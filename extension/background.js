// ── Eden Crawl v2 — background.js (Service Worker) ──
// 웹앱 요청을 받아 팝업 없이 백그라운드에서 크롤 실행
// 진행 상태 → chrome.storage(eden_crawl_status) → content_webapp.js → 웹앱 UI

const RESULT_KEY = 'eden_threads_results';
const STATUS_KEY = 'eden_crawl_status';
const VERCEL_URL_KEY = 'eden_vercel_url';

let isCrawling = false; // 중복 실행 방지

// ── 상태 저장 (content_webapp.js가 감지해서 웹앱으로 브릿지) ──
function setStatus(msg, done = false, error = false) {
  console.log('[Eden Crawl BG] 상태:', msg);
  chrome.storage.local.set({ [STATUS_KEY]: { msg, done, error, ts: Date.now() } });
}

// ── 탭 로드 대기 ──
function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    const listener = (id, info) => {
      if (id === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 새 콘텐츠 로딩 대기 ──
// 스크롤 후 컨테이너 수가 prevCount보다 증가할 때까지 기다림
// Threads 배치 로딩 패턴 대응: 즉시 2개 → 로딩 → 쭉 나옴
async function waitForNewContent(tabId, prevContainerCount, timeout = 7000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await sleep(700);
    try {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.querySelectorAll('div[data-pressable-container="true"]').length,
      });
      if (r.result > prevContainerCount) {
        await sleep(600); // 배치 완전 로딩 여유
        return true;
      }
    } catch (_) {}
  }
  return false; // timeout
}

// ── 키워드 파싱 ──
// "AI마케팅:20, 숏폼:30" → [{keyword:"AI마케팅",count:20},...]
// "AI마케팅" → [{keyword:"AI마케팅",count:defaultCount}]
function parseKeywords(input, defaultCount) {
  const parts = input.split(',').map(s => s.trim()).filter(Boolean);
  return parts.map(part => {
    const colonIdx = part.lastIndexOf(':');
    if (colonIdx > 0) {
      const kw  = part.slice(0, colonIdx).trim();
      const cnt = parseInt(part.slice(colonIdx + 1).trim(), 10);
      if (kw && !isNaN(cnt)) {
        return { keyword: kw, count: Math.min(Math.max(cnt, 5), 100) };
      }
    }
    return { keyword: part, count: defaultCount };
  }).filter(item => item.keyword.length > 0);
}

// ──────────────────────────────────────────────────────────────
// 조회수 추출 (게시물 상세 페이지에서 실행)
// ⚠️ 외부 변수 참조 불가 — 완전히 독립적이어야 함
// ──────────────────────────────────────────────────────────────
function extractViewCount() {
  function parseCount(text) {
    if (!text) return 0;
    const t = text.trim().replace(/,/g, '');
    const m = t.match(/([\d.]+)(억|만|천)?/);
    if (!m) return 0;
    const n = parseFloat(m[1]);
    if (isNaN(n)) return 0;
    if (m[2] === '억') return Math.round(n * 100_000_000);
    if (m[2] === '만') return Math.round(n * 10_000);
    if (m[2] === '천') return Math.round(n * 1_000);
    return Math.round(n);
  }
  const spans = document.querySelectorAll('span');
  for (const span of spans) {
    if (span.textContent.includes('조회')) return parseCount(span.textContent);
  }
  return 0;
}

