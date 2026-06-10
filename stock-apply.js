/* stock-apply.js
 * VCT 주식 반영 유틸리티
 * 각 match-dark.html에서 auth.js 다음에 include
 *
 * 저장 키: stock_p:선수명
 *   { price: number, ref: number, history: number[] }
 *   price   = 현재 코인 가격
 *   ref     = 현재 가격의 기준이 된 ACS (다음 비교에 사용)
 *   history = 가격 변동 이력 배열
 */
(function () {
  'use strict';

  /* ── CSS 주입 ── */
  var style = document.createElement('style');
  style.textContent = [
    '.admin-stock-row {',
    '  display: flex;',
    '  justify-content: flex-end;',
    '  padding: 10px 16px 12px;',
    '  border-top: 1px solid rgba(255,255,255,.06);',
    '}',
    '.stock-apply-btn {',
    '  display: inline-flex;',
    '  align-items: center;',
    '  gap: 6px;',
    '  padding: 7px 18px;',
    '  background: rgba(80,200,120,.15);',
    '  border: 1px solid rgba(80,200,120,.4);',
    '  border-radius: 6px;',
    '  color: #50c878;',
    '  font-size: 13px;',
    '  font-weight: 600;',
    '  cursor: pointer;',
    '  transition: background .15s, border-color .15s;',
    '}',
    '.stock-apply-btn:hover {',
    '  background: rgba(80,200,120,.28);',
    '  border-color: rgba(80,200,120,.7);',
    '}',
    '.stock-apply-btn:active { opacity: .75; }',
    '.stock-apply-btn.applied {',
    '  background: rgba(255,255,255,.06);',
    '  border-color: rgba(255,255,255,.15);',
    '  color: rgba(255,255,255,.3);',
    '  cursor: default;',
    '}',
  ].join('\n');
  document.head.appendChild(style);

  /* ── 핵심 로직 ──────────────────────────────────────────────────
   * mapIdx: maps[] 배열 인덱스 (0-based)
   * maps   변수는 각 match-dark.html의 전역 변수
   * ────────────────────────────────────────────────────────────── */
  window.applyMapToStock = function (mapIdx) {
    if (!window.vctIsAdmin || !window.vctIsAdmin()) {
      alert('관리자만 사용할 수 있습니다.');
      return;
    }

    var mapData = (typeof maps !== 'undefined') && maps[mapIdx];
    if (!mapData) {
      alert('맵 데이터를 찾을 수 없습니다.');
      return;
    }

    var players = mapData.players || [];
    var results = [];

    players.forEach(function (player) {
      var name   = (player.name  || '').trim();
      var newAcs = parseInt(player.acs, 10) || 0;
      if (!name || name === '-' || newAcs <= 0) return;

      /* ── stock_p: 키에서 현재 가격/기준 로드 ── */
      var key  = 'stock_p:' + name;
      var data = {};
      try { data = JSON.parse(localStorage.getItem(key) || 'null') || {}; } catch (e) {}

      /* ── 최초: vct_p: 에서 평균 ACS로 초기 가격 세팅 ── */
      if (!data.price || !data.ref) {
        var avgAcs = newAcs; /* fallback: 이 맵 ACS */
        try {
          var vctRaw = localStorage.getItem('vct_p:' + name);
          if (vctRaw) {
            var vctData = JSON.parse(vctRaw);
            var total = 0, cnt = 0;
            (vctData.maps || []).forEach(function (m) {
              var lg = m.league || '';
              if (lg !== 'americas' && lg !== 'emea' && lg !== 'pacific' && lg !== 'cn') return;
              var a = parseFloat(m.acs) || 0;
              if (a > 0) { total += a; cnt++; }
            });
            if (cnt > 0) avgAcs = Math.round(total / cnt);
          }
        } catch (e) {}

        var initPrice = Math.max(1, Math.round(avgAcs / 10));
        data.price   = initPrice;
        data.ref     = avgAcs;
        data.history = [initPrice];
      }

      /* ── 변동률 계산 후 새 가격 적용 ── */
      var oldPrice   = data.price;
      var pctChange  = (newAcs - data.ref) / data.ref;
      var newPrice   = Math.max(1, Math.round(data.price * (1 + pctChange)));

      data.history  = (data.history || [oldPrice]).slice();
      data.history.push(newPrice);
      data.price    = newPrice;
      data.ref      = newAcs;   /* 기준 ACS를 이 맵 ACS로 교체 */

      /* ── 반영된 맵들의 누적 ACS (표시용 평균 연동) ── */
      data.runTotal = (data.runTotal || 0) + newAcs;
      data.runCount = (data.runCount || 0) + 1;

      localStorage.setItem(key, JSON.stringify(data));

      var diff = newPrice - oldPrice;
      results.push({
        name:     name,
        oldPrice: oldPrice,
        newPrice: newPrice,
        acs:      newAcs,
        diff:     diff,
        pct:      (pctChange * 100).toFixed(1),
        sign:     diff > 0 ? '▲' : diff < 0 ? '▼' : '━',
      });
    });

    if (results.length === 0) {
      alert('반영할 ACS 데이터가 없습니다.\n선수 이름과 ACS가 모두 입력되어 있는지 확인해 주세요.');
      return;
    }

    /* ── 결과 알림 ── */
    var msg = '✅ 주식 반영 완료 (' + results.length + '명)\n\n';
    results.forEach(function (r) {
      msg += r.name + '  '
           + r.oldPrice + ' → ' + r.newPrice + ' 코인  '
           + r.sign + Math.abs(r.diff) + ' ('
           + (parseFloat(r.pct) > 0 ? '+' : '') + r.pct + '%)\n';
    });
    alert(msg);

    /* ── 버튼 "반영됨" 상태로 교체 ── */
    var card = document.getElementById('map-' + (mapIdx + 1));
    if (card) {
      var btn = card.querySelector('.stock-apply-btn');
      if (btn) {
        btn.classList.add('applied');
        btn.textContent = '✅ 반영됨';
        btn.disabled = true;
      }
    }
  };

  /* ── Admin 버튼을 각 맵 카드에 추가 ── */
  function renderStockButtons() {
    if (!window.vctIsAdmin || !window.vctIsAdmin()) return;

    for (var i = 1; i <= 5; i++) {
      var card = document.getElementById('map-' + i);
      if (!card || card.classList.contains('map-card-empty')) continue;
      if (card.querySelector('.admin-stock-row')) continue; /* 중복 방지 */

      var row   = document.createElement('div');
      row.className = 'admin-stock-row';

      var btn   = document.createElement('button');
      btn.className   = 'stock-apply-btn';
      btn.textContent = '📈 주식 반영하기';
      (function (idx) {
        btn.addEventListener('click', function () {
          if (!confirm('이 맵의 결과를 주식에 반영하시겠습니까?')) return;
          window.applyMapToStock(idx);
        });
      }(i - 1));

      row.appendChild(btn);
      card.appendChild(row);
    }
  }

  window.renderStockButtons = renderStockButtons;

  /* ── Admin 전용: 전체 stock_p: 데이터 리셋 ── */
  window.resetAllStock = function () {
    if (!window.vctIsAdmin || !window.vctIsAdmin()) {
      alert('관리자만 사용할 수 있습니다.'); return;
    }
    var keys = [];
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf('stock_p:') === 0) keys.push(k);
    }
    if (keys.length === 0) { alert('리셋할 주식 데이터가 없습니다.'); return; }
    if (!confirm('stock_p: 데이터 ' + keys.length + '개를 모두 삭제합니다.\n(가격이 평균 ACS 기준으로 초기화됩니다)\n계속하시겠습니까?')) return;
    keys.forEach(function (k) { localStorage.removeItem(k); });
    alert('✅ 리셋 완료 (' + keys.length + '명)');
  };

  /* ── 초기 실행 (DOMContentLoaded 이후 약간 대기: auth.js 로드 보장) ── */
  function tryRender() {
    renderStockButtons();
    /* maps 4-5가 나중에 추가될 때를 위해 initMapCard 패치 */
    if (typeof initMapCard === 'function' && !initMapCard._stockPatched) {
      var _orig = initMapCard;
      window.initMapCard = function (n) {
        _orig(n);
        renderStockButtons();
      };
      window.initMapCard._stockPatched = true;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(tryRender, 200); });
  } else {
    setTimeout(tryRender, 200);
  }
}());
