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
app.use(express.json({ limit: "10mb" })); /* rebuild-vct-p에서 localData 대량 전송 허용 */
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

/* ── API: prefix로 키 목록 조회 (매치 페이지 초기 로드용) ── */
app.get("/api/data-prefix", async (req, res) => {
  const prefix = req.query.prefix;
  if (!prefix) return res.status(400).json({ error: "prefix required" });
  try {
    const result = await pool.query(
      "SELECT key, value FROM app_data WHERE key LIKE $1",
      [prefix + "%"]
    );
    const data = {};
    result.rows.forEach((row) => { data[row.key] = row.value; });
    res.json(data);
  } catch (err) {
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

/* ── API: 공지 작성 (Admin 전용) ────────────────────── */
app.post("/api/notices", requireAdmin, async (req, res) => {
  const title = String((req.body && req.body.title) || "").trim();
  const text  = String((req.body && req.body.text)  || "").trim();
  if (!title) return res.status(400).json({ error: "제목을 입력해주세요." });
  if (!text)  return res.status(400).json({ error: "내용을 입력해주세요." });
  if (title.length > 100) return res.status(400).json({ error: "제목은 100자 이하로 입력해주세요." });
  if (text.length  > 1000) return res.status(400).json({ error: "내용은 1000자 이하로 입력해주세요." });
  const key = `notice:${Date.now()}`;
  try {
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [key, JSON.stringify({ title, text, at: new Date().toISOString() })]
    );
    broadcast({ type: "new-notice", at: new Date().toISOString() });
    res.json({ ok: true, key });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 공지 목록 (로그인 유저 전체) ──────────────── */
app.get("/api/notices", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT key, value FROM app_data WHERE key LIKE 'notice:%' ORDER BY key DESC"
    );
    res.json(result.rows.map((r) => {
      const v = JSON.parse(r.value);
      return { key: r.key, title: v.title, text: v.text, at: v.at };
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 공지 삭제 (Admin 전용) ────────────────────── */
app.delete("/api/notices/:ts", requireAdmin, async (req, res) => {
  const key = `notice:${req.params.ts}`;
  try {
    await pool.query("DELETE FROM app_data WHERE key=$1", [key]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ── API: 전체 보상 지급 (Admin 전용) ───────────────── */
app.post("/api/admin/reward-all", requireAdmin, async (req, res) => {
  const coins   = parseInt(req.body.coins,  10);
  const message = String(req.body.message || "").trim();
  if (!coins || coins < 1) return res.status(400).json({ error: "코인 수를 1 이상 입력하세요." });
  if (!message)            return res.status(400).json({ error: "메시지를 입력하세요." });
  try {
    /* admin·test 제외 전체 유저 코인 지급 */
    const usersRes = await pool.query(`
      SELECT ad.key, ad.value
      FROM app_data ad
      JOIN users u ON u.username = SUBSTRING(ad.key FROM 7)
      WHERE ad.key LIKE 'coins:%' AND u.role NOT IN ('admin','test')
    `);
    let count = 0;
    for (const row of usersRes.rows) {
      const cur = parseInt(row.value, 10) || 0;
      const next = cur + coins;
      await pool.query(
        `UPDATE app_data SET value=$1, updated_at=NOW() WHERE key=$2`,
        [String(next), row.key]
      );
      /* 실시간 브로드캐스트 — 개별 유저 코인 갱신 */
      broadcast({ type: "set", key: row.key, value: String(next) });
      count++;
    }
    /* 보상 공지 저장 (reward: 키) */
    const rewardKey = `reward:${Date.now()}`;
    const rewardVal = JSON.stringify({ coins, message, at: new Date().toISOString() });
    await pool.query(
      `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`,
      [rewardKey, rewardVal]
    );
    /* 전체 브로드캐스트 — 보상 공지 */
    broadcast({ type: "reward", coins, message, at: new Date().toISOString() });
    console.log(`[admin] 전체 보상 지급: ${coins}코인 × ${count}명 | "${message}"`);
    res.json({ ok: true, count, coins, message });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
  /* teamFuzzyMatch는 모듈 레벨 함수 사용 */

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
        const matchedA = titles.find(t => norm(t) === norm(teamA))
          || titles.find(t => teamFuzzyMatch(t, teamA))
          || titles[0];
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

/* ── API: 자동입력 활성화 (admin) ─────────────────── */
app.put("/api/auto-match", requireAdmin, async (req, res) => {
  const { matchKey, team1, team2, league } = req.body || {};
  if (!matchKey || !team1 || !team2)
    return res.status(400).json({ error: "matchKey, team1, team2 필수" });
  const record = { matchKey, team1, team2, league: league || "", active: true, thespikeMatchId: null, filledMaps: [] };
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

  /* 신규 선수: 초기 상태 먼저 저장 */
  if (isNew) {
    await saveStockState(playerName, state, resolvedKey);
    console.log(`[stock] ${resolvedKey}: 신규 등록 기준가격=${state.price} (기준ACS ${state.ref})`);
    /* 현재 ACS = 기준 ACS 이면 변동 없음 (이력 없는 완전 신규 선수) */
    if (newAcs === state.ref) return;
    /* 이력이 있어서 기준이 역사 평균인 경우 → 현재 ACS와 비교해 변동 적용 (fall-through) */
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

/* 어드민이 직접 선수 목록을 전달해 즉시 주가 반영 */
/* ── 기록 DB 진단 (어드민 전용) ───────────────────────────────────────────────
   /api/admin/records-diag 에 GET 요청하면 DB에 저장된 기록 데이터 현황을 반환.
   league별 vct_p 맵 엔트리 수, vct_roster 팀 수, players/rounds/veto 키 수 확인용. */
app.get("/api/admin/records-diag", async (req, res) => {
  try {
    const [vctpRows, rosterRows, playersRows, roundsRows, vetoRows, autoRows, metaRows] = await Promise.all([
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'vct_p:%'"),
      pool.query("SELECT key FROM app_data WHERE key LIKE 'vct_roster:%'"),
      pool.query("SELECT key FROM app_data WHERE key LIKE 'players:%'"),
      pool.query("SELECT key FROM app_data WHERE key LIKE 'rounds:%'"),
      pool.query("SELECT key FROM app_data WHERE key LIKE 'veto:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'auto-match:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'match-meta:%'"),
    ]);

    /* vct_p league별 집계 */
    const leagueCounts = {};
    const sampleByLeague = {};
    let totalMaps = 0;
    let emptyLeague = 0;
    vctpRows.rows.forEach(r => {
      try {
        const pd = JSON.parse(r.value);
        (pd.maps || []).forEach(m => {
          const lg = m.league || "";
          totalMaps++;
          if (!lg) { emptyLeague++; return; }
          leagueCounts[lg] = (leagueCounts[lg] || 0) + 1;
          if (!sampleByLeague[lg]) sampleByLeague[lg] = [];
          if (sampleByLeague[lg].length < 3) {
            sampleByLeague[lg].push({ player: r.key.slice(6), matchKey: m.matchKey, stage: m.stage });
          }
        });
      } catch {}
    });

    /* auto-match league 집계 */
    const autoByLeague = {};
    const autoSamples = {};
    autoRows.rows.forEach(r => {
      try {
        const v = JSON.parse(r.value);
        const lg = (v.league || "(없음)").toLowerCase();
        autoByLeague[lg] = (autoByLeague[lg] || 0) + 1;
        if (!autoSamples[lg]) autoSamples[lg] = [];
        if (autoSamples[lg].length < 5) autoSamples[lg].push({ key: r.key, league: v.league||"", team1: v.team1, team2: v.team2 });
      } catch {}
    });

    /* match-meta league 집계 */
    const metaByLeague = {};
    metaRows.rows.forEach(r => {
      try {
        const v = JSON.parse(r.value);
        const lg = (v.league || "").toLowerCase();
        metaByLeague[lg] = (metaByLeague[lg] || 0) + 1;
      } catch {}
    });

    /* players: 샘플 키 10개 + □utumn류 이상 이름 탐지 */
    const playerSampleKeys = playersRows.rows.slice(0, 10).map(r => r.key);
    /* vct_p pacific 샘플에서 matchKey 수집 */
    const pacificMatchKeys = new Set();
    (sampleByLeague["pacific"] || []).forEach(s => s.matchKey && pacificMatchKeys.add(s.matchKey));
    /* players 키 중 pacific matchKey와 매칭되는 건수 */
    let pacificPlayerEntries = 0;
    playersRows.rows.forEach(r => {
      const mk = r.key.slice("players:".length).replace(/:(\d+)$/, "");
      if (pacificMatchKeys.has(mk)) pacificPlayerEntries++;
    });

    res.json({
      ok: true,
      vctP: {
        players: vctpRows.rows.length,
        totalMapEntries: totalMaps,
        emptyLeague,
        byLeague: leagueCounts,
        samples: sampleByLeague,
      },
      vctRoster: { teams: rosterRows.rows.length, keys: rosterRows.rows.map(r => r.key.slice(11)) },
      players: { count: playersRows.rows.length, sampleKeys: playerSampleKeys,
                 pacificVctpMatchKeys: [...pacificMatchKeys], pacificPlayerEntries },
      rounds:  { count: roundsRows.rows.length },
      veto:    { count: vetoRows.rows.length },
      autoMatch: { total: autoRows.rows.length, byLeague: autoByLeague, samples: autoSamples },
      matchMeta: { total: metaRows.rows.length, byLeague: metaByLeague },
    });
  } catch (e) {
    console.error("[records-diag]", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── 기록 페이지: 전체 데이터 덤프 ─────────────────────────────────────────────
   records.html이 localStorage 대신 DB에서 직접 읽기 위해 사용하는 엔드포인트.
   vct_p, vct_roster, players, rounds, veto, 참가팀 키를 한 번에 반환한다.       */
app.get("/api/records/dump", async (req, res) => {
  try {
    const [vctpRows, rosterRows, playersRows, roundsRows, vetoRows, miscRows] = await Promise.all([
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'vct_p:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'vct_roster:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'players:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'rounds:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'veto:%'"),
      pool.query(
        "SELECT key, value FROM app_data WHERE key IN ($1,$2,$3)",
        ["masters_santiago_participants", "masters_london_participants", "champions_participants"]
      ),
    ]);

    const data = {};
    [vctpRows, rosterRows, playersRows, roundsRows, vetoRows, miscRows].forEach(result => {
      result.rows.forEach(row => { data[row.key] = row.value; });
    });

    res.json({ ok: true, data });
  } catch (e) {
    console.error("[records/dump]", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── 기록 페이지: 서버 계산 (vct_p 기반) ──────────────────────────────────
   vct_p 엔트리에 저장된 per-map stats (stage/tournament/acs/kda) +
   vct_roster 팀 정보를 결합해서 league/stage 필터링.
   league=X&stage=Y 파라미터로 필터.                                         */
app.get("/api/records/compute", async (req, res) => {
  try {
    const league = (req.query.league || "pacific").toLowerCase();
    const stage  = (req.query.stage  || "all").toLowerCase();

    /* ══ 팀 → 리그 매핑 ══ */
    const TEAM_LEAGUE_MAP = {
      /* Pacific */
      "DetonatioN FocusMe":"pacific","FULL SENSE":"pacific","Gen.G":"pacific",
      "Global Esports":"pacific","Kiwoom DRX":"pacific","Nongshim RedForce":"pacific",
      "Paper Rex":"pacific","Rex Regum Qeon":"pacific","T1":"pacific",
      "Team Secret":"pacific","VARREL":"pacific","ZETA DIVISION":"pacific",
      /* CN */
      "Dragon Ranger Gaming":"cn","EDward Gaming":"cn","FunPlus Phoenix":"cn",
      "All Gamers":"cn","Wolves Esports":"cn","Trace Esports":"cn",
      "Nova Esports":"cn","Bilibili Gaming":"cn","Guangzhou Huadu Bilibili Gaming":"cn",
      "Wuxi Titan Esports Club":"cn","Xi Lai Gaming":"cn","TYLOO":"cn",
      "IGZIST":"cn","BNK FEARX":"cn",
      /* Americas */
      "Sentinels":"americas","Cloud9":"americas","100 Thieves":"americas",
      "NRG":"americas","Evil Geniuses":"americas","LOUD":"americas",
      "Leviatán":"americas","FURIA":"americas","KRÜ Esports":"americas",
      "Team Liquid":"americas","MIBR":"americas","ENVY":"americas",
      /* EMEA */
      "Team Heretics":"emea","Fnatic":"emea","G2 Esports":"emea",
      "Natus Vincere":"emea","Team Vitality":"emea","BBL Esports":"emea",
      "FUT Esports":"emea","Karmine Corp":"emea","GIANTX":"emea",
      "WEC C":"emea","Gentle Mates":"emea","ARETE":"emea","Mir Gaming":"emea",
    };

    /* ── 1. DB 병렬 로드 ── */
    const [vctpRows, rosterRows, roundsRows, autoRows] = await Promise.all([
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'vct_p:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'vct_roster:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'rounds:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'auto-match:%'"),
    ]);

    /* ── 2. vct_roster: 선수→팀 맵 ── */
    const playerTeam = {};  /* playerName → teamName */
    rosterRows.rows.forEach(function(row) {
      var teamName = row.key.slice("vct_roster:".length);
      var v;
      try { v = JSON.parse(row.value); } catch(e) { return; }
      var all = (v.main || []).concat(v.subs || []);
      all.forEach(function(pn) { if (pn && pn !== "-") playerTeam[pn] = teamName; });
    });

    /* ── 3. auto-match: matchKey → { team1, team2 } ── */
    const autoMatch = {};  /* mk → { team1, team2 } */
    autoRows.rows.forEach(function(row) {
      var mk = row.key.slice("auto-match:".length);
      var v;
      try { v = JSON.parse(row.value); } catch(e) { return; }
      autoMatch[mk] = {
        team1: v.team1 || v.teamA || "",
        team2: v.team2 || v.teamB || "",
      };
    });

    /* ── 4. league/stage 필터 헬퍼 ── */
    /* 각 vct_p map 엔트리에 대해 effectiveLeague와 effectiveTournament를 결정 */
    function getEffectiveLeague(mapEntry, playerLeague) {
      var t = mapEntry.tournament || "";
      if (t === "santiago") return { effectiveLeague: "masters", tournament: "santiago" };
      if (t === "london")   return { effectiveLeague: "masters", tournament: "london" };
      if (t.indexOf("champions") !== -1) return { effectiveLeague: "champions", tournament: t };
      return { effectiveLeague: playerLeague, tournament: t };
    }

    function mapEntryMatchesLeague(mapEntry, playerLeague, tgt) {
      var eff = getEffectiveLeague(mapEntry, playerLeague);
      var el = eff.effectiveLeague;
      var et = eff.tournament;
      if (tgt === "global")           return el === "pacific" || el === "cn" || el === "americas" || el === "emea";
      if (tgt === "pacific")          return el === "pacific";
      if (tgt === "cn")               return el === "cn";
      if (tgt === "americas")         return el === "americas";
      if (tgt === "emea")             return el === "emea";
      if (tgt === "masters-santiago") return et === "santiago";
      if (tgt === "masters-london")   return et === "london";
      if (tgt === "champions")        return el === "champions";
      return false;
    }

    function mapEntryMatchesStage(mapEntry, tgt) {
      if (tgt === "all") return true;
      var s = mapEntry.stage || "";
      if (tgt === "kickoff")    return s === "kickoff";
      if (tgt === "stage1")     return s === "stage1" || s === "stage1playoffs";
      if (tgt === "stage2")     return s === "stage2" || s === "stage2playoffs";
      if (tgt === "swiss")      return s === "swiss";
      if (tgt === "playoffs")   return s === "playoffs";
      if (tgt === "groupstage") return s === "groupstage" || s === "swiss";
      return true;
    }

    /* ── 5. vct_p 순회: 선수 스탯 집계 + 필터된 matchKey 수집 ── */
    const playerStats = {};  /* name → { totalAcs, totalKills, totalDeaths, maps } */
    const filteredMatchKeys = new Set();
    var totalVctpPlayers = 0;
    var playersWithLeague = 0;
    var filteredMaps = 0;

    vctpRows.rows.forEach(function(row) {
      var playerName = row.key.slice("vct_p:".length);
      var pd;
      try { pd = JSON.parse(row.value); } catch(e) { return; }
      if (!pd || !Array.isArray(pd.maps)) return;

      totalVctpPlayers++;

      /* 선수 팀→리그 결정 */
      var team = playerTeam[playerName] || "";
      var playerLeague = TEAM_LEAGUE_MAP[team] || "";
      if (playerLeague) playersWithLeague++;

      pd.maps.forEach(function(mapEntry) {
        if (!mapEntry || !mapEntry.matchKey) return;

        /* league 필터 */
        if (!mapEntryMatchesLeague(mapEntry, playerLeague, league)) return;
        /* stage 필터 */
        if (!mapEntryMatchesStage(mapEntry, stage)) return;

        /* acs / kda 유효성 검사 */
        var acs = parseInt(mapEntry.acs) || 0;
        if (acs === 0) return;
        var kdaStr = mapEntry.kda || "0/0/0";
        if (kdaStr === "0/0/0") return;
        var kdaParts = kdaStr.split("/");
        var kills  = parseInt(kdaParts[0]) || 0;
        var deaths = parseInt(kdaParts[1]) || 0;

        /* 집계 */
        if (!playerStats[playerName]) {
          playerStats[playerName] = { totalAcs:0, totalKills:0, totalDeaths:0, maps:0 };
        }
        playerStats[playerName].totalAcs    += acs;
        playerStats[playerName].totalKills  += kills;
        playerStats[playerName].totalDeaths += deaths;
        playerStats[playerName].maps        += 1;

        filteredMatchKeys.add(mapEntry.matchKey);
        filteredMaps++;
      });
    });

    /* ── 6. 상위 ACS / K/D (최소 2맵) ── */
    var playerList = Object.keys(playerStats)
      .filter(function(name) { return playerStats[name].maps >= 2; })
      .map(function(name) {
        var s = playerStats[name];
        return {
          name: name,
          team: playerTeam[name] || "",
          maps: s.maps,
          acs:  s.maps > 0 ? Math.round(s.totalAcs / s.maps) : 0,
          kd:   s.totalDeaths > 0
                  ? parseFloat((s.totalKills / s.totalDeaths).toFixed(2))
                  : parseFloat(s.totalKills.toFixed(2)),
        };
      });

    var topAcs = playerList.slice().sort(function(a,b){ return b.acs - a.acs; }).slice(0, 10);
    var topKd  = playerList.slice().sort(function(a,b){ return b.kd  - a.kd;  }).slice(0, 10);

    /* ── 7. rounds: 에서 팀 통계 ── */
    /* 팀이 해당 league에 속하는지 확인 */
    function teamMatchesLeague(teamName, tgt) {
      var tl = TEAM_LEAGUE_MAP[teamName] || "";
      if (tgt === "global")    return tl === "pacific" || tl === "cn" || tl === "americas" || tl === "emea";
      if (tgt === "pacific")   return tl === "pacific";
      if (tgt === "cn")        return tl === "cn";
      if (tgt === "americas")  return tl === "americas";
      if (tgt === "emea")      return tl === "emea";
      /* masters/champions: 모든 참가팀 포함 */
      if (tgt === "masters-santiago" || tgt === "masters-london" || tgt === "champions") return true;
      return false;
    }

    const teamStats = {};  /* teamName → { maps, mapWins, pistolTotal, pistolWins, atkTotal, atkWins, defTotal, defWins } */
    function ensureTeam(t) {
      if (!t) return;
      if (!teamStats[t]) teamStats[t] = { maps:0, mapWins:0, pistolTotal:0, pistolWins:0, atkTotal:0, atkWins:0, defTotal:0, defWins:0 };
    }

    roundsRows.rows.forEach(function(row) {
      var withoutPrefix = row.key.slice("rounds:".length);
      var lastColon = withoutPrefix.lastIndexOf(":");
      if (lastColon < 0) return;
      var mk = withoutPrefix.slice(0, lastColon);
      /* rounds 항목의 matchKey가 필터된 집합에 없으면 건너뜀 */
      if (!filteredMatchKeys.has(mk)) return;

      /* 팀 이름: auto-match 에서 가져옴 */
      var am = autoMatch[mk];
      if (!am) return;
      var teamA = am.team1 || "";
      var teamB = am.team2 || "";
      if (!teamA || !teamB) return;

      var rounds;
      try { rounds = JSON.parse(row.value); } catch(e) { return; }
      if (!Array.isArray(rounds) || !rounds.length) return;

      ensureTeam(teamA);
      ensureTeam(teamB);
      teamStats[teamA].maps += 1;
      teamStats[teamB].maps += 1;

      /* 맵 승자 판별 */
      var aWins = 0, bWins = 0;
      rounds.forEach(function(r) { if (r.winner === "a") aWins++; else if (r.winner === "b") bWins++; });
      if (aWins > bWins) teamStats[teamA].mapWins++;
      else if (bWins > aWins) teamStats[teamB].mapWins++;

      rounds.forEach(function(r, idx) {
        var isPistol = (idx === 0 || idx === 12);
        var type = r.type || "";
        var winner = r.winner || "";

        var isAtk = type.indexOf("attack_") === 0;
        var isDef = type.indexOf("def_") === 0;

        if (isAtk) {
          teamStats[teamA].atkTotal++;
          if (winner === "a") teamStats[teamA].atkWins++;
          teamStats[teamB].defTotal++;
          if (winner === "b") teamStats[teamB].defWins++;
        } else if (isDef) {
          teamStats[teamA].defTotal++;
          if (winner === "a") teamStats[teamA].defWins++;
          teamStats[teamB].atkTotal++;
          if (winner === "b") teamStats[teamB].atkWins++;
        }

        if (isPistol) {
          teamStats[teamA].pistolTotal++;
          teamStats[teamB].pistolTotal++;
          if (winner === "a") teamStats[teamA].pistolWins++;
          else if (winner === "b") teamStats[teamB].pistolWins++;
        }
      });
    });

    res.json({
      ok: true,
      league,
      stage,
      matchCount: filteredMatchKeys.size,
      topAcs,
      topKd,
      teamStats,
      _debug: {
        totalVctpPlayers,
        playersWithLeague,
        filteredMaps,
        uniqueMatchKeys: filteredMatchKeys.size,
      },
    });
  } catch(e) {
    console.error("[records/compute]", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── 기록 페이지: 팀 상세 (조합, 맵 승률, 밴픽) ─────────────────────────────
   /api/records/team-detail?league=X&stage=Y&team=T                            */
app.get("/api/records/team-detail", async (req, res) => {
  try {
    const league   = (req.query.league || "pacific").toLowerCase();
    const stage    = (req.query.stage  || "all").toLowerCase();
    const teamName = (req.query.team   || "").trim();
    if (!teamName) return res.status(400).json({ ok: false, error: "team 파라미터 필요" });

    /* ── 헬퍼 (compute와 동일한 로직 복사) ── */
    const TEAM_LEAGUE_MAP2 = {
      "DetonatioN FocusMe":"pacific","FULL SENSE":"pacific","Gen.G":"pacific",
      "Global Esports":"pacific","Kiwoom DRX":"pacific","Nongshim RedForce":"pacific",
      "Paper Rex":"pacific","Rex Regum Qeon":"pacific","T1":"pacific",
      "Team Secret":"pacific","VARREL":"pacific","ZETA DIVISION":"pacific",
      "Dragon Ranger Gaming":"cn","EDward Gaming":"cn","FunPlus Phoenix":"cn",
      "All Gamers":"cn","Wolves Esports":"cn","Trace Esports":"cn",
      "Nova Esports":"cn","Bilibili Gaming":"cn","Guangzhou Huadu Bilibili Gaming":"cn",
      "Wuxi Titan Esports Club":"cn","Xi Lai Gaming":"cn","TYLOO":"cn","IGZIST":"cn","BNK FEARX":"cn",
      "Sentinels":"americas","Cloud9":"americas","100 Thieves":"americas",
      "NRG":"americas","Evil Geniuses":"americas","LOUD":"americas",
      "Leviatán":"americas","FURIA":"americas","KRÜ Esports":"americas",
      "Team Liquid":"americas","MIBR":"americas","ENVY":"americas",
      "Team Heretics":"emea","Fnatic":"emea","G2 Esports":"emea",
      "Natus Vincere":"emea","Team Vitality":"emea","BBL Esports":"emea",
      "FUT Esports":"emea","Karmine Corp":"emea","GIANTX":"emea",
      "WEC C":"emea","Gentle Mates":"emea","ARETE":"emea","Mir Gaming":"emea",
    };
    function inferLeagueFromTeam2(t1, t2) {
      if (t1 && TEAM_LEAGUE_MAP2[t1]) return TEAM_LEAGUE_MAP2[t1];
      if (t2 && TEAM_LEAGUE_MAP2[t2]) return TEAM_LEAGUE_MAP2[t2];
      return "";
    }
    const MK_LEAGUE_KW = { pacific:"pacific", emea:"emea", americas:"americas", cn:"cn",
                           masters:"masters", champions:"champions", london:"masters", santiago:"masters" };
    function inferLeagueFromKey(mk) {
      var parts = mk.split("|");
      for (var i = 0; i < parts.length; i++) {
        var pl = parts[i].toLowerCase();
        if (MK_LEAGUE_KW[pl]) return MK_LEAGUE_KW[pl];
      }
      if (parts.length >= 3) {
        var lg = inferLeagueFromTeam2(parts[1], parts[2]);
        if (lg) return lg;
      }
      return "";
    }
    const MK_STAGE_KW = { kickoff:"kickoff", stage1:"stage1", stage2:"stage2",
                          stage1playoffs:"stage1playoffs", stage2playoffs:"stage2playoffs",
                          swiss:"swiss", playoffs:"playoffs", groupstage:"groupstage" };
    function inferStageFromKey(mk) {
      var parts = mk.split("|");
      var p0 = (parts[0] || "").toLowerCase();
      if (p0.indexOf("stage1playoffs") !== -1) return "stage1playoffs";
      if (p0.indexOf("stage2playoffs") !== -1) return "stage2playoffs";
      if (MK_STAGE_KW[p0]) return MK_STAGE_KW[p0];
      for (var i = 0; i < parts.length; i++) {
        var pl = parts[i].toLowerCase();
        if (MK_STAGE_KW[pl]) return MK_STAGE_KW[pl];
      }
      return "";
    }
    function matchesLeague(meta, tgt) {
      var l = meta.league || "";
      if (tgt === "global")           return l === "pacific" || l === "cn" || l === "americas" || l === "emea";
      if (tgt === "pacific")          return l === "pacific";
      if (tgt === "cn")               return l === "cn";
      if (tgt === "americas")         return l === "americas";
      if (tgt === "emea")             return l === "emea";
      if (tgt === "masters-santiago") return l === "masters" && (meta.tournament || "") === "santiago";
      if (tgt === "masters-london")   return l === "masters" && (meta.tournament || "") === "london";
      if (tgt === "champions")        return l === "champions";
      return false;
    }
    function matchesStage(meta, tgt) {
      if (tgt === "all") return true;
      var s = meta.stage || "";
      if (tgt === "kickoff")    return s === "kickoff";
      if (tgt === "stage1")     return s === "stage1" || s === "stage1playoffs";
      if (tgt === "stage2")     return s === "stage2" || s === "stage2playoffs";
      if (tgt === "swiss")      return s === "swiss";
      if (tgt === "playoffs")   return s === "playoffs";
      if (tgt === "groupstage") return s === "groupstage" || s === "swiss";
      return true;
    }

    /* ── DB 로드 ── */
    const [autoRows, metaRows, playersRows, roundsRows, vetoRows, rosterRows, vctpRows2] = await Promise.all([
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'auto-match:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'match-meta:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'players:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'rounds:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'veto:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'vct_roster:%'"),
      pool.query("SELECT value FROM app_data WHERE key LIKE 'vct_p:%'"),
    ]);

    /* matchKey → meta */
    const matchMeta = {};
    metaRows.rows.forEach(function(row) {
      var mk = row.key.slice("match-meta:".length);
      var v; try { v = JSON.parse(row.value); } catch(e) { return; }
      matchMeta[mk] = { league: v.league || inferLeagueFromKey(mk), stage: v.stage || inferStageFromKey(mk),
                        tournament: v.tournament || "", teamA: v.teamA||v.team1||"", teamB: v.teamB||v.team2||"" };
    });
    autoRows.rows.forEach(function(row) {
      var mk = row.key.slice("auto-match:".length);
      var v; try { v = JSON.parse(row.value); } catch(e) { return; }
      if (!matchMeta[mk]) matchMeta[mk] = { league:"", stage:"", tournament:"", teamA:"", teamB:"" };
      var t1 = v.team1||v.teamA||"", t2 = v.team2||v.teamB||"";
      if (v.league) matchMeta[mk].league = v.league;
      else if (!matchMeta[mk].league) matchMeta[mk].league = inferLeagueFromTeam2(t1, t2);
      if (!matchMeta[mk].teamA && t1) matchMeta[mk].teamA = t1;
      if (!matchMeta[mk].teamB && t2) matchMeta[mk].teamB = t2;
      if (!matchMeta[mk].stage) matchMeta[mk].stage = inferStageFromKey(mk);
    });
    /* vct_p 에서 matchKey → league 보강 */
    vctpRows2.rows.forEach(function(row) {
      var pd; try { pd = JSON.parse(row.value); } catch(e) { return; }
      (pd.maps || []).forEach(function(m) {
        if (!m.matchKey || !m.league) return;
        var mk = m.matchKey;
        if (!matchMeta[mk]) matchMeta[mk] = { league:"", stage:"", tournament:"", teamA:"", teamB:"" };
        if (!matchMeta[mk].league) matchMeta[mk].league = m.league;
        if (!matchMeta[mk].stage && m.stage) matchMeta[mk].stage = m.stage;
      });
    });
    playersRows.rows.forEach(function(row) {
      var withoutPrefix = row.key.slice("players:".length);
      var lc = withoutPrefix.lastIndexOf(":");
      if (lc < 0) return;
      var mk = withoutPrefix.slice(0, lc);
      if (!matchMeta[mk]) matchMeta[mk] = { league: inferLeagueFromKey(mk), stage: inferStageFromKey(mk),
                                             tournament:"", teamA:"", teamB:"" };
      else if (!matchMeta[mk].league) matchMeta[mk].league = inferLeagueFromKey(mk);
    });

    /* 필터 통과 matchKey */
    const matchSet = new Set();
    Object.keys(matchMeta).forEach(function(mk) {
      var meta = matchMeta[mk];
      if (matchesLeague(meta, league) && matchesStage(meta, stage)) matchSet.add(mk);
    });

    /* vct_roster: 팀 선수 목록 */
    const teamLower = teamName.toLowerCase();
    var teamPlayers = [];
    rosterRows.rows.forEach(function(row) {
      var tn = row.key.slice("vct_roster:".length);
      if (tn.toLowerCase() !== teamLower && tn.toLowerCase().indexOf(teamLower) === -1 && teamLower.indexOf(tn.toLowerCase()) === -1) return;
      var v; try { v = JSON.parse(row.value); } catch(e) { return; }
      var all = (v.main||[]).concat(v.subs||[]);
      if (all.length > teamPlayers.length) teamPlayers = all;
    });

    /* veto: matchKey → veto 맵 */
    const vetoMap = {};
    vetoRows.rows.forEach(function(row) {
      var mk = row.key.slice("veto:".length);
      if (!matchSet.has(mk)) return;
      try { vetoMap[mk] = JSON.parse(row.value); } catch(e) {}
    });

    /* getMapName 헬퍼 */
    function getMapName(mk, mi, matchMaxIdx) {
      var veto = vetoMap[mk];
      if (!veto) return null;
      var maps = veto.maps;
      if (!Array.isArray(maps) || !maps.length) return null;
      var isBo5 = !!(veto.gf || veto.bo5);
      if (!isBo5) isBo5 = (parseInt(matchMaxIdx) || 0) >= 3;
      if (!isBo5 && veto.sides) isBo5 = veto.sides[4] !== undefined || veto.sides[5] !== undefined;
      if (!isBo5) {
        var dp = (String(mk).split("|")[0] || "").toLowerCase();
        isBo5 = dp.indexOf("grand") !== -1 || dp.indexOf(" gf") !== -1 || dp.indexOf("_gf") !== -1 || dp.startsWith("gf");
      }
      var stepPos;
      if      (mi === 0) stepPos = 2;
      else if (mi === 1) stepPos = 3;
      else if (mi === 2) stepPos = isBo5 ? 4 : 6;
      else if (mi === 3) stepPos = 5;
      else if (mi === 4) stepPos = 6;
      else return null;
      return maps[stepPos] || null;
    }

    const MAP_NAME_KO = {
      "Ascent":"어센트","Split":"스플릿","Fracture":"프랙처","Bind":"바인드",
      "Breeze":"브리즈","Abyss":"어비스","Lotus":"로터스","Sunset":"선셋",
      "Pearl":"펄","Icebox":"아이스박스","Corrode":"코로드","Haven":"헤이븐","헤이브":"헤이븐",
    };
    function normMap(n) { return MAP_NAME_KO[n] || n; }

    /* players 키 그룹화: mk → [mapIdx, ...] */
    const mkMapIdxSet = {};  /* mk → Set(mapIdx) */
    playersRows.rows.forEach(function(row) {
      var wp = row.key.slice("players:".length);
      var lc = wp.lastIndexOf(":");
      if (lc < 0) return;
      var mk = wp.slice(0, lc);
      if (!matchSet.has(mk)) return;
      var mi = parseInt(wp.slice(lc+1)) || 0;
      if (!mkMapIdxSet[mk]) mkMapIdxSet[mk] = new Set();
      mkMapIdxSet[mk].add(mi);
    });

    /* players: 에서 팀 사이드 판별 + 에이전트 수집 */
    const compositions = {};  /* mapName → [{ agents:[...], count, matches:[...] }] */
    const mapWinRates  = {};  /* mapName → { wins, total } */
    const banPick      = {};  /* mapName → { picks, bans } */

    const playerSet = new Set(teamPlayers.map(function(p){ return p.toLowerCase(); }));

    /* players 키 → rows 맵 */
    const playersData = {};
    playersRows.rows.forEach(function(row) {
      playersData[row.key] = row.value;
    });
    const roundsData = {};
    roundsRows.rows.forEach(function(row) {
      roundsData[row.key] = row.value;
    });

    matchSet.forEach(function(mk) {
      var mapIdxes = mkMapIdxSet[mk];
      if (!mapIdxes) return;
      var maxIdx = 0;
      mapIdxes.forEach(function(mi) { if (mi > maxIdx) maxIdx = mi; });

      /* veto 밴픽 처리 */
      var veto = vetoMap[mk];
      if (veto && Array.isArray(veto.maps)) {
        var vetoMaps = veto.maps;
        var isBo5 = !!(veto.gf || veto.bo5) || maxIdx >= 3;
        if (!isBo5 && veto.sides) isBo5 = veto.sides[4] !== undefined || veto.sides[5] !== undefined;

        /* 픽 위치: bo3=[2,3,6] bo5=[2,3,4,5,6] */
        var pickSteps = isBo5 ? [2,3,4,5,6] : [2,3,6];
        /* 밴 위치: bo3=[0,1,4,5] bo5=[0,1] */
        var banSteps = isBo5 ? [0,1] : [0,1,4,5];

        /* 팀이 어느 사이드인지: firstBan="A"면 팀A가 먼저 밴
           teamA vs teamB 에서 team이 어느쪽인지 판별 */
        var meta = matchMeta[mk] || {};
        var mTA = (meta.teamA||"").toLowerCase();
        var mTB = (meta.teamB||"").toLowerCase();
        var teamSideInVeto = null;
        if (mTA && mTA.indexOf(teamLower) !== -1) teamSideInVeto = "A";
        else if (mTB && mTB.indexOf(teamLower) !== -1) teamSideInVeto = "B";
        else if (teamLower && mTA && teamLower.indexOf(mTA) !== -1) teamSideInVeto = "A";
        else if (teamLower && mTB && teamLower.indexOf(mTB) !== -1) teamSideInVeto = "B";

        if (teamSideInVeto) {
          var firstBan = veto.firstBan || "A";
          /* 팀 밴/픽 스텝 인덱스:
             step 0,2,4 → firstBan 팀 (홀수: 상대팀)
             step 1,3,5 → !firstBan 팀 */
          var pickAndBanAll = [];
          vetoMaps.forEach(function(mapName, stepIdx) {
            if (!mapName) return;
            var mn = normMap(mapName);
            var isTeamStep = (stepIdx % 2 === 0) ? (firstBan === teamSideInVeto) : (firstBan !== teamSideInVeto);
            var isPick = pickSteps.indexOf(stepIdx) !== -1;
            var isBan  = banSteps.indexOf(stepIdx) !== -1;
            if (!isPick && !isBan) return;
            if (!banPick[mn]) banPick[mn] = { picks:0, bans:0 };
            if (isPick)        banPick[mn].picks++;
            if (isBan && isTeamStep) banPick[mn].bans++;
          });
        }
      }

      mapIdxes.forEach(function(mi) {
        var pkey = "players:" + mk + ":" + mi;
        var praw = playersData[pkey];
        if (!praw) return;
        var pdata; try { pdata = JSON.parse(praw); } catch(e) { return; }

        /* 팀 사이드 판별 */
        var aCnt = 0, bCnt = 0;
        for (var si = 0; si < 5; si++) {
          var aSlot = pdata["a" + si]; if (aSlot && aSlot.name && playerSet.has(aSlot.name.toLowerCase())) aCnt++;
          var bSlot = pdata["b" + si]; if (bSlot && bSlot.name && playerSet.has(bSlot.name.toLowerCase())) bCnt++;
        }
        var side = null;
        if (aCnt >= 3) side = "a";
        else if (bCnt >= 3) side = "b";
        else return;  /* 팀 선수 3명 미만이면 스킵 */

        /* 에이전트 5개 추출 */
        var agents = [];
        for (var si2 = 0; si2 < 5; si2++) {
          var slot = pdata[side + si2];
          if (slot && slot.agent && slot.agent !== "-") agents.push(slot.agent);
        }
        if (agents.length < 5) return;

        /* 맵 이름 */
        var rawMapName = getMapName(mk, mi, maxIdx);
        var mapName = rawMapName ? normMap(rawMapName) : null;
        if (!mapName) return;

        /* 조합 집계 */
        var agentKey = agents.slice().sort().join(",");
        if (!compositions[mapName]) compositions[mapName] = {};
        if (!compositions[mapName][agentKey]) compositions[mapName][agentKey] = { agents: agents, count: 0, matches: [] };
        compositions[mapName][agentKey].count++;
        compositions[mapName][agentKey].matches.push(mk + "|" + mi);

        /* 맵 승률: rounds에서 확인 */
        var rkey = "rounds:" + mk + ":" + mi;
        var rraw = roundsData[rkey];
        if (rraw) {
          var rounds; try { rounds = JSON.parse(rraw); } catch(e) { rounds = null; }
          if (Array.isArray(rounds) && rounds.length) {
            var aWins = 0, bWins = 0;
            rounds.forEach(function(r) { if (r.winner==="a") aWins++; else if (r.winner==="b") bWins++; });
            var won = (side === "a" && aWins > bWins) || (side === "b" && bWins > aWins);
            if (!mapWinRates[mapName]) mapWinRates[mapName] = { wins:0, total:0 };
            mapWinRates[mapName].total++;
            if (won) mapWinRates[mapName].wins++;
          }
        }
      });
    });

    /* compositions 맵별 배열 변환 */
    const compositionsOut = {};
    Object.keys(compositions).forEach(function(mapName) {
      compositionsOut[mapName] = Object.values(compositions[mapName]).sort(function(a,b){ return b.count - a.count; });
    });

    res.json({
      ok: true,
      team: teamName,
      compositions: compositionsOut,
      mapWinRates,
      banPick,
    });
  } catch(e) {
    console.error("[records/team-detail]", e);
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ── vct_p 일괄 재처리 (갈아엎기 버전) ────────────────────────────────────────
   클라이언트가 보낸 localData(admin localStorage의 players:/vct_roster: 키들)를
   DB에 먼저 UPSERT한 뒤, DB 전체를 스캔해서 vct_p를 완전히 재구성한다.
   이렇게 하면 Render 슬립 중 저장 실패로 DB에 없는 경기도 복구된다.           */
app.post("/api/admin/rebuild-vct-p", requireAdmin, async (req, res) => {
  try {
    const MK_TOURNAMENTS = new Set(["london", "santiago"]);
    const MK_STAGES      = new Set(["swiss", "playoffs", "groupstage", "stage1", "stage2",
                                     "stage1playoffs", "stage2playoffs", "kickoff"]);
    const MK_LEAGUE_KEYWORDS = {
      "pacific":"pacific","emea":"emea","americas":"americas","cn":"cn",
      "masters":"masters","champions":"champions",
    };
    function inferLeague(mkParts) {
      for (const part of mkParts) {
        const pl = part.toLowerCase();
        if (MK_TOURNAMENTS.has(pl)) return "masters";
        if (MK_LEAGUE_KEYWORDS[pl]) return MK_LEAGUE_KEYWORDS[pl];
      }
      return "";
    }

    /* ── 0단계: 클라이언트가 보낸 로컬 데이터를 DB에 먼저 저장 ── */
    const localData = req.body.localData || {};
    const localEntries = Object.entries(localData).filter(
      ([k]) => k.startsWith("players:") || k.startsWith("vct_roster:") ||
               k.startsWith("match-meta:") || k.startsWith("vct_p:")
    );
    let localSaved = 0;
    for (let i = 0; i < localEntries.length; i += 50) {
      const batch = localEntries.slice(i, i + 50);
      await Promise.all(batch.map(([k, v]) =>
        pool.query(
          `INSERT INTO app_data (key, value) VALUES ($1,$2)
           ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [k, String(v)]
        )
      ));
      localSaved += batch.length;
    }
    if (localSaved > 0) {
      console.log(`[rebuild-vct-p] 클라이언트 로컬 데이터 ${localSaved}건 DB 저장 완료`);
    }

    /* ── 1단계: 필요한 모든 데이터를 한 번에 로드 ── */
    const [playersRows, amRows, vctpRows, rosterRows, metaRows] = await Promise.all([
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'players:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'auto-match:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'vct_p:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'vct_roster:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'match-meta:%'"),
    ]);

    /* 메모리 맵 구성 */
    const amMap = {};
    amRows.rows.forEach(r => { try { amMap[r.key] = JSON.parse(r.value); } catch {} });

    const vctpMap = {}; /* lower(key) → { key, data } */
    vctpRows.rows.forEach(r => {
      try { vctpMap[r.key.toLowerCase()] = { key: r.key, data: JSON.parse(r.value) }; } catch {}
    });

    const rosterMap = {};
    rosterRows.rows.forEach(r => { try { rosterMap[r.key] = JSON.parse(r.value); } catch {} });

    /* match-meta: matchKey → { league, stage, tournament, teamA, teamB } */
    const metaMap = {};
    metaRows.rows.forEach(r => {
      try { metaMap[r.key.slice(11)] = JSON.parse(r.value); } catch {} /* "match-meta:XXX" → "XXX" */
    });

    /* ── 2단계: 메모리에서 vct_p 갱신 ── */
    const vctpUpdated = {}; /* key → 갱신된 data (마지막에 일괄 저장) */
    const teamPlayerMap = {};
    let updated = 0, skipped = 0;
    const processedMatchKeys = new Set();

    for (const row of playersRows.rows) {
      const keyParts = row.key.split(":");
      if (keyParts.length < 3) { skipped++; continue; }
      const mapIdx   = parseInt(keyParts[keyParts.length - 1]);
      if (isNaN(mapIdx)) { skipped++; continue; }
      const matchKey = keyParts.slice(1, -1).join(":");

      let playersData;
      try { playersData = JSON.parse(row.value); } catch { skipped++; continue; }
      if (Array.isArray(playersData)) { skipped++; continue; }

      const mkParts    = matchKey.split("|");
      const tournament = mkParts.find(p => MK_TOURNAMENTS.has(p.toLowerCase()))?.toLowerCase() || "";
      const stage      = mkParts.find(p => MK_STAGES.has(p.toLowerCase()))?.toLowerCase() || "";
      const amRec      = amMap[`auto-match:${matchKey}`];
      const metaRec    = metaMap[matchKey];
      /* league 우선순위: auto-match > match-meta > matchKey 추론 */
      const league     = (amRec?.league) || (metaRec?.league) || inferLeague(mkParts);
      /* stage도 match-meta에서 보완 (matchKey에 stage 명시 없을 경우) */
      const stageVal   = stage || (metaRec?.stage) || "";

      /* vct_roster 보완용 팀→선수 수집 (auto-match 또는 match-meta에서 팀 정보 획득) */
      const t1 = amRec?.team1 || metaRec?.teamA;
      const t2 = amRec?.team2 || metaRec?.teamB;
      if (t1 && t2) {
        if (!teamPlayerMap[t1]) teamPlayerMap[t1] = new Set();
        if (!teamPlayerMap[t2]) teamPlayerMap[t2] = new Set();
        ["a0","a1","a2","a3","a4"].forEach(s => {
          const p = playersData[s]; if (p?.name && p.name !== "-") teamPlayerMap[t1].add(p.name.trim());
        });
        ["b0","b1","b2","b3","b4"].forEach(s => {
          const p = playersData[s]; if (p?.name && p.name !== "-") teamPlayerMap[t2].add(p.name.trim());
        });
      }
      processedMatchKeys.add(matchKey);

      for (const slot of Object.values(playersData)) {
        if (!slot || typeof slot !== "object" || !slot.name || slot.name === "-") continue;
        const pName = slot.name.trim();
        const vkLow = `vct_p:${pName}`.toLowerCase();

        /* 메모리에서 기존 데이터 가져오기 (없으면 새로 만들기) */
        if (!vctpMap[vkLow]) vctpMap[vkLow] = { key: `vct_p:${pName}`, data: { maps: [] } };
        const vEntry = vctpMap[vkLow];
        if (!vEntry.data.maps) vEntry.data.maps = [];

        const existIdx = vEntry.data.maps.findIndex(m => m.matchKey === matchKey && m.mapIdx === mapIdx);
        const entry = existIdx >= 0 ? { ...vEntry.data.maps[existIdx] } : { matchKey, mapIdx };

        if (league)    entry.league     = league;
        if (tournament) entry.tournament = tournament;
        if (stageVal)  entry.stage      = stageVal;
        if (slot.acs != null) entry.acs  = slot.acs;
        if (slot.kda && slot.kda.includes("/")) entry.kda = slot.kda;
        if (slot.agent) entry.agent = slot.agent;

        if (!("acs" in entry) && !("kda" in entry)) { skipped++; continue; }

        if (existIdx >= 0) vEntry.data.maps[existIdx] = entry;
        else vEntry.data.maps.push(entry);

        vctpUpdated[vEntry.key] = vEntry.data;
        updated++;
      }
    }

    /* ── 3단계: 변경된 vct_p 일괄 저장 ── */
    const vctpEntries = Object.entries(vctpUpdated);
    for (let i = 0; i < vctpEntries.length; i += 50) {
      const batch = vctpEntries.slice(i, i + 50);
      await Promise.all(batch.map(([k, v]) =>
        pool.query(
          `INSERT INTO app_data (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
          [k, JSON.stringify(v)]
        )
      ));
    }

    /* ── 4단계: vct_roster 보완 ── */
    let rosterCreated = 0;
    const rosterUpdates = [];
    for (const [teamName, playerSet] of Object.entries(teamPlayerMap)) {
      const rKey = `vct_roster:${teamName}`;
      const existing = rosterMap[rKey];
      const existingPlayers = new Set([...(existing?.main || []), ...(existing?.subs || [])]);
      const newPlayers = [...playerSet].filter(p => !existingPlayers.has(p));
      if (newPlayers.length === 0 && existing) continue;
      const merged = { main: [...new Set([...existingPlayers, ...newPlayers])], subs: existing?.subs || [] };
      rosterUpdates.push([rKey, JSON.stringify(merged)]);
      rosterCreated++;
    }
    await Promise.all(rosterUpdates.map(([k, v]) =>
      pool.query(
        `INSERT INTO app_data (key, value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [k, v]
      )
    ));

    const report = {
      ok: true,
      localSaved,
      updated,
      skipped,
      rosterCreated,
      matchKeys: [...processedMatchKeys],
    };
    console.log(`[rebuild-vct-p] 완료: 로컬→DB ${localSaved}건, vct_p ${updated}건, vct_roster ${rosterCreated}건, 스킵 ${skipped}건`);
    res.json(report);
  } catch (e) {
    console.error("[rebuild-vct-p]", e);
    res.status(500).json({ error: e.message });
  }
});

/* ── 선수 주식 전체 환불 (매입가 기준) ─────────────────────────────────────
   모든 유저의 holdings:* 를 읽어 avgPrice × qty 합산 후 coins: 에 환불,
   holdings: 는 {} 로 초기화. 폐쇄 시 일괄 정산용.                         */
app.post("/api/admin/stock-refund-all", requireAdmin, async (req, res) => {
  try {
    /* 1. 모든 holdings: 와 coins: 로드 */
    const [holdRows, coinRows] = await Promise.all([
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'holdings:%'"),
      pool.query("SELECT key, value FROM app_data WHERE key LIKE 'coins:%'"),
    ]);

    /* coins 맵: username → 현재 코인 */
    const coinMap = {};
    coinRows.rows.forEach(r => {
      const uname = r.key.slice(6); /* "coins:XXX" → "XXX" */
      coinMap[uname] = parseInt(r.value, 10) || 0;
    });

    const report = []; /* { username, refund, holdingsBefore } */
    const updates = []; /* DB upsert 목록 */

    holdRows.rows.forEach(r => {
      const uname = r.key.slice(9); /* "holdings:XXX" → "XXX" */
      let holdings;
      try { holdings = JSON.parse(r.value); } catch { return; }
      if (!holdings || typeof holdings !== "object") return;

      /* 환불액 계산: avgPrice × qty 합산 */
      let refund = 0;
      const holdingsBefore = {};
      Object.entries(holdings).forEach(([pName, h]) => {
        if (!h || !h.qty || h.qty <= 0) return;
        const amt = (h.avgPrice || 0) * h.qty;
        refund += amt;
        holdingsBefore[pName] = { qty: h.qty, avgPrice: h.avgPrice || 0, refund: amt };
      });

      if (refund === 0 && Object.keys(holdingsBefore).length === 0) return; /* 보유 없으면 스킵 */

      const newCoins = (coinMap[uname] || 0) + refund;
      report.push({ username: uname, refund, holdingsBefore, newCoins });

      /* coins 갱신 */
      updates.push(pool.query(
        `INSERT INTO app_data (key,value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [`coins:${uname}`, String(newCoins)]
      ));
      /* holdings 초기화 */
      updates.push(pool.query(
        `INSERT INTO app_data (key,value) VALUES ($1,$2)
         ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
        [`holdings:${uname}`, "{}"]
      ));
    });

    await Promise.all(updates);

    const totalRefund  = report.reduce((s, r) => s + r.refund, 0);
    const totalUsers   = report.length;
    console.log(`[stock-refund-all] ${totalUsers}명 환불 완료, 총 ${totalRefund}코인 반환`);
    res.json({ ok: true, totalUsers, totalRefund, detail: report });
  } catch (e) {
    console.error("[stock-refund-all]", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/admin/stock-apply-players", requireAdmin, async (req, res) => {
  try {
    const players = req.body.players || []; // [{ name, acs }]
    const matchKey = req.body.matchKey || null;

    /* matchKey가 있으면 auto-match가 이미 처리했는지 확인 */
    if (matchKey) {
      const amRow = await pool.query(
        "SELECT value FROM app_data WHERE key=$1",
        [`auto-match:${matchKey}`]
      );
      if (amRow.rows.length > 0) {
        const am = JSON.parse(amRow.rows[0].value || "{}");
        if (am.filledMaps && am.filledMaps.length > 0) {
          console.log(`[stock-apply] ${matchKey} auto-match이 이미 처리함 (filledMaps=${am.filledMaps.length}) → 수동 주식 적용 skip`);
          return res.json({ ok: true, applied: 0, skipped: "auto-match already applied" });
        }
      }
    }

    for (const p of players) {
      if (p.name && typeof p.acs === "number" && p.acs > 0) {
        await applyAcsToStock(p.name, p.acs);
      }
    }
    res.json({ ok: true, applied: players.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

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

      /* 새로 완료된 맵 감지 — 주식은 pollAutoMatches(자동입력 ON) 또는 수동 import에서만 적용 */
      console.log(`[stock] 매치 ${matchId} / 맵 ${map.title || mapId} 완료 감지 (주식 적용은 auto-match 등록 경기만)`);
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

/* 팀 이름 퍼지 매칭: 정확 일치 → 포함 관계 → 단어 토큰 겹침 → 악센트 제거 비교 */
/* 팀 이름 fuzzy 매칭
   - 정확일치 → contains → 단어 토큰(공통단어 제외) → 악센트 제거
   - "Team Heretics"·"Team Vitality" 처럼 "team" 공유 → false 여야 함 */
const TEAM_GENERIC_WORDS = new Set(["team","esports","esport","gaming","games","club","fc","sc","gg","gc","red","blue"]);
function teamFuzzyMatch(apiTitle, queryName) {
  if (!apiTitle || !queryName) return false;
  const t = normalizeTeamName(apiTitle);
  const q = normalizeTeamName(queryName);
  if (t === q) return true;
  if (t.includes(q) || q.includes(t)) return true;
  // 단어 토큰 매칭 — 공통 단어(team, esports 등) 제외, 길이 4 이상만
  const tWords = apiTitle.toLowerCase().split(/[\s\-_]+/).filter(w => w.length >= 4 && !TEAM_GENERIC_WORDS.has(w));
  const qWords = queryName.toLowerCase().split(/[\s\-_]+/).filter(w => w.length >= 4 && !TEAM_GENERIC_WORDS.has(w));
  if (tWords.length > 0 && qWords.length > 0 &&
      qWords.some(qw => tWords.some(tw => tw.startsWith(qw) || qw.startsWith(tw)))) return true;
  // 악센트 제거 비교 (é→e, á→a, Ü→U 등)
  const strip = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return strip(t) === strip(q) || strip(t).includes(strip(q)) || strip(q).includes(strip(t));
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
              const titles = (m.teams || []).map((t) => t.title || "");
              return titles.some(t => teamFuzzyMatch(t, am.team1)) &&
                     titles.some(t => teamFuzzyMatch(t, am.team2));
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
            .filter((p) => teamFuzzyMatch(p.teamTitle, am.team1) && p.averageCombatScore > 0)
            .sort((a, b) => b.averageCombatScore - a.averageCombatScore)
            .slice(0, 5);
          const teamBPlayers = players
            .filter((p) => teamFuzzyMatch(p.teamTitle, am.team2) && p.averageCombatScore > 0)
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
            const vRow = await pool.query("SELECT key, value FROM app_data WHERE lower(key)=lower($1)", [vk]);
            let vData = {};
            let vKey = vk;
            if (vRow.rows[0]) {
              vKey = vRow.rows[0].key;
              try { vData = JSON.parse(vRow.rows[0].value); } catch {}
            }
            if (!vData.maps) vData.maps = [];
            /* 이미 이 맵 항목이 있으면 덮어쓰기, 없으면 추가 */
            const existIdx = vData.maps.findIndex(m => m.matchKey === am.matchKey && m.mapIdx === mapIdx);
            /* matchKey에서 tournament·stage 파싱 ("london|playoffs|m1", "london|swiss|groupA|0" 등) */
            const _MK_TOURNAMENTS = new Set(["london", "santiago"]);
            const _MK_STAGES      = new Set(["swiss", "playoffs", "groupstage", "stage1", "stage2", "stage1playoffs", "stage2playoffs", "kickoff"]);
            const _mkParts = (am.matchKey || "").split("|");
            const _mkTournament = _mkParts.find(p => _MK_TOURNAMENTS.has(p.toLowerCase())) || "";
            const _mkStage      = _mkParts.find(p => _MK_STAGES.has(p.toLowerCase())) || "";

            const entry = {
              matchKey   : am.matchKey,
              mapIdx,
              league     : am.league || "",
              ..._mkTournament && { tournament: _mkTournament.toLowerCase() },
              ..._mkStage      && { stage:      _mkStage.toLowerCase() },
              acs        : p.averageCombatScore,
              kda        : `${p.kills}/${p.deaths}/${p.assists}`,
              agent      : AGENT_EN_TO_KO[p.agents?.[0]?.title] || p.agents?.[0]?.title || "",
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

          /* ── 선수 주식 즉시 반영 (applyAcsToStock 내부에서 중복 방지) ── */
          for (const p of [...teamAPlayers, ...teamBPlayers]) {
            if (p.nickname && typeof p.averageCombatScore === "number" && p.averageCombatScore > 0) {
              try {
                await applyAcsToStock(p.nickname, p.averageCombatScore);
              } catch (stockErr) {
                console.error(`[auto-match] 주식 적용 오류 (${p.nickname}):`, stockErr.message);
              }
            }
          }
          if (!processedMaps[tsMatchId]) processedMaps[tsMatchId] = [];
          if (!processedMaps[tsMatchId].includes(map.id)) processedMaps[tsMatchId].push(map.id);

          /* ── 라운드 결과 & 스코어 자동 입력 ─────────────────────── */
          try {
            /* teamId → "a" | "b" 매핑: 여러 ID 필드를 순서대로 시도 (spike-match와 동일 로직) */
            const teamIdMap = {};
            const ID_FIELDS = ["participantId", "teamId", "organizationId", "teamParticipantId"];
            const rawRounds0 = map.rounds || [];
            for (const field of ID_FIELDS) {
              players.forEach((p) => {
                const val = p[field];
                if (val == null || p.averageCombatScore <= 0) return;
                const id = String(val);
                if (teamFuzzyMatch(p.teamTitle, am.team1)) teamIdMap[id] = "a";
                else if (teamFuzzyMatch(p.teamTitle, am.team2)) teamIdMap[id] = "b";
              });
              if (rawRounds0.length > 0) {
                const r0 = rawRounds0[0];
                if (teamIdMap[String(r0.attackingTeamId)] || teamIdMap[String(r0.winningTeamId)]) break;
              } else break;
              Object.keys(teamIdMap).forEach(k => delete teamIdMap[k]);
            }
            /* 여전히 매핑 실패 시 브루트포스 */
            if (rawRounds0.length > 0 && !teamIdMap[String(rawRounds0[0].attackingTeamId)]) {
              const roundTeamIds = [...new Set(
                rawRounds0.flatMap(r => [r.attackingTeamId, r.winningTeamId].filter(v => v != null).map(String))
              )];
              if (roundTeamIds.length >= 2) {
                const sampleA = players.find(p => teamFuzzyMatch(p.teamTitle, am.team1));
                const sampleB = players.find(p => teamFuzzyMatch(p.teamTitle, am.team2));
                const sample = sampleA || sampleB;
                if (sample) {
                  for (const [, v] of Object.entries(sample)) {
                    if (roundTeamIds.includes(String(v))) {
                      teamIdMap[String(v)] = sampleA ? "a" : "b";
                      const other = roundTeamIds.find(id => id !== String(v));
                      if (other) teamIdMap[other] = sampleA ? "b" : "a";
                      break;
                    }
                  }
                }
              }
            }

            const rawRounds = rawRounds0; // rawRounds0 = map.rounds || [] (위에서 선언)

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

          /* filledMaps를 맵 처리 직후 즉시 저장 (중간 오류 시 재처리 방지) */
          await pool.query(
            `INSERT INTO app_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`,
            [`auto-match:${am.matchKey}`, JSON.stringify(am)]
          );
        }
      } catch (e) {
        console.error(`[auto-match] ${am.team1} vs ${am.team2} 오류:`, e.message);
      }
    }
  } catch (e) {
    console.error("[auto-match] 전체 오류:", e.message);
  }
}

/* ── SPA fallback (반드시 모든 API 라우트 아래에 위치) ── */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

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
  }, 60 * 1000); /* 1분마다 */
  console.log("[stock] 자동 주가 폴링 시작 (1분 주기, 맵별 감지)");
});
