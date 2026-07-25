/**
 * storage.js — 서버 DB 동기화 + 실시간 SSE 레이어
 *
 * 동작 원리:
 * 1. 페이지 로드 시 서버에서 모든 데이터를 가져옴 → 메모리(_mem)에 캐싱
 *    localStorage는 LOCAL_ONLY 키(auth 토큰 등)만 사용 — 용량 초과 방지
 * 2. localStorage.setItem / getItem / removeItem 오버라이드
 *    setItem: _mem 저장 + DB pushKey (LOCAL_ONLY는 localStorage에만)
 *    getItem: localStorage 우선, 없으면 _mem fallback
 * 3. SSE(/api/events) 구독 → 다른 클라이언트의 변경사항 실시간 수신
 * 4. 페이지 포커스 복귀 시 실패한 저장 자동 재시도 (관리자만)
 * 5. window.storageReady — 초기 로드가 끝나면 resolve되는 Promise
 */
(function () {
  "use strict";

  /* 서버에 동기화하지 않을 키 (auth 토큰은 절대 DB에 저장 금지) */
  var LOCAL_ONLY = [
    "vct_admin_auth", "__vct_dirty", "__vct_sync",
    "vct_auth_token", "vct_auth_user", "sg_last_viewed",
  ];

  /* LOCAL_ONLY 접두사 — 해당 접두사로 시작하는 모든 키를 localStorage 전용으로 처리 */
  var LOCAL_ONLY_PREFIXES = [
    "__vct_am:",    /* 자동입력 실시간 ON/OFF 상태 로컬 백업 */
    "__vct_am_id:", /* thespike Match ID 로컬 백업 */
  ];

  /*
   * 서버 API 전용 접두사 — localStorage에 캐시하지 않음.
   * 이 키들은 API 엔드포인트로만 관리되므로 storage.js 동기화 대상에서 완전히 제외.
   */
  var SERVER_ONLY_PREFIXES = [
    /* 티어리스트 */
    "tlevt:", "tlpost:", "tllike:",
    /* 건의함 */
    "suggest:",
    /* 유저별 코인·금고·출석·보유주식 */
    "coins:", "vault:", "attend:", "holdings:",
    /* 승부 예측 배팅 기록 */
    "pred-bet:",
    /* 승부 예측 경기 데이터 */
    "pred-match:",
    /* 시즌 기록 */
    "season:",
    /* 공지사항 */
    "notice:",
    /* 자동 경기 입력 설정 (API 전용) */
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

  /* localStorage에 남아 있는 서버 전용 키 즉시 정리 */
  (function cleanServerOnlyFromLocal() {
    var toRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && isServerOnly(k)) toRemove.push(k);
    }
    toRemove.forEach(function (k) { localStorage.removeItem(k); });
  })();

  /* ── 인메모리 캐시 (localStorage 용량 초과 방지) ─────── */
  var _mem = {};

  /* 관리자 여부 */
  var _isAdmin = !!localStorage.getItem("vct_admin_auth") || (function () {
    try { var u = JSON.parse(localStorage.getItem("vct_auth_user")); return !!(u && u.role === "admin"); }
    catch (e) { return false; }
  })();

  /* 편집 페이지(match-dark) 여부 */
  var _isEditPage = window.location.pathname.indexOf("match-dark") !== -1;

  /* 원본 메서드 보존 */
  var _origSet    = localStorage.setItem.bind(localStorage);
  var _origGet    = localStorage.getItem.bind(localStorage);
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

  /* ── getItem 오버라이드 — localStorage 없으면 _mem fallback ── */
  localStorage.getItem = function (key) {
    var v = _origGet(key);
    if (v !== null) return v;
    return (Object.prototype.hasOwnProperty.call(_mem, key)) ? _mem[key] : null;
  };

  /* ── setItem 오버라이드 ───────────────────────────────── */
  localStorage.setItem = function (key, value) {
    var localValue = value;
    var dbValue = value;
    /* vct_p:* — 최근 15개만 */
    if (key.indexOf("vct_p:") === 0) {
      try {
        var _pd = JSON.parse(value);
        if (_pd && Array.isArray(_pd.maps) && _pd.maps.length > 15) {
          localValue = JSON.stringify({ maps: _pd.maps.slice(-15) });
          dbValue = localValue;
        }
      } catch (_e) {}
    }

    if (isLocalOnly(key)) {
      /* auth 토큰 등 — 실제 localStorage에만 저장 */
      try { _origSet(key, localValue); } catch (_qe) {}
      return;
    }

    /* 일반 키 — 메모리에 저장하고 DB에 push */
    _mem[key] = localValue;
    /* localStorage에도 시도 (Render 슬립 중 보호 목적, 용량 초과 시 skip) */
    try { _origSet(key, localValue); } catch (_qe) {}

    if (!isServerOnly(key)) {
      pushKey(key, dbValue);
    }
  };

  /* ── removeItem 오버라이드 ───────────────────────────── */
  localStorage.removeItem = function (key) {
    delete _mem[key];
    _origRemove(key);
    if (!isLocalOnly(key) && !isServerOnly(key)) {
      fetch("/api/data/" + encodeURIComponent(key), {
        method: "DELETE",
      }).catch(function (e) {
        console.warn("[storage] delete failed for key:", key, e);
      });
    }
  };

  /* ── localStorage + _mem → DB 전체 재동기화 (관리자 전용) ── */
  function syncLocalToDB(dbData) {
    if (!_isAdmin) return Promise.resolve();
    var syncs = [];
    var seen = {};

    /* localStorage 스캔 */
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (!key || isLocalOnly(key) || isServerOnly(key)) continue;
      seen[key] = true;
      var localVal = _origGet(key);
      if (localVal === null) continue;
      var dbVal = localVal;
      if (key.indexOf("vct_p:") === 0) {
        try {
          var _sd = JSON.parse(localVal);
          if (_sd && Array.isArray(_sd.maps) && _sd.maps.length > 15) {
            dbVal = JSON.stringify({ maps: _sd.maps.slice(-15) });
            _mem[key] = dbVal;
            try { _origSet(key, dbVal); } catch (_qe) {}
          }
        } catch (_se) {}
      }
      if (dbData[key] !== dbVal) syncs.push(pushKey(key, dbVal));
    }

    /* _mem 스캔 (localStorage에 없는 키) */
    Object.keys(_mem).forEach(function (key) {
      if (seen[key] || isLocalOnly(key) || isServerOnly(key)) return;
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
        /* 관리자: 이미 로컬에 있는 값은 덮어쓰지 않음 (편집 직후 되돌아가는 버그 방지) */
        if (_isAdmin && (localStorage.getItem(key) !== null || Object.prototype.hasOwnProperty.call(_mem, key))) return;
        var storeVal = data[key];
        /* vct_p:* — 최근 15개만 */
        if (key.indexOf("vct_p:") === 0) {
          try {
            var _pd2 = JSON.parse(storeVal);
            if (_pd2 && Array.isArray(_pd2.maps) && _pd2.maps.length > 15) {
              storeVal = JSON.stringify({ maps: _pd2.maps.slice(-15) });
            }
          } catch (_e2) {}
        }
        /* 메모리에 저장 (localStorage는 시도만, 초과 시 skip) */
        _mem[key] = storeVal;
        try { _origSet(key, storeVal); } catch (_qe) {}
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
          _origRemove(update.key);
        } else if (update.value !== undefined) {
          _mem[update.key] = update.value;
          try { _origSet(update.key, update.value); } catch (_qe) {}
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
          if (!isLocalOnly(key) && !isServerOnly(key) && localStorage.getItem(key) === null) {
            _mem[key] = data[key];
            try { _origSet(key, data[key]); } catch (_qe) {}
          }
        });
        return syncLocalToDB(data);
      })
      .then(function () {
        console.log("[storage] visibility-triggered resync done");
      })
      .catch(function () {});
  });

  /* ── bfcache 복원 시 자동 새로고침 ───────────────────── */
  window.addEventListener("pageshow", function (e) {
    if (e.persisted) {
      window.location.reload();
    }
  });

})();
