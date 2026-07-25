/**
 * storage.js — 서버 DB 동기화 + 실시간 SSE 레이어
 *
 * 동작 원리:
 * 1. 페이지 로드 시 서버에서 모든 데이터를 가져옴 → 메모리(_mem)에만 캐싱
 *    localStorage는 LOCAL_ONLY 키(auth 토큰 등)에만 사용 — 나머지는 일절 쓰지 않음
 * 2. localStorage.setItem / getItem / removeItem 오버라이드
 *    - LOCAL_ONLY: 실제 localStorage 사용
 *    - 그 외: _mem에만 저장, DB에 push
 * 3. SSE(/api/events) 구독 → 다른 클라이언트의 변경사항 실시간 수신
 * 4. 페이지 포커스 복귀 시 실패한 저장 자동 재시도 (관리자만)
 * 5. window.storageReady — 초기 로드가 끝나면 resolve되는 Promise
 */
(function () {
  "use strict";

  /* 서버에 동기화하지 않을 키 — 실제 localStorage에 저장 */
  var LOCAL_ONLY = [
    "vct_admin_auth", "__vct_dirty", "__vct_sync",
    "vct_auth_token", "vct_auth_user", "sg_last_viewed",
  ];

  var LOCAL_ONLY_PREFIXES = [
    "__vct_am:",
    "__vct_am_id:",
  ];

  var SERVER_ONLY_PREFIXES = [
    "tlevt:", "tlpost:", "tllike:",
    "suggest:",
    "coins:", "vault:", "attend:", "holdings:",
    "pred-bet:",
    "pred-match:",
    "season:",
    "notice:",
    "auto-match:",
  ];

  /* 혹시 이전에 DB에 올라간 auth 키가 있으면 즉시 삭제 (보안 픽스) */
  ["vct_auth_token", "vct_auth_user"].forEach(function (key) {
    fetch("/api/data/" + encodeURIComponent(key), { method: "DELETE" }).catch(function () {});
  });

  function isLocalOnly(key) {
    if (LOCAL_ONLY.indexOf(key) !== -1) return true;
    for (var i = 0; i < LOCAL_ONLY_PREFIXES.length; i++) {
      if (key.indexOf(LOCAL_ONLY_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  function isServerOnly(key) {
    for (var i = 0; i < SERVER_ONLY_PREFIXES.length; i++) {
      if (key.indexOf(SERVER_ONLY_PREFIXES[i]) === 0) return true;
    }
    return false;
  }

  /* ── 인메모리 캐시 ───────────────────────────────────── */
  var _mem = {};

  /* 원본 메서드 보존 */
  var _origSet    = localStorage.setItem.bind(localStorage);
  var _origGet    = localStorage.getItem.bind(localStorage);
  var _origRemove = localStorage.removeItem.bind(localStorage);

  /* 기존 localStorage에서 LOCAL_ONLY가 아닌 키 전부 제거 (초기 1회) */
  (function cleanNonLocalFromStorage() {
    var toRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && !isLocalOnly(k)) toRemove.push(k);
    }
    toRemove.forEach(function (k) { _origRemove(k); });
  })();

  /* 관리자 여부 */
  var _isAdmin = !!_origGet("vct_admin_auth") || (function () {
    try { var u = JSON.parse(_origGet("vct_auth_user")); return !!(u && u.role === "admin"); }
    catch (e) { return false; }
  })();

  /* 편집 페이지(match-dark) 여부 */
  var _isEditPage = window.location.pathname.indexOf("match-dark") !== -1;

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

  /* ── getItem 오버라이드 ──────────────────────────────── */
  localStorage.getItem = function (key) {
    if (isLocalOnly(key)) return _origGet(key);
    return Object.prototype.hasOwnProperty.call(_mem, key) ? _mem[key] : null;
  };

  /* ── setItem 오버라이드 ───────────────────────────────── */
  localStorage.setItem = function (key, value) {
    if (isLocalOnly(key)) {
      try { _origSet(key, value); } catch (_e) {}
      return;
    }

    var memValue = value;
    var dbValue = value;
    /* vct_p:* — 최근 15개만 */
    if (key.indexOf("vct_p:") === 0) {
      try {
        var _pd = JSON.parse(value);
        if (_pd && Array.isArray(_pd.maps) && _pd.maps.length > 15) {
          memValue = JSON.stringify({ maps: _pd.maps.slice(-15) });
          dbValue = memValue;
        }
      } catch (_e) {}
    }

    _mem[key] = memValue;

    if (!isServerOnly(key)) {
      pushKey(key, dbValue);
    }
  };

  /* ── removeItem 오버라이드 ───────────────────────────── */
  localStorage.removeItem = function (key) {
    if (isLocalOnly(key)) {
      _origRemove(key);
      return;
    }
    delete _mem[key];
    if (!isServerOnly(key)) {
      fetch("/api/data/" + encodeURIComponent(key), {
        method: "DELETE",
      }).catch(function (e) {
        console.warn("[storage] delete failed for key:", key, e);
      });
    }
  };

  /* ── _mem → DB 전체 재동기화 (관리자 전용) ─────────── */
  function syncMemToDB(dbData) {
    if (!_isAdmin) return Promise.resolve();
    var syncs = [];
    Object.keys(_mem).forEach(function (key) {
      if (isLocalOnly(key) || isServerOnly(key)) return;
      var memVal = _mem[key];
      if (dbData[key] !== memVal) syncs.push(pushKey(key, memVal));
    });
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
        /* 관리자: 이미 _mem에 있는 값은 덮어쓰지 않음 */
        if (_isAdmin && Object.prototype.hasOwnProperty.call(_mem, key)) return;
        var storeVal = data[key];
        if (key.indexOf("vct_p:") === 0) {
          try {
            var _pd2 = JSON.parse(storeVal);
            if (_pd2 && Array.isArray(_pd2.maps) && _pd2.maps.length > 15) {
              storeVal = JSON.stringify({ maps: _pd2.maps.slice(-15) });
            }
          } catch (_e2) {}
        }
        _mem[key] = storeVal;
      });

      return syncMemToDB(data).then(function () {
        console.log("[storage] loaded " + dbKeys.length + " keys from DB");
      });
    })
    .catch(function (e) {
      console.warn("[storage] could not load from DB:", e.message);
      return Promise.resolve();
    });

  /* ── SSE 실시간 동기화 ───────────────────────────────── */
  (function initSSE() {
    if (typeof EventSource === "undefined") return;

    var _savedScroll = sessionStorage.getItem("_vct_scroll_y");
    if (_savedScroll) {
      sessionStorage.removeItem("_vct_scroll_y");
      window.addEventListener("load", function () {
        window.scrollTo(0, parseInt(_savedScroll) || 0);
      });
    }

    var _sse = new EventSource("/api/events");

    _sse.onmessage = function (e) {
      try {
        var update = JSON.parse(e.data);

        if (update.type === "force-reload") {
          if (!_isAdmin) {
            sessionStorage.setItem("_vct_scroll_y", String(window.scrollY));
            window.location.reload();
          }
          return;
        }
        if (update.type === "reward") {
          window.dispatchEvent(new CustomEvent("vct-sse-reward", { detail: update }));
          return;
        }
        if (update.type === "new-notice") {
          window.dispatchEvent(new CustomEvent("vct-new-notice", { detail: update }));
          return;
        }
        if (update.type === "auto-match-filled") {
          window.dispatchEvent(new CustomEvent("vct-auto-match-filled", { detail: update }));
          return;
        }

        if (!update.key || isLocalOnly(update.key) || isServerOnly(update.key)) return;

        if (update.type === "delete") {
          delete _mem[update.key];
        } else if (update.value !== undefined) {
          _mem[update.key] = update.value;
        }
      } catch (err) {}
    };

    _sse.onerror = function () {};
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
          if (!isLocalOnly(key) && !isServerOnly(key) && !Object.prototype.hasOwnProperty.call(_mem, key)) {
            _mem[key] = data[key];
          }
        });
        return syncMemToDB(data);
      })
      .then(function () {
        console.log("[storage] visibility-triggered resync done");
      })
      .catch(function () {});
  });

  /* ── bfcache 복원 시 자동 새로고침 ───────────────────── */
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) window.location.reload();
  });

})();
