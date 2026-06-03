/**
 * help.js — 페이지별 도움말 오버레이 (스텝 방식)
 *
 * auth.js의 "?" 버튼이 window.vctHelpOpen() 을 호출합니다.
 * 한 번에 하나씩 요소를 강조하며, 다음/이전 버튼으로 탐색합니다.
 * 요소가 화면 밖에 있으면 자동으로 스크롤합니다.
 */
(function () {
  "use strict";

  /* ── CSS 주입 ──────────────────────────────────────── */
  var style = document.createElement("style");
  style.textContent = [
    "#help-overlay {",
    "  position:fixed; inset:0; z-index:98000;",
    "  background:rgba(0,0,0,0.10);",
    "  pointer-events:none;",
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
    "  width:28px; height:28px; border-radius:50%;",
    "  background:#e8432d; color:#fff;",
    "  font-family:'Barlow Condensed',sans-serif;",
    "  font-size:13px; font-weight:900;",
    "  display:grid; place-items:center;",
    "  box-shadow:0 2px 12px rgba(232,67,45,0.6), 0 0 0 4px rgba(232,67,45,0.25);",
    "  pointer-events:none;",
    "  animation:markerPop .3s cubic-bezier(0.16,1,0.3,1) both;",
    "}",
    "@keyframes markerPop { from{opacity:0;transform:scale(0.3)} to{opacity:1;transform:scale(1)} }",

    /* 하이라이트 링 */
    ".help-highlight-ring {",
    "  position:fixed; z-index:98005;",
    "  border:2px solid rgba(232,67,45,0.6);",
    "  border-radius:6px;",
    "  pointer-events:none;",
    "  box-shadow:0 0 0 4000px rgba(0,0,0,0.35);",
    "  animation:ringPop .3s cubic-bezier(0.16,1,0.3,1) both;",
    "}",
    "@keyframes ringPop { from{opacity:0} to{opacity:1} }",

    "#help-panel {",
    "  position:fixed; bottom:20px; left:50%; transform:translateX(-50%);",
    "  z-index:98020;",
    "  width:min(560px,calc(100vw - 32px));",
    "  background:rgba(8,12,22,0.97);",
    "  border:1px solid rgba(255,255,255,0.1); border-radius:12px;",
    "  padding:18px 20px 14px;",
    "  backdrop-filter:blur(20px); -webkit-backdrop-filter:blur(20px);",
    "  box-shadow:0 24px 80px rgba(0,0,0,0.8);",
    "  animation:helpFadeIn .2s ease;",
    "}",

    ".help-panel-header {",
    "  display:flex; align-items:center; justify-content:space-between;",
    "  margin-bottom:12px;",
    "}",
    ".help-panel-title {",
    "  font-family:'Barlow Condensed',sans-serif;",
    "  font-size:11px; font-weight:800; letter-spacing:.18em; text-transform:uppercase;",
    "  color:rgba(255,255,255,0.3);",
    "}",
    ".help-panel-counter {",
    "  font-family:'Barlow Condensed',sans-serif;",
    "  font-size:11px; font-weight:700; letter-spacing:.08em;",
    "  color:rgba(255,255,255,0.3);",
    "}",

    ".help-step-body {",
    "  display:flex; align-items:flex-start; gap:12px; margin-bottom:16px;",
    "}",
    ".help-step-num {",
    "  flex-shrink:0; width:26px; height:26px; border-radius:50%;",
    "  background:#e8432d; color:#fff;",
    "  font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:900;",
    "  display:grid; place-items:center;",
    "}",
    ".help-step-text { flex:1; min-width:0; }",
    ".help-step-title {",
    "  font-family:'Barlow Condensed',sans-serif; font-size:16px; font-weight:800;",
    "  letter-spacing:.03em; color:#fff; margin-bottom:4px;",
    "}",
    ".help-step-desc {",
    "  font-family:'Noto Sans KR','Barlow',sans-serif; font-size:13px;",
    "  color:rgba(255,255,255,0.55); line-height:1.7; word-break:keep-all;",
    "}",

    ".help-panel-nav {",
    "  display:flex; gap:8px; align-items:center;",
    "  border-top:1px solid rgba(255,255,255,0.07); padding-top:12px;",
    "}",
    ".help-nav-btn {",
    "  flex:1; height:36px; border-radius:6px; border:1px solid rgba(255,255,255,0.12);",
    "  background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.6);",
    "  font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:700;",
    "  letter-spacing:.1em; text-transform:uppercase; cursor:pointer;",
    "  transition:background .15s, color .15s, border-color .15s;",
    "}",
    ".help-nav-btn:hover { background:rgba(255,255,255,0.12); color:#fff; border-color:rgba(255,255,255,0.22); }",
    ".help-nav-btn:disabled { opacity:0.3; cursor:default; }",
    ".help-nav-btn--next {",
    "  background:#e8432d; border-color:#e8432d; color:#fff;",
    "}",
    ".help-nav-btn--next:hover { background:#d43520; border-color:#d43520; }",
    ".help-nav-dots {",
    "  display:flex; gap:5px; align-items:center; flex-shrink:0;",
    "}",
    ".help-nav-dot {",
    "  width:6px; height:6px; border-radius:50%;",
    "  background:rgba(255,255,255,0.18); transition:background .2s;",
    "}",
    ".help-nav-dot.active { background:#e8432d; }",
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
          desc: "라운드별 공격/방어 승패를 색으로 구분해 보여줍니다." },
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

  /* ── 상태 ──────────────────────────────────────────── */
  var _isOpen      = false;
  var _step        = 0;
  var _validItems  = [];   /* { title, desc, _el } */
  var _overlayEl   = null;
  var _panelEl     = null;
  var _closeBtnEl  = null;
  var _markerEl    = null;
  var _ringEl      = null;
  var _scrollTimer = null;

  /* ── 오버레이 열기 ──────────────────────────────────── */
  function openHelp() {
    if (_isOpen) return;
    _isOpen = true;
    _step = 0;

    var cfg = getConfig();

    /* 유효 항목 수집 */
    _validItems = [];
    cfg.items.forEach(function (item) {
      var el = null;
      var selectors = item.sel.split(",");
      for (var i = 0; i < selectors.length; i++) {
        try {
          var found = document.querySelector(selectors[i].trim());
          if (found) { el = found; break; }
        } catch (e) {}
      }
      if (!el) return;
      _validItems.push({ title: item.title, desc: item.desc, _el: el });
    });

    /* 반투명 오버레이 (pointer-events:none 이라 클릭 통과) */
    _overlayEl = document.createElement("div");
    _overlayEl.id = "help-overlay";
    document.body.appendChild(_overlayEl);

    /* 닫기 버튼 */
    _closeBtnEl = document.createElement("button");
    _closeBtnEl.id = "help-close-btn";
    _closeBtnEl.innerHTML = "✕";
    _closeBtnEl.title = "닫기 (ESC)";
    _closeBtnEl.addEventListener("click", closeHelp);
    document.body.appendChild(_closeBtnEl);

    /* 패널 */
    _panelEl = document.createElement("div");
    _panelEl.id = "help-panel";
    document.body.appendChild(_panelEl);

    document.addEventListener("keydown", _onKeyDown);

    if (_validItems.length === 0) {
      renderEmptyPanel(cfg.title);
    } else {
      goToStep(0);
    }
  }

  /* ── 스텝 이동 ──────────────────────────────────────── */
  function goToStep(idx) {
    _step = idx;
    var item = _validItems[idx];
    var el   = item._el;

    /* 하이라이트 링 제거 → 재생성 */
    if (_ringEl)   { _ringEl.remove();   _ringEl   = null; }
    if (_markerEl) { _markerEl.remove(); _markerEl = null; }

    /* 스크롤: 요소가 뷰포트 안에 있는지 확인 */
    var rect = el.getBoundingClientRect();
    var panelHeight = 160; /* 패널 높이 여유 */
    var inView = (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight - panelHeight) &&
      rect.right <= window.innerWidth
    );

    if (!inView) {
      /* 요소가 화면 밖 → 스크롤 후 마커 배치 */
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (_scrollTimer) clearTimeout(_scrollTimer);
      _scrollTimer = setTimeout(function () {
        placeMarkerAndRing(el, idx + 1);
      }, 450);
    } else {
      placeMarkerAndRing(el, idx + 1);
    }

    /* 패널 업데이트 */
    renderPanel(item, idx);
  }

  /* ── 마커 + 링 배치 ─────────────────────────────────── */
  function placeMarkerAndRing(el, num) {
    if (!_isOpen) return;

    var rect = el.getBoundingClientRect();

    /* 링 */
    var pad = 6;
    _ringEl = document.createElement("div");
    _ringEl.className = "help-highlight-ring";
    _ringEl.style.left   = Math.max(rect.left - pad, 0) + "px";
    _ringEl.style.top    = Math.max(rect.top  - pad, 0) + "px";
    _ringEl.style.width  = (rect.width  + pad * 2) + "px";
    _ringEl.style.height = (rect.height + pad * 2) + "px";
    document.body.appendChild(_ringEl);

    /* 번호 마커 (오른쪽 위) */
    _markerEl = document.createElement("div");
    _markerEl.className = "help-marker";
    _markerEl.textContent = num;
    var mx = Math.min(rect.right - 4, window.innerWidth - 32);
    var my = Math.max(rect.top  - 14, 8);
    _markerEl.style.left = mx + "px";
    _markerEl.style.top  = my + "px";
    document.body.appendChild(_markerEl);
  }

  /* ── 패널 렌더링 ─────────────────────────────────────── */
  function renderPanel(item, idx) {
    if (!_panelEl) return;
    var total = _validItems.length;
    var isFirst = (idx === 0);
    var isLast  = (idx === total - 1);

    /* 도트 인디케이터 */
    var dots = "";
    for (var i = 0; i < total; i++) {
      dots += '<div class="help-nav-dot' + (i === idx ? " active" : "") + '"></div>';
    }

    _panelEl.innerHTML =
      '<div class="help-panel-header">' +
        '<div class="help-panel-title">도움말</div>' +
        '<div class="help-panel-counter">' + (idx + 1) + ' / ' + total + '</div>' +
      '</div>' +
      '<div class="help-step-body">' +
        '<div class="help-step-num">' + (idx + 1) + '</div>' +
        '<div class="help-step-text">' +
          '<div class="help-step-title">' + escHtml(item.title) + '</div>' +
          '<div class="help-step-desc">' + escHtml(item.desc) + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="help-panel-nav">' +
        '<button class="help-nav-btn help-nav-btn--prev" ' + (isFirst ? 'disabled' : '') + '>← 이전</button>' +
        '<div class="help-nav-dots">' + dots + '</div>' +
        (isLast
          ? '<button class="help-nav-btn help-nav-btn--next">닫기</button>'
          : '<button class="help-nav-btn help-nav-btn--next">다음 →</button>'
        ) +
      '</div>';

    _panelEl.querySelector(".help-nav-btn--prev").addEventListener("click", function () {
      if (_step > 0) goToStep(_step - 1);
    });
    _panelEl.querySelector(".help-nav-btn--next").addEventListener("click", function () {
      if (_step < _validItems.length - 1) goToStep(_step + 1);
      else closeHelp();
    });
  }

  function renderEmptyPanel(title) {
    if (!_panelEl) return;
    _panelEl.innerHTML =
      '<div class="help-panel-header">' +
        '<div class="help-panel-title">' + escHtml(title) + '</div>' +
      '</div>' +
      '<div class="help-step-desc" style="color:rgba(255,255,255,0.35);text-align:center;padding:8px 0 14px;">이 페이지에서 인식된 요소가 없습니다.</div>' +
      '<div class="help-panel-nav">' +
        '<button class="help-nav-btn help-nav-btn--next" style="flex:none;width:100%;">닫기</button>' +
      '</div>';
    _panelEl.querySelector(".help-nav-btn--next").addEventListener("click", closeHelp);
  }

  /* ── 오버레이 닫기 ──────────────────────────────────── */
  function closeHelp() {
    if (!_isOpen) return;
    _isOpen = false;
    if (_scrollTimer) { clearTimeout(_scrollTimer); _scrollTimer = null; }
    if (_overlayEl)  { _overlayEl.remove();  _overlayEl  = null; }
    if (_panelEl)    { _panelEl.remove();    _panelEl    = null; }
    if (_closeBtnEl) { _closeBtnEl.remove(); _closeBtnEl = null; }
    if (_markerEl)   { _markerEl.remove();   _markerEl   = null; }
    if (_ringEl)     { _ringEl.remove();     _ringEl     = null; }
    _validItems = [];
    document.removeEventListener("keydown", _onKeyDown);
  }

  function _onKeyDown(e) {
    if (e.key === "Escape") closeHelp();
    if (e.key === "ArrowRight" && _step < _validItems.length - 1) goToStep(_step + 1);
    if (e.key === "ArrowLeft"  && _step > 0) goToStep(_step - 1);
  }

  function escHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ── 전역 노출 ── */
  window.vctHelpOpen  = openHelp;
  window.vctHelpClose = closeHelp;

})();
