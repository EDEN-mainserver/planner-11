// ── Eden Wing Bridge — content_wing_bridge.js ──
// wing.coupang.com에서 실행 (world: ISOLATED)
// MAIN world(content_wing.js)에서 발생한 이벤트를 chrome.storage로 저장

const WING_APIS_KEY = 'eden_wing_apis';
const WING_DATA_KEY = 'eden_wing_data';

// MAIN world에서 dispatch한 커스텀 이벤트 수신
window.addEventListener('__EDEN_WING_API_SEEN__', (e) => {
  const { url, path } = e.detail || {};
  if (!path) return;

  chrome.storage.local.get(WING_APIS_KEY, (stored) => {
    const apis = stored[WING_APIS_KEY] || {};
    if (!apis[path]) {
      apis[path] = { url, path, ts: Date.now() };
      chrome.storage.local.set({ [WING_APIS_KEY]: apis });
      console.log('[Eden Wing Bridge] API 발견:', path);
    }
  });
});

window.addEventListener('__EDEN_WING_DATA__', (e) => {
  const { url, path, data, ts } = e.detail || {};
  if (!data) return;

  chrome.storage.local.get(WING_DATA_KEY, (stored) => {
    const existing = stored[WING_DATA_KEY] || { data: {}, ts: 0 };
    existing.data[path] = { url, data, ts };
    existing.ts = Date.now();
    chrome.storage.local.set({ [WING_DATA_KEY]: existing });
    console.log('[Eden Wing Bridge] 데이터 캡처:', path, JSON.stringify(data).slice(0, 80));
  });
});

console.log('[Eden Wing Bridge] 브릿지 활성화 ✅');
