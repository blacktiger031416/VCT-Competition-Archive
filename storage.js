/**
 * storage.js — localStorage ↔ 서버 DB 동기화 레이어
 *
 * 동작 원리:
 * 1. 페이지 로드 시 서버에서 모든 데이터를 가져와 localStorage에 채움
 * 2. localStorage.setItem / removeItem 을 오버라이드해서 변경 사항을 DB에 자동 저장
 * 3. 타임스탬프 기반 충돌 해결:
 *    - 마지막 DB 로드 이후 로컬에서 수정된 키 → 로컬 값 유지 + DB 재동기화
 *    - 그 외 키 → DB 값이 우선 (크로스 디바이스 동기화)
 * 4. window.storageReady — 초기 로드가 끝나면 resolve되는 Promise
 */
(function () {
  "use strict";

  /* 서버에 동기화하지 않을 키 */
  var LOCAL_ONLY    = ["vct_admin_auth"];
  var DIRTY_KEY     = "__vct_dirty";   /* {key: modifiedAt} — 로컬 수정 타임스탬프 */
  var SYNC_TIME_KEY = "__vct_sync";    /* 마지막 DB 로드 시각 */

  function isLocalOnly(key) {
    return LOCAL_ONLY.indexOf(key) !== -1 || key === DIRTY_KEY || key === SYNC_TIME_KEY;
  }

  /* 원본 메서드 보존 */
  var _origSet    = localStorage.setItem.bind(localStorage);
  var _origRemove = localStorage.removeItem.bind(localStorage);

  /* 로컬 수정 타임스탬프 기록 (오버라이드 없이 직접 저장) */
  function markDirty(key) {
    try {
      var times = JSON.parse(localStorage.getItem(DIRTY_KEY) || "{}");
      times[key] = Date.now();
      _origSet(DIRTY_KEY, JSON.stringify(times));
    } catch (e) {}
  }

  function getDirtyTimes() {
    try { return JSON.parse(localStorage.getItem(DIRTY_KEY) || "{}"); } catch (e) { return {}; }
  }

  function getLastSyncTime() {
    return Number(localStorage.getItem(SYNC_TIME_KEY) || 0);
  }

  /* ── setItem 오버라이드 ───────────────────────────── */
  localStorage.setItem = function (key, value) {
    _origSet(key, value);
    if (!isLocalOnly(key)) {
      markDirty(key);
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

  /* ── 서버 전체 데이터 로드 ───────────────────────── */
  window.storageReady = fetch("/api/data/all")
    .then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(function (data) {
      var dbKeys     = Object.keys(data);
      var lastSync   = getLastSyncTime();
      var dirtyTimes = getDirtyTimes();
      var syncs      = [];

      dbKeys.forEach(function (key) {
        if (isLocalOnly(key)) return;

        var dirtyAt    = dirtyTimes[key] || 0;
        var localValue = localStorage.getItem(key);

        if (dirtyAt > lastSync && localValue !== null) {
          /* 마지막 DB 로드 이후 로컬에서 수정됨 → 로컬 값 유지, DB에 재동기화 */
          if (data[key] !== localValue) {
            syncs.push(
              fetch("/api/data/" + encodeURIComponent(key), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ value: localValue }),
              }).catch(function () {})
            );
          }
        } else {
          /* DB 값이 우선 */
          _origSet(key, data[key]);
        }
      });

      /* DB에 없는 로컬 키 → DB에 업로드 */
      Object.keys(localStorage).forEach(function (key) {
        if (isLocalOnly(key) || (key in data)) return;
        var val = localStorage.getItem(key);
        if (val === null) return;
        syncs.push(
          fetch("/api/data/" + encodeURIComponent(key), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ value: val }),
          }).catch(function () {})
        );
      });

      return Promise.all(syncs).then(function () {
        /* DB 로드 시각 갱신 */
        _origSet(SYNC_TIME_KEY, String(Date.now()));
        console.log("[storage] loaded " + dbKeys.length + " keys from DB");
      });
    })
    .catch(function (e) {
      /* 서버 오류 시에도 페이지 초기화는 진행 (기존 localStorage 사용) */
      console.warn("[storage] could not load from DB, using local cache:", e.message);
      return Promise.resolve();
    });
})();
