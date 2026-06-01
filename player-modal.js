(function () {
  /* ═══════════════════════════════════════════════════════════════
     VCT PLAYER MODAL  –  v3  (vct_p: storage)
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
     vct_p:NAME → { meta:{country,realname}, wins:[], maps:[{matchKey,mapIdx,league,stage,tournament,agent,acs,kda},...] }
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
     필터 그룹 헬퍼
  ═══════════════════════════════════════════════════════════════ */
  var LEAGUE_LABELS = {
    pacific:   'Pacific',
    americas:  'Americas',
    emea:      'EMEA',
    cn:        'China',
    masters:   'Masters',
    champions: 'Champions',
  };
  var TOURNAMENT_LABELS = {
    santiago: 'Santiago',
    london:   'London',
  };
  var STAGE_LABELS = {
    kickoff:        'KickOff',
    stage1:         'Stage 1',
    stage1playoffs: 'Stage 1 Playoffs',
    stage2:         'Stage 2',
    stage2playoffs: 'Stage 2 Playoffs',
    swiss:          'Swiss',
    playoffs:       'Playoffs',
    groupstage:     'Group Stage',
  };

  /* league + tournament + stage → 표시용 라벨 */
  function buildGroupLabel(league, tournament, stage) {
    var leagueName     = LEAGUE_LABELS[league]          || league      || '';
    var tournamentName = TOURNAMENT_LABELS[tournament]  || tournament  || '';

    // Champions의 Swiss는 Group Stage로 표시
    var stageName;
    if (league === 'champions' && stage === 'swiss') {
      stageName = 'Group Stage';
    } else {
      stageName = STAGE_LABELS[stage] || stage || '';
    }

    var prefix = '';
    if ((league === 'masters' || league === 'champions') && tournamentName) {
      prefix = leagueName + ' ' + tournamentName;
    } else {
      prefix = leagueName;
    }

    var parts = [];
    if (prefix) parts.push(prefix);
    if (stageName) parts.push(stageName);
    return parts.join(' · ') || '';
  }

  /* 그룹 정렬 키 (VCT 시즌 진행 순서) */
  function getGroupSortKey(g) {
    var l = g.league, t = g.tournament, s = g.stage;
    if (s === 'kickoff')                                        return  10;
    if (l === 'masters' && t === 'santiago' && s === 'swiss')   return  20;
    if (l === 'masters' && t === 'santiago' && s === 'playoffs') return 30;
    if (l === 'masters' && !t && s === 'swiss')                 return  25; // 토너먼트 미기재
    if (l === 'masters' && !t && s === 'playoffs')              return  35;
    if (s === 'stage1')                                         return  40;
    if (s === 'stage1playoffs')                                 return  50;
    if (l === 'masters' && t === 'london' && s === 'swiss')     return  60;
    if (l === 'masters' && t === 'london' && s === 'playoffs')  return  70;
    if (s === 'stage2')                                         return  80;
    if (s === 'stage2playoffs')                                 return  90;
    if (l === 'champions' && (s === 'swiss' || s === 'groupstage')) return 100;
    if (l === 'champions' && s === 'playoffs')                  return 110;
    return 999; // 알 수 없는 조합 → 숨김
  }

  /* maps 배열 → 그룹 목록 [{key, label, count}] (출현 순서 유지) */
  function buildFilterGroups(allMaps) {
    var order  = [];
    var groups = {};
    allMaps.forEach(function(m) {
      var key = (m.league || '') + '|' + (m.tournament || '') + '|' + (m.stage || '');
      if (!groups[key]) {
        groups[key] = {
          key:        key,
          league:     m.league      || '',
          tournament: m.tournament  || '',
          stage:      m.stage       || '',
          label:      buildGroupLabel(m.league, m.tournament, m.stage),
          count:      0,
        };
        order.push(key);
      }
      groups[key].count++;
    });
    return order.map(function(k) { return groups[k]; });
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
    .pm-team-logo-wrap img.logo-white { filter: brightness(0) invert(1); }
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

    /* admin 키 진단 */
    .pm-key-row {
      display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
      padding: 8px 26px 10px; flex-shrink: 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      background: rgba(255,255,255,0.01);
    }
    .pm-key-badge {
      font-family: monospace; font-size: 11px;
      color: rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.05);
      border-radius: 4px; padding: 2px 7px;
    }
    .pm-key-warn {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px; font-weight: 700; letter-spacing: 0.06em;
      color: rgba(255,180,60,0.85);
    }
    .pm-key-merge-inp {
      flex: 1; min-width: 100px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,180,60,0.35);
      border-radius: 6px; color: #fff;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; font-weight: 600;
      padding: 5px 10px; outline: none;
      transition: border-color 0.15s;
    }
    .pm-key-merge-inp:focus { border-color: rgba(255,180,60,0.6); }
    .pm-key-merge-inp::placeholder { color: rgba(255,255,255,0.2); }
    .pm-key-merge-btn {
      background: rgba(255,180,60,0.1);
      border: 1px solid rgba(255,180,60,0.3);
      border-radius: 6px; color: rgba(255,210,80,0.9);
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 12px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase; padding: 5px 12px;
      cursor: pointer; white-space: nowrap; transition: background 0.12s;
    }
    .pm-key-merge-btn:hover { background: rgba(255,180,60,0.22); }
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

    /* ── 경기 필터 버튼 바 ── */
    .pm-filter-bar {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 26px 0; flex-shrink: 0;
    }
    .pm-filter-btn {
      display: inline-flex; align-items: center; gap: 8px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 10px; padding: 8px 14px;
      cursor: pointer; transition: all 0.12s;
    }
    .pm-filter-btn:hover {
      background: rgba(255,255,255,0.09);
      border-color: rgba(255,255,255,0.18);
    }
    .pm-filter-btn.filtered {
      background: rgba(255,70,84,0.1);
      border-color: rgba(255,70,84,0.35);
    }
    .pm-filter-btn-icon {
      font-size: 13px; opacity: 0.6;
    }
    .pm-filter-btn-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 13px; font-weight: 700; letter-spacing: 0.08em;
      text-transform: uppercase;
      color: rgba(255,255,255,0.65);
    }
    .pm-filter-btn.filtered .pm-filter-btn-label {
      color: rgba(255,130,140,1);
    }
    .pm-filter-btn-count {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px; font-weight: 600;
      color: rgba(255,255,255,0.28);
      background: rgba(255,255,255,0.06);
      border-radius: 5px; padding: 2px 7px;
    }
    .pm-filter-btn.filtered .pm-filter-btn-count {
      color: rgba(255,130,140,0.7);
      background: rgba(255,70,84,0.12);
    }
    .pm-filter-btn-arrow {
      font-size: 9px; color: rgba(255,255,255,0.25);
      transition: transform 0.15s;
    }

    /* ── 필터 선택 팝업 ── */
    .pm-filter-popup-overlay {
      position: fixed; inset: 0; z-index: 10001;
      display: flex; align-items: center; justify-content: center;
    }
    .pm-filter-popup-overlay[hidden] { display: none !important; }
    .pm-filter-popup-bg {
      position: absolute; inset: 0;
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(4px);
    }
    .pm-filter-popup {
      position: relative; z-index: 1;
      background: #0d1520;
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 14px;
      width: min(400px, calc(100vw - 40px));
      max-height: 70vh;
      overflow-y: auto;
      box-shadow: 0 24px 70px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04) inset;
      animation: pmIn 0.2s cubic-bezier(0.16,1,0.3,1);
    }
    .pm-filter-popup-title {
      padding: 16px 20px 12px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px; font-weight: 700; letter-spacing: 0.16em;
      text-transform: uppercase; color: rgba(255,255,255,0.28);
      border-bottom: 1px solid rgba(255,255,255,0.06);
      position: sticky; top: 0;
      background: #0d1520;
    }
    .pm-filter-item {
      display: flex; align-items: center; justify-content: space-between;
      padding: 13px 20px;
      cursor: pointer;
      transition: background 0.1s;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .pm-filter-item:last-child { border-bottom: none; }
    .pm-filter-item:hover { background: rgba(255,255,255,0.05); }
    .pm-filter-item.pm-fi-selected {
      background: rgba(255,70,84,0.1);
    }
    .pm-filter-item-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 16px; font-weight: 700; letter-spacing: 0.04em;
      color: rgba(255,255,255,0.75);
    }
    .pm-filter-item.pm-fi-selected .pm-filter-item-label {
      color: rgba(255,130,140,1);
    }
    .pm-filter-item-right {
      display: flex; align-items: center; gap: 8px;
    }
    .pm-filter-item-maps {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 12px; font-weight: 600;
      color: rgba(255,255,255,0.22);
      background: rgba(255,255,255,0.05);
      border-radius: 6px; padding: 2px 8px;
    }
    .pm-filter-item.pm-fi-selected .pm-filter-item-maps {
      color: rgba(255,130,140,0.6);
      background: rgba(255,70,84,0.12);
    }
    .pm-filter-item-check {
      font-size: 14px; color: rgba(255,130,140,0.9);
      width: 16px; text-align: center;
    }
    /* 어드민 토너먼트 태그 버튼 */
    .pm-tag-row {
      display: flex; gap: 6px; padding: 0 20px 12px; flex-wrap: wrap;
    }
    .pm-tag-btn {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 4px 12px; border-radius: 6px; cursor: pointer;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.5);
      transition: all 0.12s;
    }
    .pm-tag-btn:hover {
      background: rgba(100,160,255,0.15);
      border-color: rgba(100,160,255,0.4);
      color: rgba(160,210,255,1);
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
            <span class="pm-info-label">본명</span>
            <input class="pm-info-input" id="pm-inp-realname" placeholder="예: Kim Min-chul" />
          </div>
        </div>

        <div id="pm-key-row" class="pm-key-row" style="display:none">
          <code id="pm-key-badge" class="pm-key-badge"></code>
          <span id="pm-key-warn" class="pm-key-warn" style="display:none">⚠ 데이터 없음 — 이름 불일치?</span>
          <input id="pm-key-merge-inp" class="pm-key-merge-inp" placeholder="매치 페이지의 이름 입력..." style="display:none" />
          <button id="pm-key-merge-btn" class="pm-key-merge-btn" style="display:none">여기서 불러오기</button>
        </div>

        <div id="pm-filter-bar" class="pm-filter-bar" style="display:none">
          <button id="pm-filter-btn" class="pm-filter-btn">
            <span id="pm-filter-btn-label" class="pm-filter-btn-label">전체</span>
            <span id="pm-filter-btn-count" class="pm-filter-btn-count"></span>
            <span class="pm-filter-btn-arrow">▾</span>
          </button>
        </div>

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

    <div id="pm-filter-popup-overlay" class="pm-filter-popup-overlay" hidden>
      <div class="pm-filter-popup-bg" id="pm-filter-popup-bg"></div>
      <div class="pm-filter-popup">
        <div class="pm-filter-popup-title">경기 필터 선택</div>
        <div id="pm-filter-list"></div>
      </div>
    </div>
  `;
  document.body.appendChild(el.firstElementChild);
  document.body.appendChild(el.firstElementChild); // filter popup overlay

  /* ═══════════════════════════════════════════════════════════════
     상태
  ═══════════════════════════════════════════════════════════════ */
  var _current       = null;
  var _activeFilter  = 'all'; // 'all' 또는 그룹 key 'league|tournament|stage'

  /* ═══════════════════════════════════════════════════════════════
     필터 팝업 열기/닫기
  ═══════════════════════════════════════════════════════════════ */
  function openFilterPopup() {
    if (!_current) return;
    var pd       = loadVctp(_current.name);
    var allMaps  = pd.maps || [];
    var groups   = buildFilterGroups(allMaps);
    var listEl   = document.getElementById('pm-filter-list');

    // 정렬 + 기타(label 없는 항목) 제거
    groups = groups
      .filter(function(g) { return getGroupSortKey(g) !== 999 && buildGroupLabel(g.league, g.tournament, g.stage) !== ''; })
      .sort(function(a, b) { return getGroupSortKey(a) - getGroupSortKey(b); });

    // '전체' 카운트 = 인식된 그룹 맵 합산 (기타 제외)
    var knownKeySet = {};
    groups.forEach(function(g) { knownKeySet[g.key] = true; });
    var recognizedCount = allMaps.filter(function(m) {
      return knownKeySet[(m.league||'') + '|' + (m.tournament||'') + '|' + (m.stage||'')];
    }).length;

    var items = [{ key: 'all', label: '전체', count: recognizedCount }].concat(groups);

    var admin = window.vctIsAdmin && window.vctIsAdmin();

    listEl.innerHTML = items.map(function(g) {
      var isSel = _activeFilter === g.key;
      // 어드민: Masters/Champions 토너먼트 미상 그룹에 태그 버튼 표시
      var needsTag = admin && g.key !== 'all' && (g.league === 'masters' || g.league === 'champions') && !g.tournament;
      var tagRow = '';
      if (needsTag) {
        var opts = g.league === 'masters'
          ? [['santiago','Santiago'],['london','London']]
          : [['bangkok','Bangkok']];  // Champions 토너먼트 이름
        tagRow = '<div class="pm-tag-row">' +
          '<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:10px;color:rgba(255,255,255,0.28);letter-spacing:0.1em;text-transform:uppercase;align-self:center;">토너먼트 지정:</span>' +
          opts.map(function(o) {
            return '<button class="pm-tag-btn" data-tag-key="' + g.key + '" data-tag-val="' + o[0] + '">' + o[1] + '</button>';
          }).join('') +
        '</div>';
      }
      return '<div class="pm-filter-item' + (isSel ? ' pm-fi-selected' : '') + '" data-key="' + g.key + '">' +
        '<span class="pm-filter-item-label">' + g.label + (needsTag ? ' <span style="font-size:11px;color:rgba(255,180,60,0.7);font-weight:600">(미상)</span>' : '') + '</span>' +
        '<div class="pm-filter-item-right">' +
          '<span class="pm-filter-item-maps">' + g.count + '맵</span>' +
          '<span class="pm-filter-item-check">' + (isSel ? '✓' : '') + '</span>' +
        '</div>' +
      '</div>' + tagRow;
    }).join('');

    listEl.querySelectorAll('.pm-filter-item').forEach(function(item) {
      item.addEventListener('click', function() {
        _activeFilter = item.dataset.key;
        closeFilterPopup();
        render();
      });
    });

    // 어드민 토너먼트 태그 버튼
    listEl.querySelectorAll('.pm-tag-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation(); // 부모 filter-item 클릭 방지
        var groupKey = btn.dataset.tagKey;   // e.g. 'masters||swiss'
        var newTournament = btn.dataset.tagVal; // e.g. 'santiago'
        var pd = loadVctp(_current.name);
        var changed = 0;
        pd.maps.forEach(function(m) {
          var key = (m.league||'') + '|' + (m.tournament||'') + '|' + (m.stage||'');
          if (key === groupKey) {
            m.tournament = newTournament;
            changed++;
          }
        });
        if (changed > 0) {
          saveVctp(_current.name, pd);
          closeFilterPopup();
          render();
          // 팝업 다시 열어서 결과 확인
          setTimeout(openFilterPopup, 80);
        }
      });
    });

    document.getElementById('pm-filter-popup-overlay').removeAttribute('hidden');
  }

  function closeFilterPopup() {
    document.getElementById('pm-filter-popup-overlay').setAttribute('hidden', '');
  }

  document.getElementById('pm-filter-popup-bg').addEventListener('click', closeFilterPopup);
  document.getElementById('pm-filter-btn').addEventListener('click', openFilterPopup);
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var popupVisible = !document.getElementById('pm-filter-popup-overlay').hasAttribute('hidden');
      if (popupVisible) {
        closeFilterPopup();
      } else {
        close();
      }
    }
  });

  /* ═══════════════════════════════════════════════════════════════
     렌더
  ═══════════════════════════════════════════════════════════════ */
  function render() {
    if (!_current) return;
    var name  = _current.name;
    var admin = window.vctIsAdmin && window.vctIsAdmin();
    var pd    = loadVctp(name);

    /* 메타 텍스트 */
    var parts = [];
    if (pd.meta.country)  parts.push(pd.meta.country);
    if (pd.meta.realname) parts.push(pd.meta.realname);
    document.getElementById('pm-meta').textContent = parts.join(' · ') || '—';

    /* admin 편집 */
    var editRow = document.getElementById('pm-info-edit');
    var keyRow  = document.getElementById('pm-key-row');
    if (admin) {
      editRow.style.display = 'flex';
      document.getElementById('pm-inp-country').value  = pd.meta.country  || '';
      document.getElementById('pm-inp-realname').value = pd.meta.realname || '';

      // 키 진단 행
      keyRow.style.display = 'flex';
      document.getElementById('pm-key-badge').textContent = 'vct_p:' + name;
      var hasData = (pd.maps && pd.maps.length > 0);
      document.getElementById('pm-key-warn').style.display    = hasData ? 'none' : 'inline';
      document.getElementById('pm-key-merge-inp').style.display = hasData ? 'none' : 'block';
      document.getElementById('pm-key-merge-btn').style.display = hasData ? 'none' : 'inline-block';
    } else {
      editRow.style.display = 'none';
      keyRow.style.display  = 'none';
    }

    /* ── 필터 버튼 업데이트 ── */
    var allMaps   = pd.maps || [];
    var groups    = buildFilterGroups(allMaps);
    var filterBar = document.getElementById('pm-filter-bar');
    var filterBtn = document.getElementById('pm-filter-btn');

    // 인식된 그룹만 (기타 제외, 정렬)
    var knownGroups = groups
      .filter(function(g) { return getGroupSortKey(g) !== 999 && buildGroupLabel(g.league, g.tournament, g.stage) !== ''; })
      .sort(function(a, b) { return getGroupSortKey(a) - getGroupSortKey(b); });

    // 인식된 그룹 키 집합
    var knownKeySet2 = {};
    knownGroups.forEach(function(g) { knownKeySet2[g.key] = true; });

    // 인식된 맵만 (기타 제외)
    var recognizedMaps = allMaps.filter(function(m) {
      return knownKeySet2[(m.league||'') + '|' + (m.tournament||'') + '|' + (m.stage||'')];
    });

    if (knownGroups.length >= 1) {
      filterBar.style.display = 'flex';

      // 현재 필터가 유효한지 확인 (없는 그룹이면 'all'로 리셋)
      if (_activeFilter !== 'all') {
        var validKeys = knownGroups.map(function(g) { return g.key; });
        if (validKeys.indexOf(_activeFilter) === -1) _activeFilter = 'all';
      }

      // 현재 필터 라벨 + 맵 수 표시
      var currentLabel, currentCount;
      if (_activeFilter === 'all') {
        currentLabel = '전체';
        currentCount = recognizedMaps.length; // 기타 제외
      } else {
        var activeGroup = null;
        for (var gi = 0; gi < knownGroups.length; gi++) {
          if (knownGroups[gi].key === _activeFilter) { activeGroup = knownGroups[gi]; break; }
        }
        currentLabel = activeGroup ? activeGroup.label : '전체';
        currentCount = activeGroup ? activeGroup.count : recognizedMaps.length;
      }

      document.getElementById('pm-filter-btn-label').textContent = currentLabel;
      document.getElementById('pm-filter-btn-count').textContent = currentCount + '맵';
      if (_activeFilter !== 'all') {
        filterBtn.classList.add('filtered');
      } else {
        filterBtn.classList.remove('filtered');
      }
    } else {
      filterBar.style.display = 'none';
      _activeFilter = 'all';
    }

    /* ── 필터 적용 ── */
    var maps = _activeFilter === 'all'
      ? recognizedMaps  // 기타 맵 제외
      : allMaps.filter(function(m) {
          var key = (m.league || '') + '|' + (m.tournament || '') + '|' + (m.stage || '');
          return key === _activeFilter;
        });

    /* ── 스탯 계산 ── */
    var cardsEl    = document.getElementById('pm-stat-cards');
    var agentsWrap = document.getElementById('pm-agents-wrap');

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
        var kparts = m.kda.split('/').map(function(x) { return parseFloat(x); });
        var K = kparts[0], D = kparts[1];
        if (!isNaN(K) && !isNaN(D) && D > 0) kdData.push(K / D);
      });
      var avgKD = kdData.length
        ? (kdData.reduce(function(s, v) { return s + v; }, 0) / kdData.length).toFixed(2)
        : '—';

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
    _current      = { name: playerName, team: teamName };
    _activeFilter = 'all';
    document.getElementById('pm-name').textContent = playerName;
    document.getElementById('pm-logo').innerHTML   = logoHTML || '';
    render();
    document.getElementById('player-modal').removeAttribute('hidden');
  }

  function close() {
    document.getElementById('player-modal').setAttribute('hidden', '');
    closeFilterPopup();
    _current = null;
  }

  /* ═══════════════════════════════════════════════════════════════
     이벤트
  ═══════════════════════════════════════════════════════════════ */
  document.getElementById('pm-close').addEventListener('click', close);
  document.getElementById('pm-backdrop').addEventListener('click', close);

  /* ── 키 병합 버튼 ── */
  function mergeFromOtherKey() {
    if (!_current) return;
    var inp      = document.getElementById('pm-key-merge-inp');
    var otherName = inp.value.trim();
    if (!otherName) return;

    var otherPd = loadVctp(otherName);
    if (!otherPd.maps || !otherPd.maps.length) {
      inp.style.borderColor = 'rgba(255,60,60,0.6)';
      inp.placeholder = '"' + otherName + '" 키에 데이터 없음';
      setTimeout(function() {
        inp.style.borderColor = '';
        inp.placeholder = '매치 페이지의 이름 입력...';
      }, 2000);
      return;
    }

    // 현재 선수 데이터에 병합
    var curPd = loadVctp(_current.name);
    var existingKeys = {};
    (curPd.maps || []).forEach(function(m) {
      existingKeys[m.matchKey + ':' + m.mapIdx] = true;
    });
    var added = 0;
    (otherPd.maps || []).forEach(function(m) {
      if (!existingKeys[m.matchKey + ':' + m.mapIdx]) {
        curPd.maps.push(m);
        added++;
      }
    });
    // meta도 병합 (현재 것 우선)
    if (!curPd.meta.country  && otherPd.meta.country)  curPd.meta.country  = otherPd.meta.country;
    if (!curPd.meta.realname && otherPd.meta.realname) curPd.meta.realname = otherPd.meta.realname;
    // wins 병합
    (otherPd.wins || []).forEach(function(w) {
      if ((curPd.wins || []).indexOf(w) === -1) curPd.wins.push(w);
    });

    saveVctp(_current.name, curPd);
    inp.value = '';
    console.log('[player-modal] 병합 완료: "' + otherName + '" → "' + _current.name + '" (' + added + '맵 추가)');
    render();
  }

  document.getElementById('pm-key-merge-btn').addEventListener('click', mergeFromOtherKey);
  document.getElementById('pm-key-merge-inp').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') mergeFromOtherKey();
  });

  ['pm-inp-country', 'pm-inp-realname'].forEach(function(id) {
    document.getElementById(id).addEventListener('blur', function() {
      if (!_current) return;
      var d = loadVctp(_current.name);
      d.meta.country  = document.getElementById('pm-inp-country').value.trim();
      d.meta.realname = document.getElementById('pm-inp-realname').value.trim();
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
