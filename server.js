const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "vct-archive-jwt-secret-2026";
const ADMIN_ID = "Admin";
const ADMIN_PW = process.env.ADMIN_PW || "mnasdvoiewf23";

/* ── PostgreSQL 연결 ──────────────────────────────── */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false },
});

/* ── DB 초기화 ─────────────────────────────────────── */
async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_data (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'user',
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  /* Admin 계정 시드 (없을 때만 생성) */
  const adminHash = await bcrypt.hash(ADMIN_PW, 10);
  await pool.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES ($1, $2, 'admin')
     ON CONFLICT (username) DO NOTHING`,
    [ADMIN_ID, adminHash]
  );
  console.log("DB tables ready");
}
initDB().catch((e) => console.error("DB init error:", e.message));

/* ── 미들웨어 ─────────────────────────────────────── */
app.use(express.json());
app.use(express.static(path.join(__dirname)));

/* ── SSE: 실시간 브로드캐스트 ────────────────────── */
const sseClients = new Set();

app.get("/api/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  /* 25초마다 ping (프록시/방화벽 연결 유지) */
  const ping = setInterval(() => {
    try { res.write(": ping\n\n"); } catch (e) { cleanup(); }
  }, 25000);

  sseClients.add(res);

  function cleanup() {
    clearInterval(ping);
    sseClients.delete(res);
  }
  req.on("close", cleanup);
  req.on("error", cleanup);
});

function broadcast(payload) {
  const msg = `data: ${JSON.stringify(payload)}\n\n`;
  sseClients.forEach((client) => {
    try { client.write(msg); } catch (e) { sseClients.delete(client); }
  });
}

/* ── API: 전체 데이터 조회 ────────────────────────── */
app.get("/api/data/all", async (req, res) => {
  try {
    const result = await pool.query("SELECT key, value FROM app_data");
    const data = {};
    result.rows.forEach((row) => { data[row.key] = row.value; });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 단일 키 조회 ────────────────────────────── */
app.get("/api/data/:key", async (req, res) => {
  const key = decodeURIComponent(req.params.key);
  try {
    const result = await pool.query("SELECT value FROM app_data WHERE key=$1", [key]);
    res.json(result.rows[0]?.value ?? null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 데이터 저장 (upsert) ────────────────────── */
app.post("/api/data/:key", async (req, res) => {
  const key = decodeURIComponent(req.params.key);
  const { value } = req.body;
  if (value === undefined) return res.status(400).json({ error: "value required" });
  try {
    await pool.query(
      `INSERT INTO app_data (key, value)
       VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [key, String(value)]
    );
    /* 실시간 브로드캐스트 */
    broadcast({ type: "set", key, value: String(value) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 데이터 삭제 ─────────────────────────────── */
app.delete("/api/data/:key", async (req, res) => {
  const key = decodeURIComponent(req.params.key);
  try {
    await pool.query("DELETE FROM app_data WHERE key=$1", [key]);
    /* 실시간 브로드캐스트 */
    broadcast({ type: "delete", key });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── 인증 미들웨어 ────────────────────────────────── */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "로그인이 필요합니다." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "유효하지 않은 토큰입니다." });
  }
}
function requireAdmin(req, res, next) {
  requireAuth(req, res, function () {
    if (req.user.role !== "admin") return res.status(403).json({ error: "관리자만 접근할 수 있습니다." });
    next();
  });
}

/* ── API: 회원가입 ────────────────────────────────── */
app.post("/api/auth/register", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: "아이디와 비밀번호를 입력해 주세요." });
  if (username.length < 2 || username.length > 20)
    return res.status(400).json({ error: "아이디는 2~20자여야 합니다." });
  if (password.length < 4)
    return res.status(400).json({ error: "비밀번호는 4자 이상이어야 합니다." });
  if (username === ADMIN_ID)
    return res.status(400).json({ error: "사용할 수 없는 아이디입니다." });
  try {
    const exists = await pool.query("SELECT id FROM users WHERE username=$1", [username]);
    if (exists.rows.length > 0)
      return res.status(409).json({ error: "이미 사용 중인 아이디입니다." });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'user') RETURNING id, username, role",
      [username, hash]
    );
    const user = result.rows[0];
    /* 신규 유저 코인 지급 */
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [`coins:${user.username}`, "1000"]
    );
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

