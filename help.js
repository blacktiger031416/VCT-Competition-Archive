/**
 * help.js — 페이지별 도움말 오버레이
 *
 * auth.js의 "?" 버튼이 window.vctHelpOpen() 을 호출합니다.
 * 각 페이지의 주요 요소에 번호 마커를 표시하고
 * 하단 패널에 설명을 보여줍니다.
 */
(function () {
  "use strict";

  /* ── CSS 주입 ──────────────────────────────────────── */
  var style = document.createElement("style");
  style.textContent = [
    "#help-overlay {",
    "  position:fixed; inset:0; z-index:98000;",
    "  background:rgba(0,0,0,0.10);",
    "  backdrop-filter:blur(0px); -webkit-backdrop-filter:blur(0px);",
    "  animation:helpFadeIn .2s ease;",
    "}",
    "@keyframes helpFadeIn { from{opacity:0} to{opacity:1} }",

    "#help-close-btn {",
    "  position:fixed; top:14px; right:18px; z-index:98020;",
    "  width:36px; height:36px; border-radius:50%;",
    "  background:rgba(255,255,255,0.12); border:1px solid rgba(255,255,255,0.25);",
    "  color:#fff; font-size:18px; cursor:pointer;",
    "  display:grid; place-items:center; transition:background .15s;",
    "}",
    "#help-close-btn:hover { background:rgba(255,255,255,0.24); }",

    ".help-marker {",
    "  position:fixed; z-index:98010;",
    "  width:24px; height:24px; border-radius:50%;",
    "  background:#e8432d; color:#fff;",
    "  font-family:'Barlow Condensed',sans-serif;",
    "  font-size:12px; font-weight:900;",
    "  display:grid; place-items:center;",
    "  box-shadow:0 2px 10px rgba(0,0,0,0.6), 0 0 0 3px rgba(232,67,45,0.3);",
    "  pointer-events:none;",
    "  animation:markerPop .25s cubic-bezier(0.16,1,0.3,1) both;",
    "}",
    "@keyframes markerPop { from{opacity:0;transform:scale(0.4)} to{opacity:1;transform:scale(1)} }",

    "#help-panel {",
    "  position:fixed; bottom:20px; left:50%; transform:translateX(-50%);",
    "  z-index:98020;",
    "  width:min(600px,calc(100vw - 32px));",
    "  max-height:45vh; overflow-y:auto;",
    "  background:rgba(8,12,22,0.97);",
    "  border:1px solid rgba(255,255,255,0.1); border-radius:12px;",
    "  padding:18px 20px;",
    "  backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);",
    "  box-shadow:0 24px 80px rgba(0,0,0,0.8);",
    "  animation:helpFadeIn .25s ease;",
    "}",
    "#help-panel::-webkit-scrollbar { width:4px; }",
    "#help-panel::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.15); border-radius:2px; }",

    ".help-panel-title {",
    "  font-family:'Barlow Condensed',sans-serif;",
    "  font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase;",
    "  color:rgba(255,255,255,0.35); margin-bottom:14px;",
    "}",
    ".help-item {",
    "  display:flex; align-items:flex-start; gap:12px; margin-bottom:10px;",
    "}",
    ".help-item:last-child { margin-bottom:0; }",
    ".help-item-num {",
    "  flex-shrink:0; width:22px; height:22px; border-radius:50%;",
    "  background:#e8432d; color:#fff;",
    "  font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:900;",
    "  display:grid; place-items:center; margin-top:1px;",
    "}",
    ".help-item-text { flex:1; min-width:0; }",
    ".help-item-title {",
    "  font-family:'Barlow Condensed',sans-serif; font-size:14px; font-weight:800;",
    "  letter-spacing:.03em; color:#fff; margin-bottom:2px;",
    "}",
    ".help-item-desc {",
    "  font-family:'Noto Sans KR','Barlow',sans-serif; font-size:12px;",
    "  color:rgba(255,255,255,0.48); line-height:1.65; word-break:keep-all;",
    "}",
    ".help-panel-tip {",
    "  margin-top:14px; padding-top:12px; border-top:1px solid rgba(255,255,255,0.07);",
    "  font-family:'Barlow Condensed',sans-serif; font-size:11px; font-weight:700;",
    "  letter-spacing:.06em; color:rgba(255,255,255,0.2); text-align:center;",
    "}",
  ].join("\n");
  document.head.appendChild(style);

  /* ── 페이지별 도움말 설정 ──────────────────────────── */
  var HELP_CONFIG = {

    /* ── 메인 페이지 */
    index: {
      title: "메인 페이지 도움말",
      items: [
        { sel: ".nav-links a[href*='records'], .nav-link[href*='records']",
          title: "기록",
          desc: "VCT 경기 결과와 맵 상세 데이터를 볼 수 있는 아카이브 페이지로 이동합니다." },
        { sel: ".nav-links a[href*='tierlist'], .nav-link[href*='tierlist']",
          title: "티어리스트",
          desc: "팀 티어리스트를 직접 만들고, 다른 사람들의 티어리스트를 볼 수 있는 게시판입니다." },
        { sel: ".nav-links a[href*='prediction'], .nav-link[href*='prediction']",
          title: "승부 예측",
          desc: "경기 결과를 예측하고 코인을 베팅합니다. 맞히면 코인을 획득합니다." },
        { sel: ".league-grid .league-card, .hero",
          title: "리그 / 대회 카드",
          desc: "Pacific, CN, Americas, EMEA 리그 및 Masters, Champions 대회 페이지로 이동합니다." },
      ],
    },

    /* ── 승부 예측 */
    prediction: {
      title: "승부 예측 도움말",
      items: [
        { sel: ".tab-btn[data-tab='predict'], [data-tab='predict']",
          title: "승부 예측 탭",
          desc: "진행 중인 경기에 코인을 베팅합니다. 팀을 선택하고 베팅 코인을 입력하세요." },
        { sel: ".tab-btn[data-tab='rank'], [data-tab='rank']",
          title: "순위 탭",
          desc: "코인 보유량 기준 상위 10명의 순위표입니다. Admin 계정은 포함되지 않습니다." },
        { sel: ".tab-btn[data-tab='hof'], [data-tab='hof']",
          title: "명예의 전당 탭",
          desc: "시즌이 종료될 때마다 1·2·3위 수상자가 기록되는 공간입니다." },
        { sel: ".coin-display",
          title: "내 코인",
          desc: "현재 보유 코인입니다. 베팅이 적중하면 배당률에 따라 코인을 돌려받습니다." },
        { sel: "#attend-card",
          title: "출석 체크",
          desc: "매일 07:00~24:00 KST 사이 한 번 출석하면 100코인을 획득합니다." },
        { sel: "#matches-list .pred-match, #matches-list",
          title: "예측 경기 목록",
          desc: "베팅 가능한 경기 목록입니다. 팀을 선택하고 코인 수를 입력한 뒤 예측 버튼을 누르세요." },
      ],
    },

    /* ── 티어리스트 목록 */
    tierlist_list: {
      title: "티어리스트 게시판 도움말",
      items: [
        { sel: "#season-winners",
          title: "전 시즌 수상자 티어리스트",
          desc: "지난 시즌 1·2·3위 유저의 티어리스트가 고정 표시됩니다. 보기를 눌러 확인하세요." },
        { sel: "#btn-new",
          title: "새 티어리스트 만들기 (Admin)",
          desc: "Admin 전용 버튼입니다. 팀 구성과 티어 이름을 설정해 새 이벤트를 만듭니다." },
        { sel: "#events-grid",
          title: "이벤트 목록",
          desc: "참여 가능한 티어리스트 이벤트가 표시됩니다. 카드를 클릭해 티어리스트를 작성하세요." },
      ],
    },

    /* ── 티어리스트 상세 (제작/감상) */
    tierlist_detail: {
      title: "티어리스트 제작 도움말",
      items: [
        { sel: "#tier-rows",
          title: "티어 행",
          desc: "팀 카드를 드래그해 원하는 티어에 놓으세요. 같은 티어 내에서도 순서를 바꿀 수 있습니다." },
        { sel: "#pool-grid",
          title: "팀 풀",
          desc: "아직 배치하지 않은 팀들입니다. 드래그해서 티어에 배치하거나, 배치된 팀을 다시 여기로 드래그해 제거합니다." },
        { sel: "#btn-submit",
          title: "게시하기",
          desc: "완성한 티어리스트를 게시판에 올립니다. 이미 게시한 경우 수정 게시로 업데이트됩니다." },
        { sel: "#board-section",
          title: "게시판",
          desc: "다른 유저들이 올린 티어리스트를 볼 수 있습니다. ♥를 눌러 좋아요를 남겨보세요." },
      ],
    },

    /* ── 기록 페이지 */
    records: {
      title: "경기 기록 도움말",
      items: [
        { sel: ".filter-group, .filter-bar, .record-filter, select",
          title: "필터",
          desc: "리그, 대회, 팀을 선택해 원하는 경기 기록만 필터링합니다." },
        { sel: ".match-row, .record-card, .result-item, table tbody tr",
          title: "경기 기록",
          desc: "각 경기의 팀과 스코어를 보여줍니다. 행을 클릭하면 맵별 상세 데이터로 이동합니다." },
      ],
    },

    /* ── 리그 페이지 (pacific / cn / americas / emea) */
    league: {
      title: "리그 페이지 도움말",
      items: [
        { sel: ".stage-nav a, .nav-list a, .tournament-card, .stage-link",
          title: "대회 선택",
          desc: "KickOff, Stage 1, Stage 2, Playoffs 등 각 대회 결과 페이지로 이동합니다." },
        { sel: ".league-mark img, .league-hero img",
          title: "리그 로고",
          desc: "현재 보고 있는 리그의 공식 로고입니다." },
      ],
    },

    /* ── 스테이지 / 플레이오프 페이지 */
    stage: {
      title: "경기 결과 페이지 도움말",
      items: [
        { sel: ".stage-top-nav a, .back-link, .stage-subnav a",
          title: "대회 이동",
          desc: "다른 대회나 상위 리그 페이지로 이동하는 버튼입니다." },
        { sel: ".standings-table, .standings-wrap, .group-standings",
          title: "순위표",
          desc: "조별 팀 순위와 매치 득실, 라운드 득실을 보여줍니다. 상위 팀은 다음 단계로 진출합니다." },
        { sel: ".match-block, .match-cell, .series-row, .result-row",
          title: "경기 결과",
          desc: "경기 스코어와 날짜입니다. 클릭하면 해당 경기의 맵별 상세 데이터 페이지로 이동합니다." },
        { sel: ".bracket-wrap, .bracket-cell",
          title: "대진표",
          desc: "토너먼트/플레이오프 대진 구조와 각 라운드 결과를 보여줍니다." },
      ],
    },

    /* ── Masters / Champions 팀 배정 페이지 */
    tournament_setup: {
      title: "대회 팀 배정 도움말",
      items: [
        { sel: ".slot-grid, .region-group, .team-slot-wrap",
          title: "지역별 참가팀 슬롯",
          desc: "각 지역에서 진출한 팀을 슬롯에 배정합니다. 슬롯을 클릭해 팀을 선택하세요." },
        { sel: ".match-block, .bracket-wrap",
          title: "대진표 / 경기 결과",
          desc: "대회의 대진 구조와 각 경기 결과를 보여줍니다." },
      ],
    },

    /* ── 맵 상세 데이터 (match-dark) */
    match_dark: {
      title: "맵 상세 데이터 도움말",
      items: [
        { sel: ".mo-map-slot, .map-tab-btn",
          title: "맵 탭",
          desc: "각 맵 탭을 클릭해 해당 맵의 데이터를 확인합니다. 최대 5맵이 표시됩니다." },
        { sel: ".mo-veto-cell, .veto-row, #veto-section",
          title: "맵 밴픽 (베토)",
          desc: "양 팀이 진행한 맵 선택/밴 순서와 결과를 보여줍니다." },
        { sel: ".sb-row, .scoreboard-wrap, #score-section",
          title: "라운드 스코어보드",
          desc: "라운드별 공격/방어 승패를 색으로 구분해 보여줍니다. 클릭하면 상세 정보를 볼 수 있습니다." },
        { sel: ".pc-row, .player-stat-row, #player-section",
          title: "플레이어 스탯",
          desc: "각 선수의 ACS, K/D/A, KAST, ADR 등 상세 통계입니다." },
        { sel: ".pc-agent, .agent-chip",
          title: "에이전트 픽",
          desc: "선수가 해당 맵에서 사용한 에이전트입니다. Admin만 수정할 수 있습니다." },
        { sel: ".ts-section, .team-stats-wrap",
          title: "팀 스탯",
          desc: "맵 전체 팀 스탯 (퍼스트 킬, 절약왕 등) 을 보여줍니다." },
      ],
    },
  };

  /* ── 현재 페이지에 맞는 설정 선택 ──────────────────── */
  function getConfig() {
    var path = window.location.pathname;
    var qs   = window.location.search;

    if (path.includes("match-dark"))    return HELP_CONFIG.match_dark;
    if (path.includes("prediction"))    return HELP_CONFIG.prediction;
    if (path.includes("records"))       return HELP_CONFIG.records;

    if (path.includes("tierlist")) {
      return qs.includes("id=") ? HELP_CONFIG.tierlist_detail : HELP_CONFIG.tierlist_list;
    }

    if (path.includes("stage") || path.includes("kickoff") ||
        path.includes("playoffs") || path.includes("swiss") ||
        path.includes("group"))         return HELP_CONFIG.stage;

    if (path.includes("masters") || path.includes("champions")) {
      return HELP_CONFIG.tournament_setup;
    }

    if (path.includes("pacific") || path.includes("americas") ||
        path.includes("emea") || path.includes("cn")) {
      return HELP_CONFIG.league;
    }

    return HELP_CONFIG.index;
  }

  /* ── 오버레이 열기 ──────────────────────────────────── */
  var _isOpen     = false;
  var _markers    = [];
  var _overlayEl  = null;
  var _panelEl    = null;
  var _closeBtnEl = null;

  function openHelp() {
    if (_isOpen) return;
    _isOpen = true;

    var cfg = getConfig();

    /* 스크롤 잠금 */
    document.body.style.overflow = "hidden";

    /* 반투명 오버레이 */
    _overlayEl = document.createElement("div");
    _overlayEl.id = "help-overlay";
    _overlayEl.addEventListener("click", closeHelp);
    document.body.appendChild(_overlayEl);

    /* 닫기 버튼 */
    _closeBtnEl = document.createElement("button");
    _closeBtnEl.id = "help-close-btn";
    _closeBtnEl.innerHTML = "✕";
    _closeBtnEl.title = "닫기 (ESC)";
    _closeBtnEl.addEventListener("click", closeHelp);
    document.body.appendChild(_closeBtnEl);

    /* 요소 탐색 → 유효한 항목만 마커 생성 */
    var validItems = [];
    cfg.items.forEach(function (item) {
      /* 콤마로 연결된 여러 셀렉터 중 처음으로 찾은 것 사용 */
      var el = null;
      var selectors = item.sel.split(",");
      for (var i = 0; i < selectors.length; i++) {
        try {
          var found = document.querySelector(selectors[i].trim());
          if (found) { el = found; break; }
        } catch (e) { /* 잘못된 셀렉터 무시 */ }
      }
      if (!el) return;

      var rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return;

      var num = validItems.length + 1;
      item._num = num;
      validItems.push(item);

      /* 번호 마커 */
      var marker = document.createElement("div");
      marker.className = "help-marker";
      marker.textContent = num;
      marker.style.animationDelay = (num * 0.06) + "s";

      /* 요소 오른쪽 위 모서리 근처에 배치 */
      var mx = Math.min(rect.right - 12, window.innerWidth - 28);
      var my = Math.max(rect.top - 12,  8);
      marker.style.left = mx + "px";
      marker.style.top  = my + "px";

      document.body.appendChild(marker);
      _markers.push(marker);
    });

    /* 하단 정보 패널 */
    _panelEl = document.createElement("div");
    _panelEl.id = "help-panel";
    _panelEl.addEventListener("click", function (e) { e.stopPropagation(); });

    var html = '<div class="help-panel-title">' + escHtml(cfg.title) + '</div>';
    if (!validItems.length) {
      html += '<div class="help-item-desc" style="color:rgba(255,255,255,0.35);text-align:center;padding:12px 0;">이 페이지에서 인식된 요소가 없습니다.</div>';
    } else {
      validItems.forEach(function (item) {
        html +=
          '<div class="help-item">' +
            '<div class="help-item-num">' + item._num + '</div>' +
            '<div class="help-item-text">' +
              '<div class="help-item-title">' + escHtml(item.title) + '</div>' +
              '<div class="help-item-desc">' + escHtml(item.desc) + '</div>' +
            '</div>' +
          '</div>';
      });
    }
    html += '<div class="help-panel-tip">클릭하거나 ESC 키를 눌러 닫기</div>';

    _panelEl.innerHTML = html;
    document.body.appendChild(_panelEl);

    document.addEventListener("keydown", _onKeyDown);
  }

  /* ── 오버레이 닫기 ──────────────────────────────────── */
  function closeHelp() {
    if (!_isOpen) return;
    _isOpen = false;
    document.body.style.overflow = "";
    if (_overlayEl)  { _overlayEl.remove();  _overlayEl  = null; }
    if (_panelEl)    { _panelEl.remove();    _panelEl    = null; }
    if (_closeBtnEl) { _closeBtnEl.remove(); _closeBtnEl = null; }
    _markers.forEach(function (m) { m.remove(); });
    _markers = [];
    document.removeEventListener("keydown", _onKeyDown);
  }

  function _onKeyDown(e) {
    if (e.key === "Escape") closeHelp();
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ── 전역 노출 (auth.js의 "?" 버튼이 호출) ─────────── */
  window.vctHelpOpen  = openHelp;
  window.vctHelpClose = closeHelp;

})();
