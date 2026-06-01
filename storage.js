/**
 * storage.js — localStorage ↔ 서버 DB 동기화 레이어
 *
 * 동작 원리:
 * 1. 페이지 로드 시 서버에서 모든 데이터를 가져옴
 * 2. localStorage가 항상 우선 (슬립 중 저장 실패해도 로컬 데이터 보존)
 *    - DB에 있지만 localStorage에 없는 키 → DB에서 로드 (새 기기 지원)
 *    - localStorage에 있지만 DB와 다른 키 → localStorage 유지 + DB 재동기화
 * 3. localStorage.setItem / removeItem 오버라이드 → 변경 즉시 DB에 저장 시도
 * 4. 페이지 포커스 복귀 시 실패한 저장 자동 재시도
 * 5. window.storageReady — 초기 로드가 끝나면 resolve되는 Promise
 */
(function () {
  "use strict";

  /* 서버에 동기화하지 않을 키 */
  var LOCAL_ONLY = ["vct_admin_auth", "__vct_dirty", "__vct_sync"];

  function isLocalOnly(key) {
    return LOCAL_ONLY.indexOf(key) !== -1;
  }

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
    if (!isLocalOnly(key)) {
      pushKey(key, value);
    }
  };

  /* ── removeItem 오버라이드 ───────────────────────────── */
  localStorage.removeItem = function (key) {
    _origRemove(key);
    if (!isLocalOnly(key)) {
      fetch("/api/data/" + encodeURIComponent(key), {
        method: "DELETE",
      }).catch(function (e) {
        console.warn("[storage] delete failed for key:", key, e);
      });
    }
  };

  /* ── localStorage → DB 전체 재동기화 ─────────────────── */
  function syncLocalToDB(dbData) {
    var syncs = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || isLocalOnly(key)) continue;
      var localVal = localStorage.getItem(key);
      if (localVal === null) continue;
      /* DB에 없거나 값이 다르면 업로드 */
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

      /* DB → localStorage: localStorage에 없는 키만 채움 (새 기기 지원) */
      dbKeys.forEach(function (key) {
        if (isLocalOnly(key)) return;
        if (localStorage.getItem(key) === null) {
          _origSet(key, data[key]);
        }
      });

      /* localStorage → DB: DB와 다른 값 재동기화 (슬립 중 실패한 저장 복구) */
      return syncLocalToDB(data).then(function () {
        console.log("[storage] loaded " + dbKeys.length + " keys from DB");
      });
    })
    .catch(function (e) {
      /* 서버 오류 시에도 페이지 초기화는 진행 (기존 localStorage 사용) */
      console.warn("[storage] could not load from DB, using local cache:", e.message);
      return Promise.resolve();
    });

  /* ── 페이지 포커스 복귀 시 재동기화 (슬립 후 서버 복구 대응) ── */
  var _lastSyncAt = Date.now();
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    var now = Date.now();
    /* 5분 이상 경과했을 때만 재동기화 (너무 자주 하지 않도록) */
    if (now - _lastSyncAt < 5 * 60 * 1000) return;
    _lastSyncAt = now;
    fetch("/api/data/all")
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (data) {
        /* 새 기기에서 빠진 키만 채움 */
        Object.keys(data).forEach(function (key) {
          if (!isLocalOnly(key) && localStorage.getItem(key) === null) {
            _origSet(key, data[key]);
          }
        });
        /* 로컬에서 변경된 키를 DB에 재업로드 */
        return syncLocalToDB(data);
      })
      .then(function () {
        console.log("[storage] visibility-triggered resync done");
      })
      .catch(function () {});
  });

})();
