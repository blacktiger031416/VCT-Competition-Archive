/**
 * roster-modal.js
 * pacific.html의 roster-modal을 모든 페이지에서 공유
 * API: window.openRosterModal(teamName, logoHTML)
 */
(function () {

  /* ── CSS (pacific.html과 동일) ── */
  var css = `
    .roster-modal {
      position: fixed; inset: 0; z-index: 500;
      display: flex; align-items: center; justify-content: center;
    }
    .roster-modal[hidden] { display: none; }
    .roster-modal-backdrop {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
    }
    .roster-modal-panel {
      position: relative; z-index: 1;
      background: #111a28;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      width: 92vw; max-width: 440px;
      overflow: hidden;
      box-shadow: 0 24px 64px rgba(0,0,0,0.7);
    }
    .roster-modal-header {
      display: flex; align-items: center; gap: 14px;
      padding: 18px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.03);
    }
    .roster-modal-logo {
      width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .roster-modal-logo img { width: 100%; height: 100%; object-fit: contain; }
    .roster-modal-logo img.logo-white { filter: brightness(0) invert(1); }
    .roster-modal-header-text { flex: 1; }
    .roster-modal-header-text .eyebrow {
      font-size: 10px; margin-bottom: 2px; letter-spacing: 0.2em;
    }
    #roster-modal-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 22px; font-weight: 900;
      letter-spacing: 0.05em; text-transform: uppercase; color: #fff;
    }
    .roster-modal-close {
      background: none; border: none;
      color: rgba(255,255,255,0.4); font-size: 22px;
      cursor: pointer; padding: 4px; line-height: 1;
      transition: color 0.15s; flex-shrink: 0;
    }
    .roster-modal-close:hover { color: #fff; }
    .roster-section-label {
      display: block; padding: 12px 20px 6px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: rgba(255,255,255,0.45);
    }
    .roster-player-list {
      list-style: none; max-height: 300px; overflow-y: auto; padding: 8px 0;
    }
    .roster-player-list li {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 20px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      transition: background 0.12s;
    }
    .roster-player-list li:hover { background: rgba(255,255,255,0.04); }
    .roster-player-list li:last-child { border-bottom: none; }
    .roster-empty-msg {
      color: rgba(255,255,255,0.3); font-size: 13px;
      text-align: center; padding: 20px !important;
      font-family: 'Noto Sans KR', sans-serif;
    }
    .player-index {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px; font-weight: 700;
      color: rgba(255,255,255,0.25);
      width: 18px; flex-shrink: 0; text-align: center;
    }
    .roster-player-list li > span:not(.player-index) {
      flex: 1;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 16px; font-weight: 600;
      letter-spacing: 0.04em; color: rgba(255,255,255,0.85);
    }
    .roster-player-remove {
      background: none; border: none;
      color: rgba(255,255,255,0.2); font-size: 16px;
      cursor: pointer; padding: 2px 4px;
      transition: color 0.12s; line-height: 1;
    }
    .roster-player-remove:hover { color: rgba(232,67,45,0.85); }
    .roster-add-row {
      display: flex; gap: 0;
      border-top: 1px solid rgba(255,255,255,0.07);
    }
    #roster-add-input {
      flex: 1; background: transparent; border: none;
      padding: 14px 20px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 15px; font-weight: 600; letter-spacing: 0.04em;
      color: #fff; outline: none;
    }
    #roster-add-input::placeholder { color: rgba(255,255,255,0.2); }
    .roster-add-btn {
      background: rgba(232,67,45,0.15); border: none;
      border-left: 1px solid rgba(255,255,255,0.07);
      color: #e8432d;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; padding: 0 20px;
      cursor: pointer; transition: background 0.15s;
    }
    .roster-add-btn:hover { background: rgba(232,67,45,0.28); }
    .roster-main-input {
      flex: 1; background: transparent; border: none;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 16px; font-weight: 600; letter-spacing: 0.04em;
      color: rgba(255,255,255,0.85); outline: none; padding: 2px 0;
    }
    .roster-main-input:focus { border-bottom-color: rgba(232,67,45,0.6); }
    .pm-roster-btn {
      background: none; border: none;
      color: rgba(255,255,255,0.3); cursor: pointer;
      font-size: 13px; padding: 0 6px; line-height: 1;
      flex-shrink: 0; transition: color 0.12s;
    }
    .pm-roster-btn:hover { color: rgba(255,255,255,0.8); }
  `;
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── HTML ── */
  document.body.insertAdjacentHTML('beforeend', `
    <div id="roster-modal" class="roster-modal" role="dialog" aria-modal="true" aria-labelledby="roster-modal-title" hidden>
      <div class="roster-modal-backdrop"></div>
      <div class="roster-modal-panel">
        <div class="roster-modal-header">
          <div class="roster-modal-logo" id="roster-modal-logo"></div>
          <div class="roster-modal-header-text">
            <p class="eyebrow">선수 명단</p>
            <h2 id="roster-modal-title">팀</h2>
          </div>
          <button class="roster-modal-close" id="roster-modal-close" aria-label="닫기">×</button>
        </div>
        <span class="roster-section-label">메인 선수 <span style="opacity:0.5;font-size:10px">(5명)</span></span>
        <ul class="roster-player-list" id="roster-main-list"></ul>
        <span class="roster-section-label" style="margin-top:2px">서브 선수</span>
        <ul class="roster-player-list" id="roster-sub-list"></ul>
        <div class="roster-add-row" id="roster-add-row">
          <input type="text" id="roster-add-input" placeholder="서브 선수 이름 입력..." autocomplete="off" />
          <button class="roster-add-btn" id="roster-add-btn">추가</button>
        </div>
      </div>
    </div>
  `);

  /* ── 기본 로스터: 비워둠 (어드민이 직접 입력) ── */
  var DEFAULT_ROSTERS = {};

  /* ── 스토리지 ── */
  var rosterKey = function(team) { return 'vct_roster:' + team; };

  function loadRoster(team) {
    try {
      var s = localStorage.getItem(rosterKey(team));
      if (s) {
        var p = JSON.parse(s);
        if (p && !Array.isArray(p) && p.main) return p;
        if (Array.isArray(p)) return { main: p.slice(0, 5), subs: p.slice(5) };
      }
    } catch(e) {}
    var def = DEFAULT_ROSTERS[team] || [];
    return { main: def.slice(0, 5), subs: def.slice(5) };
  }

  function saveRoster(team, data) {
    try { localStorage.setItem(rosterKey(team), JSON.stringify(data)); } catch(e) { console.error('[roster-modal] save error:', e); }
  }

  /* ── 상태 ── */
  var modal   = document.getElementById('roster-modal');
  var logoEl  = document.getElementById('roster-modal-logo');
  var titleEl = document.getElementById('roster-modal-title');
  var mainEl  = document.getElementById('roster-main-list');
  var subEl   = document.getElementById('roster-sub-list');
  var input   = document.getElementById('roster-add-input');
  var current = null;

  function getLogoHTML() {
    return logoEl ? logoEl.innerHTML : '';
  }

  function attachPlayerClick(el) {
    var pName = el.getAttribute('data-player');
    if (!pName) return;
    el.addEventListener('click', function() {
      if (window.openPlayerModal) window.openPlayerModal(pName, current, getLogoHTML());
    });
    el.style.cursor = 'pointer';
  }

  /* ── 선수 이름 변경 시 전체 데이터 연동 ── */
  function propagateRename(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;

    // 1. vct_p: (경기 기록 집계) localStorage rename
    var vctVal = localStorage.getItem('vct_p:' + oldName);
    if (vctVal !== null) {
      localStorage.setItem('vct_p:' + newName, vctVal);
      localStorage.removeItem('vct_p:' + oldName);
    }

    // 2. stock_p: (주가 데이터) localStorage rename
    var stockVal = localStorage.getItem('stock_p:' + oldName);
    if (stockVal !== null) {
      localStorage.setItem('stock_p:' + newName, stockVal);
      localStorage.removeItem('stock_p:' + oldName);
    }

    // 3. players:*:* — 모든 상세 경기 선수 이름 교체
    var pKeys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('players:') === 0) pKeys.push(k);
    }
    pKeys.forEach(function(k) {
      try {
        var obj = JSON.parse(localStorage.getItem(k) || '{}');
        var changed = false;
        Object.keys(obj).forEach(function(slot) {
          if (obj[slot] && obj[slot].name === oldName) {
            obj[slot].name = newName;
            changed = true;
          }
        });
        if (changed) localStorage.setItem(k, JSON.stringify(obj));
      } catch(e) {}
    });

    // 4. 서버 DB rename (fire-and-forget)
    var tok = localStorage.getItem('vct_auth_token') || '';
    if (tok) {
      fetch('/api/admin/rename-player', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok },
        body: JSON.stringify({ from: oldName, to: newName })
      }).catch(function() {});
    }

    // 5. 현재 열려 있는 경기 상세 페이지에 즉시 반영
    if (typeof window._matchDetailRenamePlayer === 'function') {
      window._matchDetailRenamePlayer(oldName, newName);
    }
  }

  function saveMain() {
    if (!current) return;
    var d = loadRoster(current);
    var oldMain = (d.main || []).slice(); // 변경 전 이름 저장
    d.main = Array.from(mainEl.querySelectorAll('.roster-main-input')).map(function(inp) { return inp.value.trim(); });

    // 이름이 바뀐 슬롯에 대해 전체 데이터 연동
    oldMain.forEach(function(oldName, i) {
      var newName = d.main[i];
      if (oldName && newName && oldName !== newName) {
        propagateRename(oldName, newName);
      }
    });

    saveRoster(current, d);
  }

  function render() {
    if (!current) return;
    var d     = loadRoster(current);
    var admin = window.vctIsAdmin && window.vctIsAdmin();

    /* 메인 선수 (5명) */
    mainEl.innerHTML = [0,1,2,3,4].map(function(i) {
      var nameVal = d.main[i] || '';
      if (admin) {
        return '<li class="roster-main-item">' +
          '<input class="roster-main-input" data-i="' + i + '" value="' + nameVal.replace(/"/g,'&quot;') + '" placeholder="선수 이름" />' +
          (nameVal ? '<button class="pm-roster-btn" data-player="' + nameVal.replace(/"/g,'&quot;') + '">↗</button>' : '') +
          '</li>';
      } else {
        return '<li class="roster-main-item">' +
          '<span data-player="' + nameVal.replace(/"/g,'&quot;') + '" style="opacity:0.85">' + (nameVal || '—') + '</span>' +
          '</li>';
      }
    }).join('');

    mainEl.querySelectorAll('[data-player]').forEach(attachPlayerClick);
    if (admin) {
      mainEl.querySelectorAll('.roster-main-input').forEach(function(inp) {
        inp.addEventListener('blur', saveMain);
        inp.addEventListener('keydown', function(e) { if (e.key === 'Enter') { saveMain(); inp.blur(); } });
      });
    }

    /* 서브 선수 */
    if (!d.subs || !d.subs.length) {
      subEl.innerHTML = '<li class="roster-empty-msg">등록된 서브 선수가 없습니다</li>';
    } else {
      subEl.innerHTML = d.subs.map(function(p, i) {
        return '<li>' +
          '<span data-player="' + p.replace(/"/g,'&quot;') + '" style="flex:1;opacity:0.85">' + p + '</span>' +
          (admin ? '<button class="roster-player-remove" data-sub="' + i + '">×</button>' : '') +
          '</li>';
      }).join('');
      subEl.querySelectorAll('[data-player]').forEach(attachPlayerClick);
      if (admin) {
        subEl.querySelectorAll('.roster-player-remove').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var d2 = loadRoster(current);
            d2.subs.splice(Number(btn.dataset.sub), 1);
            saveRoster(current, d2);
            render();
          });
        });
      }
    }
  }

  function open(teamName, logoHTML) {
    current = teamName;
    titleEl.textContent = teamName;
    logoEl.innerHTML = logoHTML || '';
    render();
    modal.removeAttribute('hidden');
    document.body.classList.add('roster-open');
    var addRow = document.getElementById('roster-add-row');
    if (addRow) addRow.style.display = (window.vctIsAdmin && window.vctIsAdmin()) ? 'flex' : 'none';
    input.value = '';
    if (window.vctIsAdmin && window.vctIsAdmin()) setTimeout(function() { input.focus(); }, 260);
  }

  function close() {
    modal.setAttribute('hidden', '');
    document.body.classList.remove('roster-open');
    current = null;
  }

  function add() {
    var name = input.value.trim();
    if (!name || !current) return;
    var d = loadRoster(current);
    if (!d.subs) d.subs = [];
    d.subs.push(name);
    saveRoster(current, d);
    input.value = '';
    render();
  }

  document.querySelector('.roster-modal-backdrop').addEventListener('click', close);
  document.getElementById('roster-modal-close').addEventListener('click', close);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });
  document.getElementById('roster-add-btn').addEventListener('click', add);
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') add(); });

  /* ── 공개 API ── */
  window.openRosterModal = open;

})();
