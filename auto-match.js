/* auto-match.js
 * thespike.gg Match ID 기반 자동 경기 입력
 * 모든 match-dark 페이지에서 auth.js 다음에 include
 *
 * ⚡ 바로 적용  — 이미 끝난 경기: 서버가 즉시 전체 맵 데이터 가져와서 저장
 * 📡 실시간 적용 — 진행 중인 경기: 1분 주기 서버 폴링, 맵 완료 시 SSE 수신
 */
(function () {
  'use strict';

  /* ── CSS ── */
  var _s = document.createElement('style');
  _s.textContent = [
    '#am-panel {',
    '  display: none;',
    '  align-items: center;',
    '  gap: 8px;',
    '  padding: 9px 20px;',
    '  background: rgba(255,255,255,.025);',
    '  border-bottom: 1px solid rgba(255,255,255,.06);',
    '  flex-wrap: wrap;',
    '}',
    '.am-label {',
    '  font-size: 10px;',
    '  font-family: "Barlow Condensed", sans-serif;',
    '  color: rgba(255,255,255,.3);',
    '  text-transform: uppercase;',
    '  letter-spacing: .07em;',
    '  white-space: nowrap;',
    '}',
    '#am-id-input {',
    '  font-family: "Barlow Condensed", monospace;',
    '  font-size: 13px;',
    '  padding: 5px 10px;',
    '  background: rgba(255,255,255,.07);',
    '  border: 1px solid rgba(255,255,255,.14);',
    '  border-radius: 5px;',
    '  color: #fff;',
    '  width: 120px;',
    '  outline: none;',
    '  transition: border-color .15s;',
    '}',
    '#am-id-input::placeholder { color: rgba(255,255,255,.3); }',
    '#am-id-input:focus { border-color: rgba(255,255,255,.35); }',
    '.am-btn {',
    '  display: inline-flex; align-items: center; gap: 5px;',
    '  padding: 5px 13px;',
    '  border-radius: 5px;',
    '  font-size: 11px; font-weight: 700;',
    '  cursor: pointer; transition: all .15s; border: 1px solid;',
    '  font-family: "Barlow Condensed", sans-serif;',
    '  letter-spacing: .05em; text-transform: uppercase;',
    '  white-space: nowrap;',
    '}',
    '.am-btn:active { opacity: .75; }',
    '#am-now-btn {',
    '  background: rgba(90,180,255,.12);',
    '  border-color: rgba(90,180,255,.4);',
    '  color: #5ab4ff;',
    '}',
    '#am-now-btn:hover {',
    '  background: rgba(90,180,255,.26);',
    '  border-color: rgba(90,180,255,.7);',
    '}',
    '#am-now-btn:disabled {',
    '  opacity: .45; cursor: default;',
    '}',
    '#am-live-btn {',
    '  background: rgba(255,255,255,.06);',
    '  border-color: rgba(255,255,255,.14);',
    '  color: rgba(255,255,255,.5);',
    '}',
    '#am-live-btn:hover {',
    '  background: rgba(255,255,255,.12);',
    '  border-color: rgba(255,255,255,.3);',
    '}',
    '#am-live-btn.am-live-on {',
    '  background: rgba(255,70,70,.12);',
    '  border-color: rgba(255,70,70,.4);',
    '  color: #ff6666;',
    '}',
    '#am-status {',
    '  font-size: 11px;',
    '  font-family: "Barlow Condensed", sans-serif;',
    '  color: rgba(255,255,255,.45);',
    '  margin-left: 4px;',
    '  flex: 1; min-width: 0;',
    '}',
  ].join('\n');
  document.head.appendChild(_s);

  /* ── 패널 HTML 삽입 (header 바로 아래) ── */
  function injectPanel() {
    if (document.getElementById('am-panel')) return;
    var panel = document.createElement('div');
    panel.id = 'am-panel';
    panel.innerHTML = [
      '<span class="am-label">thespike ID</span>',
      '<input type="text" id="am-id-input" placeholder="예: 144809" inputmode="numeric" />',
      '<button class="am-btn" id="am-now-btn">⚡ 바로 적용</button>',
      '<button class="am-btn" id="am-live-btn">📡 실시간 적용</button>',
      '<span id="am-status"></span>',
    ].join('');
    var header = document.querySelector('.site-header') || document.querySelector('header');
    if (header && header.parentNode) {
      header.parentNode.insertBefore(panel, header.nextSibling);
    } else {
      document.body.insertBefore(panel, document.body.firstChild);
    }
    document.getElementById('am-now-btn').addEventListener('click', applyNow);
    document.getElementById('am-live-btn').addEventListener('click', toggleLive);
  }

  /* ── 유틸 ── */
  function tok() { return localStorage.getItem('vct_auth_token') || ''; }
  function mk()  { return (typeof window.MATCH_KEY !== 'undefined' && window.MATCH_KEY) ? window.MATCH_KEY : ''; }
  function t1()  { return typeof window.MATCH_TEAM_A !== 'undefined' ? window.MATCH_TEAM_A : ''; }
  function t2()  { return typeof window.MATCH_TEAM_B !== 'undefined' ? window.MATCH_TEAM_B : ''; }
  function lg()  { return typeof window.LEAGUE !== 'undefined' ? window.LEAGUE : ''; }

  /* localStorage 키 — LOCAL_ONLY_PREFIXES 등록됨 */
  function lsIdKey()   { return '__vct_am_id:'   + mk(); }
  function lsLiveKey() { return '__vct_am:'       + mk(); } /* 기존 키와 호환 유지 */

  var _isLive = false;

  function setStatus(txt) {
    var el = document.getElementById('am-status');
    if (el) el.textContent = txt;
  }

  function setLiveStyle(on) {
    _isLive = on;
    var btn = document.getElementById('am-live-btn');
    if (!btn) return;
    if (on) {
      btn.textContent = '🔴 실시간 중지';
      btn.classList.add('am-live-on');
    } else {
      btn.textContent = '📡 실시간 적용';
      btn.classList.remove('am-live-on');
    }
  }

  /* ── 렌더 헬퍼 (각 match-dark 페이지의 전역 함수 호출) ── */
  function refreshMap(mapIdx) {
    if (typeof window.maps === 'undefined' || !window.maps[mapIdx]) return;
    var m = window.maps[mapIdx];
    if (typeof window.loadPlayersSync    === 'function') window.loadPlayersSync(mapIdx);
    if (typeof window.loadRoundState     === 'function') window.loadRoundState(mapIdx);
    if (typeof window.loadStatsState     === 'function') window.loadStatsState(mapIdx);
    if (typeof window.renderMap          === 'function') window.renderMap(m, mapIdx);
    if (typeof window.renderRoundTracker === 'function') window.renderRoundTracker(m, mapIdx);
    if (typeof window.renderTeamStats    === 'function') window.renderTeamStats(m, mapIdx);
  }

  function refreshAllMaps() {
    if (typeof window.maps === 'undefined') return;
    window.maps.forEach(function (_, i) { refreshMap(i); });
  }

  /* ── ⚡ 바로 적용 ── */
  function applyNow() {
    var input = document.getElementById('am-id-input');
    var tsId  = (input ? input.value : '').trim();
    if (!tsId)  { alert('thespike Match ID를 입력하세요.'); return; }
    if (!mk())  { alert('경기 키(MATCH_KEY)를 찾을 수 없습니다.'); return; }

    /* thespike ID를 localStorage에도 저장 */
    try { localStorage.setItem(lsIdKey(), tsId); } catch (_) {}

    var nowBtn = document.getElementById('am-now-btn');
    if (nowBtn) { nowBtn.disabled = true; nowBtn.textContent = '⏳ 처리 중...'; }
    setStatus('서버에서 데이터를 가져오는 중...');

    fetch('/api/auto-match/apply-now', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok() },
      body: JSON.stringify({ matchKey: mk(), thespikeMatchId: tsId, team1: t1(), team2: t2(), league: lg() }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (nowBtn) { nowBtn.disabled = false; nowBtn.textContent = '⚡ 바로 적용'; }
        if (d.ok) {
          setStatus('✅ ' + (d.applied || 0) + '/' + (d.totalMaps || '?') + '맵 적용 완료');
          setTimeout(function () { syncFromServer(true); }, 400);
        } else {
          setStatus('❌ ' + (d.error || '알 수 없는 오류'));
        }
      })
      .catch(function (err) {
        if (nowBtn) { nowBtn.disabled = false; nowBtn.textContent = '⚡ 바로 적용'; }
        setStatus('❌ 네트워크 오류: ' + err.message);
      });
  }

  /* ── 📡 실시간 적용 토글 ── */
  function toggleLive() {
    var input = document.getElementById('am-id-input');
    var tsId  = (input ? input.value : '').trim();
    var key   = mk();

    if (_isLive) {
      /* ── OFF ── */
      fetch('/api/auto-match/' + encodeURIComponent(key), {
        method: 'DELETE',
        headers: { Authorization: 'Bearer ' + tok() },
      }).catch(function () {});
      try { localStorage.removeItem(lsLiveKey()); } catch (_) {}
      setLiveStyle(false);
      setStatus('실시간 적용 중단됨');
    } else {
      /* ── ON ── */
      if (!tsId) { alert('thespike Match ID를 입력하세요.'); return; }
      if (!key)  { alert('경기 키(MATCH_KEY)를 찾을 수 없습니다.'); return; }
      try {
        localStorage.setItem(lsIdKey(),   tsId);
        localStorage.setItem(lsLiveKey(), '1');
      } catch (_) {}
      fetch('/api/auto-match', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok() },
        body: JSON.stringify({ matchKey: key, thespikeMatchId: tsId, team1: t1(), team2: t2(), league: lg() }),
      }).catch(function () {});
      setLiveStyle(true);
      setStatus('🔴 실시간 수신 대기 중 (1분 주기 폴링)');
    }
  }

  /* ── 서버에서 이 경기 데이터 동기화 ── */
  function syncFromServer(force) {
    var key = mk();
    if (!key) return;

    var prefixes = [
      'players:' + key + ':',
      'rounds:'  + key + ':',
      'stats:'   + key + ':',
      'vct_bo:'  + key,
    ];

    Promise.all(prefixes.map(function (pfx) {
      return fetch('/api/data-prefix?prefix=' + encodeURIComponent(pfx))
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
    })).then(function (results) {
      var changed = {};
      results.forEach(function (data) {
        Object.keys(data).forEach(function (k) {
          var v = data[k];
          if (v == null) return;
          if (!force && localStorage.getItem(k) === v) return;
          try { localStorage.setItem(k, v); } catch (_) {}
          var m = k.match(/:(\d+)$/);
          if (m) changed[+m[1]] = true;
          else   changed[-1]    = true;
        });
      });
      var idxs = Object.keys(changed).map(Number);
      if (idxs.length === 0 && !force) return;
      if (force || changed[-1]) {
        refreshAllMaps();
      } else {
        idxs.forEach(function (i) { if (i >= 0) refreshMap(i); });
      }
    });
  }

  /* ── SSE: auto-match-filled 수신 ── */
  /* auth.js / storage.js의 SSE와 중복 방지: 이 페이지에서 별도 EventSource 추가 불필요
     storage.js SSE가 "set" 이벤트로 localStorage를 먼저 업데이트하고,
     이후 auto-match-filled 커스텀 이벤트로 렌더링 트리거 */
  window.addEventListener('vct-auto-match-filled', function (e) {
    var detail = e.detail || {};
    if (detail.matchKey !== mk()) return;
    setTimeout(function () {
      refreshMap(detail.mapIdx);
      setStatus('✅ 맵' + (detail.mapIdx + 1) + (detail.mapName ? ' (' + detail.mapName + ')' : '') + ' 자동 입력 완료');
    }, 600);
  });

  /* ── 60초 백업 폴링 (실시간 ON 시 SSE 누락 방지) ── */
  setInterval(function () {
    if (_isLive) syncFromServer(false);
  }, 60 * 1000);

  /* ── 패널 표시 및 상태 복원 (admin 확인 후) ── */
  function initPanel() {
    if (!window.vctIsAdmin || !window.vctIsAdmin()) return;

    var panel = document.getElementById('am-panel');
    if (!panel) return;
    panel.style.display = 'flex';

    /* localStorage에서 thespike ID 복원 */
    var savedId = '';
    try { savedId = localStorage.getItem(lsIdKey()) || ''; } catch (_) {}
    var input = document.getElementById('am-id-input');
    if (input && savedId) input.value = savedId;

    /* 서버에서 현재 실시간 적용 상태 확인 */
    fetch('/api/auto-match', { headers: { Authorization: 'Bearer ' + tok() } })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (list) {
        var found = list.find(function (item) { return item.matchKey === mk(); });
        setLiveStyle(!!found);
        if (found) {
          var filled = (found.filledMaps || []).length;
          setStatus('🔴 실시간 수신 중 (' + filled + '맵 완료)');
          /* 서버의 thespike ID → input에 복원 */
          if (found.thespikeMatchId) {
            if (input && !input.value) input.value = String(found.thespikeMatchId);
            try { localStorage.setItem(lsIdKey(), String(found.thespikeMatchId)); } catch (_) {}
          }
          try { localStorage.setItem(lsLiveKey(), '1'); } catch (_) {}
        }
      })
      .catch(function () {});
  }

  /* ── 초기 실행 ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectPanel);
  } else {
    injectPanel();
  }

  window.addEventListener('load', function () {
    setTimeout(initPanel, 150);
    /* 초기 서버 동기화 (새로고침 시 SSE 누락분 복구) */
    setTimeout(function () { syncFromServer(false); }, 900);
  });

}());
