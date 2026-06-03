/**
 * help.js — 페이지별 도움말 오버레이 (스텝 방식 + 액션 지원)
 *
 * auth.js의 "?" 버튼이 window.vctHelpOpen() 을 호출합니다.
 * 한 번에 하나씩 요소를 강조하며, 다음/이전 버튼으로 탐색합니다.
 * 요소가 화면 밖에 있으면 자동으로 스크롤하고,
 * action이 있는 스텝은 액션 실행 후 요소를 탐색합니다.
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

    ".help-highlight-ring {",
    "  position:fixed; z-index:98005;",
    "  border:2px solid rgba(232,67,45,0.7);",
    "  border-radius:6px;",
    "  pointer-events:none;",
    "  box-shadow:0 0 0 4000px rgba(0,0,0,0.40);",
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
    "  transition:background .15s, color .15s, border-color .15s, opacity .15s;",
    "}",
    ".help-nav-btn:hover:not(:disabled) { background:rgba(255,255,255,0.12); color:#fff; border-color:rgba(255,255,255,0.22); }",
    ".help-nav-btn:disabled { opacity:0.3; cursor:default; }",
    ".help-nav-btn--next {",
    "  background:#e8432d; border-color:#e8432d; color:#fff;",
    "}",
    ".help-nav-btn--next:hover:not(:disabled) { background:#d43520; border-color:#d43520; }",
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
          desc: "맵 상세 데이터와 선수들의 개인 스탯 순위를 볼 수 있는 페이지입니다." },
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

    /* ── 기록 페이지 (3단계 흐름) */
    records: {
      title: "기록 도움말",
      items: [
        /* ① 리그 선택 */
        { sel: ".league-btn.lb-global",
          title: "전체",
          desc: "전 권역의 팀들과 각 Masters, Champions 진출팀들의 스탯 순위를 확인할 수 있는 페이지입니다." },
        { sel: ".league-btn.lb-pacific",
          title: "Pacific / CN / Americas / EMEA / Masters / Champions",
          desc: "각 대회에 속해 있는 팀들의 스탯 순위를 확인할 수 있는 페이지입니다." },

        /* ② Pacific 강제 선택 후: 팀 그리드 · 기록 · 화살표 */
        { sel: "#team-grid",
          title: "팀 로고",
          desc: "각 팀의 맵별 조합, 맵 승률, 그리고 맵 밴픽을 볼 수 있습니다.",
          action: function () {
            var btn = document.querySelector(".league-btn.lb-pacific");
            if (btn) btn.click();
          },
          actionDelay: 800 },
        { sel: "#stats-section",
          title: "기록",
          desc: "각 권역에 맞는 선수들의 ACS·K/D 순위, 팀별 피스톨·수비·공격 승률을 볼 수 있습니다." },
        { sel: "#stats-carousel-next",
          title: "화살표",
          desc: "화살표를 클릭해 ACS, K/D, 피스톨, 공격·수비 승률 등 다른 스탯 슬라이드로 넘깁니다." },

        /* ③ 전체 강제 선택 후: 스테이지 필터 */
        { sel: "#stage-filter-bar",
          title: "전체 스테이지",
          desc: "전체 스테이지와 각 KickOff, Stage 1, Stage 2의 전체 버튼으로 해당 스테이지 기준 스탯 순위를 보여줍니다.",
          action: function () {
            var btn = document.querySelector(".league-btn.lb-global");
            if (btn) btn.click();
          },
          actionDelay: 800 },
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

  /* ── 요소 탐색 헬퍼 ──────────────────────────────────── */
  function findEl(sel) {
    var selectors = sel.split(",");
    for (var i = 0; i < selectors.length; i++) {
      try {
        var el = document.querySelector(selectors[i].trim());
        if (el) return el;
      } catch (e) {}
    }
    return null;
  }

  /* multiSel: "sel1, sel2, sel3" → 각각 querySelectorAll의 첫 결과를 모아 배열 반환 */
  function findMultiEls(multiSel) {
    var els = [];
    multiSel.split(",").forEach(function (s) {
      try {
        var el = document.querySelector(s.trim());
        if (el) els.push(el);
      } catch (e) {}
    });
    return els;
  }

  /* 여러 요소의 합집합 BoundingRect 계산 */
  function unionRect(els) {
    var minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.left   < minL) minL = r.left;
      if (r.top    < minT) minT = r.top;
      if (r.right  > maxR) maxR = r.right;
      if (r.bottom > maxB) maxB = r.bottom;
    });
    return { left: minL, top: minT, right: maxR, bottom: maxB,
             width: maxR - minL, height: maxB - minT };
  }

  /* 아이템에서 사용할 요소(들) 반환 — { el, rect, multi } */
  function resolveItem(item) {
    if (item.multiSel) {
      var els = findMultiEls(item.multiSel);
      if (!els.length) return null;
      return { els: els, rect: null }; /* rect는 place 시점에 계산 */
    }
    var el = findEl(item.sel);
    return el ? { el: el, rect: null } : null;
  }

  /* ── 상태 ──────────────────────────────────────────── */
  var _isOpen      = false;
  var _pending     = false;   /* 액션 딜레이 중 네비게이션 잠금 */
  var _step        = 0;
  var _allItems    = [];      /* 설정의 전체 항목 */
  var _stepItems   = [];      /* 실제 사용할 항목 (필터링됨) */
  var _overlayEl   = null;
  var _panelEl     = null;
  var _closeBtnEl  = null;
  var _markerEl    = null;
  var _ringEl      = null;
  var _scrollTimer = null;
  var _actionTimer = null;

  /* ── 오버레이 열기 ──────────────────────────────────── */
  function openHelp() {
    if (_isOpen) return;
    _isOpen  = true;
    _pending = false;
    _step    = 0;

    var cfg = getConfig();
    _allItems = cfg.items;

    /* 유효 항목 수집:
       - action 있음 → 무조건 포함 (액션 후에 요소가 생김)
       - action 없음 → 지금 요소가 있어야 포함 */
    _stepItems = [];
    _allItems.forEach(function (item) {
      if (item.action) {
        _stepItems.push(item);
      } else {
        var resolved = resolveItem(item);
        if (resolved) {
          item._resolved = resolved;
          _stepItems.push(item);
        }
      }
    });

    /* 오버레이 */
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

    if (_stepItems.length === 0) {
      renderEmptyPanel();
    } else {
      goToStep(0);
    }
  }

  /* ── 스텝 이동 ──────────────────────────────────────── */
  function goToStep(idx) {
    if (!_isOpen || _pending) return;
    _step = idx;

    var item = _stepItems[idx];

    /* 기존 마커/링 제거 */
    clearDecor();

    if (item.action) {
      /* 액션 실행 → 딜레이 후 요소 탐색 */
      _pending = true;
      renderPanel(item, idx, true); /* 로딩 상태로 패널 먼저 표시 */
      item.action();

      if (_actionTimer) clearTimeout(_actionTimer);
      _actionTimer = setTimeout(function () {
        if (!_isOpen) return;
        _pending = false;
        var resolved = resolveItem(item);
        item._resolved = resolved || null;
        if (resolved) scrollAndPlace(resolved, idx + 1);
        renderPanel(item, idx, false);
      }, item.actionDelay || 700);
    } else {
      var resolved = item._resolved || resolveItem(item);
      item._resolved = resolved || null;
      if (resolved) scrollAndPlace(resolved, idx + 1);
      renderPanel(item, idx, false);
    }
  }

  /* ── 스크롤 + 마커/링 배치 ──────────────────────────── */
  function scrollAndPlace(resolved, num) {
    /* 스크롤 앵커: 단일 요소 or 첫 번째 요소 */
    var anchor = resolved.el || resolved.els[0];
    var panelH = 160;
    var rect   = anchor.getBoundingClientRect();
    var inView = (
      rect.top    >= 0 &&
      rect.left   >= 0 &&
      rect.bottom <= (window.innerHeight - panelH) &&
      rect.right  <= window.innerWidth
    );

    if (!inView) {
      anchor.scrollIntoView({ behavior: "smooth", block: "center" });
      if (_scrollTimer) clearTimeout(_scrollTimer);
      _scrollTimer = setTimeout(function () {
        if (_isOpen) placeDecor(resolved, num);
      }, 450);
    } else {
      placeDecor(resolved, num);
    }
  }

  function placeDecor(resolved, num) {
    if (!_isOpen) return;
    clearDecor();

    /* 단일 요소 or 복수 요소의 합집합 rect */
    var rect = resolved.els ? unionRect(resolved.els) : resolved.el.getBoundingClientRect();
    var pad  = 6;

    /* 하이라이트 링 */
    _ringEl = document.createElement("div");
    _ringEl.className = "help-highlight-ring";
    _ringEl.style.left   = Math.max(rect.left - pad, 0) + "px";
    _ringEl.style.top    = Math.max(rect.top  - pad, 0) + "px";
    _ringEl.style.width  = (rect.width  + pad * 2) + "px";
    _ringEl.style.height = (rect.height + pad * 2) + "px";
    document.body.appendChild(_ringEl);

    /* 번호 마커 (링 오른쪽 위) */
    _markerEl = document.createElement("div");
    _markerEl.className = "help-marker";
    _markerEl.textContent = num;
    _markerEl.style.left = Math.min(rect.right - 4,  window.innerWidth  - 32) + "px";
    _markerEl.style.top  = Math.max(rect.top  - 14, 8) + "px";
    document.body.appendChild(_markerEl);
  }

  function clearDecor() {
    if (_markerEl) { _markerEl.remove(); _markerEl = null; }
    if (_ringEl)   { _ringEl.remove();   _ringEl   = null; }
  }

  /* ── 패널 렌더링 ─────────────────────────────────────── */
  function renderPanel(item, idx, loading) {
    if (!_panelEl) return;
    var total   = _stepItems.length;
    var isFirst = (idx === 0);
    var isLast  = (idx === total - 1);

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
        '<button class="help-nav-btn help-nav-btn--prev"' + (isFirst || loading ? ' disabled' : '') + '>← 이전</button>' +
        '<div class="help-nav-dots">' + dots + '</div>' +
        (isLast
          ? '<button class="help-nav-btn help-nav-btn--next"' + (loading ? ' disabled' : '') + '>닫기</button>'
          : '<button class="help-nav-btn help-nav-btn--next"' + (loading ? ' disabled' : '') + '>다음 →</button>'
        ) +
      '</div>';

    _panelEl.querySelector(".help-nav-btn--prev").addEventListener("click", function () {
      if (!_pending && _step > 0) goToStep(_step - 1);
    });
    _panelEl.querySelector(".help-nav-btn--next").addEventListener("click", function () {
      if (_pending) return;
      if (_step < _stepItems.length - 1) goToStep(_step + 1);
      else closeHelp();
    });
  }

  function renderEmptyPanel() {
    if (!_panelEl) return;
    _panelEl.innerHTML =
      '<div class="help-panel-header">' +
        '<div class="help-panel-title">도움말</div>' +
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
    _isOpen  = false;
    _pending = false;
    if (_scrollTimer) { clearTimeout(_scrollTimer); _scrollTimer = null; }
    if (_actionTimer) { clearTimeout(_actionTimer); _actionTimer = null; }
    if (_overlayEl)  { _overlayEl.remove();  _overlayEl  = null; }
    if (_panelEl)    { _panelEl.remove();    _panelEl    = null; }
    if (_closeBtnEl) { _closeBtnEl.remove(); _closeBtnEl = null; }
    clearDecor();
    _stepItems = [];
    document.removeEventListener("keydown", _onKeyDown);
  }

  function _onKeyDown(e) {
    if (e.key === "Escape") { closeHelp(); return; }
    if (_pending) return;
    if (e.key === "ArrowRight" && _step < _stepItems.length - 1) goToStep(_step + 1);
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
