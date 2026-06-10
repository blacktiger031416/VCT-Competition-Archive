/**
 * test-poll.js — 자동 주가 폴링 로직 로컬 테스트
 * DB 없이 인메모리로 실행. 실제 thespike.gg API 호출.
 *
 * 테스트 경기: Masters London 2026 Swiss Stage
 *   FULL SENSE vs Global Esports (Match ID: 145496)
 *
 * 실행: node test-poll.js
 */

/* ── 인메모리 DB (mock) ─────────────────────────────── */
const mockDB = {};

function dbGet(key) {
  const val = mockDB[key];
  if (!val) return null;
  try { return JSON.parse(val); } catch { return null; }
}
function dbSet(key, obj) {
  mockDB[key] = JSON.stringify(obj);
}
function broadcast(payload) {
  /* 테스트용: SSE 대신 콘솔 출력 */
  // console.log("[SSE]", payload.key, "→", payload.value?.slice(0, 60));
}

/* ── 테스트용 초기 주가 데이터 세팅 ─────────────────── */
/* 실제 stock_p:{playerName} 구조와 동일 */
const INITIAL_PRICE = 1000; // 모든 선수 초기 주가 동일하게
const TEST_PLAYERS = [
  /* FULL SENSE */
  "Primmie", "JitBoyS", "Crws", "Killua", "Leviathan",
  /* Global Esports */
  "PatMen", "Kr1stal", "xavi8k", "UdoTan", "autumn",
];

for (const name of TEST_PLAYERS) {
  dbSet(`stock_p:${name}`, {
    price    : INITIAL_PRICE,
    ref      : 200, // 평균 ACS 기준점 (임의 설정)
    history  : [],
    runTotal : 200,
    runCount : 1,
  });
}

/* ── 주가 계산 & 적용 로직 (server.js와 동일) ───────── */
function applyAcsToStock(playerName, newAcs) {
  const state = dbGet(`stock_p:${playerName}`);
  if (!state) return null; // DB에 없는 선수

  const pctChange = (newAcs - state.ref) / state.ref;
  const newPrice  = Math.max(1, Math.round(state.price * (1 + pctChange)));
  const newState  = {
    ...state,
    price    : newPrice,
    ref      : newAcs,
    history  : [...(state.history || []), { price: newPrice, ts: Date.now() }],
    runTotal : (state.runTotal || 0) + newAcs,
    runCount : (state.runCount || 0) + 1,
  };
  dbSet(`stock_p:${playerName}`, newState);
  broadcast({ type: "set", key: `stock_p:${playerName}`, value: JSON.stringify(newState) });
  return { before: state.price, after: newPrice, pctChange };
}

/* ── 매치 처리 (server.js processMatch와 동일 — 맵별 감지) ── */
const processedMaps = {}; // { matchId: [mapId, ...] }

async function processMatch(matchId) {
  console.log(`\n📡 api.thespike.gg/match/${matchId}/stats 호출 중...\n`);
  const res  = await fetch(`https://api.thespike.gg/match/${matchId}/stats`);
  if (!res.ok) { console.error("API 오류:", res.status); return; }
  const data = await res.json();
  const maps = data.maps || [];

  console.log(`📊 총 ${maps.length}맵 데이터 수신\n`);

  if (!processedMaps[matchId]) processedMaps[matchId] = [];
  const done = processedMaps[matchId];

  for (const map of maps) {
    const mapId   = map.id;
    const players = map.players || [];

    if (done.includes(mapId)) {
      console.log(`── 맵: ${map.title || mapId} → 이미 처리됨, skip\n`);
      continue;
    }

    const hasData = players.some(p => typeof p.averageCombatScore === "number" && p.averageCombatScore > 0);
    if (!hasData) {
      console.log(`── 맵: ${map.title || mapId} → 아직 데이터 없음 (진행 중 or 미진행)\n`);
      continue;
    }

    console.log(`── 맵: ${map.title || mapId} (${players.length}명) ──`);
    for (const p of players) {
      if (!p.nickname || typeof p.averageCombatScore !== "number") continue;
      const r = applyAcsToStock(p.nickname, p.averageCombatScore);
      if (r) {
        const arrow = r.after > r.before ? "🔴▲" : r.after < r.before ? "🔵▼" : "⬜─";
        const sign  = r.pctChange >= 0 ? "+" : "";
        console.log(
          `  ${arrow} ${p.nickname.padEnd(12)} ACS ${String(p.averageCombatScore).padStart(3)}`
          + `  ${r.before} → ${r.after} 코인  (${sign}${(r.pctChange * 100).toFixed(1)}%)`
        );
      } else {
        console.log(`  ⬜ ${p.nickname.padEnd(12)} ACS ${p.averageCombatScore}  (DB에 없음 — 무시)`);
      }
    }
    done.push(mapId);
    console.log("");
  }

  /* 최종 요약 */
  console.log("═".repeat(55));
  console.log("최종 주가 요약");
  console.log("═".repeat(55));
  for (const name of TEST_PLAYERS) {
    const s = dbGet(`stock_p:${name}`);
    if (!s) continue;
    const diff = s.price - INITIAL_PRICE;
    const sign = diff >= 0 ? "+" : "";
    console.log(`  ${name.padEnd(12)} ${INITIAL_PRICE} → ${s.price} 코인  (${sign}${diff})`);
  }
}

/* ── 실행 ───────────────────────────────────────────── */
(async () => {
  console.log("═".repeat(55));
  console.log("테스트: FULL SENSE vs Global Esports (Match 145496)");
  console.log("초기 주가: 모든 선수 1000 코인, 기준 ACS: 200");
  console.log("═".repeat(55));
  await processMatch(145496);
})();
