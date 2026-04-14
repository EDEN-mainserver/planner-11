// ── Eden Crawl — content_webapp.js ──
// Vercel 웹앱 페이지에서 실행되는 브릿지 스크립트
// chrome.storage → window.postMessage → React 앱

const STORAGE_KEY = 'eden_threads_results';

// 1. 페이지 로드 시 이미 저장된 결과가 있으면 즉시 전달
chrome.storage.local.get(STORAGE_KEY, (data) => {
  if (data[STORAGE_KEY]) {
    window.postMessage({ type: 'EDEN_THREADS_RESULTS', payload: data[STORAGE_KEY] }, '*');
  }
});

// 2. 새 수집 결과가 저장되면 실시간 전달
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    window.postMessage(
      { type: 'EDEN_THREADS_RESULTS', payload: changes[STORAGE_KEY].newValue },
      '*'
    );
  }
});
