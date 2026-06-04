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

/* ── API: 리더보드 (코인 순위, admin 제외, 상위 10명) ── */
app.get("/api/leaderboard", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ad.key, ad.value
      FROM app_data ad
      JOIN users u ON u.username = SUBSTRING(ad.key FROM 7)
      WHERE ad.key LIKE 'coins:%'
        AND u.role != 'admin'
      ORDER BY CAST(ad.value AS INTEGER) DESC
      LIMIT 10
    `);
    const rows = result.rows.map((r) => ({
      username: r.key.slice(6),         /* 'coins:' 접두사 제거 */
      coins:    parseInt(r.value, 10),
    }));
    res.json(rows);
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

/* ── API: 시즌 목록 조회 ────────────────────────── */
app.get("/api/seasons", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT key, value FROM app_data WHERE key LIKE 'season:%:top3' ORDER BY key ASC"
    );
    const seasons = result.rows.map((r) => ({
      season: parseInt(r.key.split(":")[1], 10),
      top3: JSON.parse(r.value),
    }));
    res.json(seasons);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 시즌 종료 (admin) ─ 코인 리셋 + 순위 기록 */
app.post("/api/season/end", requireAdmin, async (req, res) => {
  try {
    /* 현재 시즌 번호 */
    const snRes = await pool.query("SELECT value FROM app_data WHERE key='season:current'");
    const seasonNum = snRes.rows[0] ? parseInt(snRes.rows[0].value, 10) : 1;

    /* 상위 3명 (admin 제외) */
    const top3Res = await pool.query(`
      SELECT ad.key, ad.value
      FROM app_data ad
      JOIN users u ON u.username = SUBSTRING(ad.key FROM 7)
      WHERE ad.key LIKE 'coins:%' AND u.role != 'admin'
      ORDER BY CAST(ad.value AS INTEGER) DESC
      LIMIT 3
    `);
    const top3 = top3Res.rows.map((r, i) => ({
      rank:     i + 1,
      username: r.key.slice(6),
      coins:    parseInt(r.value, 10),
    }));

    /* 시즌 기록 저장 */
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [`season:${seasonNum}:top3`, JSON.stringify(top3)]
    );

    /* 다음 시즌 번호 저장 */
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ('season:current', $1)
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
      [String(seasonNum + 1)]
    );

    /* 모든 유저 코인 → 금고에 누적 후 1000으로 리셋 (admin 제외) */
    const coinsRes = await pool.query(`
      SELECT ad.key, ad.value FROM app_data ad
      JOIN users u ON u.username = SUBSTRING(ad.key FROM 7)
      WHERE ad.key LIKE 'coins:%' AND u.role != 'admin'
    `);
    await Promise.all(
      coinsRes.rows.map(async (r) => {
        const username   = r.key.slice(6);
        const earned     = parseInt(r.value, 10) || 0;
        const vaultKey   = `vault:${username}`;
        const vaultRes   = await pool.query(
          "SELECT value FROM app_data WHERE key=$1", [vaultKey]
        );
        const prevVault  = vaultRes.rows[0] ? parseInt(vaultRes.rows[0].value, 10) : 0;
        /* 금고 누적 저장 */
        await pool.query(
          `INSERT INTO app_data (key, value) VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [vaultKey, String(prevVault + earned)]
        );
        /* 코인 리셋 */
        await pool.query(
          `UPDATE app_data SET value='1000', updated_at=NOW() WHERE key=$1`,
          [r.key]
        );
      })
    );

    broadcast({ type: "season-end", season: seasonNum, top3 });
    res.json({ ok: true, season: seasonNum, top3 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 유저의 최근 티어리스트 게시물 ─────────── */
app.get("/api/tierlist/user/:username/recent", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT key, value FROM app_data
       WHERE key LIKE $1
       ORDER BY updated_at DESC LIMIT 1`,
      [`tlpost:%:${req.params.username}`]
    );
    if (!result.rows[0]) return res.json(null);
    const post = JSON.parse(result.rows[0].value);
    /* 이벤트 정보도 함께 반환 */
    const evtRes = await pool.query(
      "SELECT value FROM app_data WHERE key=$1",
      [`tlevt:${post.eventId}`]
    );
    post.event = evtRes.rows[0] ? JSON.parse(evtRes.rows[0].value) : null;
    res.json(post);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 유저의 모든 티어리스트 게시물 ─────────── */
app.get("/api/tierlist/user/:username/posts", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT key, value FROM app_data WHERE key LIKE $1 ORDER BY updated_at DESC`,
      [`tlpost:%:${req.params.username}`]
    );
    if (!result.rows.length) return res.json([]);
    const posts = result.rows.map((r) => {
      const post = JSON.parse(r.value);
      // key 형식: tlpost:{evtId}:{username}
      post.eventId = r.key.split(":")[1];
      return post;
    });
    // 이벤트 정보 병렬 fetch
    const evtIds = [...new Set(posts.map((p) => p.eventId))];
    const evtRows = await Promise.all(
      evtIds.map((id) =>
        pool.query("SELECT value FROM app_data WHERE key=$1", [`tlevt:${id}`])
      )
    );
    const evtMap = {};
    evtIds.forEach((id, i) => {
      evtMap[id] = evtRows[i].rows[0] ? JSON.parse(evtRows[i].rows[0].value) : null;
    });
    posts.forEach((p) => { p.event = evtMap[p.eventId] || null; });
    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 전체 데이터 리셋 (admin 전용) ─────────── */
app.post("/api/admin/full-reset", requireAdmin, async (req, res) => {
  try {
    // 1. 티어리스트 (이벤트, 게시물, 좋아요)
    await pool.query("DELETE FROM app_data WHERE key LIKE 'tlevt:%'");
    await pool.query("DELETE FROM app_data WHERE key LIKE 'tlpost:%'");
    await pool.query("DELETE FROM app_data WHERE key LIKE 'tllike:%'");

    // 2. 승부 예측 (매치, 베팅)
    await pool.query("DELETE FROM app_data WHERE key LIKE 'pred:match:%'");
    await pool.query("DELETE FROM app_data WHERE key LIKE 'pred:bet:%'");

    // 3. 명예의 전당 + 시즌 기록
    await pool.query("DELETE FROM app_data WHERE key LIKE 'season:%'");

    // 4. 코인 전부 삭제 (계정 삭제 후 재가입 시 자동 발급)
    await pool.query("DELETE FROM app_data WHERE key LIKE 'coins:%'");

    // 5. 출석체크 기록
    await pool.query("DELETE FROM app_data WHERE key LIKE 'attend:%'");

    // 6. Admin 제외 모든 계정 삭제
    await pool.query("DELETE FROM users WHERE role != 'admin'");

    broadcast({ type: "force-reload" });
    res.json({ ok: true });
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

/* ── API: 건의함 제출 (누구나) ──────────────────────── */
app.post("/api/suggestions", async (req, res) => {
  const text = String((req.body && req.body.text) || "").trim();
  if (!text) return res.status(400).json({ error: "내용을 입력해주세요." });
  if (text.length > 500) return res.status(400).json({ error: "500자 이하로 입력해주세요." });
  const key = `suggest:${Date.now()}`;
  try {
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify({ text, at: new Date().toISOString() })]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 건의함 목록 (Admin 전용) ───────────────────── */
app.get("/api/suggestions", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT key, value FROM app_data WHERE key LIKE 'suggest:%' ORDER BY key DESC"
    );
    res.json(result.rows.map((r) => {
      const v = JSON.parse(r.value);
      return { key: r.key, text: v.text, at: v.at };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 건의함 삭제 (Admin 전용) ───────────────────── */
app.delete("/api/suggestions/:ts", requireAdmin, async (req, res) => {
  const key = `suggest:${req.params.ts}`;
  try {
    await pool.query("DELETE FROM app_data WHERE key=$1", [key]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 금고 조회 ─────────────────────────────────── */
app.get("/api/vault", requireAuth, async (req, res) => {
  const key = `vault:${req.user.username}`;
  try {
    const result = await pool.query("SELECT value FROM app_data WHERE key=$1", [key]);
    res.json({ vault: result.rows[0] ? parseInt(result.rows[0].value, 10) : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 예측 경기 목록 ──────────────────────────── */
app.get("/api/prediction/matches", async (req, res) => {
  try {
    const [matchRes, betRes] = await Promise.all([
      pool.query("SELECT value FROM app_data WHERE key LIKE 'pred-match:%' ORDER BY updated_at DESC"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'pred-bet:%'"),
    ]);
    const betCounts = {};
    const betTotals = {};
    betRes.rows.forEach((r) => {
      const parts = r.key.split(":");
      const matchId = parts[1];
      if (!matchId) return;
      betCounts[matchId] = (betCounts[matchId] || 0) + 1;
      try {
        const b = JSON.parse(r.value);
        betTotals[matchId] = (betTotals[matchId] || 0) + (b.amount || 0);
      } catch (_) {}
    });
    const matches = matchRes.rows.map((r) => {
      const m = JSON.parse(r.value);
      m.betCount   = betCounts[m.id] || 0;
      m.totalCoins = betTotals[m.id] || 0;
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

/* ── API: 출석 체크 상태 조회 ─────────────────────── */
app.get("/api/attendance/status", requireAuth, async (req, res) => {
  const username = req.user.username;
  const kst  = new Date(Date.now() + 9 * 3600000);
  const date = kst.toISOString().slice(0, 10); // YYYY-MM-DD KST
  try {
    const result = await pool.query(
      "SELECT value FROM app_data WHERE key=$1",
      [`attend:${username}:${date}`]
    );
    res.json({ checkedIn: !!result.rows[0], date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 출석 기록 리셋 (Admin 전용) ───────────────── */
app.delete("/api/admin/attend/:username", requireAdmin, async (req, res) => {
  const username = req.params.username;
  const kst  = new Date(Date.now() + 9 * 3600000);
  const date = kst.toISOString().slice(0, 10);
  const key  = `attend:${username}:${date}`;
  try {
    await pool.query("DELETE FROM app_data WHERE key=$1", [key]);
    res.json({ ok: true, deleted: key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 출석 체크 (100코인 지급) ────────────────── */
app.post("/api/attendance", requireAuth, async (req, res) => {
  const username = req.user.username;
  const kst     = new Date(Date.now() + 9 * 3600000);
  const kstHour = kst.getUTCHours();  // KST hour (0~23)
  const date    = kst.toISOString().slice(0, 10);

  // 07:00 ~ 24:00 KST 만 허용
  if (kstHour < 7) {
    return res.status(400).json({ error: "출석체크는 오전 7시부터 가능합니다." });
  }

  const attendKey = `attend:${username}:${date}`;
  try {
    const existing = await pool.query(
      "SELECT value FROM app_data WHERE key=$1", [attendKey]
    );
    if (existing.rows[0])
      return res.status(409).json({ error: "오늘 이미 출석체크를 하셨습니다." });

    // 출석 기록
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [attendKey, "1"]
    );
    // 100코인 지급
    const coinKey = `coins:${username}`;
    const coinRes = await pool.query(
      "SELECT value FROM app_data WHERE key=$1", [coinKey]
    );
    const cur      = coinRes.rows[0] ? parseInt(coinRes.rows[0].value, 10) : 0;
    const newCoins = cur + 100;
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [coinKey, String(newCoins)]
    );
    res.json({ ok: true, coins: newCoins, bonus: 100 });
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
