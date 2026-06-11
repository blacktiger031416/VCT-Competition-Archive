/**
 * test-poll.js — 자동 주가 폴링 로직 로컬 테스트
 * DB 없이 인메모리로 실행. 실제 thespike.gg API 호출.
 *
 * 테스트 경기 (Masters London 2026 Swiss Stage):
 *   [완료] Global Esports vs Leviatán     (Match ID: 145492)
 *   [진행] Team Vitality vs Dragon Ranger (Match ID: 145490, 3맵 진행중)
 *
 * 실행: node test-poll.js
 */

/* ── 인메모리 DB (mock) ─────────────────────────────── */
const mockDB = {};
let broadcastLog = [];

function dbGet(key) {
  const val = mockDB[key];
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}
function dbSet(key, obj) {
  mockDB[key] = JSON.stringify(obj);
}
function broadcast(payload) {
  broadcastLog.push(payload.key);
}

/* ── server.js의 getStockState (인메모리 버전) ── */
function getStockState(name) {
  const key = `stock_p:${name}`;
  const val = mockDB[key];
  if (!val) return null;
  try { return { state: JSON.parse(val), resolvedKey: key }; } catch { return null; }
}
function saveStockState(name, state, resolvedKey) {
  const key = resolvedKey || `stock_p:${name}`;
  mockDB[key] = JSON.stringify(state);
  broadcast({ type: "set", key, value: JSON.stringify(state) });
}
function initStockFromVctP(name, fallbackAcs) {
  const vctKey = `vct_p:${name}`;
  const vctRaw = mockDB[vctKey];
  let avgAcs = fallbackAcs || 200;
  let resolvedName = name;
  if (vctRaw) {
    const vctData = JSON.parse(vctRaw);
    const maps = vctData.maps || [];
    let total = 0, cnt = 0;
    maps.forEach(m => {
      const a = parseFloat(m.acs) || 0;
      if (a > 0) { total += a; cnt++; }
    });
    if (cnt > 0) avgAcs = Math.round(total / cnt);
  } else if (!fallbackAcs) {
    return null;
  }
  const initPrice = Math.max(1, Math.round(avgAcs / 10));
  return { state: { price: initPrice, ref: avgAcs, history: [initPrice], runTotal: 0, runCount: 0 },
           resolvedKey: `stock_p:${resolvedName}` };
}

