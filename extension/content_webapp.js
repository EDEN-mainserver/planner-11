// ── Eden Crawl — content_webapp.js ──
// Vercel 웹앱 페이지에서 실행되는 브릿지 스크립트
// chrome.storage → sessionStorage(백업) + window.postMessage → React 앱
// 웹앱 postMessage → chrome.runtime.sendMessage → background.js (크롤 실행)

const STORAGE_KEY = 'eden_threads_results';
const STATUS_KEY  = 'eden_crawl_status';
const SESSION_KEY = 'eden_threads_pending';

console.log('[Eden Crawl] content_webapp.js 로드됨:', location.href);

// ── 결과 브릿지: storage → postMessage → React ──
function bridge(payload) {
  if (!payload) return;
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload)); } catch (_) {}
  window.postMessage({ type: 'EDEN_THREADS_RESULTS', payload }, '*');
  console.log('[Eden Crawl] bridge 전송:', { keyword: payload.keyword, posts: payload.posts?.length });
}

// 1. 페이지 로드 시 이미 저장된 결과가 있으면 즉시 전달
chrome.storage.local.get(STORAGE_KEY, (data) => {
  if (data[STORAGE_KEY]) bridge(data[STORAGE_KEY]);
  else console.log('[Eden Crawl] storage 데이터 없음 (대기 중)');
});

// 2. storage 변경 감지 → 결과·진행상태 모두 브릿지
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  // 수집 결과 전달
  if (changes[STORAGE_KEY]) {
    bridge(changes[STORAGE_KEY].newValue);
  }
  // 진행 상태 전달 (웹앱 진행바 표시용)
  if (changes[STATUS_KEY]) {
    window.postMessage({ type: 'EDEN_CRAWL_STATUS', payload: changes[STATUS_KEY].newValue }, '*');
  }
  // 게시물 이미지 결과 전달
  if (changes['eden_post_images']) {
    window.postMessage({ type: 'EDEN_POST_IMAGES', payload: changes['eden_post_images'].newValue }, '*');
  }
  // 아이보스 본문 결과 전달
  if (changes['eden_iboss_content']) {
    window.postMessage({ type: 'EDEN_IBOSS_CONTENT', payload: changes['eden_iboss_content'].newValue }, '*');
  }
  // 아이보스 목록 결과 전달
  if (changes['eden_iboss_list']) {
    window.postMessage({ type: 'EDEN_IBOSS_LIST', payload: changes['eden_iboss_list'].newValue }, '*');
  }
});

// 3. 웹앱 → 백그라운드: 크롤 시작 요청 전달
// 웹앱이 postMessage({ type:'EDEN_START_CRAWL', keyword, count })를 보내면
// content script가 background.js로 전달 → 백그라운드에서 자동 수집 시작
window.addEventListener('message', (event) => {
  if (event.source !== window) return;
  const { type, keyword, count } = event.data || {};

  if (type === 'EDEN_GET_POST_IMAGES') {
    if (!event.data.postUrl) return;
    chrome.runtime.sendMessage({ type: 'EDEN_GET_POST_IMAGES', postUrl: event.data.postUrl }, () => {
      if (chrome.runtime.lastError) console.error('[Eden Crawl] 이미지 요청 실패:', chrome.runtime.lastError.message);
    });
    return;
  }

  if (type === 'EDEN_GET_IBOSS_LIST') {
    if (!event.data.month) return;
    chrome.runtime.sendMessage({ type: 'EDEN_GET_IBOSS_LIST', month: event.data.month }, () => {
      if (chrome.runtime.lastError) console.error('[Eden Crawl] 아이보스 목록 요청 실패:', chrome.runtime.lastError.message);
    });
    return;
  }

  if (type === 'EDEN_GET_IBOSS_CONTENT') {
    if (!event.data.sourceUrl) return;
    chrome.runtime.sendMessage({ type: 'EDEN_GET_IBOSS_CONTENT', sourceUrl: event.data.sourceUrl }, () => {
      if (chrome.runtime.lastError) console.error('[Eden Crawl] 아이보스 본문 요청 실패:', chrome.runtime.lastError.message);
    });
    return;
  }

  if (type === 'EDEN_STOP_CRAWL') {
    chrome.runtime.sendMessage({ type: 'EDEN_STOP_CRAWL' }, () => {
      if (chrome.runtime.lastError) console.error('[Eden Crawl] 중지 요청 실패:', chrome.runtime.lastError.message);
    });
    return;
  }

  if (type === 'EDEN_START_CRAWL') {
    if (!keyword) return;
    console.log('[Eden Crawl] 웹앱 수집 요청 수신 → background 전달:', keyword, count);
    chrome.runtime.sendMessage(
      { type: 'EDEN_START_CRAWL', keyword, count: count || 30 },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('[Eden Crawl] background 전달 실패:', chrome.runtime.lastError.message);
          // 에러를 웹앱에 전달
          window.postMessage({
            type: 'EDEN_CRAWL_STATUS',
            payload: { msg: '확장 프로그램 오류: ' + chrome.runtime.lastError.message, done: true, error: true }
          }, '*');
        } else {
          console.log('[Eden Crawl] background 수신 확인:', response);
        }
      }
    );
    return;
  }

  // 레거시: 팝업 키워드 pre-fill용 (팝업 열 때 자동 입력)
  if (type === 'EDEN_SEND_KEYWORD') {
    if (!keyword) return;
    chrome.storage.local.set({ eden_pending_keyword: keyword });
  }
});
