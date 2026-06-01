/**
 * batch-modal.js
 * 매치 페이지 내 일괄 입력 팝업
 * 의존: MATCH_KEY, LEAGUE, MATCH_FROM, maps[] (match-dark 전역 변수)
 *       saveFieldSync, getPlayerSideKey (match-dark 함수)
 */
(function () {

  /* ── CSS ── */
  var css = `
    #bm-overlay {
      position: fixed; inset: 0; z-index: 10000;
      display: flex; align-items: center; justify-content: center;
    }
    #bm-overlay[hidden] { display: none !important; }
    #bm-backdrop {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(6px);
    }
    #bm-panel {
      position: relative; z-index: 1;
      width: min(780px, calc(100vw - 24px));
      max-height: 88vh;
      background: #0d1520;
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 16px;
      box-shadow: 0 40px 100px rgba(0,0,0,0.85);
      display: flex; flex-direction: column;
      animation: bmIn 0.22s cubic-bezier(0.16,1,0.3,1);
      overflow: hidden;
    }
    @keyframes bmIn {
      from { opacity:0; transform: scale(0.94) translateY(14px); }
      to   { opacity:1; transform: none; }
    }

    /* 헤더 */
    #bm-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 22px 0; flex-shrink: 0;
    }
    #bm-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 18px; font-weight: 900; letter-spacing: 0.08em;
      text-transform: uppercase; color: #fff;
    }
    #bm-close {
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; color: rgba(255,255,255,0.4); font-size: 18px;
      cursor: pointer; padding: 4px 10px; line-height: 1;
      transition: all 0.12s;
    }
    #bm-close:hover { background: rgba(255,255,255,0.12); color: #fff; }

    /* 탭 */
    #bm-tabs {
      display: flex; gap: 6px; padding: 14px 22px 0; flex-shrink: 0;
    }
    .bm-tab {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; padding: 7px 18px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; color: rgba(255,255,255,0.4);
      cursor: pointer; transition: all 0.12s;
    }
    .bm-tab.active {
      background: rgba(255,70,84,0.15);
      border-color: rgba(255,70,84,0.4);
      color: rgba(255,120,130,1);
    }

    /* 테이블 영역 */
    #bm-body { overflow-y: auto; flex: 1; padding: 14px 22px; }

    .bm-table { width: 100%; border-collapse: collapse; }
    .bm-table thead tr {
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }
    .bm-table th {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; color: rgba(255,255,255,0.25);
      padding: 8px 8px 8px 4px; text-align: left;
    }
    .bm-table tbody tr { border-bottom: 1px solid rgba(255,255,255,0.04); }
    .bm-table tbody tr:last-child { border-bottom: none; }
    .bm-table tbody tr.bm-side-b { background: rgba(100,120,255,0.04); }
    .bm-table td { padding: 5px 4px; vertical-align: middle; }

    .bm-slot {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
      width: 30px; color: rgba(255,255,255,0.2); text-align: center;
    }
    .bm-slot.a { color: rgba(255,90,90,0.6); }
    .bm-slot.b { color: rgba(90,120,255,0.6); }

    .bm-name {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 14px; font-weight: 700;
      color: rgba(255,255,255,0.75); min-width: 80px;
      padding: 0 8px;
    }
    .bm-name.empty { color: rgba(255,255,255,0.2); font-style: italic; }

    .bm-inp {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.09);
      border-radius: 7px; color: #e8e4e0;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 14px; font-weight: 600;
      padding: 7px 9px; outline: none; width: 100%;
      transition: border-color 0.12s, background 0.12s;
    }
    .bm-inp:focus {
      border-color: rgba(255,70,84,0.55);
      background: rgba(255,70,84,0.07);
    }
    .bm-inp.has-val {
      border-color: rgba(80,200,120,0.35);
      background: rgba(80,200,120,0.05);
      color: #8fffa8;
    }
    .bm-inp::placeholder { color: rgba(255,255,255,0.15); }
    .bm-col-agent { width: 110px; }
    .bm-col-acs   { width: 80px; }
    .bm-col-kda   { width: 100px; }

    /* 구분선 */
    .bm-divider td {
      padding: 10px 0 6px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; color: rgba(255,255,255,0.2);
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }

    /* 하단 */
    #bm-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 14px 22px; flex-shrink: 0;
      border-top: 1px solid rgba(255,255,255,0.06);
      background: rgba(255,255,255,0.01);
    }
    #bm-status {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.3);
    }
    #bm-status.ok  { color: rgba(80,200,130,0.9); }
    #bm-status.err { color: rgba(255,80,80,0.9); }

    #bm-save-btn {
      background: linear-gradient(135deg, rgba(255,70,84,0.9), rgba(200,50,70,0.9));
      border: none; border-radius: 10px; color: #fff;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 15px; font-weight: 900; letter-spacing: 0.08em;
      text-transform: uppercase; padding: 11px 34px;
      cursor: pointer; transition: opacity 0.12s, transform 0.1s;
      box-shadow: 0 4px 18px rgba(255,70,84,0.28);
    }
    #bm-save-btn:hover { opacity: 0.87; }
    #bm-save-btn:active { transform: scale(0.97); }

    /* 매치 페이지 내 버튼 */
    #bm-open-btn {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 12px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase;
      background: rgba(255,70,84,0.12);
      border: 1px solid rgba(255,70,84,0.3);
      border-radius: 8px; color: rgba(255,120,130,0.9);
      padding: 6px 14px; cursor: pointer;
      transition: all 0.12s; margin-left: 10px;
    }
    #bm-open-btn:hover {
      background: rgba(255,70,84,0.22);
      border-color: rgba(255,70,84,0.5);
      color: #fff;
    }
  `;
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── HTML ── */
  document.body.insertAdjacentHTML('beforeend', `
    <div id="bm-overlay" hidden>
      <div id="bm-backdrop"></div>
      <div id="bm-panel">
        <div id="bm-header">
          <span id="bm-title">일괄 입력</span>
          <button id="bm-close">×</button>
        </div>
        <div id="bm-tabs"></div>
        <div id="bm-body"></div>
        <div id="bm-footer">
          <span id="bm-status">입력 후 저장을 누르세요.</span>
          <button id="bm-save-btn">저장</button>
        </div>
      </div>
    </div>
  `);

  /* ── 상태 ── */
  var _activeMap = 0;

  /* ── 탭 / 테이블 렌더 ── */
  function renderTabs() {
    var tabsEl  = document.getElementById('bm-tabs');
    tabsEl.innerHTML = '';
    var mapsArr = window.maps || [];
    var count   = window.activeMapCount || mapsArr.length || 1;
    for (var i = 0; i < count; i++) {
      (function(idx) {
        var btn = document.createElement('button');
        btn.className = 'bm-tab' + (idx === _activeMap ? ' active' : '');
        btn.textContent = 'MAP ' + (idx + 1);
        btn.addEventListener('click', function() {
          _activeMap = idx;
          renderTabs();
          renderTable();
        });
        tabsEl.appendChild(btn);
      })(i);
    }
  }

  function renderTable() {
    var bodyEl = document.getElementById('bm-body');
    bodyEl.innerHTML = '';

    var mapsArr = window.maps || [];
    var m = mapsArr[_activeMap];
    if (!m) return;

    var sideA = m.players.filter(function(p) { return p.side === 'a'; });
    var sideB = m.players.filter(function(p) { return p.side === 'b'; });

    var table = document.createElement('table');
    table.className = 'bm-table';
    table.innerHTML =
      '<thead><tr>' +
        '<th style="width:32px"></th>' +
        '<th>선수</th>' +
        '<th class="bm-col-agent">요원</th>' +
        '<th class="bm-col-acs">ACS</th>' +
        '<th class="bm-col-kda">KDA</th>' +
      '</tr></thead><tbody></tbody>';

    var tbody = table.querySelector('tbody');

    function addDivider(label) {
      var tr = document.createElement('tr');
      tr.className = 'bm-divider';
      tr.innerHTML = '<td colspan="5">' + label + '</td>';
      tbody.appendChild(tr);
    }

    function addPlayerRow(p, globalIdx, slot) {
      var tr = document.createElement('tr');
      tr.className = slot[0] === 'b' ? 'bm-side-b' : '';
      tr.dataset.pIdx = globalIdx;
      tr.dataset.slot = slot;

      var nameText = (p && p.name && p.name !== '-') ? p.name : '—';
      var hasName  = (p && p.name && p.name !== '-');

      var agentVal = (p && p.agent) || '';
      var acsVal   = (p && p.acs   != null) ? String(p.acs) : '';
      var kdaVal   = (p && p.kda)  || '';

      tr.innerHTML =
        '<td class="bm-slot ' + slot[0] + '">' + slot.toUpperCase() + '</td>' +
        '<td class="bm-name' + (hasName ? '' : ' empty') + '">' + nameText + '</td>' +
        '<td><input class="bm-inp f-agent' + (agentVal ? ' has-val' : '') + '" placeholder="요루" value="' + esc(agentVal) + '" /></td>' +
        '<td><input class="bm-inp f-acs'  + (acsVal   ? ' has-val' : '') + '" placeholder="180" value="' + esc(acsVal)   + '" /></td>' +
        '<td><input class="bm-inp f-kda'  + (kdaVal   ? ' has-val' : '') + '" placeholder="14/8/3" value="' + esc(kdaVal) + '" /></td>';

      tr.querySelectorAll('.bm-inp').forEach(function(inp) {
        inp.addEventListener('input', function() {
          inp.classList.toggle('has-val', inp.value.trim().length > 0);
        });
      });

      tbody.appendChild(tr);
    }

    // TeamA 이름
    var teamAName = (window.MATCH_TEAM_A || 'Team A').toUpperCase();
    var teamBName = (window.MATCH_TEAM_B || 'Team B').toUpperCase();

    addDivider(teamAName);
    sideA.forEach(function(p, i) {
      var globalIdx = m.players.indexOf(p);
      addPlayerRow(p, globalIdx, 'a' + i);
    });

    addDivider(teamBName);
    sideB.forEach(function(p, i) {
      var globalIdx = m.players.indexOf(p);
      addPlayerRow(p, globalIdx, 'b' + i);
    });

    bodyEl.appendChild(table);
  }

  function esc(s) {
    return (s || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  }

  /* ── 저장 ── */
  document.getElementById('bm-save-btn').addEventListener('click', function() {
    var mapsArr  = window.maps || [];
    var m        = mapsArr[_activeMap];
    var matchKey = window.MATCH_KEY  || '';
    var league   = window.LEAGUE     || '';
    var stage    = window.MATCH_FROM || '';
    var statusEl = document.getElementById('bm-status');

    if (!m || !matchKey) {
      statusEl.textContent = '⚠️ 경기 데이터가 없습니다.';
      statusEl.className = 'err';
      return;
    }

    var bodyEl = document.getElementById('bm-body');
    var rows   = bodyEl.querySelectorAll('tr[data-p-idx]');
    var saved  = 0;

    rows.forEach(function(tr) {
      var globalIdx = parseInt(tr.dataset.pIdx, 10);
      var p         = m.players[globalIdx];
      var pName     = p && p.name && p.name !== '-' ? p.name.trim() : '';
      if (!pName) return;

      var agent = tr.querySelector('.f-agent').value.trim();
      var acs   = tr.querySelector('.f-acs').value.trim();
      var kda   = tr.querySelector('.f-kda').value.trim();
      if (!agent && !acs && !kda) return;

      /* 1. vct_p: 업데이트 */
      try {
        var vk = 'vct_p:' + pName;
        var vd = {};
        try { vd = JSON.parse(localStorage.getItem(vk) || '{}'); } catch(e2) {}
        if (!vd.maps) vd.maps = [];

        var entry = null;
        for (var i = 0; i < vd.maps.length; i++) {
          if (vd.maps[i].matchKey === matchKey && vd.maps[i].mapIdx === _activeMap) {
            entry = vd.maps[i]; break;
          }
        }
        if (!entry) {
          entry = { matchKey: matchKey, mapIdx: _activeMap };
          vd.maps.push(entry);
        }
        entry.league = league;
        entry.stage  = stage;
        if (agent) entry.agent = agent;
        if (acs)   entry.acs   = parseFloat(acs) || acs;
        if (kda && kda.indexOf('/') !== -1) entry.kda = kda;
        localStorage.setItem(vk, JSON.stringify(vd));
      } catch(e3) {}

      /* 2. players: 키 업데이트 (매치 페이지에도 반영) */
      try {
        var slot = tr.dataset.slot;
        var PKEY = 'players:' + matchKey + ':' + _activeMap;
        var pd   = {};
        try { pd = JSON.parse(localStorage.getItem(PKEY) || '{}'); } catch(e4) {}
        if (!pd[slot]) pd[slot] = {};
        pd[slot].name = pName;
        if (agent) pd[slot].agent = agent;
        if (acs)   pd[slot].acs   = parseFloat(acs) || acs;
        if (kda && kda.indexOf('/') !== -1) pd[slot].kda = kda;
        localStorage.setItem(PKEY, JSON.stringify(pd));
      } catch(e5) {}

      saved++;
    });

    if (saved > 0) {
      statusEl.textContent = '✅ ' + saved + '명 저장 완료!';
      statusEl.className = 'save-status ok';
      /* 매치 페이지 테이블 새로고침 */
      if (typeof renderMap === 'function') renderMap(_activeMap);
    } else {
      statusEl.textContent = '⚠️ 입력된 내용이 없습니다.';
      statusEl.className = 'save-status err';
    }
  });

  /* ── 열기 / 닫기 ── */
  function openBatchModal(startMapIdx) {
    _activeMap = startMapIdx || 0;
    document.getElementById('bm-status').textContent = '입력 후 저장을 누르세요.';
    document.getElementById('bm-status').className = 'save-status';
    renderTabs();
    renderTable();
    document.getElementById('bm-overlay').removeAttribute('hidden');
  }
  function closeBatchModal() {
    document.getElementById('bm-overlay').setAttribute('hidden', '');
  }

  document.getElementById('bm-close').addEventListener('click', closeBatchModal);
  document.getElementById('bm-backdrop').addEventListener('click', closeBatchModal);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeBatchModal();
  });

  window.openBatchModal = openBatchModal;

  /* ── 매치 페이지에 버튼 추가 (admin만) ── */
  window.storageReady && window.storageReady.then(function() {
    if (!window.vctIsAdmin || !window.vctIsAdmin()) return;
    var bar = document.getElementById('map-count-bar');
    if (!bar) return;
    var btn = document.createElement('button');
    btn.id = 'bm-open-btn';
    btn.textContent = '일괄 입력';
    btn.addEventListener('click', function() {
      var activeMapIdx = 0;
      var mapsArr = window.maps || [];
      for (var i = 0; i < mapsArr.length; i++) {
        if (mapsArr[i] && !mapsArr[i].hidden) { activeMapIdx = i; }
      }
      openBatchModal(activeMapIdx);
    });
    bar.appendChild(btn);
  });

})();
