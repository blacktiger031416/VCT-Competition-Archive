(function () {
  /* ── CSS ─────────────────────────────────────────────── */
  var css = `
    .pm-overlay {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    }
    .pm-overlay[hidden] { display: none !important; }
    .pm-backdrop {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.72);
      backdrop-filter: blur(6px);
    }
    .pm-panel {
      position: relative; z-index: 1;
      width: min(560px, calc(100vw - 24px));
      max-height: 90vh; overflow-y: auto;
      background: #111a28;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.75);
      animation: pmIn 0.2s cubic-bezier(0.16,1,0.3,1);
    }
    @keyframes pmIn {
      from { opacity:0; transform: scale(0.96) translateY(12px); }
      to   { opacity:1; transform: none; }
    }

    /* 헤더 */
    .pm-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 22px 18px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      gap: 14px;
    }
    .pm-header-left { display: flex; align-items: center; gap: 16px; flex: 1; min-width: 0; }
    .pm-team-logo-wrap {
      width: 52px; height: 52px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .pm-team-logo-wrap img {
      width: 100%; height: 100%; object-fit: contain;
    }
    .pm-header-text { flex: 1; min-width: 0; }
    .pm-player-name {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 28px; font-weight: 900;
      letter-spacing: 0.06em; text-transform: uppercase;
      color: #fff; margin: 0; line-height: 1.1;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .pm-player-meta {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; font-weight: 600; letter-spacing: 0.08em;
      color: rgba(255,255,255,0.45); margin-top: 4px;
      text-transform: uppercase;
    }
    .pm-close {
      background: none; border: none;
      color: rgba(255,255,255,0.35); font-size: 22px;
      cursor: pointer; padding: 4px; line-height: 1;
      transition: color 0.15s; flex-shrink: 0;
    }
    .pm-close:hover { color: #fff; }

    /* 기본 정보 편집 (admin) */
    .pm-info-edit {
      display: flex; gap: 10px;
      padding: 14px 22px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      background: rgba(255,255,255,0.02);
    }
    .pm-info-field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .pm-info-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: rgba(255,255,255,0.35);
    }
    .pm-info-input {
      background: rgba(255,255,255,0.07);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px;
      color: #fff; font-family: 'Barlow Condensed', sans-serif;
      font-size: 14px; font-weight: 600; letter-spacing: 0.04em;
      padding: 6px 10px; outline: none;
      transition: border-color 0.15s;
    }
    .pm-info-input:focus { border-color: rgba(255,255,255,0.3); }

    /* 섹션 */
    .pm-section { padding: 18px 22px; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .pm-section:last-child { border-bottom: none; }
    .pm-section-title {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; color: rgba(255,255,255,0.35);
      margin-bottom: 14px;
    }

    /* 스탯 카드 */
    .pm-stat-cards {
      display: flex; gap: 10px;
    }
    .pm-stat-card {
      flex: 1; background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; padding: 14px 10px;
      text-align: center;
    }
    .pm-stat-val {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 28px; font-weight: 900;
      color: #fff; line-height: 1;
    }
    .pm-stat-lbl {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; color: rgba(255,255,255,0.35);
      margin-top: 6px;
    }
    .pm-no-stats {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; color: rgba(255,255,255,0.25);
      text-align: center; padding: 10px 0;
    }

    /* 우승 기록 */
    .pm-wins-list { display: flex; flex-direction: column; gap: 8px; }
    .pm-win-item {
      display: flex; align-items: center; gap: 10px;
      background: rgba(255,200,60,0.07);
      border: 1px solid rgba(255,200,60,0.18);
      border-radius: 8px; padding: 10px 14px;
    }
    .pm-win-icon { font-size: 16px; flex-shrink: 0; }
    .pm-win-text {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 15px; font-weight: 700; letter-spacing: 0.04em;
      color: rgba(255,220,100,0.9); flex: 1;
    }
    .pm-win-remove {
      background: none; border: none;
      color: rgba(255,255,255,0.2); font-size: 16px;
      cursor: pointer; padding: 2px 4px; line-height: 1;
      transition: color 0.12s;
    }
    .pm-win-remove:hover { color: rgba(232,67,45,0.8); }
    .pm-no-wins {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; color: rgba(255,255,255,0.25);
      text-align: center; padding: 10px 0;
    }

    /* 우승 추가 (admin) */
    .pm-win-add-row {
      display: flex; gap: 8px; margin-top: 10px;
    }
    .pm-win-add-input {
      flex: 1;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 6px;
      color: #fff; font-family: 'Barlow Condensed', sans-serif;
      font-size: 14px; font-weight: 600; letter-spacing: 0.03em;
      padding: 8px 12px; outline: none;
      transition: border-color 0.15s;
    }
    .pm-win-add-input::placeholder { color: rgba(255,255,255,0.2); }
    .pm-win-add-input:focus { border-color: rgba(255,255,255,0.3); }
    .pm-win-add-btn {
      background: rgba(255,200,60,0.15);
      border: 1px solid rgba(255,200,60,0.35);
      border-radius: 6px; color: rgba(255,220,100,0.9);
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; font-weight: 700; letter-spacing: 0.06em;
      text-transform: uppercase; padding: 8px 16px;
      cursor: pointer; transition: background 0.12s;
      white-space: nowrap;
    }
    .pm-win-add-btn:hover { background: rgba(255,200,60,0.25); }
  `;
  var styleEl = document.createElement("style");
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── HTML 삽입 ──────────────────────────────────────── */
  var html = `
    <div id="player-modal" class="pm-overlay" hidden>
      <div class="pm-backdrop" id="pm-backdrop"></div>
      <div class="pm-panel">
        <div class="pm-header">
          <div class="pm-header-left">
            <div class="pm-team-logo-wrap" id="pm-logo"></div>
            <div class="pm-header-text">
              <h2 class="pm-player-name" id="pm-name">—</h2>
              <div class="pm-player-meta" id="pm-meta">—</div>
            </div>
          </div>
          <button class="pm-close" id="pm-close">×</button>
        </div>

        <!-- admin 기본정보 편집 -->
        <div class="pm-info-edit" id="pm-info-edit" style="display:none">
          <div class="pm-info-field">
            <span class="pm-info-label">국가</span>
            <input class="pm-info-input" id="pm-inp-country" placeholder="예: 싱가포르" />
          </div>
          <div class="pm-info-field">
            <span class="pm-info-label">포지션</span>
            <input class="pm-info-input" id="pm-inp-role" placeholder="예: Duelist" />
          </div>
        </div>

        <!-- 경기 스탯 -->
        <div class="pm-section">
          <div class="pm-section-title">경기 스탯</div>
          <div id="pm-stats"></div>
        </div>

        <!-- 우승 기록 -->
        <div class="pm-section">
          <div class="pm-section-title">우승 기록</div>
          <div class="pm-wins-list" id="pm-wins"></div>
          <div class="pm-win-add-row" id="pm-win-add-row" style="display:none">
            <input class="pm-win-add-input" id="pm-win-input" placeholder="예: VCT Masters Santiago 2026" />
            <button class="pm-win-add-btn" id="pm-win-add-btn">+ 추가</button>
          </div>
        </div>
      </div>
    </div>
  `;
  var wrapper = document.createElement("div");
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper.firstElementChild);

  /* ── 상태 ────────────────────────────────────────────── */
  var _current = null; // 현재 선수 이름

  function metaKey(name)  { return 'vct_player_meta:' + name; }
  function winsKey(name)  { return 'vct_player_wins:' + name; }

  function loadMeta(name) {
    try { return JSON.parse(localStorage.getItem(metaKey(name)) || '{}'); } catch(e) { return {}; }
  }
  function saveMeta(name, obj) {
    try { localStorage.setItem(metaKey(name), JSON.stringify(obj)); } catch(e) {}
  }
  function loadWins(name) {
    try { return JSON.parse(localStorage.getItem(winsKey(name)) || '[]'); } catch(e) { return []; }
  }
  function saveWins(name, arr) {
    try { localStorage.setItem(winsKey(name), JSON.stringify(arr)); } catch(e) {}
  }

  /* ── 스탯 스캔 ───────────────────────────────────────── */
  function scanStats(playerName) {
    var results = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (!k || !k.startsWith('stats:')) continue;
      try {
        var d = JSON.parse(localStorage.getItem(k));
        if (!d || !Array.isArray(d.players)) continue;
        d.players.forEach(function(p) {
          if (!p || p.name !== playerName) return;
          var acsNum = parseFloat(p.acs);
          var kdaParts = (p.kda || '').split('/').map(Number);
          if (!isNaN(acsNum) && acsNum > 0) {
            results.push({ acs: acsNum, k: kdaParts[0] || 0, d: kdaParts[1] || 0, a: kdaParts[2] || 0 });
          }
        });
      } catch(e) {}
    }
    return results;
  }

  /* ── 렌더 ────────────────────────────────────────────── */
  function render() {
    if (!_current) return;
    var name  = _current.name;
    var admin = window.vctIsAdmin && window.vctIsAdmin();
    var meta  = loadMeta(name);
    var wins  = loadWins(name);

    // 메타 표시
    var metaParts = [];
    if (meta.country) metaParts.push(meta.country);
    if (meta.role)    metaParts.push(meta.role);
    document.getElementById('pm-meta').textContent = metaParts.join(' · ') || '—';

    // admin 편집 칸
    var editRow = document.getElementById('pm-info-edit');
    if (admin) {
      editRow.style.display = 'flex';
      document.getElementById('pm-inp-country').value = meta.country || '';
      document.getElementById('pm-inp-role').value    = meta.role    || '';
    } else {
      editRow.style.display = 'none';
    }

    // 스탯
    var statsEl = document.getElementById('pm-stats');
    var statData = scanStats(name);
    if (!statData.length) {
      statsEl.innerHTML = '<div class="pm-no-stats">기록된 스탯이 없습니다</div>';
    } else {
      var avgAcs = Math.round(statData.reduce(function(s,r){ return s+r.acs; }, 0) / statData.length);
      var totK = statData.reduce(function(s,r){ return s+r.k; }, 0);
      var totD = statData.reduce(function(s,r){ return s+r.d; }, 0);
      var totA = statData.reduce(function(s,r){ return s+r.a; }, 0);
      var kda  = totD ? ((totK + totA * 0.5) / totD).toFixed(2) : (totK + totA * 0.5).toFixed(2);
      statsEl.innerHTML =
        '<div class="pm-stat-cards">' +
          '<div class="pm-stat-card"><div class="pm-stat-val">' + avgAcs + '</div><div class="pm-stat-lbl">평균 ACS</div></div>' +
          '<div class="pm-stat-card"><div class="pm-stat-val">' + kda   + '</div><div class="pm-stat-lbl">평균 KDA</div></div>' +
          '<div class="pm-stat-card"><div class="pm-stat-val">' + statData.length + '</div><div class="pm-stat-lbl">출전 맵</div></div>' +
        '</div>';
    }

    // 우승 기록
    var winsEl = document.getElementById('pm-wins');
    if (!wins.length) {
      winsEl.innerHTML = '<div class="pm-no-wins">우승 기록이 없습니다</div>';
    } else {
      winsEl.innerHTML = wins.map(function(w, i) {
        return '<div class="pm-win-item">' +
          '<span class="pm-win-icon">🏆</span>' +
          '<span class="pm-win-text">' + w + '</span>' +
          (admin ? '<button class="pm-win-remove" data-idx="' + i + '">×</button>' : '') +
          '</div>';
      }).join('');
      if (admin) {
        winsEl.querySelectorAll('.pm-win-remove').forEach(function(btn) {
          btn.addEventListener('click', function() {
            var arr = loadWins(name);
            arr.splice(Number(btn.dataset.idx), 1);
            saveWins(name, arr);
            render();
          });
        });
      }
    }

    // 우승 추가칸 (admin)
    document.getElementById('pm-win-add-row').style.display = admin ? 'flex' : 'none';
  }

  /* ── 열기/닫기 ───────────────────────────────────────── */
  function open(playerName, teamName, logoHTML) {
    _current = { name: playerName, team: teamName };
    document.getElementById('pm-name').textContent = playerName;
    var logoEl = document.getElementById('pm-logo');
    logoEl.innerHTML = logoHTML || '';
    render();
    document.getElementById('player-modal').removeAttribute('hidden');
  }

  function close() {
    document.getElementById('player-modal').setAttribute('hidden', '');
    _current = null;
  }

  /* ── 이벤트 ──────────────────────────────────────────── */
  document.getElementById('pm-close').addEventListener('click', close);
  document.getElementById('pm-backdrop').addEventListener('click', close);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') close();
  });

  // admin: 기본정보 저장 (blur)
  ['pm-inp-country', 'pm-inp-role'].forEach(function(id) {
    document.getElementById(id).addEventListener('blur', function() {
      if (!_current) return;
      var meta = loadMeta(_current.name);
      meta.country = document.getElementById('pm-inp-country').value.trim();
      meta.role    = document.getElementById('pm-inp-role').value.trim();
      saveMeta(_current.name, meta);
      render();
    });
  });

  // admin: 우승 추가
  function addWin() {
    if (!_current) return;
    var inp = document.getElementById('pm-win-input');
    var val = inp.value.trim();
    if (!val) return;
    var arr = loadWins(_current.name);
    arr.push(val);
    saveWins(_current.name, arr);
    inp.value = '';
    render();
  }
  document.getElementById('pm-win-add-btn').addEventListener('click', addWin);
  document.getElementById('pm-win-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') addWin();
  });

  /* ── 외부 공개 ───────────────────────────────────────── */
  window.openPlayerModal = open;
})();
