(function () {
  "use strict";

  var KEY      = "vct_admin_auth";
  var ADMIN_ID = "Admin";
  var ADMIN_PW = "mnasdvoiewf23";

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

  function refreshAuthBtn() {
    if (isAdmin()) {
      authBtn.textContent = "Admin ✓";
      authBtn.className = "auth-header-btn auth-header-btn--on";
    } else {
      authBtn.textContent = "로그인";
      authBtn.className = "auth-header-btn";
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
    /* 일반 페이지: 헤더에 삽입 */
    header.appendChild(authBtn);
  } else {
    /* index.html처럼 site-header가 없는 페이지: 고정 위치 버튼 */
    authBtn.classList.add("auth-header-btn--floating");
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
          return true; /* close & reload */
        } else {
          var errEl = form.querySelector(".login-error");
          errEl.hidden = false;
          form.querySelector("[name=login-pw]").value = "";
          form.querySelector("[name=login-pw]").focus();
          return false; /* stay open */
        }
      },
      submitLabel: "로그인",
      firstFocus: "[name=login-id]",
    });
  }

  /* ── 공통 모달 헬퍼 ─────────────────────────────── */
  function openModal(options) {
    /* 기존 모달 제거 */
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

  /* ── 전역 노출 (페이지 스크립트에서 필요시 참조) ── */
  window.vctIsAdmin = isAdmin;
})();
