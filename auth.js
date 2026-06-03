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

  function refreshAuthButtons() {
    var user = getCachedUser();
    if (!user) {
      /* 미로그인 */
      authBtn.textContent = "로그인";
      authBtn.className = "auth-header-btn";
      refreshBtn.style.display = "none";
      authBtn.onclick = openLoginModal;
    } else if (user.role === "admin") {
      /* Admin */
      authBtn.textContent = "Admin";
      authBtn.className = "auth-header-btn auth-header-btn--on";
      refreshBtn.style.display = "";
      authBtn.onclick = openLogoutConfirm;
    } else {
      /* 일반 유저 */
      authBtn.textContent = user.username;
      authBtn.className = "auth-header-btn auth-header-btn--user";
      refreshBtn.style.display = "none";
      authBtn.onclick = openLogoutConfirm;
    }
  }

  refreshAuthButtons();

  /* 도움말 버튼 */
  var helpBtn = document.createElement("button");
  helpBtn.type = "button";
  helpBtn.className = "help-trigger-btn";
  helpBtn.textContent = "?";
  helpBtn.title = "도움말";
  helpBtn.addEventListener("click", function () {
    if (window.vctHelpOpen) window.vctHelpOpen();
  });

  if (header) {
    /* 우측 버튼 그룹 wrapper */
    var rightGroup = document.createElement("div");
    rightGroup.className = "header-right-group";
    rightGroup.appendChild(refreshBtn);
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
    floatWrap.appendChild(helpBtn);
    floatWrap.appendChild(authBtn);
    document.body.appendChild(floatWrap);
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

  /* ── 전역 노출 ── */
  window.vctIsAdmin = isAdmin;
  window.vctGetUser = getCachedUser;
})();
