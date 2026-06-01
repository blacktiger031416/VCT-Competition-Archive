(function () {
  /* ═══════════════════════════════════════════════════════════════
     VCT PLAYER MODAL  –  v2  (vct_p: storage)
     새 데이터 구조: vct_p:PLAYER_NAME → { meta, wins, maps[] }
  ═══════════════════════════════════════════════════════════════ */

  /* ── 요원 이미지 맵 ─────────────────────────────────────────── */
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
    비토:    "https://i.namu.wiki/i/k7MZL2YWWu7DT9fcrySpYk2HioLYi80nJjgYHB2l24XiupY3Oebneq9aMJIXe7UqAL9sMd51Z7m_3hZOeSx7jQ.webp",
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

  /* ═══════════════════════════════════════════════════════════════
     새 데이터 구조 helpers
     vct_p:NAME → { meta:{country,role,team}, wins:[], maps:[{matchKey,mapIdx,agent,acs,kda},...] }
  ═══════════════════════════════════════════════════════════════ */
  function vctpKey(name) { return 'vct_p:' + name; }

  function loadVctp(name) {
    try {
      var raw = localStorage.getItem(vctpKey(name));
      if (!raw) return { meta: {}, wins: [], maps: [] };
      var d = JSON.parse(raw);
      if (!d.meta)  d.meta  = {};
      if (!d.wins)  d.wins  = [];
      if (!d.maps)  d.maps  = [];
      return d;
    } catch(e) { return { meta: {}, wins: [], maps: [] }; }
  }

  function saveVctp(name, data) {
    try { localStorage.setItem(vctpKey(name), JSON.stringify(data)); } catch(e) {}
  }

  /* ═══════════════════════════════════════════════════════════════
     마이그레이션: players:MATCH_KEY:mapIdx → vct_p:NAME
     한 번만 실행 (vct_p_migrated 플래그로 체크)
  ═══════════════════════════════════════════════════════════════ */
  function runMigration() {
    if (localStorage.getItem('vct_p_migrated') === '1') return;

    var count = 0;
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.startsWith('players:')) keys.push(k);
    }

    keys.forEach(function(k) {
      // players:MATCH_KEY:mapIdx  — mapIdx는 맨 마지막 :숫자
      var withoutPrefix = k.substring('players:'.length);
      var lastColon = withoutPrefix.lastIndexOf(':');
      if (lastColon === -1) return;
      var matchKey = withoutPrefix.substring(0, lastColon);
      var mapIdx   = parseInt(withoutPrefix.substring(lastColon + 1), 10);
      if (isNaN(mapIdx)) return;

      try {
        var d = JSON.parse(localStorage.getItem(k));
        if (!d || typeof d !== 'object' || Array.isArray(d)) return;

        Object.keys(d).forEach(function(slot) {
          var p = d[slot];
          if (!p || !p.name || p.name === '-' || p.name.trim() === '') return;

          var pName = p.name.trim();
          var pd    = loadVctp(pName);

          // 같은 matchKey+mapIdx 항목이 이미 있으면 필드 병합
          var existing = null;
          for (var j = 0; j < pd.maps.length; j++) {
            if (pd.maps[j].matchKey === matchKey && pd.maps[j].mapIdx === mapIdx) {
              existing = pd.maps[j]; break;
            }
          }
          if (!existing) {
            existing = { matchKey: matchKey, mapIdx: mapIdx };
            pd.maps.push(existing);
          }
          if (p.agent && p.agent.trim()) existing.agent = p.agent.trim();
          if (p.acs   != null && p.acs !== '') existing.acs = p.acs;
          if (p.kda   && p.kda.indexOf('/') !== -1) existing.kda = p.kda;

          saveVctp(pName, pd);
          count++;
        });
      } catch(e) {}
    });

    // 구버전 meta/wins 마이그레이션
    var metaKeys = [];
    for (var ii = 0; ii < localStorage.length; ii++) {
      var kk = localStorage.key(ii);
      if (kk && kk.startsWith('vct_player_meta:')) metaKeys.push(kk);
    }
    metaKeys.forEach(function(mk) {
      var pName = mk.substring('vct_player_meta:'.length);
      try {
        var meta = JSON.parse(localStorage.getItem(mk) || '{}');
        var pd   = loadVctp(pName);
        pd.meta  = Object.assign({}, meta, pd.meta);
        saveVctp(pName, pd);
      } catch(e) {}
    });

    var winsKeys = [];
    for (var jj = 0; jj < localStorage.length; jj++) {
      var wk = localStorage.key(jj);
      if (wk && wk.startsWith('vct_player_wins:')) winsKeys.push(wk);
    }
    winsKeys.forEach(function(wkk) {
      var pName = wkk.substring('vct_player_wins:'.length);
      try {
        var wins = JSON.parse(localStorage.getItem(wkk) || '[]');
        var pd   = loadVctp(pName);
        if (!pd.wins.length && wins.length) pd.wins = wins;
        saveVctp(pName, pd);
      } catch(e) {}
    });

    localStorage.setItem('vct_p_migrated', '1');
    console.log('[player-modal] 마이그레이션 완료: ' + count + '개 슬롯 → vct_p: 구조로 변환');
  }

  /* ═══════════════════════════════════════════════════════════════
     CSS
  ═══════════════════════════════════════════════════════════════ */
  var css = `
    .pm-overlay {
      position: fixed; inset: 0; z-index: 9999;
      display: flex; align-items: center; justify-content: center;
    }
    .pm-overlay[hidden] { display: none !important; }
    .pm-backdrop {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.78);
      backdrop-filter: blur(8px);
    }
    .pm-panel {
      position: relative; z-index: 1;
      width: min(620px, calc(100vw - 24px));
      max-height: 90vh;
      background: #0d1520;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      box-shadow: 0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04) inset;
      animation: pmIn 0.25s cubic-bezier(0.16,1,0.3,1);
      overflow: hidden;
      display: flex; flex-direction: column;
    }
    .pm-panel-scroll { overflow-y: auto; flex: 1; }
    @keyframes pmIn {
      from { opacity:0; transform: scale(0.94) translateY(16px); }
      to   { opacity:1; transform: none; }
    }

    /* 헤더 배너 */
    .pm-header {
      position: relative; flex-shrink: 0;
      display: flex; align-items: center; justify-content: space-between;
      padding: 24px 26px 24px; gap: 14px;
    }
    .pm-header::before {
      content: ''; position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(255,70,84,0.18) 0%, rgba(100,120,255,0.12) 50%, transparent 80%);
      pointer-events: none;
    }
    .pm-header::after {
      content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,70,84,0.5), rgba(100,120,255,0.5), transparent);
    }
    .pm-header-left { position: relative; display: flex; align-items: center; gap: 18px; flex: 1; min-width: 0; }
    .pm-team-logo-wrap {
      width: 60px; height: 60px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .pm-team-logo-wrap img { width: 80%; height: 80%; object-fit: contain; }
    .pm-header-text { flex: 1; min-width: 0; }
    .pm-player-name {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 36px; font-weight: 900;
      letter-spacing: 0.08em;
      color: #fff; margin: 0; line-height: 1.3;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      text-shadow: 0 2px 12px rgba(0,0,0,0.6);
    }
    .pm-player-meta {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; font-weight: 600; letter-spacing: 0.1em;
      color: rgba(255,255,255,0.4); margin-top: 5px;
      text-transform: uppercase;
    }
    .pm-close {
      position: relative;
      background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; color: rgba(255,255,255,0.4); font-size: 20px;
      cursor: pointer; padding: 6px 10px; line-height: 1;
      transition: all 0.15s; flex-shrink: 0; align-self: flex-start;
    }
    .pm-close:hover { background: rgba(255,255,255,0.12); color: #fff; border-color: rgba(255,255,255,0.2); }

    /* admin 기본정보 편집 */
    .pm-info-edit {
      display: flex; gap: 10px; flex-shrink: 0;
      padding: 14px 26px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      background: rgba(255,255,255,0.02);
    }
    .pm-info-field { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .pm-info-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: rgba(255,255,255,0.3);
    }
    .pm-info-input {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; color: #fff;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 14px; font-weight: 600; letter-spacing: 0.04em;
      padding: 7px 12px; outline: none; transition: border-color 0.15s;
    }
    .pm-info-input:focus { border-color: rgba(255,100,100,0.5); }

    /* 스테이지 탭 */
    .pm-stage-tabs {
      display: flex; gap: 6px; flex-wrap: wrap;
      padding: 16px 26px 0; flex-shrink: 0;
    }
    .pm-stage-tab {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 12px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase; padding: 6px 16px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 8px; color: rgba(255,255,255,0.35);
      cursor: pointer; transition: all 0.12s;
    }
    .pm-stage-tab:hover { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.6); }
    .pm-stage-tab.active {
      background: rgba(255,70,84,0.15);
      border-color: rgba(255,70,84,0.4);
      color: rgba(255,130,140,1);
    }

    /* 스탯 영역 */
    .pm-stats-area { padding: 16px 26px 0; }
    .pm-stat-cards { display: flex; gap: 12px; margin-bottom: 22px; }
    .pm-stat-card {
      flex: 1; position: relative; overflow: hidden;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px; padding: 18px 12px 14px; text-align: center;
      transition: border-color 0.2s, transform 0.2s;
    }
    .pm-stat-card::before {
      content: ''; position: absolute; top: 0; left: 50%; transform: translateX(-50%);
      width: 60%; height: 2px;
      background: linear-gradient(90deg, transparent, rgba(255,80,80,0.7), transparent);
      border-radius: 0 0 4px 4px;
    }
    .pm-stat-card:hover { border-color: rgba(255,80,80,0.25); transform: translateY(-2px); }
    .pm-stat-val {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 38px; font-weight: 900; color: #fff; line-height: 1;
      letter-spacing: -0.01em;
    }
    .pm-stat-lbl {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: rgba(255,255,255,0.3);
      margin-top: 7px;
    }

    /* 사용 요원 */
    .pm-agents-section { padding: 0 26px 22px; }
    .pm-section-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 10px; font-weight: 700; letter-spacing: 0.16em;
      text-transform: uppercase; color: rgba(255,255,255,0.25);
      margin-bottom: 12px; display: flex; align-items: center; gap: 8px;
    }
    .pm-section-label::after {
      content: ''; flex: 1; height: 1px;
      background: linear-gradient(90deg, rgba(255,255,255,0.08), transparent);
    }
    .pm-agents-row { display: flex; flex-wrap: wrap; gap: 10px; }
    .pm-agent-item {
      display: flex; flex-direction: column; align-items: center; gap: 5px;
      transition: transform 0.15s;
    }
    .pm-agent-item:hover { transform: translateY(-3px); }
    .pm-agent-img {
      width: 52px; height: 52px; object-fit: cover; object-position: top center;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.1);
      background: rgba(255,255,255,0.04);
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    }
    .pm-agent-item:first-child .pm-agent-img {
      border-color: rgba(255,180,60,0.5);
      box-shadow: 0 4px 16px rgba(255,150,30,0.25);
    }
    .pm-agent-count {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.45);
      letter-spacing: 0.04em;
    }
    .pm-agent-item:first-child .pm-agent-count { color: rgba(255,200,80,0.9); }

    .pm-no-data {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; color: rgba(255,255,255,0.2);
      text-align: center; padding: 16px 0;
    }

    .pm-divider {
      height: 1px; margin: 0 26px; flex-shrink: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
    }

    /* 우승 기록 */
    .pm-wins-section { padding: 22px 26px; }
    .pm-wins-list { display: flex; flex-direction: column; gap: 8px; }
    .pm-win-item {
      display: flex; align-items: center; gap: 12px;
      background: linear-gradient(90deg, rgba(255,200,60,0.08), rgba(255,200,60,0.03));
      border: 1px solid rgba(255,200,60,0.15);
      border-radius: 10px; padding: 12px 16px;
      transition: border-color 0.15s;
    }
    .pm-win-item:hover { border-color: rgba(255,200,60,0.3); }
    .pm-win-icon { font-size: 18px; flex-shrink: 0; }
    .pm-win-text {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 16px; font-weight: 700; letter-spacing: 0.04em;
      color: rgba(255,220,100,0.9); flex: 1;
    }
    .pm-win-remove {
      background: none; border: none;
      color: rgba(255,255,255,0.18); font-size: 16px;
      cursor: pointer; padding: 2px 4px; line-height: 1;
      transition: color 0.12s;
    }
    .pm-win-remove:hover { color: rgba(232,67,45,0.8); }
    .pm-no-wins {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; color: rgba(255,255,255,0.2);
      text-align: center; padding: 10px 0;
    }
    .pm-win-add-row { display: flex; gap: 8px; margin-top: 12px; }
    .pm-win-add-input {
      flex: 1; background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; color: #fff;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 14px; font-weight: 600; letter-spacing: 0.03em;
      padding: 9px 14px; outline: none; transition: border-color 0.15s;
    }
    .pm-win-add-input::placeholder { color: rgba(255,255,255,0.18); }
    .pm-win-add-input:focus { border-color: rgba(255,200,60,0.4); }
    .pm-win-add-btn {
      background: rgba(255,200,60,0.12);
      border: 1px solid rgba(255,200,60,0.3);
      border-radius: 8px; color: rgba(255,220,100,0.9);
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; font-weight: 700; letter-spacing: 0.06em;
      text-transform: uppercase; padding: 9px 18px;
      cursor: pointer; transition: background 0.12s; white-space: nowrap;
    }
    .pm-win-add-btn:hover { background: rgba(255,200,60,0.22); }
  `;
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ═══════════════════════════════════════════════════════════════
     HTML
  ═══════════════════════════════════════════════════════════════ */
  var el = document.createElement('div');
  el.innerHTML = `
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

        <div id="pm-stage-tabs" class="pm-stage-tabs" style="display:none"></div>

        <div class="pm-panel-scroll">
          <div class="pm-stats-area">
            <div id="pm-stat-cards"></div>
          </div>
          <div class="pm-agents-section" id="pm-agents-wrap"></div>
          <div class="pm-divider"></div>
          <div class="pm-wins-section">
            <div class="pm-section-label">우승 기록</div>
            <div class="pm-wins-list" id="pm-wins"></div>
            <div class="pm-win-add-row" id="pm-win-add-row" style="display:none">
              <input class="pm-win-add-input" id="pm-win-input" placeholder="예: VCT Masters Santiago 2026" />
              <button class="pm-win-add-btn" id="pm-win-add-btn">+ 추가</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(el.firstElementChild);

  /* ═══════════════════════════════════════════════════════════════
     상태
  ═══════════════════════════════════════════════════════════════ */
  var _current      = null;
  var _activeStage  = 'all';
  var STAGE_ORDER   = ['kickoff', 'stage1', 'stage2', 'playoffs'];
  var STAGE_LABELS  = {
    all:      '전체',
    kickoff:  'KickOff',
    stage1:   'Stage 1',
    stage2:   'Stage 2',
    playoffs: 'Playoffs',
  };

  /* ═══════════════════════════════════════════════════════════════
     렌더
  ═══════════════════════════════════════════════════════════════ */
  function render() {
    if (!_current) return;
    var name  = _current.name;
    var admin = window.vctIsAdmin && window.vctIsAdmin();
    var pd    = loadVctp(name);          // vct_p:NAME 에서 직접 로드

    /* 메타 텍스트 */
    var parts = [];
    if (pd.meta.country) parts.push(pd.meta.country);
    if (pd.meta.role)    parts.push(pd.meta.role);
    document.getElementById('pm-meta').textContent = parts.join(' · ') || '—';

    /* admin 편집 */
    var editRow = document.getElementById('pm-info-edit');
    if (admin) {
      editRow.style.display = 'flex';
      document.getElementById('pm-inp-country').value = pd.meta.country || '';
      document.getElementById('pm-inp-role').value    = pd.meta.role    || '';
    } else {
      editRow.style.display = 'none';
    }

    /* ── 스테이지 탭 ── */
    var allMaps    = pd.maps || [];
    var cardsEl    = document.getElementById('pm-stat-cards');
    var agentsWrap = document.getElementById('pm-agents-wrap');
    var tabsEl     = document.getElementById('pm-stage-tabs');

    var stageSeen = {};
    allMaps.forEach(function(m) {
      if (m.stage) stageSeen[m.stage] = true;
    });
    var stagesFound = STAGE_ORDER.filter(function(s) { return stageSeen[s]; });
    // 알 수 없는 stage 값도 추가
    Object.keys(stageSeen).forEach(function(s) {
      if (STAGE_ORDER.indexOf(s) === -1) stagesFound.push(s);
    });

    if (stagesFound.length >= 1) {
      var tabList = ['all'].concat(stagesFound);
      // _activeStage가 현재 데이터에 없으면 'all'로 리셋
      if (_activeStage !== 'all' && stagesFound.indexOf(_activeStage) === -1) _activeStage = 'all';
      tabsEl.style.display = 'flex';
      tabsEl.innerHTML = tabList.map(function(s) {
        return '<button class="pm-stage-tab' + (s === _activeStage ? ' active' : '') + '" data-stage="' + s + '">' +
          (STAGE_LABELS[s] || s) + '</button>';
      }).join('');
      tabsEl.querySelectorAll('.pm-stage-tab').forEach(function(btn) {
        btn.addEventListener('click', function() {
          _activeStage = btn.dataset.stage;
          render();
        });
      });
    } else {
      tabsEl.style.display = 'none';
      _activeStage = 'all';
    }

    /* 스테이지 필터 적용 */
    var maps = _activeStage === 'all'
      ? allMaps
      : allMaps.filter(function(m) { return m.stage === _activeStage; });

    /* ── 스탯 계산 ── */
    if (!maps.length) {
      cardsEl.innerHTML    = '<div class="pm-no-data">기록된 스탯이 없습니다</div>';
      agentsWrap.innerHTML = '';
    } else {
      /* 평균 ACS */
      var acsData = [];
      maps.forEach(function(m) {
        var v = parseFloat(m.acs);
        if (!isNaN(v) && v > 0) acsData.push(v);
      });
      var avgAcs = acsData.length
        ? Math.round(acsData.reduce(function(s, v) { return s + v; }, 0) / acsData.length)
        : '—';

      /* 평균 K/D */
      var kdData = [];
      maps.forEach(function(m) {
        if (!m.kda) return;
        var parts2 = m.kda.split('/').map(function(x) { return parseFloat(x); });
        var K = parts2[0], D = parts2[1];
        if (!isNaN(K) && !isNaN(D) && D > 0) kdData.push(K / D);
      });
      var avgKD = kdData.length
        ? (kdData.reduce(function(s, v) { return s + v; }, 0) / kdData.length).toFixed(2)
        : '—';

      /* 맵 수 표시 */
      var mapCountLabel = '(' + maps.length + '맵)';

      cardsEl.innerHTML =
        '<div class="pm-stat-cards">' +
          '<div class="pm-stat-card"><div class="pm-stat-val">' + avgAcs + '</div><div class="pm-stat-lbl">평균 ACS ' + mapCountLabel + '</div></div>' +
          '<div class="pm-stat-card"><div class="pm-stat-val">' + avgKD  + '</div><div class="pm-stat-lbl">평균 K/D ' + mapCountLabel + '</div></div>' +
        '</div>';

      /* 사용 요원 집계 */
      var agentCount = {};
      maps.forEach(function(m) {
        var ag = (m.agent || '').trim();
        if (!ag) return;
        agentCount[ag] = (agentCount[ag] || 0) + 1;
      });
      var agentList = Object.keys(agentCount).sort(function(a, b) { return agentCount[b] - agentCount[a]; });

      if (agentList.length) {
        var agentHTML = agentList.map(function(ag) {
          var imgUrl = AGENT_IMGS[ag] || '';
          var cnt    = agentCount[ag];
          return '<div class="pm-agent-item">' +
            (imgUrl
              ? '<img class="pm-agent-img" src="' + imgUrl + '" alt="' + ag + '" title="' + ag + '" />'
              : '<div class="pm-agent-img" style="display:flex;align-items:center;justify-content:center;font-size:10px;color:rgba(255,255,255,0.3)">' + ag + '</div>') +
            '<span class="pm-agent-count">' + cnt + '</span>' +
          '</div>';
        }).join('');

        agentsWrap.innerHTML =
          '<div class="pm-section-label">사용 요원</div>' +
          '<div class="pm-agents-row">' + agentHTML + '</div>';
      } else {
        agentsWrap.innerHTML = '';
      }
    }

    /* ── 우승 기록 ── */
    var wins  = pd.wins || [];
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
            var d = loadVctp(name);
            d.wins.splice(Number(btn.dataset.idx), 1);
            saveVctp(name, d);
            render();
          });
        });
      }
    }
    document.getElementById('pm-win-add-row').style.display = admin ? 'flex' : 'none';
  }

  /* ═══════════════════════════════════════════════════════════════
     열기/닫기
  ═══════════════════════════════════════════════════════════════ */
  function open(playerName, teamName, logoHTML) {
    _current     = { name: playerName, team: teamName };
    _activeStage = 'all';
    document.getElementById('pm-name').textContent = playerName;
    document.getElementById('pm-logo').innerHTML   = logoHTML || '';
    render();
    document.getElementById('player-modal').removeAttribute('hidden');
  }

  function close() {
    document.getElementById('player-modal').setAttribute('hidden', '');
    _current = null;
  }

  /* ═══════════════════════════════════════════════════════════════
     이벤트
  ═══════════════════════════════════════════════════════════════ */
  document.getElementById('pm-close').addEventListener('click', close);
  document.getElementById('pm-backdrop').addEventListener('click', close);
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') close(); });

  ['pm-inp-country', 'pm-inp-role'].forEach(function(id) {
    document.getElementById(id).addEventListener('blur', function() {
      if (!_current) return;
      var d = loadVctp(_current.name);
      d.meta.country = document.getElementById('pm-inp-country').value.trim();
      d.meta.role    = document.getElementById('pm-inp-role').value.trim();
      saveVctp(_current.name, d);
      render();
    });
  });

  function addWin() {
    if (!_current) return;
    var inp = document.getElementById('pm-win-input');
    var val = inp.value.trim();
    if (!val) return;
    var d = loadVctp(_current.name);
    d.wins.push(val);
    saveVctp(_current.name, d);
    inp.value = '';
    render();
  }
  document.getElementById('pm-win-add-btn').addEventListener('click', addWin);
  document.getElementById('pm-win-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') addWin();
  });

  /* ═══════════════════════════════════════════════════════════════
     공개 API
  ═══════════════════════════════════════════════════════════════ */
  window.openPlayerModal = open;

  /**
   * match-dark 파일에서 saveFieldSync 이후 호출:
   * updateVctPlayer(playerName, matchKey, mapIdx, { agent, acs, kda })
   */
  window.updateVctPlayer = function(playerName, matchKey, mapIdx, fields) {
    if (!playerName || playerName === '-' || !playerName.trim()) return;
    var pName = playerName.trim();
    var pd    = loadVctp(pName);

    // 같은 matchKey+mapIdx 항목 찾기 (없으면 생성)
    var entry = null;
    for (var i = 0; i < pd.maps.length; i++) {
      if (pd.maps[i].matchKey === matchKey && pd.maps[i].mapIdx === mapIdx) {
        entry = pd.maps[i]; break;
      }
    }
    if (!entry) {
      entry = { matchKey: matchKey, mapIdx: mapIdx };
      pd.maps.push(entry);
    }

    // 필드 업데이트 (null/undefined는 건너뜀)
    if (fields.agent !== undefined && fields.agent !== null && fields.agent !== '')
      entry.agent = fields.agent;
    if (fields.acs !== undefined && fields.acs !== null && fields.acs !== '')
      entry.acs = fields.acs;
    if (fields.kda !== undefined && fields.kda !== null && fields.kda.indexOf && fields.kda.indexOf('/') !== -1)
      entry.kda = fields.kda;

    saveVctp(pName, pd);
  };

  /* ── 마이그레이션 실행 (로드 시 1회) ── */
  runMigration();

})();
