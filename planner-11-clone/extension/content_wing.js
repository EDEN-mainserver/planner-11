// ── Eden Wing — content_wing.js ──
// wing.coupang.com 페이지에서 실행 (world: MAIN)
// Wing 내부 API를 fetch 인터셉트로 캡처 → background로 전달

(function () {
  if (window.__edenWingInjected) return;
  window.__edenWingInjected = true;

  // ── 관심 API 패턴 (주문/매출/정산/재고) ──
  const INTEREST_PATTERNS = [
    /order/i,
    /sale/i,
    /revenue/i,
    /settlement/i,
    /inventory/i,
    /stock/i,
    /profit/i,
    /statistics/i,
    /dashboard/i,
    /summary/i,
    /payment/i,
  ];

  function isInteresting(url) {
    return INTEREST_PATTERNS.some((p) => p.test(url));
  }

  // ── fetch 인터셉터 ──
  const _fetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await _fetch(...args);

    try {
      const rawUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      if (!rawUrl) return response;

      // Wing 도메인 또는 상대경로만 처리
      const isWing =
        rawUrl.includes('wing.coupang.com') || rawUrl.startsWith('/');
      if (!isWing) return response;

      const fullUrl = rawUrl.startsWith('/')
        ? 'https://wing.coupang.com' + rawUrl
        : rawUrl;
      const path = new URL(fullUrl).pathname;

      if (isInteresting(path)) {
        response
          .clone()
          .json()
          .then((data) => {
            window.dispatchEvent(
              new CustomEvent('__EDEN_WING_DATA__', {
                detail: { url: fullUrl, path, data, ts: Date.now() },
              })
            );
          })
          .catch(() => {});
      }

      // 모든 Wing API 경로 기록 (탐색용)
      window.dispatchEvent(
        new CustomEvent('__EDEN_WING_API_SEEN__', {
          detail: { url: fullUrl, path, ts: Date.now() },
        })
      );
    } catch (_) {}

    return response;
  };

  // ── XHR 인터셉터 ──
  const _XHROpen = XMLHttpRequest.prototype.open;
  const _XHRSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__edenUrl = url;
    this.__edenMethod = method;
    return _XHROpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener('load', function () {
      try {
        const rawUrl = this.__edenUrl || '';
        if (!rawUrl) return;

        const isWing =
          rawUrl.includes('wing.coupang.com') || rawUrl.startsWith('/');
        if (!isWing) return;

        const fullUrl = rawUrl.startsWith('/')
          ? 'https://wing.coupang.com' + rawUrl
          : rawUrl;
        const path = new URL(fullUrl).pathname;

        if (isInteresting(path)) {
          const data = JSON.parse(this.responseText);
          window.dispatchEvent(
            new CustomEvent('__EDEN_WING_DATA__', {
              detail: { url: fullUrl, path, data, ts: Date.now() },
            })
          );
        }

        window.dispatchEvent(
          new CustomEvent('__EDEN_WING_API_SEEN__', {
            detail: { url: fullUrl, path, ts: Date.now() },
          })
        );
      } catch (_) {}
    });
    return _XHRSend.call(this, ...args);
  };

  console.log('[Eden Wing] 인터셉터 활성화 ✅');
})();