/* ── server.js와 동일한 applyAcsToStock (최신 수정 반영) ── */
function applyAcsToStock(name, newAcs) {
  let found = getStockState(name);
  const isNew = !found;
  if (!found) found = initStockFromVctP(name, newAcs);
  if (!found) return { skipped: true, reason: "no init" };

  const { state, resolvedKey } = found;

  if (isNew) {
    saveStockState(name, state, resolvedKey);
    return { isNew: true, price: state.price, ref: state.ref };
  }

  if (newAcs === state.ref) {
    return { skipped: true, reason: "duplicate ACS" };
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
  saveStockState(name, newState, resolvedKey);
  return { before: state.price, after: newPrice, pctChange };
}

/* ── processMatch (server.js와 동일 구조) ── */
const processedMaps = {};

async function processMatch(matchId) {
  const res  = await fetch(`https://api.thespike.gg/match/${matchId}/stats`);
  if (!res.ok) { console.error("API 오류:", res.status); return; }
  const data = await res.json();
  const maps = data.maps || [];

  if (!processedMaps[matchId]) processedMaps[matchId] = [];
  const done = processedMaps[matchId];

  let newMapCount = 0;
  for (const map of maps) {
    const mapId   = map.id;
    const players = map.players || [];

    if (done.includes(mapId)) {
      console.log(`  ↩  맵 ${map.title||mapId}: 이미 처리됨 (processedMaps) — skip`);
      continue;
    }

    const hasData = players.some(p => typeof p.averageCombatScore === "number" && p.averageCombatScore > 0);
    if (!hasData) {
      console.log(`  ⏳ 맵 ${map.title||mapId}: 아직 데이터 없음 (진행중/미시작) — skip`);
      continue;
    }

    console.log(`\n  🗺  맵 ${map.title||mapId} (${players.length}명 데이터)`);
    for (const p of players) {
      if (!p.nickname || !(p.averageCombatScore > 0)) continue;
      const r = applyAcsToStock(p.nickname, p.averageCombatScore);
      const marker = r.isNew ? "🆕" : r.skipped ? "⏭ " : r.after > r.before ? "🔴▲" : r.after < r.before ? "🔵▼" : "⬜━";
      let detail = "";
      if (r.isNew)     detail = `신규등록 가격=${r.price} (ACS ${r.ref})`;
      else if (r.skipped) detail = `건너뜀 (${r.reason})`;
      else detail = `${r.before}→${r.after} 코인 (${r.pctChange>=0?"+":""}${(r.pctChange*100).toFixed(1)}%)`;
      console.log(`    ${marker} ${p.nickname.padEnd(12)} ACS ${String(p.averageCombatScore).padStart(3)}  ${detail}`);
    }
    done.push(mapId);
    newMapCount++;
  }
  return newMapCount;
}

/* ── 테스트 실행 ────────────────────────────────────── */
(async () => {
  const LINE = "═".repeat(60);
  const line = "─".repeat(60);

  /* ╔══ 1. 완료된 경기 테스트 (GE vs Leviatán, 3맵 모두 완료) ══╗ */
  console.log("\n" + LINE);
  console.log("TEST 1: GE vs Leviatán (match 145492) — 3맵 완료");
  console.log("  신규 선수 (stock_p: 없음) 초기화 확인");
  console.log(LINE);

  /* 선수 데이터 없이 시작 (isNew 경로 테스트) */
  const t1Start = Date.now();
  await processMatch(145492);
  const t1End = Date.now();

  console.log(`\n  ⏱  처리 시간: ${t1End - t1Start}ms`);

  /* stock_p: 저장 확인 */
  const geLeviatan_players = ["Kr1stal", "autumn", "UdoTan", "PatMen", "xavi8k",
                              "Sato", "Neon", "spikeziN", "Melser", "Shyy"];
  console.log("\n  📦 저장된 stock_p: 데이터 확인:");
  let savedCount = 0;
  for (const name of geLeviatan_players) {
    const s = dbGet(`stock_p:${name}`);
    if (s) {
      const histOk = Array.isArray(s.history) && s.history.every(h => typeof h === "number");
      console.log(`    ✅ ${name.padEnd(12)} price=${s.price} ref=${s.ref} history=[${s.history.slice(0,3).join(",")}...] histType=${histOk?"number":"⚠️ object"}`);
      savedCount++;
    } else {
      console.log(`    ❌ ${name}: stock_p: 없음`);
    }
  }
  console.log(`\n  저장 확인: ${savedCount}/${geLeviatan_players.length}명`);

  /* ╔══ 2. 중복 방지 테스트 — 같은 경기 2번 실행 ══╗ */
  console.log("\n" + LINE);
  console.log("TEST 2: 같은 경기 2번 실행 — 중복 방지 (processedMaps)");
  console.log(LINE);

  const kr1stalBefore = dbGet("stock_p:Kr1stal");
  console.log(`  Kr1stal 현재 가격: ${kr1stalBefore?.price} (ACS ref: ${kr1stalBefore?.ref})`);

  const t2Start = Date.now();
  await processMatch(145492); // 두 번째 실행
  const t2End = Date.now();

  const kr1stalAfter = dbGet("stock_p:Kr1stal");
  const changed = kr1stalBefore?.price !== kr1stalAfter?.price;
  console.log(`  Kr1stal 재실행 후: ${kr1stalAfter?.price} → ${changed ? "⚠️ 가격 변동됨 (중복!)" : "✅ 변동 없음"}`);
  console.log(`  ⏱  처리 시간: ${t2End - t2Start}ms (processedMaps로 빠르게 skip)`);

  /* ╔══ 3. 진행 중 경기 테스트 (Vitality vs DRG, 3맵 중 2맵 완료) ══╗ */
  console.log("\n" + LINE);
  console.log("TEST 3: Vitality vs DRG (match 145490) — 3맵 중 2맵만 완료");
  console.log("  3맵(Haven)은 ACS 0 → 주가 적용 안 돼야 함");
  console.log(LINE);

  const t3Start = Date.now();
  const newMaps = await processMatch(145490);
  const t3End = Date.now();
  console.log(`\n  ⏱  처리 시간: ${t3End - t3Start}ms`);
  console.log(`  처리된 맵 수: ${newMaps} (예상: 2)`);

  const derke = dbGet("stock_p:Derke");
  console.log(`  Derke stock_p: ${derke ? `price=${derke.price} ref=${derke.ref} histLen=${derke.history?.length}` : "없음"}`);

  /* ╔══ 4. history 타입 확인 ══╗ */
  console.log("\n" + LINE);
  console.log("TEST 4: history 배열 타입 — number[] 확인 (NaN/[object Object] 방지)");
  console.log(LINE);
  let histErrors = 0;
  for (const key of Object.keys(mockDB)) {
    if (!key.startsWith("stock_p:")) continue;
    const s = dbGet(key);
    if (!s || !s.history) continue;
    for (const h of s.history) {
      if (typeof h !== "number" || isNaN(h)) {
        console.log(`  ⚠️ ${key}: history에 잘못된 값: ${JSON.stringify(h)}`);
        histErrors++;
      }
    }
  }
  console.log(`  history 타입 오류: ${histErrors}개 (0이어야 함)`);

  /* ╔══ 5. SSE broadcast 확인 ══╗ */
  console.log("\n" + LINE);
  console.log("TEST 5: SSE broadcast 호출 횟수 확인");
  console.log(LINE);
  const uniqueKeys = new Set(broadcastLog);
  const stockBroadcasts = broadcastLog.filter(k => k.startsWith("stock_p:"));
  console.log(`  broadcast 총 호출: ${broadcastLog.length}회`);
  console.log(`  stock_p: broadcast: ${stockBroadcasts.length}회`);
  console.log(`  고유 선수 수: ${uniqueKeys.size}명`);

  /* ╔══ 최종 요약 ══╗ */
  console.log("\n" + LINE);
  console.log("최종 요약");
  console.log(LINE);
  const allStocks = Object.keys(mockDB)
    .filter(k => k.startsWith("stock_p:"))
    .map(k => ({ name: k.slice(8), ...dbGet(k) }));
  allStocks.sort((a, b) => b.price - a.price);
  for (const s of allStocks) {
    const histLen = s.history?.length || 0;
    console.log(`  ${s.name.padEnd(14)} price=${String(s.price).padStart(4)} ref=${String(s.ref).padStart(3)} histLen=${histLen}`);
  }

  /* 검증 결과 */
  console.log("\n" + LINE);
  const errors = [];
  if (savedCount < geLeviatan_players.length * 0.8) errors.push("GE/Leviatan 선수 저장 부족");
  if (changed) errors.push("중복 적용 발생");
  if (histErrors > 0) errors.push("history 타입 오류");
  if (newMaps !== 2) errors.push(`Vitality vs DRG 처리 맵 수 오류 (${newMaps}개, 예상 2개)`);

  if (errors.length === 0) {
    console.log("✅ 모든 테스트 통과");
  } else {
    console.log("❌ 실패:", errors.join(", "));
    process.exitCode = 1;
  }
  console.log(LINE + "\n");
})();