// ──────────────────────────────────────────────────────────────
// 1회 스크래핑 (탭 내 실행)
// ⚠️ 외부 변수 참조 불가 — 완전히 독립적이어야 함
// ──────────────────────────────────────────────────────────────
function scrapeOnce(seenUrlsArray) {
  function parseCount(text) {
    if (!text) return 0;
    const t = text.trim().replace(/,/g, '');
    const m = t.match(/([\d.]+)(억|만|천)?/);
    if (!m) return 0;
    const n = parseFloat(m[1]);
    if (isNaN(n)) return 0;
    if (m[2] === '억') return Math.round(n * 100_000_000);
    if (m[2] === '만') return Math.round(n * 10_000);
    if (m[2] === '천') return Math.round(n * 1_000);
    return Math.round(n);
  }
  function getCount(el, label) {
    const svg = el.querySelector(`svg[aria-label="${label}"]`);
    if (!svg) return 0;
    const sibling = svg.nextElementSibling;
    if (sibling) return parseCount(sibling.textContent);
    const btn = svg.closest('div[role="button"], button');
    if (btn) { const span = btn.querySelector('span'); if (span) return parseCount(span.textContent); }
    let node = svg.parentElement;
    for (let i = 0; i < 4 && node && node !== el; i++) {
      const span = node.querySelector('span.x1o0tod') || node.querySelector('span[class]');
      if (span) { const n = parseInt(span.textContent.replace(/[^0-9]/g, '')); if (!isNaN(n)) return n; }
      node = node.parentElement;
    }
    return 0;
  }
  const seenSet  = new Set(seenUrlsArray);
  const newPosts = [];
  const containers = document.querySelectorAll('div[data-pressable-container="true"]');
  containers.forEach((el) => {
    try {
      const authorEl = el.querySelector('a[href^="/@"]');
      if (!authorEl) return;
      const author = authorEl.getAttribute('href').replace(/^\//, '');
      const postLinkEl = el.querySelector('a[href*="/post/"]');
      const postUrl = postLinkEl ? 'https://www.threads.com' + postLinkEl.getAttribute('href') : '';
      if (postUrl && seenSet.has(postUrl)) return;
      const timeEl   = el.querySelector('time[datetime]');
      const datetime = timeEl?.getAttribute('datetime') || '';
      const timeText = timeEl?.textContent?.trim() || '';
      const paragraphs = new Set();
      el.querySelectorAll("div.xat24cr span[dir='auto'], span[dir='auto']").forEach((span) => {
        const t = span.textContent.trim();
        if (t && t.length > 4) paragraphs.add(t);
      });
      const content = [...paragraphs].join('\n');
      if (!content) return;
      newPosts.push({
        author:   '@' + author.replace(/^@/, ''),
        content, postUrl, datetime,
        time:     timeText || datetime.slice(0, 10),
        likes:    getCount(el, '좋아요'),
        comments: getCount(el, '답글'),
        shares:   getCount(el, '리포스트'),
      });
    } catch (_) {}
  });
  return { newPosts, debug: { containerCount: containers.length, url: location.href } };
}

// ──────────────────────────────────────────────────────────────
// 단일 키워드 크롤
// ──────────────────────────────────────────────────────────────
async function crawlSingleKeyword(keyword, targetCount, prefix) {
  let tab = null;
  const allPosts = [];
  const seenUrls = new Set();

  try {
    const url = `https://www.threads.com/search?q=${encodeURIComponent(keyword)}&serp_type=default`;
    tab = await chrome.tabs.create({ url, active: false });
    await waitForTabLoad(tab.id);
    // 초기 렌더링 대기 — 컨테이너가 나타날 때까지 기다림 (최대 10초)
    setStatus(`${prefix} 렌더링 대기 중...`);
    await waitForNewContent(tab.id, 0, 10000);

    let noNewCount = 0;
    const MAX_NO_NEW = 5;
    let lastDebug   = { url: '', containerCount: 0 };

    setStatus(`(0/${targetCount}) ${prefix} 수집 시작`);

    while (allPosts.length < targetCount && noNewCount < MAX_NO_NEW) {
      // 현재 컨테이너 수 기록 (스크롤 후 증가 감지용)
      const [countRes] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.querySelectorAll('div[data-pressable-container="true"]').length,
      });
      const prevContainerCount = countRes.result;

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func:   scrapeOnce,
        args:   [Array.from(seenUrls)],
      });
      const { newPosts, debug } = result.result;
      lastDebug = debug;

      if (debug.url.includes('/login') || debug.url.includes('accounts/login')) {
        setStatus('Threads 로그인이 필요합니다', true, true);
        break;
      }

      if (newPosts.length > 0) {
        newPosts.forEach(p => {
          if (allPosts.length >= targetCount) return;
          allPosts.push({ ...p, rank: allPosts.length + 1, keyword });
          if (p.postUrl) seenUrls.add(p.postUrl);
        });
        noNewCount = 0;
        setStatus(`(${allPosts.length}/${targetCount}) ${prefix} 수집 중`);
      } else {
        noNewCount++;
        setStatus(`(${allPosts.length}/${targetCount}) ${prefix} 로딩 대기 중... [${noNewCount}/${MAX_NO_NEW}]`);
      }

      if (allPosts.length < targetCount) {
        // 스크롤 후 새 콘텐츠 나타날 때까지 대기 (최대 7초)
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.scrollBy(0, 1000) });
        await waitForNewContent(tab.id, prevContainerCount, 7000);
      }
    }

    await chrome.tabs.remove(tab.id);
    tab = null;

    // 조회수 수집
    const postsWithUrl = allPosts.filter(p => p.postUrl);
    if (postsWithUrl.length > 0) {
      setStatus(`조회수 수집 중... (0/${postsWithUrl.length})`);
      let detailTab = null;
      try {
        detailTab = await chrome.tabs.create({ url: 'about:blank', active: false });
        for (let i = 0; i < postsWithUrl.length; i++) {
          const post = postsWithUrl[i];
          setStatus(`조회수 수집 중... (${i + 1}/${postsWithUrl.length})`);
          await chrome.tabs.update(detailTab.id, { url: post.postUrl });
          await waitForTabLoad(detailTab.id);
          await sleep(2500);
          try {
            const [res] = await chrome.scripting.executeScript({ target: { tabId: detailTab.id }, func: extractViewCount });
            post.views = res.result || 0;
          } catch (_) { post.views = 0; }
        }
      } finally {
        if (detailTab) await chrome.tabs.remove(detailTab.id).catch(() => {});
      }
    }

    return { posts: allPosts, lastDebug };
  } catch (err) {
    if (tab) await chrome.tabs.remove(tab.id).catch(() => {});
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// 메인 크롤 실행
// ──────────────────────────────────────────────────────────────
async function runCrawl(rawKeyword, defaultCount) {
  if (isCrawling) {
    setStatus('이미 수집이 진행 중입니다.', true, true);
    return;
  }
  isCrawling = true;

  try {
    const keywords = parseKeywords(rawKeyword, defaultCount);
    if (keywords.length === 0) return;

    const isMulti  = keywords.length > 1;
    const allPosts = [];

    for (let i = 0; i < keywords.length; i++) {
      const { keyword, count } = keywords[i];
      const prefix = isMulti ? `[${i + 1}/${keywords.length}] ${keyword}` : `"${keyword}"`;

      setStatus(`${prefix} 검색 탭 열기 중...`);
      const { posts, lastDebug } = await crawlSingleKeyword(keyword, count, prefix);

      if (posts.length === 0) {
        if (lastDebug.url.includes('/login') || lastDebug.url.includes('accounts/login')) {
          setStatus('Threads 로그인이 필요합니다. 브라우저에서 로그인해주세요.', true, true);
          return;
        }
        continue;
      }

      allPosts.push(...posts);
      if (isMulti) setStatus(`[${i + 1}/${keywords.length}] ${keyword} 완료 — ${posts.length}개 수집 (누적 ${allPosts.length}개)`);
    }

    if (allPosts.length === 0) {
      setStatus('게시물을 수집하지 못했습니다. Threads 로그인 후 재시도하세요.', true, true);
      return;
    }

    allPosts.forEach((p, i) => { p.rank = i + 1; });

    const combinedKeyword = keywords.map(k => k.keyword).join(', ');
    await chrome.storage.local.set({
      [RESULT_KEY]: { keyword: combinedKeyword, posts: allPosts, timestamp: Date.now() },
    });

    setStatus(`완료 — ${allPosts.length}개 수집됨`, true);
    console.log('[Eden Crawl BG] 수집 완료:', { combinedKeyword, total: allPosts.length });

  } catch (err) {
    setStatus(`오류: ${err.message}`, true, true);
    console.error('[Eden Crawl BG] 오류:', err);
  } finally {
    isCrawling = false;
  }
}

// ── 메시지 리스너 (content_webapp.js → background) ──
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[Eden Crawl BG] 메시지 수신:', message.type, message);

  if (message.type === 'EDEN_START_CRAWL') {
    const { keyword, count = 30 } = message;
    sendResponse({ ok: true, crawling: isCrawling });
    if (!isCrawling) {
      runCrawl(keyword, count).catch(err => {
        console.error('[Eden Crawl BG] runCrawl 오류:', err);
        setStatus(`오류: ${err.message}`, true, true);
      });
    }
    return false;
  }

  if (message.type === 'EDEN_CRAWL_STATUS_CHECK') {
    sendResponse({ crawling: isCrawling });
    return false;
  }
});

console.log('[Eden Crawl BG] background.js 로드 완료');
