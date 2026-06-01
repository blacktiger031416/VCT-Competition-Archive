/**
 * team-modal.js
 * 팀 클릭 시 로스터 + Masters 스탯 팝업
 * 의존: vct_p: 스토리지, player-modal.js (openPlayerModal)
 * API: window.openTeamModal(teamName, logoUrl, logoWhite, league, tournament, onChangePicker?)
 */
(function () {

  /* ── CSS ── */
  var css = `
    #tm-overlay {
      position: fixed; inset: 0; z-index: 9998;
      display: flex; align-items: center; justify-content: center;
    }
    #tm-overlay[hidden] { display: none !important; }
    #tm-backdrop {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(8px);
    }
    #tm-panel {
      position: relative; z-index: 1;
      width: min(580px, calc(100vw - 24px));
      max-height: 88vh;
      background: #0d1024;
      border: 1px solid rgba(101,30,255,0.2);
      border-radius: 18px;
      box-shadow: 0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(101,30,255,0.08) inset;
      display: flex; flex-direction: column;
      animation: tmIn 0.24s cubic-bezier(0.16,1,0.3,1);
      overflow: hidden;
    }
    @keyframes tmIn {
      from { opacity:0; transform: scale(0.93) translateY(16px); }
      to   { opacity:1; transform: none; }
    }

    /* 헤더 */
    #tm-header {
      position: relative; flex-shrink: 0;
      display: flex; align-items: center; gap: 16px;
      padding: 24px 24px 20px;
    }
    #tm-header::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(101,30,255,0.18), transparent 70%);
      pointer-events: none;
    }
    #tm-header::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(101,30,255,0.45), transparent);
    }
    #tm-logo-wrap {
      position: relative;
      width: 58px; height: 58px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(101,30,255,0.2);
      border-radius: 12px;
    }
    #tm-logo-wrap img { width: 80%; height: 80%; object-fit: contain; }
    #tm-header-text { flex: 1; min-width: 0; position: relative; }
    #tm-team-name {
      font-family: 'Barlow Condensed', 'Noto Sans KR', sans-serif;
      font-size: 28px; font-weight: 900; letter-spacing: 0.05em;
      color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    #tm-team-sub {
      font-size: 11px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: rgba(180,150,255,0.5);
      margin-top: 4px;
    }
    #tm-header-actions { position: relative; display: flex; gap: 8px; align-items: center; }
    #tm-change-btn {
      font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase;
      background: rgba(101,30,255,0.12);
      border: 1px solid rgba(101,30,255,0.3);
      border-radius: 8px; color: rgba(160,120,255,0.9);
      padding: 6px 14px; cursor: pointer; transition: all 0.12s;
      display: none;
    }
    #tm-change-btn:hover { background: rgba(101,30,255,0.25); color: #fff; }
    #tm-close {
      position: relative;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; color: rgba(255,255,255,0.4); font-size: 20px;
      cursor: pointer; padding: 5px 10px; line-height: 1;
      transition: all 0.15s; flex-shrink: 0;
    }
    #tm-close:hover { background: rgba(255,255,255,0.12); color: #fff; }

    /* 스탯 요약 바 */
    #tm-stats-bar {
      display: flex; gap: 0; flex-shrink: 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      background: rgba(255,255,255,0.02);
    }
    .tm-stat-box {
      flex: 1; text-align: center;
      padding: 12px 8px;
      border-right: 1px solid rgba(255,255,255,0.04);
    }
    .tm-stat-box:last-child { border-right: none; }
    .tm-stat-val {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 22px; font-weight: 900; color: #fff; line-height: 1;
    }
    .tm-stat-lbl {
      font-size: 9px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: rgba(255,255,255,0.25);
      margin-top: 4px;
    }

    /* 스크롤 영역 */
    #tm-body { overflow-y: auto; flex: 1; padding: 16px 20px; }

    /* 섹션 라벨 */
    .tm-section-label {
      font-size: 9px; font-weight: 700; letter-spacing: 0.16em;
      text-transform: uppercase; color: rgba(255,255,255,0.22);
      margin-bottom: 10px; display: flex; align-items: center; gap: 8px;
    }
    .tm-section-label::after {
      content: ''; flex: 1; height: 1px;
      background: linear-gradient(90deg, rgba(255,255,255,0.07), transparent);
    }

    /* 로스터 테이블 */
    .tm-roster-table { width: 100%; border-collapse: collapse; }
    .tm-roster-table th {
      font-size: 9px; font-weight: 700; letter-spacing: 0.14em;
      text-transform: uppercase; color: rgba(255,255,255,0.2);
      padding: 0 8px 8px; text-align: left;
    }
    .tm-roster-table th:not(:first-child) { text-align: center; }
    .tm-roster-table tbody tr {
      border-bottom: 1px solid rgba(255,255,255,0.04);
      transition: background 0.1s;
      cursor: pointer;
    }
    .tm-roster-table tbody tr:last-child { border-bottom: none; }
    .tm-roster-table tbody tr:hover { background: rgba(101,30,255,0.1); }
    .tm-roster-table td { padding: 9px 8px; vertical-align: middle; }

    .tm-player-name {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 16px; font-weight: 700; letter-spacing: 0.03em;
      color: rgba(255,255,255,0.85);
    }
    .tm-player-realname {
      font-size: 10px; color: rgba(255,255,255,0.3);
      margin-top: 2px; letter-spacing: 0.03em;
    }
    .tm-player-stat {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 15px; font-weight: 700;
      color: rgba(255,255,255,0.65); text-align: center;
    }
    .tm-player-stat.highlight { color: rgba(160,130,255,0.9); }
    .tm-no-stat {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; color: rgba(255,255,255,0.18); text-align: center;
    }
    .tm-agent-img {
      width: 28px; height: 28px; object-fit: cover; object-position: top center;
      border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);
      display: block; margin: 0 auto;
    }
    .tm-agent-ph {
      width: 28px; height: 28px; border-radius: 6px;
      background: rgba(255,255,255,0.05); display: block; margin: 0 auto;
    }

    /* 로스터 편집 (admin) */
    .tm-add-row {
      display: flex; gap: 8px; margin-top: 14px;
    }
    .tm-add-input {
      flex: 1; background: rgba(255,255,255,0.05);
      border: 1px solid rgba(101,30,255,0.2);
      border-radius: 8px; color: #fff;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 14px; font-weight: 600; letter-spacing: 0.03em;
      padding: 8px 12px; outline: none; transition: border-color 0.15s;
    }
    .tm-add-input::placeholder { color: rgba(255,255,255,0.18); }
    .tm-add-input:focus { border-color: rgba(101,30,255,0.5); }
    .tm-add-btn {
      background: rgba(101,30,255,0.15);
      border: 1px solid rgba(101,30,255,0.35);
      border-radius: 8px; color: rgba(160,120,255,0.9);
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; font-weight: 700; letter-spacing: 0.06em;
      text-transform: uppercase; padding: 8px 18px;
      cursor: pointer; transition: background 0.12s; white-space: nowrap;
    }
    .tm-add-btn:hover { background: rgba(101,30,255,0.28); }
    .tm-remove-btn {
      background: none; border: none;
      color: rgba(255,255,255,0.18); font-size: 15px;
      cursor: pointer; padding: 2px 6px; line-height: 1;
      transition: color 0.12s;
    }
    .tm-remove-btn:hover { color: rgba(232,67,45,0.8); }

    .tm-no-roster {
      font-size: 13px; color: rgba(255,255,255,0.2);
      text-align: center; padding: 20px 0;
    }
  `;
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── AGENT IMAGES (player-modal.js와 동일) ── */
  var AGENT_IMGS = {
    게코:    "https://c-valorant-api.op.gg/Assets/Characters/E370FA57-4757-3604-3648-499E1F642D3F_small.png",
    네온:    "https://i.namu.wiki/i/4ogqg4lB9_G5JKxp145jlSjbzSxRhhXDpUJeoMqSuUnkHrNsHUNj969wyGMvKuYhkd-gDucOmRVlGYFBdHyU2w.webp",
    데드록:  "https://i.namu.wiki/i/7-QoPRINetjBCUblJjq6oPK_4HHAtH10nsD5vATNG3hwqMxCLRa0GJTZOM_us3WvSHK91b965Eo7VoF7hXEpew.webp",
    레이나:  "https://i.namu.wiki/i/THZZ8MlhetJzmWZNYTsHi69SPcjCnuQwkbgkHoM8SF7cbgXpvNg2gXSlEpPec_SXHX08Y3gDP2llILTFdRRbdQ.webp",
    레이즈:  "https://i.namu.wiki/i/14BBGZHNg2x0JYMy6x87Oo2Qlg3jp7GqxhMhGFJ5uYg2vspQXtK7vxJpcak1uFZ_k9vPr6znt6KJcihHw3L_bg.webp",
    믹스:    "https://i.namu.wiki/i/u_CwGnSZJSLW7tsqGYzZZ9VqPM8vXa4tmmbLElugjV5pOZaoZLrHyBvoWk4mCMtLZGf3CorG6g_N12ZrWjLIPg.webp",
    바이스:  "https://i.namu.wiki/i/RoVLjmYPHlDcLzy3QwkUOV4MsxdnKFAQAUY_s6H8nB4N_RStAD_TQlSW0RNpkRuCgmY24qQPICqu4fiCVApKcg.webp",
    바이퍼:  "https://i.namu.wiki/i/Vqp-AY0l-Xe8qK7Ef4FVmjYnOQ99Gj0M1ozbDZjmxibcEJocsbDGUDtEr4FNsTpTq_SyjjWVdJxHWOYgAxywew.webp",
    브리치:  "https://i.namu.wiki/i/situ_MvKaWMojZasDwAzJ2jN-5Rp__8FRbWxmFuBjDfvVfK0xZ2ER_9fYNluAsUd_h5cFYkufQSuTNH_DKVuJQ.webp",
    브림스톤: "https://i.namu.wiki/i/UvL7SmnIwxyZuVEHFnHlwPpMTQlD0RhmAlm-gIfTyctIrb3Vnmor4A_nRiKCQlYMxIxi7G73NITfwQIt27Xvzw.webp",
    비토:    "https://i.namu.wiki/i/k7MZL2YWWu7DT9fcrySpYk2HioLYi80nJjgYHB2l24XiupY3Oebneq9aMJIXe7UqAL9sMd51Z7m_9hZOeSx7jQ.webp",
    사이퍼:  "https://i.namu.wiki/i/-XPO1Vou13Z8Feqn27wFFqHLg9Olt4vEAt9VB8b8Gfwx7MZugISCbWmekrWjnaI5PONSHtu0zZitKXUb8jZI9w.webp",
    세이지:  "https://i.namu.wiki/i/jqodeZWsC3MyJzJ8DwABim3K0uuZ37PgksNux_GREfl65HoYrX0L2XIs4cTdm0cpwP7Db1z73YnbpHMctb6hiQ.webp",
    소바:    "https://c-valorant-api.op.gg/Assets/Characters/320B2A48-4D9B-A075-30F1-1F93A9B638FA_small.png?image=q_auto:good,f_webp,w_200&v=1776341444",
    스카이:  "https://i.namu.wiki/i/GfJ7jOzMvNyDGYYCGcmB69dMe2StOUhtsS1jVJzZ3Ul_vht-RwymHwQm2znxrdKGOgnOzxq66ygZupY2bwYetg.webp",
    아스트라: "https://c-valorant-api.op.gg/Assets/Characters/41FB69C1-4189-7B37-F117-BCAF1E96F1BF_small.png?image=q_auto:good,f_webp,w_200&v=1776341444",
    아이소:  "https://i.namu.wiki/i/JrF8spBoOI0_cV6S3URHYZ9g2EpLqbugUcxNkW6Vbp60Ig6FZdXDDLNisS7suS92OrcRxH3muHmBDrhuAtrIsQ.webp",
    오멘:    "https://i.namu.wiki/i/8LpnTIlczZAC81pGY3gcZeLs_6e8C-s43OZR7o2F6JucSs60HPDxnQ_vs4Fk_8HDq1VlGIK8WvjJhZDdQmsfwQ.webp",
    요루:    "https://i.namu.wiki/i/O8_5nw3EgYWhLraoQ5qj2ooaTQGqhTNhVou0an9A2A4o5Uy7SSr3O8C7nwmub1jzssrRziii5qcwjq8-ACZwkA.webp",
    웨이레이: "https://i.namu.wiki/i/Kj83E8_P6KTeg8NR0oXc5HiK9bo8_nnHymVoTvrwv8XgUhKrQH8Mf-mCAOaOYBYYbY3NtxbOtnU4rioCjjIafg.webp",
    제트:    "https://i.namu.wiki/i/_ScoZkw_dp5eGn66y8GXGqzGRHAUQiZD-AEGqpt0FQTpO3sLAdALfP37rzLppNRUFUK505MkSXf31Es-p2hE0g.webp",
    체임버:  "https://i.namu.wiki/i/kH9bgltG2hlwvNGUr64utZLO7V03cYI0itwIpVwR0H3GLeQ0v1lWeSgZr3QnLzJLaq5OChM9jZ20vSEO-UXysA.webp",
    케이오:  "https://valorantinfo.com/images/kr/kayo_valorant_icon_3589.webp",
    클로브:  "https://i.namu.wiki/i/l-OTVsdNYqe6PE3GsUHe4gzw7YbMcLtX831Y7ofn0Ta5gyMdFNqFJp8VVSsoqocBJMit8HFGz_If4e8cnQZbnw.webp",
    킬조이:  "https://media.valorant-api.com/agents/1e58de9c-4950-5125-93e9-a0aee9f98746/displayicon.png",
    테호:    "https://i.namu.wiki/i/DczhNjwRqUiOwhoL-DPhCm9EzpbQU3JkqmZzbwz3DF_nkuyFNtbB4sxAaY_bFm3D0h8ZuMre85zAwX7C50UVgA.webp",
    페이드:  "https://media.valorant-api.com/agents/dade69b4-4f5a-8528-247b-219e5a1facd6/displayicon.png",
    피닉스:  "https://valorantinfo.com/images/kr/phoenix_valorant_icon_3596.webp",
    하버:    "https://i.namu.wiki/i/qxmGsWVdbBLpysuGibvT8l4dwJLFI4RTIanYEaVg-laKEt3sDGw5Crc5S-mm7qtI83iQg9SNntbThMcaJ1VTdA.webp",
  };

  /* ── HTML ── */
  document.body.insertAdjacentHTML('beforeend', `
    <div id="tm-overlay" hidden>
      <div id="tm-backdrop"></div>
      <div id="tm-panel">
        <div id="tm-header">
          <div id="tm-logo-wrap"></div>
          <div id="tm-header-text">
            <div id="tm-team-name">—</div>
            <div id="tm-team-sub">Masters Stats</div>
          </div>
          <div id="tm-header-actions">
            <button id="tm-change-btn">팀 변경</button>
            <button id="tm-close">×</button>
          </div>
        </div>
        <div id="tm-stats-bar"></div>
        <div id="tm-body"></div>
      </div>
    </div>
  `);

  /* ── 상태 ── */
  var _teamName   = '';
  var _logoUrl    = '';
  var _logoWhite  = false;
  var _league     = '';       // 'masters' | 'champions'
  var _tournament = '';       // 'santiago' | 'london' | '' 등
  var _onPicker   = null;     // admin picker 콜백

  /* ── 로스터 스토리지 (토너먼트별 분리) ── */
  function rosterKey(name) {
    // vct_roster:TEAM:LEAGUE:TOURNAMENT  예) vct_roster:Paper Rex:masters:santiago
    return 'vct_roster:' + name + ':' + (_league || 'unknown') + (_tournament ? ':' + _tournament : '');
  }
  function loadRoster(name) {
    try { return JSON.parse(localStorage.getItem(rosterKey(name)) || '[]'); } catch(e) { return []; }
  }
  function saveRoster(name, list) {
    try { localStorage.setItem(rosterKey(name), JSON.stringify(list)); } catch(e) {}
  }

  /* ── 토너먼트별 스탯 계산 ── */
  function getMastersStats(playerName) {
    try {
      var raw = localStorage.getItem('vct_p:' + playerName);
      if (!raw) return null;
      var pd = JSON.parse(raw);
      var mm = (pd.maps || []).filter(function(m) {
        if (_league && m.league !== _league) return false;
        if (_tournament && m.tournament !== _tournament) return false;
        return true;
      });
      if (!mm.length) return null;

      var acsArr = mm.map(function(m) { return parseFloat(m.acs); }).filter(function(v) { return !isNaN(v) && v > 0; });
      var kdArr  = [];
      mm.forEach(function(m) {
        if (!m.kda) return;
        var p = m.kda.split('/').map(Number);
        if (!isNaN(p[0]) && !isNaN(p[1]) && p[1] > 0) kdArr.push(p[0] / p[1]);
      });
      var agCnt = {};
      mm.forEach(function(m) {
        var ag = (m.agent || '').trim();
        if (ag) agCnt[ag] = (agCnt[ag] || 0) + 1;
      });
      var topAgent = Object.keys(agCnt).sort(function(a, b) { return agCnt[b] - agCnt[a]; })[0] || '';
      var realname = '';
      try { realname = (JSON.parse(raw).meta || {}).realname || ''; } catch(e2) {}

      return {
        maps:     mm.length,
        avgAcs:   acsArr.length ? Math.round(acsArr.reduce(function(s,v){return s+v;},0) / acsArr.length) : null,
        avgKd:    kdArr.length  ? (kdArr.reduce(function(s,v){return s+v;},0) / kdArr.length).toFixed(2) : null,
        topAgent: topAgent,
        realname: realname,
      };
    } catch(e) { return null; }
  }

  /* ── 렌더 ── */
  function render() {
    var admin   = window.vctIsAdmin && window.vctIsAdmin();
    var roster  = loadRoster(_teamName);

    /* 헤더 */
    var logoWrap = document.getElementById('tm-logo-wrap');
    logoWrap.innerHTML = _logoUrl
      ? '<img src="' + _logoUrl + '" alt="' + _teamName + '"' + (_logoWhite ? ' style="filter:brightness(0)invert(1)"' : '') + ' />'
      : '';
    document.getElementById('tm-team-name').textContent = _teamName;
    document.getElementById('tm-change-btn').style.display = (admin && _onPicker) ? 'block' : 'none';

    /* 팀 전체 스탯 요약 */
    var statsBar = document.getElementById('tm-stats-bar');
    if (roster.length) {
      var teamAcs = [], teamKd = [];
      roster.forEach(function(pName) {
        var s = getMastersStats(pName);
        if (!s) return;
        if (s.avgAcs !== null) teamAcs.push(s.avgAcs);
        if (s.avgKd  !== null) teamKd.push(parseFloat(s.avgKd));
      });
      var tAcs = teamAcs.length ? Math.round(teamAcs.reduce(function(a,b){return a+b;},0)/teamAcs.length) : '—';
      var tKd  = teamKd.length  ? (teamKd.reduce(function(a,b){return a+b;},0)/teamKd.length).toFixed(2) : '—';
      statsBar.innerHTML =
        '<div class="tm-stat-box"><div class="tm-stat-val">' + tAcs + '</div><div class="tm-stat-lbl">팀 평균 ACS</div></div>' +
        '<div class="tm-stat-box"><div class="tm-stat-val">' + tKd  + '</div><div class="tm-stat-lbl">팀 평균 K/D</div></div>' +
        '<div class="tm-stat-box"><div class="tm-stat-val">' + roster.length + '</div><div class="tm-stat-lbl">로스터</div></div>';
    } else {
      statsBar.innerHTML = '';
    }

    /* 로스터 테이블 */
    var body = document.getElementById('tm-body');
    body.innerHTML = '';

    var labelEl = document.createElement('div');
    labelEl.className = 'tm-section-label';
    labelEl.textContent = '로스터 — Masters 스탯';
    body.appendChild(labelEl);

    if (!roster.length) {
      var noEl = document.createElement('div');
      noEl.className = 'tm-no-roster';
      noEl.textContent = admin ? '로스터가 없습니다. 아래에서 선수를 추가하세요.' : '로스터가 등록되어 있지 않습니다.';
      body.appendChild(noEl);
    } else {
      var table = document.createElement('table');
      table.className = 'tm-roster-table';
      table.innerHTML =
        '<thead><tr>' +
          '<th style="width:28px"></th>' +
          '<th>선수</th>' +
          '<th style="width:60px">ACS</th>' +
          '<th style="width:60px">K/D</th>' +
          '<th style="width:38px">요원</th>' +
          (admin ? '<th style="width:28px"></th>' : '') +
        '</tr></thead><tbody></tbody>';
      var tbody = table.querySelector('tbody');

      roster.forEach(function(pName, idx) {
        var stats = getMastersStats(pName);
        var tr    = document.createElement('tr');
        tr.dataset.player = pName;

        var agentImg = stats && stats.topAgent && AGENT_IMGS[stats.topAgent]
          ? '<img class="tm-agent-img" src="' + AGENT_IMGS[stats.topAgent] + '" alt="' + stats.topAgent + '" title="' + stats.topAgent + '" />'
          : '<span class="tm-agent-ph"></span>';

        tr.innerHTML =
          '<td style="text-align:center;color:rgba(255,255,255,0.2);font-family:\'Barlow Condensed\',sans-serif;font-size:12px;font-weight:700;">' + (idx+1) + '</td>' +
          '<td><div class="tm-player-name">' + pName + '</div>' +
            (stats && stats.realname ? '<div class="tm-player-realname">' + stats.realname + '</div>' : '') +
          '</td>' +
          '<td><div class="tm-player-stat' + (stats && stats.avgAcs !== null ? ' highlight' : '') + '">' + (stats && stats.avgAcs !== null ? stats.avgAcs : '—') + '</div></td>' +
          '<td><div class="tm-player-stat' + (stats && stats.avgKd  !== null ? ' highlight' : '') + '">' + (stats && stats.avgKd  !== null ? stats.avgKd  : '—') + '</div></td>' +
          '<td>' + agentImg + '</td>' +
          (admin ? '<td><button class="tm-remove-btn" data-idx="' + idx + '">×</button></td>' : '');

        /* 선수 클릭 → player modal */
        tr.addEventListener('click', function(e) {
          if (e.target.classList.contains('tm-remove-btn')) return;
          if (window.openPlayerModal) {
            var logoHTML = _logoUrl
              ? '<img src="' + _logoUrl + '" style="width:80%;height:80%;object-fit:contain' + (_logoWhite?';filter:brightness(0)invert(1)':'') + '" />'
              : '';
            window.openPlayerModal(pName, _teamName, logoHTML);
          }
        });

        tbody.appendChild(tr);
      });

      /* 삭제 버튼 (admin) */
      if (admin) {
        tbody.querySelectorAll('.tm-remove-btn').forEach(function(btn) {
          btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var list = loadRoster(_teamName);
            list.splice(Number(btn.dataset.idx), 1);
            saveRoster(_teamName, list);
            render();
          });
        });
      }

      body.appendChild(table);
    }

    /* 선수 추가 (admin) */
    if (admin) {
      var addRow = document.createElement('div');
      addRow.className = 'tm-add-row';
      addRow.innerHTML =
        '<input class="tm-add-input" id="tm-add-input" placeholder="선수 닉네임 입력" />' +
        '<button class="tm-add-btn" id="tm-add-btn">+ 추가</button>';
      body.appendChild(addRow);

      function addPlayer() {
        var inp = document.getElementById('tm-add-input');
        var val = (inp.value || '').trim();
        if (!val) return;
        var list = loadRoster(_teamName);
        if (list.indexOf(val) !== -1) { inp.value = ''; return; }
        list.push(val);
        saveRoster(_teamName, list);
        inp.value = '';
        render();
      }
      document.getElementById('tm-add-btn').addEventListener('click', addPlayer);
      document.getElementById('tm-add-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') addPlayer();
      });
    }
  }

  /* ── 열기 / 닫기 ── */
  function open(teamName, logoUrl, logoWhite, league, tournament, onPicker) {
    _teamName   = teamName   || '';
    _logoUrl    = logoUrl    || '';
    _logoWhite  = !!logoWhite;
    _league     = league     || '';
    _tournament = tournament || '';
    _onPicker   = onPicker   || null;
    render();
    document.getElementById('tm-overlay').removeAttribute('hidden');
  }
  function close() {
    document.getElementById('tm-overlay').setAttribute('hidden', '');
  }

  document.getElementById('tm-close').addEventListener('click', close);
  document.getElementById('tm-backdrop').addEventListener('click', close);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });
  document.getElementById('tm-change-btn').addEventListener('click', function() {
    close();
    if (_onPicker) _onPicker();
  });

  /* ── 공개 API ── */
  window.openTeamModal = open;

})();