/* ── API: 로그인 ──────────────────────────────────── */
app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.status(400).json({ error: "아이디와 비밀번호를 입력해 주세요." });
  try {
    const result = await pool.query("SELECT id, username, password_hash, role FROM users WHERE username=$1", [username]);
    if (result.rows.length === 0)
      return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    const user = result.rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ error: "아이디 또는 비밀번호가 올바르지 않습니다." });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, username: user.username, role: user.role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "서버 오류가 발생했습니다." });
  }
});

/* ── API: 토큰 검증 ───────────────────────────────── */
app.get("/api/auth/me", (req, res) => {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    res.json({ username: payload.username, role: payload.role });
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

/* ── API: 티어리스트 이벤트 목록 조회 ───────────── */
app.get("/api/tierlist/events", async (req, res) => {
  try {
    const [evRes, postRes] = await Promise.all([
      pool.query("SELECT value FROM app_data WHERE key LIKE 'tlevt:%' ORDER BY updated_at DESC"),
      pool.query("SELECT key FROM app_data WHERE key LIKE 'tlpost:%'"),
    ]);
    const counts = {};
    postRes.rows.forEach((r) => {
      const parts = r.key.split(":"); // tlpost:{evtId}:{username}
      if (parts[1]) counts[parts[1]] = (counts[parts[1]] || 0) + 1;
    });
    const events = evRes.rows.map((r) => {
      const e = JSON.parse(r.value);
      e.postCount = counts[e.id] || 0;
      return e;
    });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 티어리스트 이벤트 생성/수정 (admin) ───── */
app.post("/api/tierlist/events", requireAdmin, async (req, res) => {
  const evt = req.body;
  if (!evt.id) evt.id = Date.now().toString();
  const key = `tlevt:${evt.id}`;
  try {
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [key, JSON.stringify(evt)]
    );
    broadcast({ type: "tl-event-update", event: evt });
    res.json({ ok: true, id: evt.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 티어리스트 이벤트 삭제 (admin) ─────────── */
app.delete("/api/tierlist/events/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query(
      "DELETE FROM app_data WHERE key=$1 OR key LIKE $2 OR key LIKE $3",
      [`tlevt:${id}`, `tlpost:${id}:%`, `tllike:${id}:%`]
    );
    broadcast({ type: "tl-event-delete", id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 이벤트별 게시물 조회 (좋아요 포함) ──────── */
app.get("/api/tierlist/events/:id/posts", async (req, res) => {
  try {
    const [postsRes, likesRes] = await Promise.all([
      pool.query("SELECT value FROM app_data WHERE key LIKE $1 ORDER BY updated_at DESC",
        [`tlpost:${req.params.id}:%`]),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE $1",
        [`tllike:${req.params.id}:%`]),
    ]);
    const likesMap = {};
    likesRes.rows.forEach((r) => {
      const postUser = r.key.split(":")[2]; // tllike:{evtId}:{postUser}
      if (postUser) likesMap[postUser] = JSON.parse(r.value);
    });
    const posts = postsRes.rows.map((r) => {
      const p = JSON.parse(r.value);
      p.likes = likesMap[p.username] || [];
      return p;
    });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 이벤트별 게시 (로그인 필요) ────────────── */
app.post("/api/tierlist/events/:id/posts", requireAuth, async (req, res) => {
  const evtId = req.params.id;
  const { tierData } = req.body || {};
  if (!tierData) return res.status(400).json({ error: "tierData required" });
  const username = req.user.username;
  const post = { username, tierData, eventId: evtId, createdAt: new Date().toISOString() };
  const key = `tlpost:${evtId}:${username}`;
  try {
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [key, JSON.stringify(post)]
    );
    broadcast({ type: "tl-post", eventId: evtId, post });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 이벤트별 게시물 삭제 (admin 또는 본인) ── */
app.delete("/api/tierlist/events/:id/posts/:username", requireAuth, async (req, res) => {
  const { id, username } = req.params;
  if (req.user.role !== "admin" && req.user.username !== username)
    return res.status(403).json({ error: "권한이 없습니다." });
  try {
    await pool.query("DELETE FROM app_data WHERE key=$1 OR key=$2",
      [`tlpost:${id}:${username}`, `tllike:${id}:${username}`]);
    broadcast({ type: "tl-delete", eventId: id, username });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 게시물 좋아요 토글 (로그인 필요) ──────── */
app.post("/api/tierlist/events/:id/posts/:postUser/like", requireAuth, async (req, res) => {
  const { id, postUser } = req.params;
  const liker = req.user.username;
  const key = `tllike:${id}:${postUser}`;
  try {
    const result = await pool.query("SELECT value FROM app_data WHERE key=$1", [key]);
    let likes = result.rows[0] ? JSON.parse(result.rows[0].value) : [];
    const idx = likes.indexOf(liker);
    if (idx >= 0) likes.splice(idx, 1); else likes.push(liker);
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [key, JSON.stringify(likes)]
    );
    broadcast({ type: "tl-like", eventId: id, postUser, likes });
    res.json({ ok: true, likes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 전체 뷰어 새로고침 트리거 ─────────────── */
app.post("/api/refresh", (req, res) => {
  broadcast({ type: "force-reload" });
  res.json({ ok: true });
});

/* ── API: 코인 조회 (미등록 시 1000 자동 지급) ──────── */
app.get("/api/coins", requireAuth, async (req, res) => {
  const key = `coins:${req.user.username}`;
  try {
    const result = await pool.query("SELECT value FROM app_data WHERE key=$1", [key]);
    if (!result.rows[0]) {
      await pool.query(
        `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
        [key, "1000"]
      );
      return res.json({ coins: 1000 });
    }
    res.json({ coins: parseInt(result.rows[0].value, 10) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 예측 경기 목록 ──────────────────────────── */
app.get("/api/prediction/matches", async (req, res) => {
  try {
    const [matchRes, betRes] = await Promise.all([
      pool.query("SELECT value FROM app_data WHERE key LIKE 'pred-match:%' ORDER BY updated_at DESC"),
      pool.query("SELECT key FROM app_data WHERE key LIKE 'pred-bet:%'"),
    ]);
    const betCounts = {};
    betRes.rows.forEach((r) => {
      const parts = r.key.split(":");
      if (parts[1]) betCounts[parts[1]] = (betCounts[parts[1]] || 0) + 1;
    });
    const matches = matchRes.rows.map((r) => {
      const m = JSON.parse(r.value);
      m.betCount = betCounts[m.id] || 0;
      return m;
    });
    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 예측 경기 생성 (admin) ─────────────────── */
app.post("/api/prediction/matches", requireAdmin, async (req, res) => {
  const { team1, team2, odds1, odds2, label, logo1, logo2 } = req.body || {};
  if (!team1 || !team2 || !odds1 || !odds2)
    return res.status(400).json({ error: "team1, team2, odds1, odds2 필수" });
  const id = Date.now().toString();
  const match = {
    id, label: label || "", team1, team2,
    odds1: parseFloat(odds1), odds2: parseFloat(odds2),
    logo1: logo1 || "", logo2: logo2 || "",
    status: "open", winner: null,
    createdAt: new Date().toISOString(),
  };
  try {
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [`pred-match:${id}`, JSON.stringify(match)]
    );
    broadcast({ type: "pred-match-update", match });
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 예측 경기 상태 변경 open↔closed (admin) ── */
app.patch("/api/prediction/matches/:id", requireAdmin, async (req, res) => {
  const { status } = req.body || {};
  if (!["open", "closed"].includes(status))
    return res.status(400).json({ error: "status must be open or closed" });
  const key = `pred-match:${req.params.id}`;
  try {
    const result = await pool.query("SELECT value FROM app_data WHERE key=$1", [key]);
    if (!result.rows[0]) return res.status(404).json({ error: "not found" });
    const match = JSON.parse(result.rows[0].value);
    match.status = status;
    await pool.query(
      `UPDATE app_data SET value=$2, updated_at=NOW() WHERE key=$1`,
      [key, JSON.stringify(match)]
    );
    broadcast({ type: "pred-match-update", match });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 예측 경기 삭제 (admin) ─────────────────── */
app.delete("/api/prediction/matches/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  try {
    await pool.query("DELETE FROM app_data WHERE key=$1 OR key LIKE $2",
      [`pred-match:${id}`, `pred-bet:${id}:%`]);
    broadcast({ type: "pred-match-delete", id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 배팅 (로그인 필요) ─────────────────────── */
app.post("/api/prediction/matches/:id/bet", requireAuth, async (req, res) => {
  const matchId = req.params.id;
  const username = req.user.username;
  const { team, amount } = req.body || {};
  const betAmount = parseInt(amount, 10);
  if (!team || !betAmount || betAmount < 1)
    return res.status(400).json({ error: "team과 amount(양수)가 필요합니다." });
  try {
    const matchRes = await pool.query("SELECT value FROM app_data WHERE key=$1", [`pred-match:${matchId}`]);
    if (!matchRes.rows[0]) return res.status(404).json({ error: "경기를 찾을 수 없습니다." });
    const match = JSON.parse(matchRes.rows[0].value);
    if (match.status !== "open") return res.status(400).json({ error: "배팅이 마감되었습니다." });
    if (team !== match.team1 && team !== match.team2)
      return res.status(400).json({ error: "올바른 팀을 선택해 주세요." });

    const betKey = `pred-bet:${matchId}:${username}`;
    const existing = await pool.query("SELECT value FROM app_data WHERE key=$1", [betKey]);
    if (existing.rows[0]) return res.status(409).json({ error: "이미 배팅하셨습니다." });

    const coinKey = `coins:${username}`;
    const coinRes = await pool.query("SELECT value FROM app_data WHERE key=$1", [coinKey]);
    const currentCoins = coinRes.rows[0] ? parseInt(coinRes.rows[0].value, 10) : 0;
    if (currentCoins < betAmount)
      return res.status(400).json({ error: `코인이 부족합니다. (보유: ${currentCoins})` });

    const newCoins = currentCoins - betAmount;
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [coinKey, String(newCoins)]
    );
    const bet = { username, matchId, team, amount: betAmount, createdAt: new Date().toISOString() };
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [betKey, JSON.stringify(bet)]
    );
    broadcast({ type: "pred-bet", matchId, username, team, amount: betAmount });
    res.json({ ok: true, coins: newCoins });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 정산 (admin) ──────────────────────────── */
app.post("/api/prediction/matches/:id/settle", requireAdmin, async (req, res) => {
  const matchId = req.params.id;
  const { winner } = req.body || {};
  if (!winner) return res.status(400).json({ error: "winner required" });
  try {
    const matchRes = await pool.query("SELECT value FROM app_data WHERE key=$1", [`pred-match:${matchId}`]);
    if (!matchRes.rows[0]) return res.status(404).json({ error: "not found" });
    const match = JSON.parse(matchRes.rows[0].value);
    if (match.status === "settled") return res.status(400).json({ error: "이미 정산된 경기입니다." });
    if (winner !== match.team1 && winner !== match.team2)
      return res.status(400).json({ error: "올바른 팀을 선택해 주세요." });

    const winOdds = winner === match.team1 ? match.odds1 : match.odds2;
    const betsRes = await pool.query("SELECT value FROM app_data WHERE key LIKE $1",
      [`pred-bet:${matchId}:%`]);
    for (const row of betsRes.rows) {
      const bet = JSON.parse(row.value);
      if (bet.team === winner) {
        const payout = Math.floor(bet.amount * winOdds);
        const coinKey = `coins:${bet.username}`;
        const coinRes = await pool.query("SELECT value FROM app_data WHERE key=$1", [coinKey]);
        const cur = coinRes.rows[0] ? parseInt(coinRes.rows[0].value, 10) : 0;
        await pool.query(
          `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [coinKey, String(cur + payout)]
        );
      }
    }
    match.status = "settled";
    match.winner = winner;
    await pool.query(
      `UPDATE app_data SET value=$2, updated_at=NOW() WHERE key=$1`,
      [`pred-match:${matchId}`, JSON.stringify(match)]
    );
    broadcast({ type: "pred-match-update", match });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 내 배팅 목록 (로그인 필요) ─────────────── */
app.get("/api/prediction/my-bets", requireAuth, async (req, res) => {
  const username = req.user.username;
  try {
    const result = await pool.query(
      "SELECT value FROM app_data WHERE key LIKE $1",
      [`pred-bet:%:${username}`]
    );
    res.json(result.rows.map((r) => JSON.parse(r.value)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── SPA fallback ─────────────────────────────────── */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`VCT Archive server running on port ${PORT}`);
});
