(function () {
  "use strict";

  var TOKEN_KEY = "vct_auth_token";
  var USER_KEY  = "vct_auth_user"; /* { username, role } */

  /* ── 캐시된 유저 ─────────────────────────────────── */
  function getCachedUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; }
  }
  function isAdmin() {
    var u = getCachedUser();
    return !!(u && u.role === "admin");
  }
  function isLoggedIn() {
    return !!getCachedUser();
  }
  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || null;
  }

  /* ── view-only 제어 ──────────────────────────────── */
  if (!isAdmin()) {
    document.body.classList.add("view-only");
  }

  /* ── Barlow Condensed 폰트 (help ? 버튼용, 미로드 페이지 보완) ── */
  if (!document.querySelector('link[href*="Barlow+Condensed"]') &&
      !document.querySelector('link[href*="Barlow_Condensed"]')) {
    var fontLink = document.createElement("link");
    fontLink.rel  = "stylesheet";
    fontLink.href = "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;900&display=swap";
    document.head.appendChild(fontLink);
  }

  /* ── 스타일 인젝션 ───────────────────────────────── */
  var style = document.createElement("style");
  style.textContent = [
    /* ── Header Button ── */
    ".auth-header-btn {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  gap: 7px;",
    "  margin-left: 6px;",
    "  padding: 0 14px;",
    "  height: 32px;",
    "  border: 1px solid rgba(255,255,255,0.12);",
    "  border-radius: 4px;",
    "  background: rgba(255,255,255,0.05);",
    "  color: rgba(255,255,255,0.5);",
    "  font-size: 11px;",
    "  font-weight: 700;",
    "  font-family: 'Barlow Condensed', sans-serif;",
    "  letter-spacing: 0.14em;",
    "  text-transform: uppercase;",
    "  cursor: pointer;",
    "  transition: background 0.15s, border-color 0.15s, color 0.15s;",
    "  white-space: nowrap;",
    "  flex-shrink: 0;",
    "}",
    ".auth-header-btn::before {",
    "  content: '';",
    "  display: block;",
    "  width: 7px; height: 7px;",
    "  border-radius: 50%;",
    "  background: rgba(255,255,255,0.25);",
    "  flex-shrink: 0;",
    "  transition: background 0.15s;",
    "}",
    ".auth-header-btn:hover {",
    "  background: rgba(255,255,255,0.09);",
    "  border-color: rgba(255,255,255,0.22);",
    "  color: rgba(255,255,255,0.85);",
    "}",
    ".auth-header-btn:hover::before { background: rgba(255,255,255,0.55); }",

    /* Admin 로그인 상태 */
    ".auth-header-btn--on {",
    "  background: rgba(30,210,100,0.1);",
    "  border-color: rgba(30,210,100,0.3);",
    "  color: #3ddc84;",
    "}",
    ".auth-header-btn--on::before { background: #3ddc84; box-shadow: 0 0 6px rgba(61,220,132,0.7); }",
    ".auth-header-btn--on:hover { background: rgba(220,50,50,0.12); border-color: rgba(220,50,50,0.35); color: #ff6b6b; }",
    ".auth-header-btn--on:hover::before { background: #ff6b6b; box-shadow: 0 0 6px rgba(255,100,100,0.6); }",

    /* 일반 유저 로그인 상태 */
    ".auth-header-btn--user {",
    "  background: rgba(80,140,255,0.1);",
    "  border-color: rgba(80,140,255,0.3);",
    "  color: #7eb8ff;",
    "}",
    ".auth-header-btn--user::before { background: #7eb8ff; box-shadow: 0 0 6px rgba(120,170,255,0.6); }",
    ".auth-header-btn--user:hover { background: rgba(220,50,50,0.12); border-color: rgba(220,50,50,0.35); color: #ff6b6b; }",
    ".auth-header-btn--user:hover::before { background: #ff6b6b; box-shadow: 0 0 6px rgba(255,100,100,0.6); }",

    /* 우측 버튼 그룹 */
    ".header-right-group {",
    "  margin-left: auto;",
    "  display: flex;",
    "  align-items: center;",
    "  gap: 8px;",
    "  flex-shrink: 0;",
    "}",
    /* auth-header-btn의 per-page margin-left:auto를 그룹 내에서 무력화 */
    ".header-right-group .auth-header-btn { margin-left: 0 !important; }",

    /* 도움말 버튼 */
    ".help-trigger-btn {",
    "  width: 30px; height: 30px;",
    "  border-radius: 50%;",
    "  background: rgba(255,255,255,0.07);",
    "  border: 1px solid rgba(255,255,255,0.14);",
    "  color: rgba(255,255,255,0.45);",
    "  font-family: 'Barlow Condensed', sans-serif;",
    "  font-size: 14px; font-weight: 900;",
    "  cursor: pointer; flex-shrink: 0;",
    "  display: flex; align-items: center; justify-content: center;",
    "  transition: background .15s, color .15s, border-color .15s;",
    "  line-height: 1; padding-bottom: 1px;",
    "}",
    ".help-trigger-btn:hover {",
    "  background: rgba(255,255,255,0.14);",
    "  border-color: rgba(255,255,255,0.28);",
    "  color: #fff;",
    "}",

    /* 새로고침 버튼 */
    ".auth-refresh-btn {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  gap: 6px;",
    "  padding: 0 12px;",
    "  height: 32px;",
    "  border: 1px solid rgba(255,255,255,0.12);",
    "  border-radius: 4px;",
    "  background: rgba(255,255,255,0.05);",
    "  color: rgba(255,255,255,0.45);",
    "  font-size: 11px;",
    "  font-weight: 700;",
    "  font-family: 'Barlow Condensed', sans-serif;",
    "  letter-spacing: 0.12em;",
    "  text-transform: uppercase;",
    "  cursor: pointer;",
    "  transition: background 0.15s, border-color 0.15s, color 0.15s, transform 0.15s;",
    "  white-space: nowrap;",
    "  flex-shrink: 0;",
    "}",
    ".auth-refresh-btn:hover { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.22); color: rgba(255,255,255,0.85); }",
    ".auth-refresh-btn:active { transform: rotate(180deg); }",
    ".auth-refresh-btn .refresh-icon { font-size: 13px; line-height: 1; }",

    /* ── Modal overlay ── */
    ".login-modal { position:fixed; inset:0; z-index:9500; display:flex; align-items:center; justify-content:center; }",
    ".login-backdrop { position:absolute; inset:0; background:rgba(5,8,15,0.75); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); }",

    /* ── Panel ── */
    ".login-panel {",
    "  position:relative; z-index:1;",
    "  width:min(400px,calc(100vw - 32px));",
    "  background:#111a28;",
    "  border:1px solid rgba(255,255,255,0.09);",
    "  border-radius:8px;",
    "  box-shadow:0 32px 96px rgba(0,0,0,0.7),0 0 0 1px rgba(255,255,255,0.03) inset;",
    "  overflow:hidden;",
    "  animation:authPanelIn 0.22s cubic-bezier(0.16,1,0.3,1);",
    "}",
    "@keyframes authPanelIn { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:none} }",

    /* ── Tabs ── */
    ".login-tabs {",
    "  display:flex;",
    "  border-bottom:1px solid rgba(255,255,255,0.06);",
    "}",
    ".login-tab {",
    "  flex:1;",
    "  padding:16px 0 14px;",
    "  background:none;",
    "  border:none;",
    "  font-family:'Barlow Condensed',sans-serif;",
    "  font-size:13px; font-weight:800;",
    "  letter-spacing:0.12em; text-transform:uppercase;",
    "  color:rgba(255,255,255,0.3);",
    "  cursor:pointer;",
    "  border-bottom:2px solid transparent;",
    "  transition:color 0.15s,border-color 0.15s;",
    "  margin-bottom:-1px;",
    "}",
    ".login-tab.active { color:#fff; border-bottom-color:#e8432d; }",
    ".login-tab:hover:not(.active) { color:rgba(255,255,255,0.65); }",

    /* ── Panel header (no-tab version) ── */
    ".login-panel-header {",
    "  display:flex; align-items:center; justify-content:space-between;",
    "  padding:20px 22px 18px;",
    "  border-bottom:1px solid rgba(255,255,255,0.06);",
    "}",
    ".login-panel-header h2 { font-family:'Barlow Condensed',sans-serif; font-size:18px; font-weight:900; letter-spacing:0.08em; text-transform:uppercase; color:#fff; margin:0; }",
    ".login-close { width:30px; height:30px; display:grid; place-items:center; border:1px solid rgba(255,255,255,0.08); border-radius:4px; background:rgba(255,255,255,0.04); font-size:16px; line-height:1; color:rgba(255,255,255,0.35); cursor:pointer; transition:background 0.12s,color 0.12s,border-color 0.12s; }",
    ".login-close:hover { background:rgba(255,255,255,0.09); border-color:rgba(255,255,255,0.18); color:rgba(255,255,255,0.8); }",

    /* ── Tab close row ── */
    ".login-tab-row {",
    "  display:flex; align-items:stretch;",
    "  border-bottom:1px solid rgba(255,255,255,0.06);",
    "  padding-right:14px;",
    "}",
    ".login-tab-row .login-close { align-self:center; flex-shrink:0; }",

    /* ── Form ── */
    ".login-form { display:flex; flex-direction:column; gap:14px; padding:22px; }",
    ".login-field { display:flex; flex-direction:column; gap:6px; }",
    ".login-field span { font-family:'Barlow Condensed',sans-serif; font-size:10px; font-weight:700; letter-spacing:0.2em; text-transform:uppercase; color:rgba(255,255,255,0.35); }",
    ".login-field input { width:100%; height:42px; padding:0 14px; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:4px; font-family:'Barlow Condensed',sans-serif; font-size:15px; font-weight:600; letter-spacing:0.04em; color:#fff; outline:none; box-sizing:border-box; transition:border-color 0.15s,background 0.15s; }",
    ".login-field input::placeholder { color:rgba(255,255,255,0.18); }",
    ".login-field input:focus { border-color:rgba(232,67,45,0.6); background:rgba(255,255,255,0.06); box-shadow:0 0 0 3px rgba(232,67,45,0.12); }",

    /* ── Messages ── */
    ".login-error { font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#ff6b6b; background:rgba(220,50,50,0.1); border:1px solid rgba(220,50,50,0.2); border-radius:4px; padding:9px 12px; margin:0; }",
    ".login-success { font-family:'Barlow Condensed',sans-serif; font-size:12px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase; color:#3ddc84; background:rgba(30,210,100,0.1); border:1px solid rgba(30,210,100,0.2); border-radius:4px; padding:9px 12px; margin:0; }",
    ".login-confirm-msg { font-family:'Barlow','Noto Sans KR',sans-serif; font-size:14px; color:rgba(255,255,255,0.55); margin:4px 0; line-height:1.6; }",

    /* ── Actions ── */
    ".login-actions { margin-top:2px; }",
    ".login-submit { width:100%; height:44px; border:none; border-radius:4px; background:#e8432d; color:#fff; font-family:'Barlow Condensed',sans-serif; font-size:13px; font-weight:700; letter-spacing:0.18em; text-transform:uppercase; cursor:pointer; transition:background 0.15s,opacity 0.15s; position:relative; overflow:hidden; }",
    ".login-submit::after { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,0.1) 0%,transparent 60%); pointer-events:none; }",
    ".login-submit:hover { background:#d43520; }",
    ".login-submit:active { opacity:0.85; }",
    ".login-submit:disabled { opacity:0.5; cursor:default; }",
    ".login-submit--danger { background:rgba(180,30,30,0.85); border:1px solid rgba(220,50,50,0.3); }",
    ".login-submit--danger:hover { background:rgba(200,30,30,0.95); }",

    /* ── 건의함 버튼 ── */
    ".suggest-trigger-btn {",
    "  position:relative; display:inline-flex; align-items:center; gap:5px;",
    "  padding:0 11px; height:30px; border-radius:4px;",
    "  background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.11);",
    "  color:rgba(255,255,255,0.45); font-size:12px; font-weight:700;",
    "  font-family:'Noto Sans KR','Barlow',sans-serif; cursor:pointer; flex-shrink:0;",
    "  transition:background .15s,color .15s,border-color .15s; white-space:nowrap;",
    "}",
    ".suggest-trigger-btn:hover { background:rgba(255,255,255,0.11); border-color:rgba(255,255,255,0.22); color:rgba(255,255,255,0.85); }",
    ".sg-badge {",
    "  display:none; position:absolute; top:-4px; right:-4px;",
    "  width:9px; height:9px; border-radius:50%;",
    "  background:#e8432d; border:1.5px solid #080c16;",
    "  pointer-events:none;",
    "}",

    /* ── 건의함 모달 내용 ── */
    ".sg-notice {",
    "  background:rgba(240,192,64,.08); border:1px solid rgba(240,192,64,.2);",
    "  border-radius:4px; padding:10px 14px;",
    "  font-size:12px; color:rgba(240,192,64,.85); line-height:1.65;",
    "}",
    ".sg-textarea {",
    "  width:100%; height:110px; padding:10px 14px; box-sizing:border-box;",
    "  background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.10);",
    "  border-radius:4px; font-family:'Noto Sans KR','Barlow',sans-serif; font-size:13px;",
    "  color:#fff; resize:vertical; outline:none;",
    "  transition:border-color .15s,background .15s;",
    "}",
    ".sg-textarea::placeholder { color:rgba(255,255,255,.2); }",
    ".sg-textarea:focus { border-color:rgba(232,67,45,.5); background:rgba(255,255,255,.06); box-shadow:0 0 0 3px rgba(232,67,45,.1); }",
    ".sg-char { text-align:right; font-size:11px; color:rgba(255,255,255,.25); margin-top:4px; }",
    ".sg-char.over { color:#ff6b6b; }",
    ".sg-list { display:flex; flex-direction:column; gap:8px; max-height:340px; overflow-y:auto; }",
    ".sg-item { background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); border-radius:6px; padding:12px 14px; }",
    ".sg-item-meta { font-size:11px; color:rgba(255,255,255,.3); display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }",
    ".sg-item-text { font-size:13px; color:rgba(255,255,255,.8); line-height:1.65; white-space:pre-wrap; word-break:break-word; }",
    ".sg-item-del { background:none; border:1px solid rgba(220,50,50,.3); border-radius:3px; color:rgba(220,80,80,.7); font-size:11px; font-weight:700; padding:2px 8px; cursor:pointer; transition:background .12s,color .12s,border-color .12s; }",
    ".sg-item-del:hover { background:rgba(220,50,50,.15); color:#ff6b6b; border-color:rgba(220,50,50,.5); }",
    ".sg-empty { text-align:center; padding:32px 0; color:rgba(255,255,255,.25); font-size:13px; }",

    /* ── view-only ── */
    "body.view-only .inline-edit,",
    "body.view-only .agent-chip,",
    "body.view-only [data-veto-map-button],",
    "body.view-only [data-veto-step],",
    "body.view-only [data-prediction-edit],",
    "body.view-only .prediction-odds,",
    "body.view-only .set-score-button,",
    "body.view-only .rt-cell,",
    "body.view-only .sb-diamond,",
    "body.view-only .rp-icon-btn,",
    "body.view-only .rp-clear-btn,",
    "body.view-only .player-cell,",
    "body.view-only .map-count-btn,",
    "body.view-only .mo-score-num,",
    "body.view-only .mo-map-slot,",
    "body.view-only .mo-veto-cell,",
    "body.view-only .pc-agent,",
    "body.view-only .sb-score-diamond-l,",
    "body.view-only .sb-score-diamond-r,",
    /* 팀 스텟 (스코어, 첫킬, 절약왕 등) */
    "body.view-only .ts-val,",
    /* 배당률 */
    "body.view-only .mo-pred-odds",
    "{ pointer-events:none !important; cursor:default !important; }",
    "body.view-only .roster-add-row { display:none !important; }",
    "body.view-only .roster-player-remove { display:none !important; }",
    "body.view-only .map-count-bar { display:none !important; }",
  ].join("\n");
  document.head.appendChild(style);

  /* ── 헤더 버튼 생성 ──────────────────────────────── */
  var header = document.querySelector(".site-header");

  /* 새로고침 버튼 (admin만) */
  var refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "auth-refresh-btn";
  refreshBtn.innerHTML = '<span class="refresh-icon">↻</span> 새로고침';
  refreshBtn.title = "서버에서 최신 데이터를 불러옵니다";
  refreshBtn.style.display = "none";
  refreshBtn.addEventListener("click", function () {
    fetch("/api/refresh", { method: "POST" }).catch(function () {});
    window.location.reload();
  });

  /* 메인 auth 버튼 */
  var authBtn = document.createElement("button");
  authBtn.type = "button";

  /* 도움말 버튼 */
  var helpBtn = document.createElement("button");
  helpBtn.type = "button";
  helpBtn.className = "help-trigger-btn";
  helpBtn.textContent = "?";
  helpBtn.title = "도움말";
  helpBtn.addEventListener("click", function () {
    if (window.vctHelpOpen) window.vctHelpOpen();
  });

  /* 공지 버튼 (index 페이지만) */
  var noticeBtn = null;
  (function () {
    var p = window.location.pathname;
    var onIndex = (p === "/" || p === "" || p.endsWith("/index.html"));
    if (!onIndex) return;
    noticeBtn = document.createElement("button");
    noticeBtn.type = "button";
    noticeBtn.className = "suggest-trigger-btn";
    if (isAdmin()) {
      noticeBtn.innerHTML = "📢 공지 작성";
      noticeBtn.addEventListener("click", openNoticeAdminModal);
    } else {
      noticeBtn.innerHTML = "📢 공지<span class='sg-badge' id='nc-badge'></span>";
      noticeBtn.addEventListener("click", openNoticeUserModal);
    }
  })();

  /* 건의함 버튼 (index 페이지만) */
  var suggestBtn = null;
  (function () {
    var p = window.location.pathname;
    var onIndex = (p === "/" || p === "" || p.endsWith("/index.html"));
    if (!onIndex) return;
    suggestBtn = document.createElement("button");
    suggestBtn.type = "button";
    suggestBtn.className = "suggest-trigger-btn";
    if (isAdmin()) {
      suggestBtn.innerHTML = "📮 건의함 확인<span class='sg-badge' id='sg-badge'></span>";
      suggestBtn.addEventListener("click", openSuggestAdminModal);
    } else {
      suggestBtn.innerHTML = "📮 건의함";
      suggestBtn.addEventListener("click", openSuggestModal);
    }
  })();

  /* 보상 버튼 (admin만) */
  var rewardBtn = document.createElement("button");
  rewardBtn.type = "button";
  rewardBtn.className = "suggest-trigger-btn";
  rewardBtn.innerHTML = "🎁 보상";
  rewardBtn.title = "전체 유저에게 코인 보상 지급";
  rewardBtn.style.display = "none";
  rewardBtn.addEventListener("click", openRewardModal);

  /* refreshAuthButtons: authBtn + refreshBtn + rewardBtn 상태 동기화 */
  function refreshAuthButtons() {
    var user = getCachedUser();
    /* 보상 버튼: admin만 표시 */
    rewardBtn.style.display = (user && user.role === "admin") ? "" : "none";
    if (!user) {
      authBtn.textContent = "로그인";
      authBtn.className = "auth-header-btn";
      refreshBtn.style.display = "none";
      authBtn.onclick = openLoginModal;
    } else if (user.role === "admin") {
      authBtn.textContent = "Admin";
      authBtn.className = "auth-header-btn auth-header-btn--on";
      refreshBtn.style.display = "";
      authBtn.onclick = openLogoutConfirm;
    } else {
      authBtn.textContent = user.username;
      authBtn.className = "auth-header-btn auth-header-btn--user";
      refreshBtn.style.display = "none";
      authBtn.onclick = openLogoutConfirm;
    }
  }

  refreshAuthButtons();

  if (header) {
    /* 우측 버튼 그룹 wrapper */
    var rightGroup = document.createElement("div");
    rightGroup.className = "header-right-group";
    rightGroup.appendChild(refreshBtn);
    rightGroup.appendChild(rewardBtn);
    if (noticeBtn) rightGroup.appendChild(noticeBtn);
    if (suggestBtn) rightGroup.appendChild(suggestBtn);
    rightGroup.appendChild(helpBtn);
    rightGroup.appendChild(authBtn);
    header.appendChild(rightGroup);
  } else {
    /* 헤더 없는 페이지(index 등): 우측 상단 고정 컨테이너 */
    var floatWrap = document.createElement("div");
    floatWrap.style.cssText = [
      "position:fixed",
      "top:16px",
      "right:20px",
      "z-index:9000",
      "display:flex",
      "align-items:center",
      "gap:8px",
    ].join(";");
    floatWrap.appendChild(refreshBtn);
    floatWrap.appendChild(rewardBtn);
    if (noticeBtn) floatWrap.appendChild(noticeBtn);
    if (suggestBtn) floatWrap.appendChild(suggestBtn);
    floatWrap.appendChild(helpBtn);
    floatWrap.appendChild(authBtn);
    document.body.appendChild(floatWrap);
  }

  /* 배지 초기 확인 (index) */
  if (isAdmin() && suggestBtn) {
    checkSuggestBadge();
  }
  if (!isAdmin() && noticeBtn) {
    checkNoticeBadge();
  }

  /* ── 토큰 서버 검증 (백그라운드) ─────────────────── */
  var token = getToken();
  if (token) {
    fetch("/api/auth/me", { headers: { Authorization: "Bearer " + token } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) {
          /* 토큰 만료 / 무효 → 로그아웃 */
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          location.reload();
        } else {
          /* 서버 role로 캐시 갱신 */
          var cur = getCachedUser() || {};
          if (cur.role !== data.role || cur.username !== data.username) {
            localStorage.setItem(USER_KEY, JSON.stringify({ username: data.username, role: data.role }));
            location.reload();
          }
        }
      })
      .catch(function () { /* 오프라인 → 캐시 신뢰 */ });
  }

  /* ── 로그인 모달 ─────────────────────────────────── */
  function openLoginModal() {
    openAuthModal("login");
  }
  function openRegisterModal() {
    openAuthModal("register");
  }

  function openAuthModal(defaultTab) {
    var existing = document.querySelector(".login-modal");
    if (existing) existing.remove();

    var modal = document.createElement("div");
    modal.className = "login-modal";
    modal.innerHTML =
      '<div class="login-backdrop"></div>' +
      '<div class="login-panel" role="dialog" aria-modal="true">' +
        '<div class="login-tab-row">' +
          '<button class="login-tab" data-tab="login" type="button">로그인</button>' +
          '<button class="login-tab" data-tab="register" type="button">회원 가입</button>' +
          '<button class="login-close" type="button" aria-label="닫기">×</button>' +
        '</div>' +
        /* 로그인 폼 */
        '<form class="login-form" id="auth-form-login" novalidate>' +
          '<label class="login-field"><span>아이디</span>' +
            '<input type="text" name="login-id" autocomplete="username" placeholder="아이디 입력" /></label>' +
          '<label class="login-field"><span>비밀번호</span>' +
            '<input type="password" name="login-pw" autocomplete="current-password" placeholder="비밀번호 입력" /></label>' +
          '<p class="login-error" hidden></p>' +
          '<div class="login-actions"><button type="submit" class="login-submit">로그인</button></div>' +
        '</form>' +
        /* 회원가입 폼 */
        '<form class="login-form" id="auth-form-register" novalidate style="display:none">' +
          '<label class="login-field"><span>아이디</span>' +
            '<input type="text" name="reg-id" autocomplete="username" placeholder="2~20자 영문/숫자" /></label>' +
          '<label class="login-field"><span>비밀번호</span>' +
            '<input type="password" name="reg-pw" autocomplete="new-password" placeholder="4자 이상" /></label>' +
          '<label class="login-field"><span>비밀번호 확인</span>' +
            '<input type="password" name="reg-pw2" autocomplete="new-password" placeholder="비밀번호 재입력" /></label>' +
          '<p class="login-error" hidden></p>' +
          '<p class="login-success" hidden></p>' +
          '<div class="login-actions"><button type="submit" class="login-submit">회원 가입</button></div>' +
        '</form>' +
      '</div>';

    document.body.appendChild(modal);

    var tabs = modal.querySelectorAll(".login-tab");
    var formLogin = modal.querySelector("#auth-form-login");
    var formReg = modal.querySelector("#auth-form-register");

    function switchTab(tab) {
      tabs.forEach(function (t) { t.classList.toggle("active", t.dataset.tab === tab); });
      formLogin.style.display = (tab === "login") ? "" : "none";
      formReg.style.display = (tab === "register") ? "" : "none";
      var firstInput = (tab === "login" ? formLogin : formReg).querySelector("input");
      if (firstInput) setTimeout(function () { firstInput.focus(); }, 40);
    }
    tabs.forEach(function (t) {
      t.addEventListener("click", function () { switchTab(t.dataset.tab); });
    });
    switchTab(defaultTab);

    /* 닫기 */
    function close() {
      modal.remove();
      document.removeEventListener("keydown", escHandler);
    }
    modal.querySelector(".login-backdrop").addEventListener("click", close);
    modal.querySelector(".login-close").addEventListener("click", close);
    function escHandler(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", escHandler);

    /* 로그인 제출 */
    formLogin.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = (formLogin.querySelector("[name=login-id]").value || "").trim();
      var pw = formLogin.querySelector("[name=login-pw]").value || "";
      var errEl = formLogin.querySelector(".login-error");
      var btn = formLogin.querySelector(".login-submit");
      errEl.hidden = true;
      btn.disabled = true;
      btn.textContent = "로그인 중...";

      fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: id, password: pw }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) {
            errEl.textContent = data.error;
            errEl.hidden = false;
            formLogin.querySelector("[name=login-pw]").value = "";
            formLogin.querySelector("[name=login-pw]").focus();
            btn.disabled = false;
            btn.textContent = "로그인";
          } else {
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(USER_KEY, JSON.stringify({ username: data.username, role: data.role }));
            close();
            location.reload();
          }
        })
        .catch(function () {
          errEl.textContent = "서버에 연결할 수 없습니다.";
          errEl.hidden = false;
          btn.disabled = false;
          btn.textContent = "로그인";
        });
    });

    /* 회원가입 제출 */
    formReg.addEventListener("submit", function (e) {
      e.preventDefault();
      var id = (formReg.querySelector("[name=reg-id]").value || "").trim();
      var pw = formReg.querySelector("[name=reg-pw]").value || "";
      var pw2 = formReg.querySelector("[name=reg-pw2]").value || "";
      var errEl = formReg.querySelector(".login-error");
      var okEl = formReg.querySelector(".login-success");
      var btn = formReg.querySelector(".login-submit");

      errEl.hidden = true;
      okEl.hidden = true;

      if (pw !== pw2) {
        errEl.textContent = "비밀번호가 일치하지 않습니다.";
        errEl.hidden = false;
        formReg.querySelector("[name=reg-pw2]").focus();
        return;
      }

      btn.disabled = true;
      btn.textContent = "가입 중...";

      fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: id, password: pw }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.error) {
            errEl.textContent = data.error;
            errEl.hidden = false;
            btn.disabled = false;
            btn.textContent = "회원 가입";
          } else {
            /* 가입 성공 → 자동 로그인 */
            localStorage.setItem(TOKEN_KEY, data.token);
            localStorage.setItem(USER_KEY, JSON.stringify({ username: data.username, role: data.role }));
            close();
            location.reload();
          }
        })
        .catch(function () {
          errEl.textContent = "서버에 연결할 수 없습니다.";
          errEl.hidden = false;
          btn.disabled = false;
          btn.textContent = "회원 가입";
        });
    });
  }

  /* ── 로그아웃 확인 ───────────────────────────────── */
  function openLogoutConfirm() {
    var user = getCachedUser();
    var name = user ? user.username : "계정";
    openSimpleModal({
      title: "로그아웃",
      body: '<p class="login-confirm-msg"><strong>' + name + '</strong> 계정에서 로그아웃 하시겠습니까?</p>',
      onSubmit: function () {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        location.reload();
      },
      submitLabel: "로그아웃",
      submitClass: "login-submit--danger",
    });
  }

  /* ── 단순 모달 헬퍼 (로그아웃 확인 등) ─────────── */
  function openSimpleModal(options) {
    var existing = document.querySelector(".login-modal");
    if (existing) existing.remove();

    var modal = document.createElement("div");
    modal.className = "login-modal";
    modal.innerHTML =
      '<div class="login-backdrop"></div>' +
      '<div class="login-panel" role="dialog" aria-modal="true">' +
        '<div class="login-panel-header">' +
          '<h2>' + options.title + '</h2>' +
          '<button class="login-close" type="button" aria-label="닫기">×</button>' +
        '</div>' +
        '<form class="login-form" novalidate>' +
          options.body +
          '<div class="login-actions">' +
            '<button type="submit" class="login-submit ' + (options.submitClass || "") + '">' +
              options.submitLabel +
            '</button>' +
          '</div>' +
        '</form>' +
      '</div>';

    document.body.appendChild(modal);

    function close() {
      modal.remove();
      document.removeEventListener("keydown", escHandler);
    }
    modal.querySelector(".login-backdrop").addEventListener("click", close);
    modal.querySelector(".login-close").addEventListener("click", close);
    function escHandler(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", escHandler);

    modal.querySelector(".login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      options.onSubmit();
      close();
    });
  }

  /* ── 공지 배지 헬퍼 (일반 유저) ────────────────────── */
  function showNoticeBadge() {
    var b = document.getElementById("nc-badge");
    if (b) b.style.display = "block";
  }
  function hideNoticeBadge() {
    var b = document.getElementById("nc-badge");
    if (b) b.style.display = "none";
  }
  function checkNoticeBadge() {
    fetch("/api/notices", {
      headers: { Authorization: "Bearer " + getToken() },
    }).then(function (r) { return r.json(); })
      .then(function (data) {
        if (!Array.isArray(data) || !data.length) { hideNoticeBadge(); return; }
        var lastViewed = localStorage.getItem("nc_last_viewed") || "";
        var hasNew = data.some(function (item) { return item.at > lastViewed; });
        if (hasNew) showNoticeBadge(); else hideNoticeBadge();
      })
      .catch(function () {});
  }

  /* SSE: 새 공지 → 일반 유저 배지 표시 */
  window.addEventListener("vct-new-notice", function () {
    if (!isAdmin()) showNoticeBadge();
  });

  /* ── 공지 작성·관리 모달 (Admin) ────────────────────── */
  function openNoticeAdminModal() {
    var existing = document.querySelector(".login-modal");
    if (existing) existing.remove();

    var modal = document.createElement("div");
    modal.className = "login-modal";
    modal.innerHTML =
      '<div class="login-backdrop"></div>' +
      '<div class="login-panel" style="width:min(560px,calc(100vw - 32px));" role="dialog" aria-modal="true">' +
        '<div class="login-panel-header">' +
          '<h2>📢 공지 작성</h2>' +
          '<button class="login-close" type="button" aria-label="닫기">×</button>' +
        '</div>' +
        '<div class="login-form" style="display:flex;flex-direction:column;gap:14px;">' +
          /* 작성 폼 */
          '<div style="display:flex;flex-direction:column;gap:10px;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.08);">' +
            '<div>' +
              '<input id="nc-title" type="text" class="sg-textarea" placeholder="제목 (최대 100자)" maxlength="100"' +
                ' style="height:auto;padding:9px 12px;font-size:14px;font-weight:700;">' +
            '</div>' +
            '<div>' +
              '<textarea id="nc-text" class="sg-textarea" placeholder="내용을 입력해주세요. (최대 1000자)" maxlength="1000" style="height:110px;"></textarea>' +
              '<div class="sg-char"><span id="nc-count">0</span> / 1000</div>' +
            '</div>' +
            '<p class="login-error" id="nc-error" hidden></p>' +
            '<p class="login-success" id="nc-ok" hidden>공지가 등록되었습니다!</p>' +
            '<div class="login-actions">' +
              '<button type="button" class="login-submit" id="nc-submit">공지 등록</button>' +
            '</div>' +
          '</div>' +
          /* 기존 공지 목록 */
          '<div class="sg-list" id="nc-list"><div class="sg-empty">불러오는 중…</div></div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    var titleEl  = modal.querySelector("#nc-title");
    var textEl   = modal.querySelector("#nc-text");
    var countEl  = modal.querySelector("#nc-count");
    var errEl    = modal.querySelector("#nc-error");
    var okEl     = modal.querySelector("#nc-ok");
    var submitBtn = modal.querySelector("#nc-submit");
    var listEl   = modal.querySelector("#nc-list");

    textEl.addEventListener("input", function () {
      var len = textEl.value.length;
      countEl.textContent = len;
      countEl.parentElement.className = "sg-char" + (len > 1000 ? " over" : "");
    });

    function close() { modal.remove(); document.removeEventListener("keydown", escH); }
    modal.querySelector(".login-backdrop").addEventListener("click", close);
    modal.querySelector(".login-close").addEventListener("click", close);
    function escH(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", escH);

    function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
    function fmtDate(iso) {
      try {
        var d = new Date(iso);
        var kst = new Date(d.getTime() + 9 * 3600000);
        return kst.toISOString().replace("T"," ").slice(0,16) + " KST";
      } catch(e) { return iso; }
    }

    function renderList(items) {
      if (!items.length) { listEl.innerHTML = '<div class="sg-empty">등록된 공지가 없습니다.</div>'; return; }
      listEl.innerHTML = items.map(function (item) {
        var ts = item.key.replace("notice:", "");
        return '<div class="sg-item" data-ts="' + esc(ts) + '">' +
          '<div class="sg-item-meta">' +
            '<span style="font-weight:700;color:rgba(255,255,255,.85)">' + esc(item.title) + '</span>' +
            '<span>' + fmtDate(item.at) + '</span>' +
            '<button class="sg-item-del" type="button">삭제</button>' +
          '</div>' +
          '<div class="sg-item-text">' + esc(item.text) + '</div>' +
        '</div>';
      }).join("");

      listEl.querySelectorAll(".sg-item-del").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var item = btn.closest(".sg-item");
          var ts = item.dataset.ts;
          btn.disabled = true; btn.textContent = "…";
          fetch("/api/notices/" + encodeURIComponent(ts), {
            method: "DELETE",
            headers: { Authorization: "Bearer " + getToken() },
          }).then(function (r) { return r.json(); })
            .then(function (d) {
              if (d.ok) {
                item.remove();
                if (!listEl.querySelector(".sg-item"))
                  listEl.innerHTML = '<div class="sg-empty">등록된 공지가 없습니다.</div>';
              } else { btn.disabled = false; btn.textContent = "삭제"; }
            })
            .catch(function () { btn.disabled = false; btn.textContent = "삭제"; });
        });
      });
    }

    function loadList() {
      fetch("/api/notices", { headers: { Authorization: "Bearer " + getToken() } })
        .then(function (r) { return r.json(); })
        .then(function (data) { renderList(Array.isArray(data) ? data : []); })
        .catch(function () { listEl.innerHTML = '<div class="sg-empty">불러오기 실패.</div>'; });
    }
    loadList();

    submitBtn.addEventListener("click", function () {
      var title = titleEl.value.trim();
      var text  = textEl.value.trim();
      errEl.hidden = true; okEl.hidden = true;
      if (!title) { errEl.textContent = "제목을 입력해주세요."; errEl.hidden = false; return; }
      if (!text)  { errEl.textContent = "내용을 입력해주세요."; errEl.hidden = false; return; }
      if (title.length > 100)  { errEl.textContent = "제목은 100자 이하로 입력해주세요."; errEl.hidden = false; return; }
      if (text.length  > 1000) { errEl.textContent = "내용은 1000자 이하로 입력해주세요."; errEl.hidden = false; return; }
      submitBtn.disabled = true; submitBtn.textContent = "등록 중...";
      fetch("/api/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + getToken() },
        body: JSON.stringify({ title: title, text: text }),
      }).then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) {
            okEl.hidden = false;
            titleEl.value = ""; textEl.value = ""; countEl.textContent = "0";
            submitBtn.disabled = false; submitBtn.textContent = "공지 등록";
            loadList();
            setTimeout(function () { okEl.hidden = true; }, 2500);
          } else {
            errEl.textContent = d.error || "오류가 발생했습니다.";
            errEl.hidden = false;
            submitBtn.disabled = false; submitBtn.textContent = "공지 등록";
          }
        })
        .catch(function () {
          errEl.textContent = "서버에 연결할 수 없습니다.";
          errEl.hidden = false;
          submitBtn.disabled = false; submitBtn.textContent = "공지 등록";
        });
    });

    setTimeout(function () { titleEl.focus(); }, 60);
  }

  /* ── 공지 열람 모달 (일반 유저) ─────────────────────── */
  function openNoticeUserModal() {
    var existing = document.querySelector(".login-modal");
    if (existing) existing.remove();

    /* 열리는 순간 "확인함" 기록 → 배지 숨김 */
    localStorage.setItem("nc_last_viewed", new Date().toISOString());
    hideNoticeBadge();

    var modal = document.createElement("div");
    modal.className = "login-modal";
    modal.innerHTML =
      '<div class="login-backdrop"></div>' +
      '<div class="login-panel" style="width:min(520px,calc(100vw - 32px));" role="dialog" aria-modal="true">' +
        '<div class="login-panel-header">' +
          '<h2>📢 공지사항</h2>' +
          '<button class="login-close" type="button" aria-label="닫기">×</button>' +
        '</div>' +
        '<div class="login-form" style="display:flex;flex-direction:column;gap:12px;">' +
          '<div class="sg-list" id="nc-list-user"><div class="sg-empty">불러오는 중…</div></div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    var listEl = modal.querySelector("#nc-list-user");

    function close() { modal.remove(); document.removeEventListener("keydown", escH); }
    modal.querySelector(".login-backdrop").addEventListener("click", close);
    modal.querySelector(".login-close").addEventListener("click", close);
    function escH(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", escH);

    function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
    function fmtDate(iso) {
      try {
        var d = new Date(iso);
        var kst = new Date(d.getTime() + 9 * 3600000);
        return kst.toISOString().replace("T"," ").slice(0,16) + " KST";
      } catch(e) { return iso; }
    }

    fetch("/api/notices", { headers: { Authorization: "Bearer " + getToken() } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!Array.isArray(data) || !data.length) {
          listEl.innerHTML = '<div class="sg-empty">등록된 공지가 없습니다.</div>';
          return;
        }
        listEl.innerHTML = data.map(function (item) {
          return '<div class="sg-item">' +
            '<div class="sg-item-meta">' +
              '<span style="font-weight:700;color:rgba(255,255,255,.85);font-size:14px;">' + esc(item.title) + '</span>' +
              '<span>' + fmtDate(item.at) + '</span>' +
            '</div>' +
            '<div class="sg-item-text" style="white-space:pre-wrap;">' + esc(item.text) + '</div>' +
          '</div>';
        }).join("");
      })
      .catch(function () { listEl.innerHTML = '<div class="sg-empty">불러오기 실패.</div>'; });
  }

  /* ── 건의함 제출 모달 (일반 유저) ──────────────────── */
  function openSuggestModal() {
    var existing = document.querySelector(".login-modal");
    if (existing) existing.remove();

    var modal = document.createElement("div");
    modal.className = "login-modal";
    modal.innerHTML =
      '<div class="login-backdrop"></div>' +
      '<div class="login-panel" role="dialog" aria-modal="true">' +
        '<div class="login-panel-header">' +
          '<h2>📮 건의함</h2>' +
          '<button class="login-close" type="button" aria-label="닫기">×</button>' +
        '</div>' +
        '<div class="login-form" style="display:flex;flex-direction:column;gap:12px;">' +
          '<div class="sg-notice">⚠ 주의사항<br>욕설, 폭언 등은 삼가주세요.</div>' +
          '<div>' +
            '<textarea class="sg-textarea" id="sg-input" placeholder="건의할 내용을 입력해주세요. (최대 500자)" maxlength="500"></textarea>' +
            '<div class="sg-char"><span id="sg-count">0</span> / 500</div>' +
          '</div>' +
          '<p class="login-error" id="sg-error" hidden></p>' +
          '<p class="login-success" id="sg-ok" hidden>전달되었습니다! 감사합니다 😊</p>' +
          '<div class="login-actions">' +
            '<button type="button" class="login-submit" id="sg-submit">보내기</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    var textarea = modal.querySelector("#sg-input");
    var countEl  = modal.querySelector("#sg-count");
    var errEl    = modal.querySelector("#sg-error");
    var okEl     = modal.querySelector("#sg-ok");
    var submitBtn = modal.querySelector("#sg-submit");

    textarea.addEventListener("input", function () {
      var len = textarea.value.length;
      countEl.textContent = len;
      countEl.parentElement.className = "sg-char" + (len > 500 ? " over" : "");
    });

    function close() {
      modal.remove();
      document.removeEventListener("keydown", escH);
    }
    modal.querySelector(".login-backdrop").addEventListener("click", close);
    modal.querySelector(".login-close").addEventListener("click", close);
    function escH(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", escH);

    submitBtn.addEventListener("click", function () {
      var text = textarea.value.trim();
      errEl.hidden = true;
      okEl.hidden = true;
      if (!text) { errEl.textContent = "내용을 입력해주세요."; errEl.hidden = false; return; }
      if (text.length > 500) { errEl.textContent = "500자 이하로 입력해주세요."; errEl.hidden = false; return; }
      submitBtn.disabled = true;
      submitBtn.textContent = "전송 중...";
      fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text }),
      }).then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.error) {
            errEl.textContent = d.error;
            errEl.hidden = false;
            submitBtn.disabled = false;
            submitBtn.textContent = "보내기";
          } else {
            okEl.hidden = false;
            textarea.value = "";
            countEl.textContent = "0";
            submitBtn.disabled = true;
            submitBtn.textContent = "전송 완료";
            setTimeout(close, 1800);
          }
        })
        .catch(function () {
          errEl.textContent = "서버에 연결할 수 없습니다.";
          errEl.hidden = false;
          submitBtn.disabled = false;
          submitBtn.textContent = "보내기";
        });
    });

    setTimeout(function () { textarea.focus(); }, 60);
  }

  /* ── 건의함 배지 헬퍼 ───────────────────────────── */
  function showSuggestBadge() {
    var b = document.getElementById("sg-badge");
    if (b) b.style.display = "block";
  }
  function hideSuggestBadge() {
    var b = document.getElementById("sg-badge");
    if (b) b.style.display = "none";
  }
  function checkSuggestBadge() {
    fetch("/api/suggestions", {
      headers: { Authorization: "Bearer " + getToken() },
    }).then(function (r) { return r.json(); })
      .then(function (data) {
        if (!Array.isArray(data) || !data.length) { hideSuggestBadge(); return; }
        var lastViewed = localStorage.getItem("sg_last_viewed") || "";
        var hasNew = data.some(function (item) { return item.at > lastViewed; });
        if (hasNew) showSuggestBadge(); else hideSuggestBadge();
      })
      .catch(function () {});
  }

  /* ── 건의함 확인 모달 (Admin) ────────────────────── */
  function openSuggestAdminModal() {
    var existing = document.querySelector(".login-modal");
    if (existing) existing.remove();

    /* 열리는 순간 "확인함" 기록 → 배지 숨김 */
    localStorage.setItem("sg_last_viewed", new Date().toISOString());
    hideSuggestBadge();

    var modal = document.createElement("div");
    modal.className = "login-modal";
    modal.innerHTML =
      '<div class="login-backdrop"></div>' +
      '<div class="login-panel" style="width:min(520px,calc(100vw - 32px));" role="dialog" aria-modal="true">' +
        '<div class="login-panel-header">' +
          '<h2>📮 건의함 확인</h2>' +
          '<button class="login-close" type="button" aria-label="닫기">×</button>' +
        '</div>' +
        '<div class="login-form" style="display:flex;flex-direction:column;gap:12px;">' +
          '<div class="sg-list" id="sg-list"><div class="sg-empty">불러오는 중…</div></div>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);

    var listEl = modal.querySelector("#sg-list");

    function close() {
      modal.remove();
      document.removeEventListener("keydown", escH);
    }
    modal.querySelector(".login-backdrop").addEventListener("click", close);
    modal.querySelector(".login-close").addEventListener("click", close);
    function escH(e) { if (e.key === "Escape") close(); }
    document.addEventListener("keydown", escH);

    function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
    function fmtDate(iso) {
      try {
        var d = new Date(iso);
        var kst = new Date(d.getTime() + 9 * 3600000);
        return kst.toISOString().replace("T"," ").slice(0,16) + " KST";
      } catch(e) { return iso; }
    }

    function renderList(items) {
      if (!items.length) {
        listEl.innerHTML = '<div class="sg-empty">아직 건의가 없습니다.</div>';
        return;
      }
      listEl.innerHTML = items.map(function (item) {
        var ts = item.key.replace("suggest:", "");
        return '<div class="sg-item" data-key="' + esc(item.key) + '" data-ts="' + esc(ts) + '">' +
          '<div class="sg-item-meta">' +
            '<span>' + fmtDate(item.at) + '</span>' +
            '<button class="sg-item-del" type="button">삭제</button>' +
          '</div>' +
          '<div class="sg-item-text">' + esc(item.text) + '</div>' +
        '</div>';
      }).join("");

      listEl.querySelectorAll(".sg-item-del").forEach(function (btn) {
        btn.addEventListener("click", function () {
          var item = btn.closest(".sg-item");
          var ts = item.dataset.ts;
          btn.disabled = true;
          btn.textContent = "…";
          fetch("/api/suggestions/" + encodeURIComponent(ts), {
            method: "DELETE",
            headers: { Authorization: "Bearer " + getToken() },
          }).then(function (r) { return r.json(); })
            .then(function (d) {
              if (d.ok) item.remove();
              else { btn.disabled = false; btn.textContent = "삭제"; }
              if (!listEl.querySelector(".sg-item")) {
                listEl.innerHTML = '<div class="sg-empty">아직 건의가 없습니다.</div>';
              }
            })
            .catch(function () { btn.disabled = false; btn.textContent = "삭제"; });
        });
      });
    }

    fetch("/api/suggestions", {
      headers: { Authorization: "Bearer " + getToken() },
    }).then(function (r) { return r.json(); })
      .then(function (data) { renderList(Array.isArray(data) ? data : []); })
      .catch(function () { listEl.innerHTML = '<div class="sg-empty">불러오기 실패.</div>'; });
  }

  /* ── 보상 지급 모달 (Admin) ── */
  function openRewardModal() {
    var existing = document.querySelector(".login-modal");
    if (existing) existing.remove();

    var modal = document.createElement("div");
    modal.className = "login-modal";
    modal.innerHTML = [
      '<div class="login-box" style="width:380px">',
        '<div class="login-header">',
          '<span class="login-title">🎁 전체 보상 지급</span>',
          '<button class="login-close" id="reward-close">✕</button>',
        '</div>',
        '<div class="login-body" style="display:flex;flex-direction:column;gap:14px">',
          '<div style="background:rgba(255,200,60,.07);border:1px solid rgba(255,200,60,.2);border-radius:6px;padding:10px 14px;font-size:12px;color:rgba(255,200,60,.85);line-height:1.6">',
            'admin·test 계정을 제외한 모든 유저에게 코인을 지급합니다.',
          '</div>',
          '<div>',
            '<label style="font-size:12px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px">지급 코인 수</label>',
            '<input id="reward-coins" type="number" min="1" placeholder="예: 500" style="width:100%;box-sizing:border-box;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:4px;padding:9px 12px;color:#fff;font-family:\'Barlow Condensed\',sans-serif;font-size:16px;font-weight:700;outline:none">',
          '</div>',
          '<div>',
            '<label style="font-size:12px;font-weight:700;color:rgba(255,255,255,.5);letter-spacing:.08em;text-transform:uppercase;display:block;margin-bottom:6px">공지 메시지</label>',
            '<textarea id="reward-msg" class="sg-textarea" placeholder="예: 점검 보상으로 코인을 지급드립니다 :)" style="height:90px"></textarea>',
            '<div id="reward-msg-char" class="sg-char">0 / 200</div>',
          '</div>',
          '<div id="reward-status" style="font-size:12px;min-height:16px;text-align:center"></div>',
          '<button id="reward-send-btn" class="login-submit" style="margin-top:2px">지급하기</button>',
        '</div>',
      '</div>',
    ].join("");

    document.body.appendChild(modal);

    var msgEl   = modal.querySelector("#reward-msg");
    var charEl  = modal.querySelector("#reward-msg-char");
    var sendBtn = modal.querySelector("#reward-send-btn");
    var statusEl= modal.querySelector("#reward-status");

    msgEl.addEventListener("input", function () {
      var len = msgEl.value.length;
      charEl.textContent = len + " / 200";
      charEl.className = "sg-char" + (len > 200 ? " over" : "");
    });

    modal.querySelector("#reward-close").addEventListener("click", function () { modal.remove(); });
    modal.addEventListener("click", function (e) { if (e.target === modal) modal.remove(); });

    sendBtn.addEventListener("click", function () {
      var coins = parseInt(modal.querySelector("#reward-coins").value, 10);
      var msg   = msgEl.value.trim();
      if (!coins || coins < 1) { statusEl.style.color="#ff6b6b"; statusEl.textContent="코인 수를 입력하세요."; return; }
      if (!msg)                 { statusEl.style.color="#ff6b6b"; statusEl.textContent="메시지를 입력하세요."; return; }
      if (msg.length > 200)     { statusEl.style.color="#ff6b6b"; statusEl.textContent="200자 이하로 입력하세요."; return; }

      sendBtn.disabled = true;
      sendBtn.textContent = "지급 중...";
      statusEl.textContent = "";

      fetch("/api/admin/reward-all", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + getToken() },
        body: JSON.stringify({ coins: coins, message: msg }),
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.ok) {
            statusEl.style.color = "#3ddc84";
            statusEl.textContent = "✅ " + d.count + "명에게 " + d.coins + "코인 지급 완료!";
            sendBtn.textContent  = "지급 완료";
          } else {
            statusEl.style.color = "#ff6b6b";
            statusEl.textContent = "❌ " + (d.error || "오류 발생");
            sendBtn.disabled = false;
            sendBtn.textContent = "지급하기";
          }
        })
        .catch(function () {
          statusEl.style.color = "#ff6b6b";
          statusEl.textContent = "❌ 네트워크 오류";
          sendBtn.disabled = false;
          sendBtn.textContent = "지급하기";
        });
    });
  }

  /* ── SSE: 보상 수신 (일반 유저 — 토스트 알림)
       각 페이지의 SSE 연결이 reward 이벤트를 window에 dispatch하면 여기서 받습니다.
       페이지에 SSE가 없는 경우(로그인 페이지 등)를 위해 별도 연결도 fallback으로 유지. ── */
  window.addEventListener("vct-sse-reward", function (e) {
    var d = e.detail;
    if (d && d.coins) showRewardToast(d.coins, d.message || "");
  });

  /* reward 이벤트는 storage.js SSE가 모든 페이지에서 relay함 — 별도 SSE 불필요 */

  function showRewardToast(coins, message) {
    var toast = document.createElement("div");
    toast.style.cssText = [
      "position:fixed", "bottom:28px", "left:50%", "transform:translateX(-50%)",
      "z-index:99999", "background:#0d1f0d", "border:1px solid rgba(61,220,132,.35)",
      "border-radius:10px", "padding:16px 24px", "min-width:280px", "max-width:400px",
      "box-shadow:0 8px 32px rgba(0,0,0,.6)", "font-family:'Noto Sans KR','Barlow',sans-serif",
      "text-align:center", "animation:rewardToastIn .3s ease",
    ].join(";");
    toast.innerHTML = [
      '<div style="font-size:22px;margin-bottom:6px">🎁</div>',
      '<div style="font-size:15px;font-weight:700;color:#3ddc84;margin-bottom:4px">+' + coins + ' 코인 지급!</div>',
      '<div style="font-size:13px;color:rgba(255,255,255,.65);line-height:1.5;word-break:break-word">' + escapeHtml(message) + '</div>',
    ].join("");

    /* 애니메이션 키프레임 */
    if (!document.querySelector("#reward-toast-style")) {
      var s = document.createElement("style");
      s.id = "reward-toast-style";
      s.textContent = "@keyframes rewardToastIn{from{opacity:0;transform:translateX(-50%) translateY(20px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}";
      document.head.appendChild(s);
    }

    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.transition = "opacity .4s";
      toast.style.opacity = "0";
      setTimeout(function () { toast.remove(); }, 400);
    }, 5000);
  }

  function escapeHtml(s) {
    return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  }

  /* ── 전역 노출 ── */
  window.vctIsAdmin = isAdmin;
  window.vctGetUser = getCachedUser;
})();
