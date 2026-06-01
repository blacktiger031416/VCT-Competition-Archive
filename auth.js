(function () {
  "use strict";

  var KEY      = "vct_admin_auth";
  var ADMIN_ID = "Admin";
  var ADMIN_PW = "mnasdvoiewf23";

  /* ── 스타일 인젝션 ──────────────────────────────────── */
  var style = document.createElement("style");
  style.textContent = [
    /* ── Header Button ── */
    ".auth-header-btn {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  gap: 7px;",
    "  margin-left: auto;",
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
    ".auth-header-btn:hover::before {",
    "  background: rgba(255,255,255,0.55);",
    "}",
    ".auth-header-btn--on {",
    "  background: rgba(30,210,100,0.1);",
    "  border-color: rgba(30,210,100,0.3);",
    "  color: #3ddc84;",
    "}",
    ".auth-header-btn--on::before {",
    "  background: #3ddc84;",
    "  box-shadow: 0 0 6px rgba(61,220,132,0.7);",
    "}",
    ".auth-header-btn--on:hover {",
    "  background: rgba(220,50,50,0.12);",
    "  border-color: rgba(220,50,50,0.35);",
    "  color: #ff6b6b;",
    "}",
    ".auth-header-btn--on:hover::before {",
    "  background: #ff6b6b;",
    "  box-shadow: 0 0 6px rgba(255,100,100,0.6);",
    "}",
    ".auth-header-btn--floating {",
    "  position: fixed;",
    "  top: 16px; right: 20px;",
    "  z-index: 9000;",
    "  box-shadow: 0 4px 20px rgba(0,0,0,0.5);",
    "}",
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
    ".auth-refresh-btn:hover {",
    "  background: rgba(255,255,255,0.09);",
    "  border-color: rgba(255,255,255,0.22);",
    "  color: rgba(255,255,255,0.85);",
    "}",
    ".auth-refresh-btn:active { transform: rotate(180deg); }",
    ".auth-refresh-btn .refresh-icon { font-size: 13px; line-height: 1; }",

    /* ── Modal overlay ── */
    ".login-modal {",
    "  position: fixed; inset: 0;",
    "  z-index: 9500;",
    "  display: flex; align-items: center; justify-content: center;",
    "}",
    ".login-backdrop {",
    "  position: absolute; inset: 0;",
    "  background: rgba(5,8,15,0.75);",
    "  backdrop-filter: blur(8px);",
    "  -webkit-backdrop-filter: blur(8px);",
    "}",

    /* ── Panel ── */
    ".login-panel {",
    "  position: relative; z-index: 1;",
    "  width: min(380px, calc(100vw - 32px));",
    "  background: #111a28;",
    "  border: 1px solid rgba(255,255,255,0.09);",
    "  border-radius: 8px;",
    "  box-shadow: 0 32px 96px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.03) inset;",
    "  overflow: hidden;",
    "  animation: authPanelIn 0.22s cubic-bezier(0.16,1,0.3,1);",
    "}",
    "@keyframes authPanelIn {",
    "  from { opacity: 0; transform: translateY(16px) scale(0.97); }",
    "  to   { opacity: 1; transform: none; }",
    "}",

    /* ── Panel header ── */
    ".login-panel-header {",
    "  display: flex; align-items: center; justify-content: space-between;",
    "  padding: 20px 22px 18px;",
    "  border-bottom: 1px solid rgba(255,255,255,0.06);",
    "}",
    ".login-panel-header h2 {",
    "  font-family: 'Barlow Condensed', sans-serif;",
    "  font-size: 18px; font-weight: 900;",
    "  letter-spacing: 0.08em; text-transform: uppercase;",
    "  color: #fff; margin: 0;",
    "}",
    ".login-close {",
    "  width: 30px; height: 30px;",
    "  display: grid; place-items: center;",
    "  border: 1px solid rgba(255,255,255,0.08);",
    "  border-radius: 4px;",
    "  background: rgba(255,255,255,0.04);",
    "  font-size: 16px; line-height: 1;",
    "  color: rgba(255,255,255,0.35);",
    "  cursor: pointer;",
    "  transition: background 0.12s, color 0.12s, border-color 0.12s;",
    "}",
    ".login-close:hover {",
    "  background: rgba(255,255,255,0.09);",
    "  border-color: rgba(255,255,255,0.18);",
    "  color: rgba(255,255,255,0.8);",
    "}",

    /* ── Form ── */
    ".login-form {",
    "  display: flex; flex-direction: column; gap: 14px;",
    "  padding: 22px;",
    "}",
    ".login-field {",
    "  display: flex; flex-direction: column; gap: 6px;",
    "}",
    ".login-field span {",
    "  font-family: 'Barlow Condensed', sans-serif;",
    "  font-size: 10px; font-weight: 700;",
    "  letter-spacing: 0.2em; text-transform: uppercase;",
    "  color: rgba(255,255,255,0.35);",
    "}",
    ".login-field input {",
    "  width: 100%; height: 42px;",
    "  padding: 0 14px;",
    "  background: rgba(255,255,255,0.04);",
    "  border: 1px solid rgba(255,255,255,0.1);",
    "  border-radius: 4px;",
    "  font-family: 'Barlow Condensed', sans-serif;",
    "  font-size: 15px; font-weight: 600;",
    "  letter-spacing: 0.04em;",
    "  color: #fff;",
    "  outline: none;",
    "  box-sizing: border-box;",
    "  transition: border-color 0.15s, background 0.15s;",
    "}",
    ".login-field input::placeholder { color: rgba(255,255,255,0.18); }",
    ".login-field input:focus {",
    "  border-color: rgba(232,67,45,0.6);",
    "  background: rgba(255,255,255,0.06);",
    "  box-shadow: 0 0 0 3px rgba(232,67,45,0.12);",
    "}",

    /* ── Error ── */
    ".login-error {",
    "  font-family: 'Barlow Condensed', sans-serif;",
    "  font-size: 12px; font-weight: 700;",
    "  letter-spacing: 0.08em; text-transform: uppercase;",
    "  color: #ff6b6b;",
    "  background: rgba(220,50,50,0.1);",
    "  border: 1px solid rgba(220,50,50,0.2);",
    "  border-radius: 4px;",
    "  padding: 9px 12px;",
    "  margin: 0;",
    "}",

    /* ── Confirm msg ── */
    ".login-confirm-msg {",
    "  font-family: 'Barlow', 'Noto Sans KR', sans-serif;",
    "  font-size: 14px;",
    "  color: rgba(255,255,255,0.55);",
    "  margin: 4px 0 4px;",
    "  line-height: 1.6;",
    "}",

    /* ── Actions ── */
    ".login-actions { margin-top: 2px; }",
    ".login-submit {",
    "  width: 100%; height: 44px;",
    "  border: none; border-radius: 4px;",
    "  background: #e8432d;",
    "  color: #fff;",
    "  font-family: 'Barlow Condensed', sans-serif;",
    "  font-size: 13px; font-weight: 700;",
    "  letter-spacing: 0.18em; text-transform: uppercase;",
    "  cursor: pointer;",
    "  transition: background 0.15s, opacity 0.15s;",
    "  position: relative; overflow: hidden;",
    "}",
    ".login-submit::after {",
    "  content: '';",
    "  position: absolute; inset: 0;",
    "  background: linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 60%);",
    "  pointer-events: none;",
    "}",
    ".login-submit:hover { background: #d43520; }",
    ".login-submit:active { opacity: 0.85; }",
    ".login-submit--danger { background: rgba(180,30,30,0.85); border: 1px solid rgba(220,50,50,0.3); }",
    ".login-submit--danger:hover { background: rgba(200,30,30,0.95); }",

    /* ── view-only: 모든 편집 요소 차단 (전 페이지 공통) ── */
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
    /* 맵 카운트 +/- */
    "body.view-only .map-count-btn,",
    /* 오버뷰 스코어 입력 */
    "body.view-only .mo-score-num,",
    "body.view-only .mo-map-slot,",
    /* 베토 셀 */
    "body.view-only .mo-veto-cell,",
    /* 선수/에이전트 */
    "body.view-only .pc-agent,",
    /* 스코어보드 다이아몬드 위 점수 (클릭 시 score editor 열림) */
    "body.view-only .sb-score-diamond-l,",
    "body.view-only .sb-score-diamond-r",
    "{ pointer-events: none !important; cursor: default !important; }",

    /* 로스터 수정 UI 숨김 */
    "body.view-only .roster-add-row { display: none !important; }",
    "body.view-only .roster-player-remove { display: none !important; }",

    "body.view-only .map-count-bar { display: none !important; }",
  ].join("\n");
  document.head.appendChild(style);

  /* ── 인증 상태 ─────────────────────────────────────── */
  function isAdmin() {
    return localStorage.getItem(KEY) === "1";
  }

  /* view-only 클래스: 비로그인 상태에서 편집 비활성화 */
  if (!isAdmin()) {
    document.body.classList.add("view-only");
  }

  /* ── 헤더 버튼 주입 ──────────────────────────────── */
  var header = document.querySelector(".site-header");
  var authBtn = document.createElement("button");
  authBtn.type = "button";

  /* 새로고침 버튼 (admin 로그인 시에만 표시) */
  var refreshBtn = document.createElement("button");
  refreshBtn.type = "button";
  refreshBtn.className = "auth-refresh-btn";
  refreshBtn.innerHTML = '<span class="refresh-icon">↻</span> 새로고침';
  refreshBtn.title = "서버에서 최신 데이터를 불러옵니다";
  refreshBtn.style.display = "none";
  refreshBtn.addEventListener("click", function () {
    window.location.reload();
  });

  function refreshAuthBtn() {
    if (isAdmin()) {
      authBtn.textContent = "Admin";
      authBtn.className = "auth-header-btn auth-header-btn--on";
      refreshBtn.style.display = "";
    } else {
      authBtn.textContent = "로그인";
      authBtn.className = "auth-header-btn";
      refreshBtn.style.display = "none";
    }
  }
  refreshAuthBtn();

  authBtn.addEventListener("click", function () {
    if (isAdmin()) {
      openLogoutConfirm();
    } else {
      openLoginModal();
    }
  });

  if (header) {
    header.appendChild(refreshBtn);
    header.appendChild(authBtn);
  } else {
    authBtn.classList.add("auth-header-btn--floating");
    document.body.appendChild(refreshBtn);
    document.body.appendChild(authBtn);
  }

  /* ── 로그아웃 확인 ───────────────────────────────── */
  function openLogoutConfirm() {
    openModal({
      title: "로그아웃",
      body: '<p class="login-confirm-msg">관리자 계정에서 로그아웃 하시겠습니까?</p>',
      onSubmit: function () {
        localStorage.removeItem(KEY);
        location.reload();
      },
      submitLabel: "로그아웃",
      submitClass: "login-submit--danger",
    });
  }

  /* ── 로그인 모달 ─────────────────────────────────── */
  function openLoginModal() {
    openModal({
      title: "관리자 로그인",
      body: '\
        <label class="login-field">\
          <span>아이디</span>\
          <input type="text" name="login-id" autocomplete="username" placeholder="아이디 입력" />\
        </label>\
        <label class="login-field">\
          <span>비밀번호</span>\
          <input type="password" name="login-pw" autocomplete="current-password" placeholder="비밀번호 입력" />\
        </label>\
        <p class="login-error" hidden>아이디 또는 비밀번호가 올바르지 않습니다.</p>',
      onSubmit: function (form) {
        var id = (form.querySelector("[name=login-id]").value || "").trim();
        var pw = (form.querySelector("[name=login-pw]").value || "");
        if (id === ADMIN_ID && pw === ADMIN_PW) {
          localStorage.setItem(KEY, "1");
          return true;
        } else {
          var errEl = form.querySelector(".login-error");
          errEl.hidden = false;
          form.querySelector("[name=login-pw]").value = "";
          form.querySelector("[name=login-pw]").focus();
          return false;
        }
      },
      submitLabel: "로그인",
      firstFocus: "[name=login-id]",
    });
  }

  /* ── 공통 모달 헬퍼 ─────────────────────────────── */
  function openModal(options) {
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

    function escHandler(e) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", escHandler);

    modal.querySelector(".login-form").addEventListener("submit", function (e) {
      e.preventDefault();
      var result = options.onSubmit(this);
      if (result !== false) {
        close();
        location.reload();
      }
    });

    var focusSel = options.firstFocus;
    if (focusSel) {
      setTimeout(function () {
        var el = modal.querySelector(focusSel);
        if (el) el.focus();
      }, 40);
    }
  }

  /* ── 전역 노출 ── */
  window.vctIsAdmin = isAdmin;
})();
