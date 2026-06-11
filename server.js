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
        AND u.role NOT IN ('admin', 'test')
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
      WHERE ad.key LIKE 'coins:%' AND u.role NOT IN ('admin', 'test')
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
      WHERE ad.key LIKE 'coins:%' AND u.role NOT IN ('admin', 'test')
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

/* ── API: 선수 이름 rename (admin 전용) ─────────── */
app.post("/api/admin/rename-player", requireAdmin, async (req, res) => {
  const { from, to } = req.body;
  if (!from || !to) return res.status(400).json({ error: "from, to 필요" });
  try {
    const prefixes = ["stock_p:", "vct_p:"];
    let renamed = [];
    for (const prefix of prefixes) {
      const oldKey = `${prefix}${from}`;
      const newKey = `${prefix}${to}`;
      // 기존 키 조회 (대소문자 무관)
      const found = await pool.query(
        "SELECT key, value FROM app_data WHERE lower(key)=lower($1)",
        [oldKey]
      );
      if (found.rows.length === 0) continue;
      const { key: realOldKey, value } = found.rows[0];
      // 새 키가 이미 있으면 덮어쓰기, 없으면 insert
      await pool.query(
        `INSERT INTO app_data (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [newKey, value]
      );
      // 구 키 삭제
      await pool.query("DELETE FROM app_data WHERE key=$1", [realOldKey]);
      renamed.push({ from: realOldKey, to: newKey });
    }
    res.json({ ok: true, renamed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── API: 선수 데이터 삭제 (admin 전용) ─────────── */
app.post("/api/admin/delete-player", requireAdmin, async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name 필요" });
  try {
    const prefixes = ["stock_p:", "vct_p:"];
    let deleted = [];
    for (const prefix of prefixes) {
      const key = `${prefix}${name}`;
      const r = await pool.query(
        "DELETE FROM app_data WHERE lower(key)=lower($1) RETURNING key",
        [key]
      );
      if (r.rows.length > 0) deleted.push(r.rows[0].key);
    }
    res.json({ ok: true, deleted });
  } catch (e) {
    res.status(500).json({ error: e.message });
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

    // 5-1. 보유 주식 초기화
    await pool.query("DELETE FROM app_data WHERE key LIKE 'holdings:%'");

    // 6. Admin·test 제외 모든 계정 삭제
    await pool.query("DELETE FROM users WHERE role NOT IN ('admin', 'test')");

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

/* ── API: 보유 주식 조회 ────────────────────────────── */
app.get("/api/stock/holdings", requireAuth, async (req, res) => {
  const key = `holdings:${req.user.username}`;
  try {
    const result = await pool.query("SELECT value FROM app_data WHERE key=$1", [key]);
    const holdings = result.rows[0] ? JSON.parse(result.rows[0].value) : {};
    res.json({ holdings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 주식 매수 ─────────────────────────────────── */
app.post("/api/stock/buy", requireAuth, async (req, res) => {
  const { playerName, qty, price } = req.body || {};
  const qtyN = parseInt(qty, 10), priceN = parseInt(price, 10);
  if (!playerName || qtyN < 1 || priceN < 1)
    return res.status(400).json({ error: "잘못된 요청입니다." });

  const username    = req.user.username;
  const coinKey     = `coins:${username}`;
  const holdingsKey = `holdings:${username}`;
  const total       = priceN * qtyN;

  try {
    const coinRes    = await pool.query("SELECT value FROM app_data WHERE key=$1", [coinKey]);
    const curCoins   = coinRes.rows[0] ? parseInt(coinRes.rows[0].value, 10) : 1000;
    if (curCoins < total)
      return res.status(400).json({ error: "코인이 부족합니다." });

    const holdRes  = await pool.query("SELECT value FROM app_data WHERE key=$1", [holdingsKey]);
    const holdings = holdRes.rows[0] ? JSON.parse(holdRes.rows[0].value) : {};

    /* 평균 단가 갱신 */
    if (holdings[playerName]) {
      const old    = holdings[playerName];
      const newQty = old.qty + qtyN;
      holdings[playerName] = {
        qty:      newQty,
        avgPrice: Math.round((old.avgPrice * old.qty + priceN * qtyN) / newQty),
      };
    } else {
      holdings[playerName] = { qty: qtyN, avgPrice: priceN };
    }

    const newCoins = curCoins - total;
    await pool.query(
      `INSERT INTO app_data (key,value) VALUES ($1,$2)
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [coinKey, String(newCoins)]
    );
    await pool.query(
      `INSERT INTO app_data (key,value) VALUES ($1,$2)
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [holdingsKey, JSON.stringify(holdings)]
    );
    res.json({ ok: true, coins: newCoins, holdings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 주식 매도 ─────────────────────────────────── */
app.post("/api/stock/sell", requireAuth, async (req, res) => {
  const { playerName, qty, price } = req.body || {};
  const qtyN = parseInt(qty, 10), priceN = parseInt(price, 10);
  if (!playerName || qtyN < 1 || priceN < 1)
    return res.status(400).json({ error: "잘못된 요청입니다." });

  const username    = req.user.username;
  const coinKey     = `coins:${username}`;
  const holdingsKey = `holdings:${username}`;
  const total       = priceN * qtyN;

  try {
    const holdRes  = await pool.query("SELECT value FROM app_data WHERE key=$1", [holdingsKey]);
    const holdings = holdRes.rows[0] ? JSON.parse(holdRes.rows[0].value) : {};

    const cur = holdings[playerName];
    if (!cur || cur.qty < qtyN)
      return res.status(400).json({ error: "보유 수량이 부족합니다." });

    const coinRes  = await pool.query("SELECT value FROM app_data WHERE key=$1", [coinKey]);
    const curCoins = coinRes.rows[0] ? parseInt(coinRes.rows[0].value, 10) : 1000;
    const newCoins = curCoins + total;

    const newQty = cur.qty - qtyN;
    if (newQty === 0) delete holdings[playerName];
    else holdings[playerName] = { qty: newQty, avgPrice: cur.avgPrice };

    await pool.query(
      `INSERT INTO app_data (key,value) VALUES ($1,$2)
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [coinKey, String(newCoins)]
    );
    await pool.query(
      `INSERT INTO app_data (key,value) VALUES ($1,$2)
       ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [holdingsKey, JSON.stringify(holdings)]
    );
    res.json({ ok: true, coins: newCoins, holdings });
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
  const { team1, team2, odds1, odds2, label, logo1, logo2, deadline } = req.body || {};
  if (!team1 || !team2 || !odds1 || !odds2)
    return res.status(400).json({ error: "team1, team2, odds1, odds2 필수" });
  const id = Date.now().toString();
  const match = {
    id, label: label || "", team1, team2,
    odds1: parseFloat(odds1), odds2: parseFloat(odds2),
    logo1: logo1 || "", logo2: logo2 || "",
    status: "open", winner: null,
    createdAt: new Date().toISOString(),
    deadline: deadline || null,
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
  const { status, odds1, odds2 } = req.body || {};
  const key = `pred-match:${req.params.id}`;
  try {
    const result = await pool.query("SELECT value FROM app_data WHERE key=$1", [key]);
    if (!result.rows[0]) return res.status(404).json({ error: "not found" });
    const match = JSON.parse(result.rows[0].value);

    /* status 변경 */
    if (status !== undefined) {
      if (!["open", "closed"].includes(status))
        return res.status(400).json({ error: "status must be open or closed" });
      match.status = status;
    }

    /* 배당률 변경 (open 상태일 때만) */
    if (odds1 !== undefined || odds2 !== undefined) {
      if (match.status !== "open")
        return res.status(400).json({ error: "배당률은 배팅 진행 중인 경기에서만 수정할 수 있습니다." });
      const o1 = parseFloat(odds1);
      const o2 = parseFloat(odds2);
      if (isNaN(o1) || isNaN(o2) || o1 < 1.01 || o2 < 1.01)
        return res.status(400).json({ error: "배당률은 1.01 이상이어야 합니다." });
      match.odds1 = o1;
      match.odds2 = o2;
    }

    await pool.query(
      `UPDATE app_data SET value=$2, updated_at=NOW() WHERE key=$1`,
      [key, JSON.stringify(match)]
    );
    broadcast({ type: "pred-match-update", match });
    res.json({ ok: true, match });
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
    if (match.deadline && new Date() > new Date(match.deadline))
      return res.status(400).json({ error: "배팅 마감 시각이 지났습니다." });
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

/* ── API: 공지사항 목록 ────────────────────────────── */
app.get("/api/notices", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT value FROM app_data WHERE key LIKE 'notice:%' ORDER BY updated_at DESC"
    );
    res.json(result.rows.map((r) => JSON.parse(r.value)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 공지사항 등록 (admin) ─────────────────────── */
app.post("/api/notices", requireAdmin, async (req, res) => {
  const { title, content } = req.body || {};
  if (!title || !content)
    return res.status(400).json({ error: "title, content 필수" });
  const id = Date.now().toString();
  const notice = { id, title, content, createdAt: new Date().toISOString() };
  try {
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [`notice:${id}`, JSON.stringify(notice)]
    );
    broadcast({ type: "notice-new", notice });
    res.json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 공지사항 삭제 (admin) ─────────────────────── */
app.delete("/api/notices/:id", requireAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM app_data WHERE key=$1", [`notice:${req.params.id}`]);
    broadcast({ type: "notice-delete", id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: thespike.gg 경기 데이터 프록시 (admin) ────── */
app.get("/api/spike-match/:id", requireAdmin, async (req, res) => {
  const matchId = req.params.id;
  const teamA   = (req.query.teamA || "").trim();
  const teamB   = (req.query.teamB || "").trim();

  function norm(s) { return (s || "").toLowerCase().replace(/\s+/g, ""); }

  try {
    const r = await fetch(`https://api.thespike.gg/match/${matchId}/stats`);
    if (!r.ok) return res.status(r.status).json({ error: `thespike API ${r.status}` });
    const data = await r.json();
    const rawMaps = (data.maps || []).filter(m =>
      (m.players || []).some(p => p.averageCombatScore > 0)
    );

    const result = rawMaps.map((map, mapIdx) => {
      const players = map.players || [];

      /* 어느 팀이 A/B인지 결정 */
      const titles = [...new Set(players.map(p => p.teamTitle).filter(Boolean))];
      let sideA = titles[0] || "", sideB = titles[1] || "";
      if (teamA) {
        const matchedA = titles.find(t => norm(t) === norm(teamA)) || titles[0];
        const matchedB = titles.find(t => t !== matchedA) || titles[1];
        sideA = matchedA || sideA;
        sideB = matchedB || sideB;
      }

      const filterSide = (side, max) =>
        players
          .filter(p => norm(p.teamTitle) === norm(side) && p.averageCombatScore > 0)
          .sort((a, b) => b.averageCombatScore - a.averageCombatScore)
          .slice(0, max);

      const playersA = filterSide(sideA, 5);
      const playersB = filterSide(sideB, 5);

      const playersData = {};
      playersA.forEach((p, i) => {
        playersData[`a${i}`] = {
          name  : p.nickname,
          agent : AGENT_EN_TO_KO[p.agents?.[0]?.title] || p.agents?.[0]?.title || "",
          acs   : p.averageCombatScore,
          kda   : `${p.kills}/${p.deaths}/${p.assists}`,
        };
      });
      playersB.forEach((p, i) => {
        playersData[`b${i}`] = {
          name  : p.nickname,
          agent : AGENT_EN_TO_KO[p.agents?.[0]?.title] || p.agents?.[0]?.title || "",
          acs   : p.averageCombatScore,
          kda   : `${p.kills}/${p.deaths}/${p.assists}`,
        };
      });

      /* 라운드 데이터 ── teamIdMap 빌드 (여러 필드 시도) */
      const rawRounds = map.rounds || [];
      const teamIdMap = {};

      // 1단계: 플레이어의 여러 ID 필드를 시도
      const ID_FIELDS = ["participantId", "teamId", "organizationId", "teamParticipantId"];
      for (const field of ID_FIELDS) {
        players.forEach(p => {
          const val = p[field];
          if (val == null) return;
          const id = String(val);
          if (norm(p.teamTitle) === norm(sideA)) teamIdMap[id] = "a";
          else if (norm(p.teamTitle) === norm(sideB)) teamIdMap[id] = "b";
        });
        // 이 필드로 빌드된 teamIdMap이 실제 라운드 ID와 매칭되는지 확인
        if (rawRounds.length > 0) {
          const r0 = rawRounds[0];
          if (teamIdMap[String(r0.attackingTeamId)] || teamIdMap[String(r0.winningTeamId)]) break;
        } else break;
        // 매칭 안 되면 초기화 후 다음 필드 시도
        Object.keys(teamIdMap).forEach(k => delete teamIdMap[k]);
      }

      // 2단계: 그래도 안 되면 라운드의 고유 팀 ID를 플레이어 전체 필드 브루트포스로 매핑
      if (rawRounds.length > 0 && !teamIdMap[String(rawRounds[0].attackingTeamId)]) {
        const roundTeamIds = [...new Set(
          rawRounds.flatMap(r => [r.attackingTeamId, r.winningTeamId].filter(v => v != null).map(String))
        )];
        if (roundTeamIds.length >= 2) {
          const sampleA = players.find(p => norm(p.teamTitle) === norm(sideA));
          const sampleB = players.find(p => norm(p.teamTitle) === norm(sideB));
          if (sampleA) {
            for (const [k, v] of Object.entries(sampleA)) {
              if (roundTeamIds.includes(String(v))) {
                teamIdMap[String(v)] = "a";
                const other = roundTeamIds.find(id => id !== String(v));
                if (other) teamIdMap[other] = "b";
                break;
              }
            }
          } else if (sampleB) {
            for (const [k, v] of Object.entries(sampleB)) {
              if (roundTeamIds.includes(String(v))) {
                teamIdMap[String(v)] = "b";
                const other = roundTeamIds.find(id => id !== String(v));
                if (other) teamIdMap[other] = "a";
                break;
              }
            }
          }
        }
      }

      console.log(`[spike-match] map ${mapIdx} teamIdMap:`, teamIdMap,
        "round0:", rawRounds[0] ? { atk: rawRounds[0].attackingTeamId, win: rawRounds[0].winningTeamId } : "none");

      let firstAttacker = null;
      if (rawRounds.length > 0) {
        firstAttacker = teamIdMap[String(rawRounds[0].attackingTeamId)] || null;
      }

      const roundsArr = rawRounds.map(r => {
        const atkSide = teamIdMap[String(r.attackingTeamId)];
        const winSide = teamIdMap[String(r.winningTeamId)];
        if (!atkSide || !winSide) return { winner: null, type: null };
        const atkWon = winSide === atkSide;
        let type;
        if (atkWon) {
          type = r.winningAction === 1 ? "attack_spike" : "attack_kill";
        } else {
          switch (r.winningAction) {
            case 2: type = "def_defuse";  break;
            case 3: type = "def_kill";    break;
            case 4: type = "def_timeout"; break;
            default: type = "def_kill";
          }
        }
        return { winner: winSide, type };
      });

      const aScore = roundsArr.filter(r => r.winner === "a").length;
      const bScore = roundsArr.filter(r => r.winner === "b").length;

      // 디버그: teamIdMap이 비어 있을 경우 플레이어 샘플 & 라운드 샘플 반환
      const _dbg = Object.keys(teamIdMap).length === 0 ? {
        samplePlayerKeys: Object.keys(players[0] || {}),
        round0Raw: rawRounds[0] || null,
      } : undefined;

      return {
        mapIdx,
        title   : MAP_EN_TO_KO[map.title] || map.title || `Map ${mapIdx + 1}`,
        titleEn : map.title || "",
        teamATitle: sideA,
        teamBTitle: sideB,
        aScore, bScore, firstAttacker,
        players : playersData,
        rounds  : roundsArr,
        ..._dbg && { _debug: _dbg },
      };
    });

    res.json({ maps: result });
  } catch (err) {
    console.error("[spike-match] 오류:", err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ── SPA fallback ─────────────────────────────────── */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* ── API: 자동입력 활성화 (admin) ─────────────────── */
app.put("/api/auto-match", requireAdmin, async (req, res) => {
  const { matchKey, team1, team2 } = req.body || {};
  if (!matchKey || !team1 || !team2)
    return res.status(400).json({ error: "matchKey, team1, team2 필수" });
  const record = { matchKey, team1, team2, active: true, thespikeMatchId: null, filledMaps: [] };
  try {
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
      [`auto-match:${matchKey}`, JSON.stringify(record)]
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete("/api/auto-match/:matchKey", requireAdmin, async (req, res) => {
  try {
    const key = `auto-match:${decodeURIComponent(req.params.matchKey)}`;
    await pool.query("DELETE FROM app_data WHERE key=$1", [key]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get("/api/auto-match", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM app_data WHERE key LIKE 'auto-match:%'");
    res.json(result.rows.map((r) => JSON.parse(r.value)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* ══════════════════════════════════════════════════════
   자동 주가 업데이트 — thespike.gg API 폴링
   감시 대상: VCT 2026 메인 이벤트 (챌린저스 제외)
   주기: 5분마다
   ══════════════════════════════════════════════════════ */

const WATCHED_EVENT_IDS = [
  4148, // Masters London 2026
  4157, // Americas Stage 2
  4158, // EMEA Stage 2
  4159, // China Stage 2
  4160, // Pacific Stage 2
];

/* 처리 완료 맵 추적: { "matchId": [mapId, ...] }
   맵 단위로 추적 — 경기 중간에 끝난 맵부터 바로 반영 */
let processedMaps = {};

/* DB에서 stock_p:{name} 읽기 — 대소문자 무관 조회 후 정확한 키 반환 */
async function getStockState(playerName) {
  /* 1) 정확한 키로 먼저 시도 */
  const key = `stock_p:${playerName}`;
  const res = await pool.query("SELECT value FROM app_data WHERE key=$1", [key]);
  if (res.rows[0]) {
    try { return { state: JSON.parse(res.rows[0].value), resolvedKey: key }; } catch { return null; }
  }
  /* 2) 대소문자 무관 fallback */
  const res2 = await pool.query(
    "SELECT key, value FROM app_data WHERE lower(key)=lower($1) AND key LIKE 'stock_p:%'",
    [key]
  );
  if (!res2.rows[0]) return null;
  try { return { state: JSON.parse(res2.rows[0].value), resolvedKey: res2.rows[0].key }; } catch { return null; }
}

/* DB에 stock_p:{name} 저장 + SSE 브로드캐스트 */
async function saveStockState(playerName, state, resolvedKey) {
  const key   = resolvedKey || `stock_p:${playerName}`;
  const value = JSON.stringify(state);
  await pool.query(
    `INSERT INTO app_data (key, value)
     VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
    [key, value]
  );
  broadcast({ type: "set", key, value });
}

/* vct_p:{name} 에서 평균 ACS 계산 → 초기 stock_p 세팅 (버튼과 동일 로직) */
async function initStockFromVctP(playerName, fallbackAcs) {
  const vctKey = `vct_p:${playerName}`;
  /* 대소문자 무관 조회 */
  const res = await pool.query(
    "SELECT key, value FROM app_data WHERE lower(key)=lower($1)",
    [vctKey]
  );
  let resolvedPlayerName = playerName;
  let avgAcs = fallbackAcs || 200;

  if (res.rows[0]) {
    resolvedPlayerName = res.rows[0].key.slice(6); /* "vct_p:" 이후 */
    let vctData;
    try { vctData = JSON.parse(res.rows[0].value); } catch { vctData = {}; }
    const maps = vctData.maps || [];
    let total = 0, cnt = 0;
    maps.forEach(m => {
      const lg = m.league || "";
      if (!["americas","emea","pacific","cn","masters","champions"].includes(lg)) return;
      const a = parseFloat(m.acs) || 0;
      if (a > 0) { total += a; cnt++; }
    });
    if (cnt > 0) avgAcs = Math.round(total / cnt);
  } else if (!fallbackAcs) {
    return null; /* vct_p도 없고 fallback도 없으면 포기 */
  }

  const initPrice = Math.max(1, Math.round(avgAcs / 10));
  return { state: { price: initPrice, ref: avgAcs, history: [initPrice], runTotal: 0, runCount: 0 },
           resolvedKey: `stock_p:${resolvedPlayerName}` };
}

/* 선수 한 명의 주가 적용 */
async function applyAcsToStock(playerName, newAcs) {
  let found = await getStockState(playerName);
  const isNew = !found;
  /* stock_p 없으면 vct_p 기록으로 초기화, vct_p도 없으면 현재 ACS로 초기화 */
  if (!found) found = await initStockFromVctP(playerName, newAcs);
  if (!found) return;

  const { state, resolvedKey } = found;

  /* 신규 선수: 초기 상태를 DB에 저장하고 종료 (ref === newAcs 이므로 변동 없음) */
  if (isNew) {
    await saveStockState(playerName, state, resolvedKey);
    console.log(`[stock] ${resolvedKey}: 신규 등록 가격=${state.price} (ACS ${newAcs})`);
    return;
  }

  /* 이미 동일 ACS로 반영된 경우 중복 방지 */
  if (newAcs === state.ref) {
    console.log(`[stock] ${playerName}: ACS ${newAcs} 이미 반영됨 — 건너뜀`);
    return;
  }

  const pctChange = (newAcs - state.ref) / state.ref;
  const newPrice  = Math.max(1, Math.round(state.price * (1 + pctChange)));
  const newState  = {
    ...state,
    price    : newPrice,
    ref      : newAcs,
    history  : [...(state.history || []), newPrice].slice(-200),
    runTotal : (state.runTotal || 0) + newAcs,
    runCount : (state.runCount || 0) + 1,
  };
  await saveStockState(playerName, newState, resolvedKey);
  console.log(`[stock] ${resolvedKey}: ACS ${newAcs} → 가격 ${state.price}→${newPrice} (${pctChange >= 0 ? "+" : ""}${(pctChange * 100).toFixed(1)}%)`);
}

/* 매치 한 건 처리 — 완료된 맵만 골라서 적용 */
async function processMatch(matchId) {
  try {
    const res  = await fetch(`https://api.thespike.gg/match/${matchId}/stats`);
    if (!res.ok) return;
    const data = await res.json();
    const maps = data.maps || [];

    if (!processedMaps[matchId]) processedMaps[matchId] = [];
    const done = processedMaps[matchId];

    let newMapCount = 0;
    for (const map of maps) {
      const mapId   = map.id;
      const players = map.players || [];

      /* 이미 처리한 맵이면 skip */
      if (done.includes(mapId)) continue;

      /* 플레이어 ACS 데이터가 없으면 아직 끝나지 않은 맵 */
      const hasData = players.some(p => typeof p.averageCombatScore === "number" && p.averageCombatScore > 0);
      if (!hasData) continue;

      /* 새로 완료된 맵 — 주가 적용 */
      console.log(`[stock] 매치 ${matchId} / 맵 ${map.title || mapId} 완료 감지`);
      for (const p of players) {
        if (p.nickname && typeof p.averageCombatScore === "number") {
          await applyAcsToStock(p.nickname, p.averageCombatScore);
        }
      }
      done.push(mapId);
      newMapCount++;
    }

    if (newMapCount > 0) {
      console.log(`[stock] 매치 ${matchId}: ${newMapCount}개 맵 신규 처리`);
    }
  } catch (e) {
    console.error(`[stock] 매치 ${matchId} 처리 오류:`, e.message);
  }
}

/* 폴링 메인 함수 — 진행 중인 경기도 포함 */
async function pollVctMatches() {
  const allEventMatches = {}; /* eventId → matches[] — auto-match에도 재사용 */

  for (const eventId of WATCHED_EVENT_IDS) {
    try {
      const res  = await fetch(`https://api.thespike.gg/matches?eventId=${eventId}`);
      if (!res.ok) continue;
      const data = await res.json();
      const matches = Array.isArray(data) ? data : (data.matches || data.data || []);
      allEventMatches[eventId] = matches;

      for (const match of matches) {
        const id = match.id;
        if (!id) continue;

        /* 완전히 끝난 매치 + 모든 맵 처리 완료 → skip */
        if (match.isFinished) {
          const done = processedMaps[id] || [];
          if (done.length > 0) continue;
        }

        await processMatch(id);
      }
    } catch (e) {
      console.error(`[stock] eventId ${eventId} 폴링 오류:`, e.message);
    }
  }

  /* auto-match 경기 입력 처리 */
  await pollAutoMatches(allEventMatches);
}

/* 서버 재시작 시 처리 완료 맵 복원 */
async function initProcessedMaps() {
  try {
    const res = await pool.query("SELECT value FROM app_data WHERE key='stock:processed_maps'");
    if (res.rows[0]) {
      processedMaps = JSON.parse(res.rows[0].value);
      const total = Object.values(processedMaps).reduce((s, v) => s + v.length, 0);
      console.log(`[stock] 처리 완료 맵 ${total}건 복원`);
    }
  } catch (e) {
    console.error("[stock] 처리 완료 맵 복원 오류:", e.message);
  }
}

/* 처리 완료 맵을 DB에 주기적으로 저장 */
async function saveProcessedMaps() {
  try {
    await pool.query(
      `INSERT INTO app_data (key, value)
       VALUES ('stock:processed_maps', $1)
       ON CONFLICT (key) DO UPDATE SET value=$1, updated_at=NOW()`,
      [JSON.stringify(processedMaps)]
    );
  } catch (e) {
    console.error("[stock] 처리 완료 맵 저장 오류:", e.message);
  }
}

/* ── 자동 경기 입력 (Auto-match) ────────────────────────
   match-dark 페이지에서 ON된 경기를 thespike.gg에서 찾아
   K/D/A·ACS·에이전트를 자동으로 DB에 저장
   ──────────────────────────────────────────────────── */

/* 에이전트 영어 → 한국어 매핑 */
const AGENT_EN_TO_KO = {
  "Brimstone":"브림스톤","Viper":"바이퍼","Omen":"오멘","Killjoy":"킬조이",
  "Cypher":"사이퍼","Sova":"소바","Sage":"세이지","Phoenix":"피닉스",
  "Jett":"제트","Reyna":"레이나","Raze":"레이즈","Breach":"브리치",
  "Skye":"스카이","Yoru":"요루","Astra":"아스트라","KAY/O":"케이오",
  "Chamber":"체임버","Neon":"네온","Fade":"페이드","Harbor":"하버",
  "Gekko":"게코","Deadlock":"데드록","Iso":"아이소","Clove":"클로브",
  "Vyse":"바이스","Tejo":"테호","Waylay":"웨이레이","Gecko":"게코",
  "Mix":"믹스",
};

/* 맵 영어 → 한국어 매핑 */
const MAP_EN_TO_KO = {
  "Ascent":"어센트","Bind":"바인드","Split":"스플릿","Sunset":"선셋",
  "Abyss":"어비스","Pearl":"펄","Breeze":"브리즈","Haven":"헤이븐",
  "Fracture":"프랙처","Lotus":"로터스","Icebox":"아이스박스","Corrode":"코로드",
};

function normalizeTeamName(name) {
  return (name || "").toLowerCase().replace(/\s+/g, "");
}

async function pollAutoMatches(allEventMatches) {
  try {
    const result = await pool.query("SELECT key, value FROM app_data WHERE key LIKE 'auto-match:%'");
    const autoMatches = result.rows.map((r) => JSON.parse(r.value)).filter((m) => m.active);
    if (!autoMatches.length) return;

    for (const am of autoMatches) {
      try {
        /* thespike 매치 ID 찾기 (이미 알고 있으면 skip) */
        let tsMatchId = am.thespikeMatchId;
        if (!tsMatchId) {
          for (const matches of Object.values(allEventMatches)) {
            const found = matches.find((m) => {
              const teams = (m.teams || []).map((t) => normalizeTeamName(t.title || ""));
              return teams.includes(normalizeTeamName(am.team1)) &&
                     teams.includes(normalizeTeamName(am.team2));
            });
            if (found) { tsMatchId = found.id; break; }
          }
          if (!tsMatchId) continue; // 아직 thespike에 없음

          /* 찾은 matchId 저장 */
          am.thespikeMatchId = tsMatchId;
          await pool.query(
            `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
            [`auto-match:${am.matchKey}`, JSON.stringify(am)]
          );
        }

        /* 맵별 스탯 가져와서 저장 */
        const statsRes = await fetch(`https://api.thespike.gg/match/${tsMatchId}/stats`);
        if (!statsRes.ok) continue;
        const statsData = await statsRes.json();
        const maps = statsData.maps || [];

        for (let mapIdx = 0; mapIdx < maps.length; mapIdx++) {
          const map = maps[mapIdx];
          if ((am.filledMaps || []).includes(map.id)) continue;
          const players = map.players || [];
          /* ACS는 맵 종료 후에만 채워지므로 완료 판단으로 유효 */
          if (!players.some((p) => p.averageCombatScore > 0)) continue; // 미완료 맵

          /* ACS > 0인 선수만 (서브/미출전 로스터 제외), ACS 내림차순 정렬 후 5명으로 제한 */
          const teamAPlayers = players
            .filter((p) => normalizeTeamName(p.teamTitle) === normalizeTeamName(am.team1) && p.averageCombatScore > 0)
            .sort((a, b) => b.averageCombatScore - a.averageCombatScore)
            .slice(0, 5);
          const teamBPlayers = players
            .filter((p) => normalizeTeamName(p.teamTitle) === normalizeTeamName(am.team2) && p.averageCombatScore > 0)
            .sort((a, b) => b.averageCombatScore - a.averageCombatScore)
            .slice(0, 5);

          const playersData = {};
          teamAPlayers.forEach((p, i) => {
            playersData[`a${i}`] = {
              name  : p.nickname,
              agent : AGENT_EN_TO_KO[p.agents?.[0]?.title] || p.agents?.[0]?.title || "",
              acs   : p.averageCombatScore,
              kda   : `${p.kills}/${p.deaths}/${p.assists}`,
            };
          });
          teamBPlayers.forEach((p, i) => {
            playersData[`b${i}`] = {
              name  : p.nickname,
              agent : AGENT_EN_TO_KO[p.agents?.[0]?.title] || p.agents?.[0]?.title || "",
              acs   : p.averageCombatScore,
              kda   : `${p.kills}/${p.deaths}/${p.assists}`,
            };
          });

          const playersKey = `players:${am.matchKey}:${mapIdx}`;
          const playersVal = JSON.stringify(playersData);
          await pool.query(
            `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
            [playersKey, playersVal]
          );
          broadcast({ type: "set", key: playersKey, value: playersVal });

          /* ── vct_p: 서버 저장 (클라이언트 미열람 시에도 주가 반영 가능하도록) ── */
          for (const p of [...teamAPlayers, ...teamBPlayers]) {
            if (!p.nickname || !(p.averageCombatScore > 0)) continue;
            const vk = `vct_p:${p.nickname}`;
            const vRow = await pool.query("SELECT value FROM app_data WHERE lower(key)=lower($1)", [vk]);
            let vData = {};
            let vKey = vk;
            if (vRow.rows[0]) {
              vKey = vRow.rows[0].key;
              try { vData = JSON.parse(vRow.rows[0].value); } catch {}
            }
            if (!vData.maps) vData.maps = [];
            /* 이미 이 맵 항목이 있으면 덮어쓰기, 없으면 추가 */
            const existIdx = vData.maps.findIndex(m => m.matchKey === am.matchKey && m.mapIdx === mapIdx);
            const entry = {
              matchKey : am.matchKey,
              mapIdx,
              league   : am.league || "",
              acs      : p.averageCombatScore,
              kda      : `${p.kills}/${p.deaths}/${p.assists}`,
              agent    : AGENT_EN_TO_KO[p.agents?.[0]?.title] || p.agents?.[0]?.title || "",
            };
            if (existIdx >= 0) vData.maps[existIdx] = entry;
            else vData.maps.push(entry);
            const vVal = JSON.stringify(vData);
            await pool.query(
              `INSERT INTO app_data (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
              [vKey, vVal]
            );
            broadcast({ type: "set", key: vKey, value: vVal });
          }

          /* ── 선수 주식 즉시 반영 (processMatch가 이미 처리한 맵은 skip) ── */
          if (!(processedMaps[tsMatchId] || []).includes(map.id)) {
            for (const p of players) {
              if (p.nickname && typeof p.averageCombatScore === "number" && p.averageCombatScore > 0) {
                await applyAcsToStock(p.nickname, p.averageCombatScore);
              }
            }
            if (!processedMaps[tsMatchId]) processedMaps[tsMatchId] = [];
            processedMaps[tsMatchId].push(map.id);
          }

          /* ── 라운드 결과 & 스코어 자동 입력 ─────────────────────── */
          try {
            /* teamId → "a" | "b" 매핑 (ACS > 0인 실제 출전 선수만으로 팀 판별) */
            const teamIdMap = {}; // teamId -> "a" | "b"
            players.forEach((p) => {
              if (p.teamId == null || p.averageCombatScore <= 0) return;
              const id = String(p.teamId);
              if (normalizeTeamName(p.teamTitle) === normalizeTeamName(am.team1)) teamIdMap[id] = "a";
              else if (normalizeTeamName(p.teamTitle) === normalizeTeamName(am.team2)) teamIdMap[id] = "b";
            });

            const rawRounds = map.rounds || [];

            /* firstAttacker: 라운드1 공격팀이 team A이면 "a", B이면 "b" */
            let firstAttacker = null;
            if (rawRounds.length > 0) {
              const r1 = rawRounds[0];
              firstAttacker = teamIdMap[String(r1.attackingTeamId)] || null;
            }

            /* 라운드별 winner/type 변환 */
            const roundsArr = rawRounds.map((r) => {
              const atkSide = teamIdMap[String(r.attackingTeamId)]; // "a" | "b"
              const defSide = atkSide === "a" ? "b" : "a";
              const winSide = teamIdMap[String(r.winningTeamId)];
              if (!atkSide || !winSide) return { winner: null, type: null };

              const atkWon = winSide === atkSide;
              let type;
              if (atkWon) {
                // 공격팀 승리
                type = r.winningAction === 1 ? "attack_spike" : "attack_kill";
              } else {
                // 수비팀 승리
                switch (r.winningAction) {
                  case 2: type = "def_defuse";  break; // 스파이크 해체
                  case 3: type = "def_kill";    break; // 수비 처치 (공격팀 전멸)
                  case 4: type = "def_timeout"; break; // 설치 실패
                  default: type = "def_kill";
                }
              }
              return { winner: winSide, type };
            });

            /* 스코어 계산 */
            const aScore = roundsArr.filter((r) => r.winner === "a").length;
            const bScore = roundsArr.filter((r) => r.winner === "b").length;

            /* rounds 저장 & broadcast */
            const roundsKey = `rounds:${am.matchKey}:${mapIdx}`;
            const roundsVal = JSON.stringify(roundsArr);
            await pool.query(
              `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
              [roundsKey, roundsVal]
            );
            broadcast({ type: "set", key: roundsKey, value: roundsVal });

            /* stats 저장 (기존 teamStats 보존, 스코어+firstAttacker만 갱신) */
            const statsKey = `stats:${am.matchKey}:${mapIdx}`;
            let existingStats = { teamStats: [] };
            try {
              const sr = await pool.query("SELECT value FROM app_data WHERE key=$1", [statsKey]);
              if (sr.rows.length > 0) existingStats = JSON.parse(sr.rows[0].value);
            } catch (_) {}
            existingStats.aScore       = aScore;
            existingStats.bScore       = bScore;
            existingStats.firstAttacker = firstAttacker;
            const statsVal = JSON.stringify(existingStats);
            await pool.query(
              `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
              [statsKey, statsVal]
            );
            broadcast({ type: "set", key: statsKey, value: statsVal });
          } catch (roundErr) {
            console.error(`[auto-match] 라운드 처리 오류:`, roundErr.message);
          }

          broadcast({ type: "auto-match-filled", matchKey: am.matchKey, mapIdx,
                      mapName: MAP_EN_TO_KO[map.title] || map.title || "" });

          if (!am.filledMaps) am.filledMaps = [];
          am.filledMaps.push(map.id);
          console.log(`[auto-match] ${am.team1} vs ${am.team2} 맵${mapIdx+1}(${map.title}) 자동 입력 완료`);
        }

        /* filledMaps 업데이트 저장 */
        await pool.query(
          `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [`auto-match:${am.matchKey}`, JSON.stringify(am)]
        );
      } catch (e) {
        console.error(`[auto-match] ${am.team1} vs ${am.team2} 오류:`, e.message);
      }
    }
  } catch (e) {
    console.error("[auto-match] 전체 오류:", e.message);
  }
}

app.listen(PORT, async () => {
  console.log(`VCT Archive server running on port ${PORT}`);

  /* ── 테스트 계정 자동 생성 (없을 때만) ── */
  try {
    const exists = await pool.query("SELECT id FROM users WHERE username='test'");
    if (exists.rows.length === 0) {
      const hash = await bcrypt.hash("cos070719!!", 10);
      await pool.query(
        "INSERT INTO users (username, password_hash, role) VALUES ('test', $1, 'test')",
        [hash]
      );
      await pool.query(
        `INSERT INTO app_data (key, value) VALUES ('coins:test', '999999')
         ON CONFLICT (key) DO UPDATE SET value='999999'`
      );
      console.log("[init] test 계정 생성 완료 (999999코인, role=test)");
    } else {
      /* 이미 있으면 role과 코인만 보정 */
      await pool.query("UPDATE users SET role='test' WHERE username='test' AND role != 'test'");
      await pool.query(
        `INSERT INTO app_data (key, value) VALUES ('coins:test', '999999')
         ON CONFLICT (key) DO NOTHING`
      );
    }
  } catch (e) {
    console.error("[init] test 계정 생성 실패:", e.message);
  }

  /* ── 배팅 마감 시각 자동 처리 (1분마다) ── */
  setInterval(async () => {
    try {
      const result = await pool.query("SELECT key, value FROM app_data WHERE key LIKE 'pred-match:%'");
      for (const row of result.rows) {
        const match = JSON.parse(row.value);
        if (match.status !== "open" || !match.deadline) continue;
        if (new Date() < new Date(match.deadline)) continue;
        match.status = "closed";
        await pool.query(
          `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [row.key, JSON.stringify(match)]
        );
        broadcast({ type: "pred-match-update", match });
        console.log(`[pred] 경기 ${match.id} (${match.team1} vs ${match.team2}) 배팅 자동 마감`);
      }
    } catch (e) {
      console.error("[pred] 자동 마감 오류:", e.message);
    }
  }, 60 * 1000);

  /* ── 자동 주가 폴링 시작 ── */
  await initProcessedMaps();
  pollVctMatches(); /* 서버 시작 즉시 1회 실행 */
  setInterval(async () => {
    await pollVctMatches();
    await saveProcessedMaps();
  }, 5 * 60 * 1000); /* 5분마다 */
  console.log("[stock] 자동 주가 폴링 시작 (5분 주기, 맵별 감지)");
});
