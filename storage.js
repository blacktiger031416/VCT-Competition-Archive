/**
 * storage.js — localStorage ↔ 서버 DB 동기화 + 실시간 SSE 레이어
 *
 * 동작 원리:
 * 1. 페이지 로드 시 서버에서 모든 데이터를 가져옴
 *    - 관리자(vct_admin_auth): localStorage 우선 (Render 슬립 중 저장 보호)
 *    - 일반 방문자: DB 우선 (항상 최신 데이터 표시)
 * 2. localStorage.setItem / removeItem 오버라이드 → 변경 즉시 DB에 저장 시도
 * 3. SSE(/api/events) 구독 → 다른 클라이언트의 변경사항 실시간 수신
 *    - match-dark 편집 페이지: localStorage만 업데이트 (새로고침 없음)
 *    - 그 외 페이지: 변경 감지 시 0.8초 후 자동 새로고침 (스크롤 위치 유지)
 * 4. 페이지 포커스 복귀 시 실패한 저장 자동 재시도 (관리자만)
 * 5. window.storageReady — 초기 로드가 끝나면 resolve되는 Promise
 */
(function () {
  "use strict";

  /* 서버에 동기화하지 않을 키 (auth 토큰은 절대 DB에 저장 금지) */
  var LOCAL_ONLY = [
    "vct_admin_auth", "__vct_dirty", "__vct_sync",
    "vct_auth_token", "vct_auth_user",
  ];

  /*
   * 서버 API 전용 접두사 — localStorage에 캐시하지 않음.
   * 이 키들은 API 엔드포인트로만 관리되므로 storage.js 동기화 대상에서 완전히 제외.
   * (이 키가 localStorage에 남아 있으면 Admin의 syncLocalToDB가 삭제된 데이터를 복원하는 버그 발생)
   */
  var SERVER_ONLY_PREFIXES = [
    "tlevt:", "tlpost:", "tllike:", "suggest:",
  ];

  /* 혹시 이전에 DB에 올라간 auth 키가 있으면 즉시 삭제 (보안 픽스) */
  ["vct_auth_token", "vct_auth_user"].forEach(function (key) {
    fetch("/api/data/" + encodeURIComponent(key), { method: "DELETE" }).catch(function () {});
  });

  function isLocalOnly(key) {
    return LOCAL_ONLY.indexOf(key) !== -1;
  }

  function isServerOnly(key) {
    for (var i = 0; i < SERVER_ONLY_PREFIXES.length; i++) {
      if (key.indexOf(SERVER_ONLY_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  /* localStorage에 남아 있는 서버 전용 키 즉시 정리 (원본 메서드 사용) */
  (function cleanServerOnlyFromLocal() {
    var toRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && isServerOnly(k)) toRemove.push(k);
    }
    toRemove.forEach(function (k) {
      localStorage.removeItem(k); /* 오버라이드 전이므로 원본이 아직 없음 — 바로 호출 */
    });
  })();

  /* 관리자 여부 (vct_admin_auth는 LOCAL_ONLY라 localStorage에서 직접 읽음) */
  var _isAdmin = !!localStorage.getItem("vct_admin_auth");

  /* 편집 페이지(match-dark) 여부: 실시간 새로고침 제외 */
  var _isEditPage = window.location.pathname.indexOf("match-dark") !== -1;

  /* 원본 메서드 보존 */
  var _origSet    = localStorage.setItem.bind(localStorage);
  var _origRemove = localStorage.removeItem.bind(localStorage);

  /* ── DB에 키 하나 업로드 ──────────────────────────────── */
  function pushKey(key, value) {
    return fetch("/api/data/" + encodeURIComponent(key), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: String(value) }),
    }).catch(function (e) {
      console.warn("[storage] sync failed for key:", key, e);
    });
  }

  /* ── setItem 오버라이드 ───────────────────────────────── */
  localStorage.setItem = function (key, value) {
    _origSet(key, value);
    if (!isLocalOnly(key) && !isServerOnly(key)) {
      pushKey(key, value);
    }
  };

  /* ── removeItem 오버라이드 ───────────────────────────── */
  localStorage.removeItem = function (key) {
    _origRemove(key);
    if (!isLocalOnly(key) && !isServerOnly(key)) {
      fetch("/api/data/" + encodeURIComponent(key), {
        method: "DELETE",
      }).catch(function (e) {
        console.warn("[storage] delete failed for key:", key, e);
      });
    }
  };

  /* ── localStorage → DB 전체 재동기화 (관리자 전용) ───── */
  function syncLocalToDB(dbData) {
    if (!_isAdmin) return Promise.resolve();
    var syncs = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || isLocalOnly(key) || isServerOnly(key)) continue;
      var localVal = localStorage.getItem(key);
      if (localVal === null) continue;
      if (dbData[key] !== localVal) {
        syncs.push(pushKey(key, localVal));
      }
    }
    return Promise.all(syncs);
  }

  /* ── 서버 전체 데이터 로드 ───────────────────────────── */
  window.storageReady = fetch("/api/data/all")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      var dbKeys = Object.keys(data);

      dbKeys.forEach(function (key) {
        if (isLocalOnly(key) || isServerOnly(key)) return;
        if (_isAdmin) {
          /* 관리자: localStorage에 없는 키만 DB에서 채움 (슬립 중 저장 보호) */
          if (localStorage.getItem(key) === null) {
            _origSet(key, data[key]);
          }
        } else {
          /* 일반 방문자: DB가 항상 우선 (최신 데이터 표시) */
          _origSet(key, data[key]);
        }
      });

      /* 관리자: 슬립 중 실패한 저장을 DB에 재동기화 */
      return syncLocalToDB(data).then(function () {
        console.log("[storage] loaded " + dbKeys.length + " keys from DB");
      });
    })
    .catch(function (e) {
      console.warn("[storage] could not load from DB, using local cache:", e.message);
      return Promise.resolve();
    });

  /* ── SSE 실시간 동기화 ───────────────────────────────── */
  (function initSSE() {
    if (typeof EventSource === "undefined") return;

    /* 스크롤 복원 (새로고침 후) */
    var _savedScroll = sessionStorage.getItem("_vct_scroll_y");
    if (_savedScroll) {
      sessionStorage.removeItem("_vct_scroll_y");
      window.addEventListener("load", function () {
        window.scrollTo(0, parseInt(_savedScroll) || 0);
      });
    }

    var _sse = new EventSource("/api/events");
    var _reloadTimer = null;

    _sse.onmessage = function (e) {
      try {
        var update = JSON.parse(e.data);

        /* 관리자가 새로고침 버튼을 눌렀을 때 → 뷰어만 새로고침 */
        if (update.type === "force-reload") {
          if (!_isAdmin) {
            sessionStorage.setItem("_vct_scroll_y", String(window.scrollY));
            window.location.reload();
          }
          return;
        }

        if (!update.key || isLocalOnly(update.key) || isServerOnly(update.key)) return;

        /* localStorage 즉시 반영 (push 없이 원본 메서드로) */
        if (update.type === "delete") {
          _origRemove(update.key);
        } else if (update.value !== undefined) {
          _origSet(update.key, update.value);
        }

        /* 자동 새로고침 없음 — 관리자가 버튼으로 직접 트리거 */
      } catch (err) {
        /* 파싱 오류 무시 */
      }
    };

    _sse.onerror = function () {
      /* EventSource가 자동으로 재연결 처리 */
    };
  })();

  /* ── 페이지 포커스 복귀 시 재동기화 (관리자 전용) ───── */
  var _lastSyncAt = Date.now();
  document.addEventListener("visibilitychange", function () {
    if (!_isAdmin) return;
    if (document.visibilityState !== "visible") return;
    var now = Date.now();
    if (now - _lastSyncAt < 5 * 60 * 1000) return;
    _lastSyncAt = now;
    fetch("/api/data/all")
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (data) {
        Object.keys(data).forEach(function (key) {
          if (!isLocalOnly(key) && !isServerOnly(key) && localStorage.getItem(key) === null) {
            _origSet(key, data[key]);
          }
        });
        return syncLocalToDB(data);
      })
      .then(function () {
        console.log("[storage] visibility-triggered resync done");
      })
      .catch(function () {});
  });

  /* ── bfcache 복원 시 자동 새로고침 ─────────────────────
     Chrome 뒤로가기 버튼으로 돌아올 때 JS 애니메이션이 멈춘
     상태로 복원되어 카드가 투명하게 보이는 버그 방지 */
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      window.location.reload();
    }
  });

})();
