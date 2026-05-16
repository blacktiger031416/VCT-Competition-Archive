/**
 * storage.js — localStorage ↔ 서버 DB 동기화 레이어
 *
 * 동작 원리:
 * 1. 페이지 로드 시 서버에서 모든 데이터를 가져와 localStorage에 채움
 * 2. localStorage.setItem / removeItem 을 오버라이드해서 변경 사항을 DB에 자동 저장
 * 3. window.storageReady — 초기 로드가 끝나면 resolve되는 Promise
 *    → 각 페이지 스크립트는 이 Promise를 await 한 뒤 초기화
 */
(function () {
  "use strict";

  /* 서버에 동기화하지 않을 키 (인증 등 클라이언트 전용) */
  var LOCAL_ONLY = ["vct_admin_auth"];

  function isLocalOnly(key) {
    return LOCAL_ONLY.indexOf(key) !== -1;
  }

  /* 원본 메서드 보존 */
  var _origSet    = localStorage.setItem.bind(localStorage);
  var _origRemove = localStorage.removeItem.bind(localStorage);
  var _origClear  = localStorage.clear.bind(localStorage);

  /* ── setItem 오버라이드 ───────────────────────────── */
  localStorage.setItem = function (key, value) {
    _origSet(key, value);
    if (!isLocalOnly(key)) {
      fetch("/api/data/" + encodeURIComponent(key), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: String(value) }),
      }).catch(function (e) {
        console.warn("[storage] sync failed for key:", key, e);
      });
    }
  };

  /* ── removeItem 오버라이드 ───────────────────────── */
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

  /* ── 서버 전체 데이터 로드 → localStorage 채우기 ── */
  window.storageReady = fetch("/api/data/all")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      var dbKeys = Object.keys(data);
      var dbKeySet = {};
      dbKeys.forEach(function (key) { dbKeySet[key] = true; });

      /* localStorage → DB: DB에 없는 키만 올려줌 (로컬에서 생성된 키 보호) */
      Object.keys(localStorage).forEach(function (key) {
        if (!isLocalOnly(key) && !dbKeySet[key]) {
          fetch("/api/data/" + encodeURIComponent(key), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: localStorage.getItem(key) }),
          }).catch(function () {});
        }
      });

      /* DB → localStorage: DB가 항상 우선 (크로스 디바이스 동기화) */
      dbKeys.forEach(function (key) {
        _origSet(key, data[key]);
      });

      console.log("[storage] loaded " + dbKeys.length + " keys from DB");
    })
    .catch(function (e) {
      /* 서버 오류 시에도 페이지 초기화는 진행 (기존 localStorage 사용) */
      console.warn("[storage] could not load from DB, using local cache:", e.message);
      return Promise.resolve();
    });
})();
