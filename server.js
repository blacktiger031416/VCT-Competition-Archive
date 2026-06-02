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

/* ── API: 전체 뷰어 새로고침 트리거 ─────────────── */
app.post("/api/refresh", (req, res) => {
  broadcast({ type: "force-reload" });
  res.json({ ok: true });
});

/* ── SPA fallback ─────────────────────────────────── */
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`VCT Archive server running on port ${PORT}`);
});
