// ── Eden Crawl — content_webapp.js ──
// Vercel 웹앱 페이지에서 실행되는 브릿지 스크립트
// chrome.storage → window.postMessage → React 앱

const STORAGE_KEY = 'eden_threads_results';

console.log('[Eden Crawl] content_webapp.js 로드됨:', location.href);

// 1. 페이지 로드 시 이미 저장된 결과가 있으면 즉시 전달
chrome.storage.local.get(STORAGE_KEY, (data) => {
  if (data[STORAGE_KEY]) {
    console.log('[Eden Crawl] 기존 storage 데이터 발견 → postMessage 전송:', {
      keyword:   data[STORAGE_KEY].keyword,
      postCount: data[STORAGE_KEY].posts?.length,
    });
    window.postMessage({ type: 'EDEN_THREADS_RESULTS', payload: data[STORAGE_KEY] }, '*');
  } else {
    console.log('[Eden Crawl] storage 데이터 없음 (대기 중)');
  }
});

// 2. 새 수집 결과가 저장되면 실시간 전달
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[STORAGE_KEY]) {
    const payload = changes[STORAGE_KEY].newValue;
    console.log('[Eden Crawl] storage 변경 감지 → postMessage 전송:', {
      keyword:   payload?.keyword,
      postCount: payload?.posts?.length,
    });
    window.postMessage(
      { type: 'EDEN_THREADS_RESULTS', payload },
      '*'
    );
  }
});
