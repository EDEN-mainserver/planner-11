// ── Eden Crawl v2 — background.js (Service Worker) ──
// 웹앱 요청을 받아 팝업 없이 백그라운드에서 크롤 실행
// 진행 상태 → chrome.storage(eden_crawl_status) → content_webapp.js → 웹앱 UI

const RESULT_KEY = 'eden_threads_results';
const STATUS_KEY = 'eden_crawl_status';
const VERCEL_URL_KEY = 'eden_vercel_url';

let isCrawling    = false; // 중복 실행 방지 (Threads)
let stopRequested = false; // 중지 요청 플래그 (Threads)
let isXCrawling    = false; // 중복 실행 방지 (X)
let stopXRequested = false; // 중지 요청 플래그 (X)

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
// 쓰레드 표식 감지 (background 스코프 — 본문 텍스트에서 호출)
// "1/3", "2/5" 등 N/M 패턴 — 1≤N≤M, 2≤M≤10
// Threads UI의 자동 인디케이터("2/5" 다음 글 표시)도, 작성자가 손으로 쓴 "1/3"도 모두 잡음
// ──────────────────────────────────────────────────────────────
function detectThreadTotal(content) {
  if (!content) return 0;
  const re = /(?:^|[^\d])([1-9])\s*\/\s*(\d{1,2})(?=\s|$|[.!?,])/g;
  let m, best = 0;
  while ((m = re.exec(content)) !== null) {
    const cur = parseInt(m[1], 10);
    const total = parseInt(m[2], 10);
    if (total >= 2 && total <= 10 && cur <= total) best = Math.max(best, total);
  }
  return best;
}

// ──────────────────────────────────────────────────────────────
// 상세 페이지 정보 수집 — 조회수 + 쓰레드 연속글
// ⚠️ 외부 변수 참조 불가 — 완전히 독립적이어야 함
// 동일 작성자(handle) + 다른 postId 필터로 타인 댓글 자동 배제
// ──────────────────────────────────────────────────────────────
function extractDetailInfo(authorHandle, currentPostId, expectedThreadCount) {
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

  // ── 조회수 ──
  let views = 0;
  const spans = document.querySelectorAll('span');
  for (const span of spans) {
    if (span.textContent.includes('조회')) { views = parseCount(span.textContent); break; }
  }

  // ── 쓰레드 연속글 ──
  const threadParts = [];
  const seenPostIds = new Set();
  if (currentPostId) seenPostIds.add(currentPostId);

  const debugInfo = {
    wantHandle:        authorHandle ? String(authorHandle).replace(/^@/, '').toLowerCase() : '',
    currentPostId:     currentPostId || '',
    expectedTotal:     expectedThreadCount || 0,
    containerCount:    0,
    sampleHandles:     [],
    samePostIds:       [],
    otherAuthorCount:  0,
  };

  if (authorHandle && expectedThreadCount > 1) {
    const wantHandle = debugInfo.wantHandle;
    const containers = document.querySelectorAll('div[data-pressable-container="true"]');
    debugInfo.containerCount = containers.length;

    containers.forEach((el) => {
      // 작성자 핸들 추출 — /@name 또는 /@name/post/xxx 형태
      const authorEl = el.querySelector('a[href^="/@"]');
      if (!authorEl) return;
      const rawHref = authorEl.getAttribute('href') || '';
      const handle = rawHref.replace(/^\/@?/, '').split(/[/?#]/)[0].toLowerCase();
      if (debugInfo.sampleHandles.length < 10) debugInfo.sampleHandles.push(handle);

      if (handle !== wantHandle) { debugInfo.otherAuthorCount++; return; }

      // postId 추출 — 동일 작성자라도 postId가 다를 때만 쓰레드 연속글로 인정
      const postLinkEl = el.querySelector('a[href*="/post/"]');
      const postHref = postLinkEl ? postLinkEl.getAttribute('href') || '' : '';
      const postIdMatch = postHref.match(/\/post\/([^/?#]+)/);
      const postId = postIdMatch ? postIdMatch[1] : '';
      if (!postId) return;
      if (seenPostIds.has(postId)) return; // 원본 게시물 OR 중복 렌더링 스킵
      seenPostIds.add(postId);
      if (debugInfo.samePostIds.length < 10) debugInfo.samePostIds.push(postId);

      // 본문 텍스트
      const paragraphs = new Set();
      el.querySelectorAll("div.xat24cr span[dir='auto'], span[dir='auto']").forEach((span) => {
        const t = span.textContent.trim();
        if (t && t.length > 4) paragraphs.add(t);
      });
      const text = [...paragraphs].join('\n');
      if (!text) return;

      const timeEl = el.querySelector('time[datetime]');
      const datetime = timeEl?.getAttribute('datetime') || '';
      const postUrl = postHref ? 'https://www.threads.com' + postHref : '';

      threadParts.push({ text, datetime, postUrl, postId });
    });

    // 시간순 (오래된 게 part 2)
    threadParts.sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
    // expectedThreadCount-1 개로 자르기 (M 신뢰성 낮을 경우 대비, 최대 9개 보장)
    threadParts.length = Math.min(threadParts.length, Math.max(expectedThreadCount - 1, 0));
  }

  return {
    views,
    threadParts: threadParts.map(p => p.text),
    threadPartsMeta: threadParts.map(p => ({ postId: p.postId, datetime: p.datetime })),
    debugInfo,
  };
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
    if (sibling) { const v = parseCount(sibling.textContent); if (v > 0) return v; }
    const btn = svg.closest('div[role="button"], button');
    if (btn) { const span = btn.querySelector('span'); if (span) { const v = parseCount(span.textContent); if (v > 0) return v; } }
    let node = svg.parentElement;
    for (let i = 0; i < 6 && node; i++) {
      const span = node.querySelector('span.x1o0tod') || node.querySelector('span[class]');
      if (span) { const n = parseInt(span.textContent.replace(/[^0-9]/g, '')); if (!isNaN(n) && n > 0) return n; }
      node = node.parentElement;
    }
    return 0;
  }
  // 공유하기 카운트 추출 — pressable-container 외부까지 최대 10단계 탐색
  // 구조: svg[aria-label="공유하기"] → parentElement(flexBox) → span.x1o0tod
  function findShare(el) {
    let node = el;
    for (let i = 0; i < 10; i++) {
      if (!node) break;
      const svg = node.querySelector('svg[aria-label="공유하기"]');
      if (svg) {
        // 방법 1: SVG 부모 flex 컨테이너 내 span.x1o0tod 직접 쿼리
        const flexBox = svg.parentElement;
        if (flexBox) {
          const numSpan = flexBox.querySelector('span.x1o0tod');
          if (numSpan) return parseCount(numSpan.textContent);
        }
        // 방법 2: nextElementSibling textContent
        const sibling = svg.nextElementSibling;
        if (sibling) { const v = parseCount(sibling.textContent); if (v > 0) return v; }
        // 방법 3: role=button 컨테이너 내 모든 span 순회
        const btn = svg.closest('[role="button"]');
        if (btn) {
          for (const s of btn.querySelectorAll('span')) {
            const v = parseCount(s.textContent.trim());
            if (v > 0) return v;
          }
        }
        return 0;
      }
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
        shares:   findShare(el),
      });
    } catch (_) {}
  });
  return { newPosts, debug: { containerCount: containers.length, url: location.href } };
}

// ──────────────────────────────────────────────────────────────
// 탭 포커스 → 클릭 → 원래 탭 복귀 (로딩 정체 해소용)
// ──────────────────────────────────────────────────────────────
async function activateAndClick(tabId, returnTabId) {
  try {
    await chrome.tabs.update(tabId, { active: true });
    await sleep(300);
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    });
    await sleep(300);
    if (returnTabId) await chrome.tabs.update(returnTabId, { active: true }).catch(() => {});
  } catch (_) {}
}

// ──────────────────────────────────────────────────────────────
// 단일 키워드 크롤
// ──────────────────────────────────────────────────────────────
async function crawlSingleKeyword(keyword, targetCount, prefix) {
  let tab = null;
  const allPosts = [];
  const seenUrls = new Set();

  try {
    // 현재 활성 탭 기억 — 크롤 후 웹앱으로 복귀
    const [originTab] = await chrome.tabs.query({ active: true, currentWindow: true });

    const url = `https://www.threads.com/search?q=${encodeURIComponent(keyword)}&serp_type=default`;
    // active: true로 열어 Threads가 포커스를 받아 콘텐츠를 즉시 로딩
    tab = await chrome.tabs.create({ url, active: true });
    await waitForTabLoad(tab.id);

    // 초기 렌더링 대기 — body 클릭으로 로딩 유도
    setStatus(`${prefix} 렌더링 대기 중...`);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    });

    // 바로 웹앱 탭으로 복귀
    if (originTab?.id) {
      await chrome.tabs.update(originTab.id, { active: true }).catch(() => {});
    }

    await waitForNewContent(tab.id, 0, 10000);

    let noNewCount = 0;
    const MAX_NO_NEW = 5;
    let lastDebug   = { url: '', containerCount: 0 };

    setStatus(`(0/${targetCount}) ${prefix} 수집 시작`);

    while (allPosts.length < targetCount && noNewCount < MAX_NO_NEW && !stopRequested) {
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
        // 새 게시물이 없을 때마다 탭 포커스 → 클릭 → 복귀로 Threads 로딩 유도
        await activateAndClick(tab.id, originTab?.id);
      }

      if (allPosts.length < targetCount) {
        // 스크롤 후 새 콘텐츠 나타날 때까지 대기 (최대 7초)
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.scrollBy(0, 1000) });
        await waitForNewContent(tab.id, prevContainerCount, 7000);
      }
    }

    await chrome.tabs.remove(tab.id);
    tab = null;

    // 상세 페이지 수집 — 조회수 + 쓰레드 연속글(중지 요청 시 건너뜀)
    const postsWithUrl = allPosts.filter(p => p.postUrl);
    if (postsWithUrl.length > 0 && !stopRequested) {
      setStatus(`상세 수집 중... (0/${postsWithUrl.length})`);
      let detailTab = null;
      try {
        detailTab = await chrome.tabs.create({ url: 'about:blank', active: false });
        for (let i = 0; i < postsWithUrl.length; i++) {
          if (stopRequested) break;
          const post = postsWithUrl[i];
          const threadTotal = detectThreadTotal(post.content);
          const postIdMatch = (post.postUrl || '').match(/\/post\/([^/?#]+)/);
          const currentPostId = postIdMatch ? postIdMatch[1] : '';
          const label = threadTotal > 1 ? `쓰레드(${threadTotal}편)` : '조회수';
          setStatus(`${label} 수집 중... (${i + 1}/${postsWithUrl.length})`);

          await chrome.tabs.update(detailTab.id, { url: post.postUrl });
          await waitForTabLoad(detailTab.id);
          // body 클릭으로 로딩 유도
          await chrome.scripting.executeScript({
            target: { tabId: detailTab.id },
            func: () => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })),
          }).catch(() => {});
          await sleep(2500);

          // 쓰레드면 답글/연속글 lazy-load 트리거 — 추가 스크롤
          if (threadTotal > 1) {
            await chrome.scripting.executeScript({
              target: { tabId: detailTab.id },
              func: () => window.scrollBy(0, 1500),
            }).catch(() => {});
            await sleep(1500);
          }

          try {
            const [res] = await chrome.scripting.executeScript({
              target: { tabId: detailTab.id },
              func:   extractDetailInfo,
              args:   [post.author, currentPostId, threadTotal],
            });
            const { views = 0, threadParts = [], threadPartsMeta = [], debugInfo = {} } = res.result || {};
            post.views = views;
            if (threadTotal > 1) {
              console.log(`[Eden Crawl BG] 쓰레드 시도: ${post.author} (${threadTotal}편)`, {
                url:            post.postUrl,
                currentPostId,
                wantHandle:     debugInfo.wantHandle,
                containerCount: debugInfo.containerCount,
                sampleHandles:  debugInfo.sampleHandles,
                otherAuthor:    debugInfo.otherAuthorCount,
                collectedIds:   debugInfo.samePostIds,
                collected:      threadParts.length,
              });
            }
            if (threadTotal > 1 && threadParts.length > 0) {
              post.threadTotal = threadTotal;
              post.threadParts = threadParts;
              post.threadPartsMeta = threadPartsMeta;
            }
          } catch (e) {
            console.warn('[Eden Crawl BG] 상세 수집 실패:', e?.message);
            post.views = 0;
          }
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
  isCrawling    = true;
  stopRequested = false; // 새 수집 시 중지 플래그 초기화

  try {
    const keywords = parseKeywords(rawKeyword, defaultCount);
    if (keywords.length === 0) return;

    const isMulti  = keywords.length > 1;
    const allPosts = [];

    for (let i = 0; i < keywords.length; i++) {
      if (stopRequested) break;

      const { keyword, count } = keywords[i];
      const prefix = isMulti ? `[${i + 1}/${keywords.length}] ${keyword}` : `"${keyword}"`;

      setStatus(`${prefix} 검색 탭 열기 중...`);
      const { posts, lastDebug } = await crawlSingleKeyword(keyword, count, prefix);

      if (posts.length === 0 && !stopRequested) {
        if (lastDebug.url.includes('/login') || lastDebug.url.includes('accounts/login')) {
          setStatus('Threads 로그인이 필요합니다. 브라우저에서 로그인해주세요.', true, true);
          return;
        }
        continue;
      }

      allPosts.push(...posts);
      if (isMulti && !stopRequested) setStatus(`[${i + 1}/${keywords.length}] ${keyword} 완료 — ${posts.length}개 수집 (누적 ${allPosts.length}개)`);
    }

    // 중지됐거나 정상 완료 — 수집된 데이터가 있으면 저장
    if (allPosts.length === 0) {
      if (stopRequested) {
        setStatus('수집이 중지됐습니다. (수집된 게시물 없음)', true);
      } else {
        setStatus('게시물을 수집하지 못했습니다. Threads 로그인 후 재시도하세요.', true, true);
      }
      return;
    }

    allPosts.forEach((p, i) => { p.rank = i + 1; });

    const combinedKeyword = keywords.map(k => k.keyword).join(', ');
    await chrome.storage.local.set({
      [RESULT_KEY]: { keyword: combinedKeyword, posts: allPosts, timestamp: Date.now() },
    });

    if (stopRequested) {
      setStatus(`중지됨 — ${allPosts.length}개 수집됨`, true);
      console.log('[Eden Crawl BG] 수집 중지:', { combinedKeyword, total: allPosts.length });
    } else {
      setStatus(`완료 — ${allPosts.length}개 수집됨`, true);
      console.log('[Eden Crawl BG] 수집 완료:', { combinedKeyword, total: allPosts.length });
    }

  } catch (err) {
    setStatus(`오류: ${err.message}`, true, true);
    console.error('[Eden Crawl BG] 오류:', err);
  } finally {
    isCrawling    = false;
    stopRequested = false;
  }
}

// ──────────────────────────────────────────────────────────────
// X(트위터) 상태 저장
// ──────────────────────────────────────────────────────────────
function setXStatus(msg, done = false, error = false) {
  console.log('[Eden Crawl BG] X 상태:', msg);
  chrome.storage.local.set({ eden_x_status: { msg, done, error, ts: Date.now() } });
}

// ── X 새 콘텐츠 로딩 대기 ──
async function waitForXContent(tabId, prevCount, timeout = 7000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await sleep(700);
    try {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => document.querySelectorAll('article[data-testid="tweet"]').length,
      });
      if (r.result > prevCount) { await sleep(500); return true; }
    } catch (_) {}
  }
  return false;
}

// ──────────────────────────────────────────────────────────────
// X 1회 스크래핑 (탭 내 실행)
// ⚠️ 외부 변수 참조 불가 — 완전히 독립적이어야 함
// ──────────────────────────────────────────────────────────────
function scrapeXOnce(seenUrlsArray) {
  function parseCount(text) {
    if (!text) return 0;
    const t = text.trim().replace(/,/g, '');
    const m = t.match(/([\d.]+)(K|M|B)?/i);
    if (!m) return 0;
    const n = parseFloat(m[1]);
    if (isNaN(n)) return 0;
    const u = (m[2] || '').toUpperCase();
    if (u === 'K') return Math.round(n * 1_000);
    if (u === 'M') return Math.round(n * 1_000_000);
    if (u === 'B') return Math.round(n * 1_000_000_000);
    return Math.round(n);
  }

  const seenSet  = new Set(seenUrlsArray);
  const newPosts = [];
  const articles = document.querySelectorAll('article[data-testid="tweet"]');

  articles.forEach(article => {
    try {
      const linkEl = article.querySelector('a[href*="/status/"]');
      if (!linkEl) return;
      const path = linkEl.getAttribute('href') || '';
      const postUrl = path.startsWith('http') ? path : 'https://x.com' + path;
      if (seenSet.has(postUrl)) return;

      const userNameEl = article.querySelector('[data-testid="User-Name"]');
      let author = '';
      if (userNameEl) {
        const handleLink = userNameEl.querySelector('a[role="link"]');
        author = handleLink ? handleLink.getAttribute('href').replace('/', '@') : '';
      }

      const textEl  = article.querySelector('[data-testid="tweetText"]');
      const content = textEl ? textEl.innerText.trim() : '';
      if (!content) return;

      const timeEl   = article.querySelector('time[datetime]');
      const datetime = timeEl?.getAttribute('datetime') || '';
      const timeText = timeEl?.textContent?.trim() || '';

      function getCount(testId) {
        const btn = article.querySelector(`[data-testid="${testId}"]`);
        if (!btn) return 0;
        for (const span of btn.querySelectorAll('span')) {
          const v = parseCount(span.textContent);
          if (v > 0) return v;
        }
        return 0;
      }

      // 조회수: analytics 링크 내 app-text-transition-container
      // 구조: <a href="*/analytics"> ... <span data-testid="app-text-transition-container">1.1K</span>
      function getViews() {
        // Method 1: analytics 링크
        const analyticsA = article.querySelector('a[href*="/analytics"]');
        if (analyticsA) {
          const c = analyticsA.querySelector('[data-testid="app-text-transition-container"]');
          if (c) return parseCount(c.textContent);
        }
        // Method 2: aria-label에 "Views" 포함
        for (const el of article.querySelectorAll('[aria-label]')) {
          const label = el.getAttribute('aria-label') || '';
          if (/views/i.test(label)) {
            const c = el.querySelector('[data-testid="app-text-transition-container"]');
            if (c) return parseCount(c.textContent);
            const m = label.match(/([\d,\.]+[KMBkmb]?)\s*[Vv]iew/);
            if (m) return parseCount(m[1]);
          }
        }
        return 0;
      }

      newPosts.push({
        author, content, postUrl, datetime,
        time:     timeText || datetime.slice(0, 10),
        likes:    getCount('like'),
        comments: getCount('reply'),
        shares:   getCount('retweet'),
        views:    getViews(),
      });
    } catch (_) {}
  });

  return { newPosts, debug: { articleCount: articles.length, url: location.href } };
}

// ──────────────────────────────────────────────────────────────
// X 크롤 메인 함수
// ──────────────────────────────────────────────────────────────
async function crawlX(rawKeyword, targetCount) {
  if (isXCrawling) {
    setXStatus('이미 X 수집이 진행 중입니다.', true, true);
    return;
  }
  isXCrawling    = true;
  stopXRequested = false;

  let tab = null;
  const allPosts = [];
  const seenUrls = new Set();

  try {
    const [originTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(rawKeyword)}&src=typed_query`;
    tab = await chrome.tabs.create({ url: searchUrl, active: true });
    await waitForTabLoad(tab.id);

    setXStatus(`렌더링 대기 중...`);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    });

    if (originTab?.id) {
      await chrome.tabs.update(originTab.id, { active: true }).catch(() => {});
    }

    await waitForXContent(tab.id, 0, 10000);

    let noNewCount = 0;
    const MAX_NO_NEW = 5;
    setXStatus(`(0/${targetCount}) "${rawKeyword}" 수집 시작`);

    while (allPosts.length < targetCount && noNewCount < MAX_NO_NEW && !stopXRequested) {
      const [countRes] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => document.querySelectorAll('article[data-testid="tweet"]').length,
      });
      const prevCount = countRes.result;

      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func:   scrapeXOnce,
        args:   [Array.from(seenUrls)],
      });
      const { newPosts, debug } = result.result;

      if (debug.url.includes('/login') || debug.url.includes('i/flow/login')) {
        setXStatus('X 로그인이 필요합니다', true, true);
        break;
      }

      if (newPosts.length > 0) {
        newPosts.forEach(p => {
          if (allPosts.length >= targetCount) return;
          allPosts.push({ ...p, rank: allPosts.length + 1, keyword: rawKeyword });
          if (p.postUrl) seenUrls.add(p.postUrl);
        });
        noNewCount = 0;
        setXStatus(`(${allPosts.length}/${targetCount}) "${rawKeyword}" 수집 중`);
      } else {
        noNewCount++;
        setXStatus(`(${allPosts.length}/${targetCount}) 로딩 대기 중... [${noNewCount}/${MAX_NO_NEW}]`);
        await activateAndClick(tab.id, originTab?.id);
      }

      if (allPosts.length < targetCount) {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.scrollBy(0, 1200) });
        await waitForXContent(tab.id, prevCount, 7000);
      }
    }

    await chrome.tabs.remove(tab.id);
    tab = null;

    if (allPosts.length === 0) {
      setXStatus(
        stopXRequested
          ? 'X 수집이 중지됐습니다. (수집된 트윗 없음)'
          : '트윗을 수집하지 못했습니다. X.com 로그인 후 재시도하세요.',
        true, !stopXRequested
      );
      return;
    }

    allPosts.forEach((p, i) => { p.rank = i + 1; });
    await chrome.storage.local.set({
      eden_x_results: { keyword: rawKeyword, posts: allPosts, timestamp: Date.now() },
    });

    setXStatus(
      stopXRequested
        ? `중지됨 — ${allPosts.length}개 트윗 수집됨`
        : `완료 — ${allPosts.length}개 트윗 수집됨`,
      true
    );
    console.log('[Eden Crawl BG] X 수집 완료:', { rawKeyword, total: allPosts.length });

  } catch (err) {
    if (tab) await chrome.tabs.remove(tab.id).catch(() => {});
    setXStatus(`오류: ${err.message}`, true, true);
    console.error('[Eden Crawl BG] X 오류:', err);
  } finally {
    isXCrawling    = false;
    stopXRequested = false;
  }
}

// ──────────────────────────────────────────────────────────────
// 게시물 이미지 수집
// ──────────────────────────────────────────────────────────────
async function fetchPostImages(postUrl) {
  let tab = null;
  try {
    tab = await chrome.tabs.create({ url: postUrl, active: false });
    await waitForTabLoad(tab.id);
    await sleep(2500);
    // body 클릭으로 렌더링 유도
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    }).catch(() => {});
    await sleep(1000);

    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const seen = new Set();
        const urls = [];
        document.querySelectorAll('img').forEach(img => {
          const src = img.src || img.getAttribute('src') || '';
          if (!src || seen.has(src)) return;
          // Threads/Instagram CDN 이미지만 수집, 아이콘/UI 이미지 제외
          if ((src.includes('cdninstagram') || src.includes('fbcdn')) &&
              (img.naturalWidth > 150 || img.width > 150 || parseInt(img.getAttribute('width')) > 150)) {
            seen.add(src);
            urls.push(src);
          }
        });
        return urls;
      },
    });

    await chrome.tabs.remove(tab.id);
    tab = null;
    return result?.result || [];
  } catch (err) {
    if (tab) await chrome.tabs.remove(tab.id).catch(() => {});
    console.error('[Eden Crawl BG] 이미지 수집 오류:', err);
    return [];
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

  if (message.type === 'EDEN_STOP_CRAWL') {
    if (isCrawling) {
      stopRequested = true;
      setStatus('중지 요청됨... 현재 단계 완료 후 중지합니다.');
      console.log('[Eden Crawl BG] 수집 중지 요청');
    }
    sendResponse({ ok: true });
    return false;
  }

  // ── 아이보스 인기글 목록 크롤 ──
  if (message.type === 'EDEN_GET_IBOSS_LIST') {
    const { month } = message;
    sendResponse({ ok: true });
    (async () => {
      let tab = null;
      try {
        const listUrl = `https://www.i-boss.co.kr/ab-1886?month=${month}`;
        tab = await chrome.tabs.create({ url: listUrl, active: false });
        await sleep(4000);

        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            function parseCount(text) {
              if (!text) return 0;
              const t = text.trim().replace(/,/g, '');
              const m = t.match(/([\d.]+)/);
              return m ? parseInt(m[1]) || 0 : 0;
            }
            const posts = [];
            const rows = document.querySelectorAll('tr.is_notice_');
            rows.forEach((row, i) => {
              try {
                const rankEl  = row.querySelector('.snum');
                const rank    = rankEl ? parseInt(rankEl.textContent.trim()) || (i + 1) : (i + 1);
                const linkEl  = row.querySelector('a[href][title]');
                if (!linkEl) return;
                const title   = linkEl.getAttribute('title') || linkEl.textContent.trim();
                const href    = linkEl.getAttribute('href') || '';
                const sourceUrl = href.startsWith('http') ? href : 'https://www.i-boss.co.kr' + href;
                const commEl  = row.querySelector('.AB-comm');
                const comments = commEl ? parseCount(commEl.textContent) : 0;
                const writerEl = row.querySelector('.mb_writer');
                const author  = writerEl ? writerEl.textContent.trim() : '';
                const tds = Array.from(row.querySelectorAll('td')).map(td => td.textContent.trim());
                const createdAt = tds[3] || '';
                const likes  = parseCount(tds[4] || '0');
                const views  = parseCount(tds[5] || '0');
                posts.push({ rank, title, author, views, likes, comments, source_url: sourceUrl, created_at: createdAt, platform: 'iboss' });
              } catch (_) {}
            });
            return { posts, pageUrl: location.href };
          },
        });

        await chrome.tabs.remove(tab.id);
        tab = null;
        const { posts = [], pageUrl = '' } = result?.result || {};
        console.log('[Eden Crawl BG] 아이보스 목록:', { count: posts.length, pageUrl, month });
        chrome.storage.local.set({ eden_iboss_list: { month, posts, ts: Date.now() } });
      } catch (err) {
        if (tab) await chrome.tabs.remove(tab.id).catch(() => {});
        console.error('[Eden Crawl BG] 아이보스 목록 오류:', err.message);
        chrome.storage.local.set({ eden_iboss_list: { month, posts: [], error: err.message, ts: Date.now() } });
      }
    })();
    return false;
  }

  // ── 아이보스 본문 추출 (브라우저 세션 활용) ──
  if (message.type === 'EDEN_GET_IBOSS_CONTENT') {
    const { sourceUrl } = message;
    sendResponse({ ok: true });
    (async () => {
      let tab = null;
      try {
        tab = await chrome.tabs.create({ url: sourceUrl, active: false });
        // waitForTabLoad 대신 고정 대기 — onUpdated 무한 대기 방지
        await sleep(4000);

        const [result] = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // 본문 영역 탐색
            const SELECTORS = [
              '.ABA-view-body', '.ABA-article-contents',
              '[class*="ABA-view"]', '.fr-view', '.fr-element',
              '#article_content', '#bo_v_con',
            ];
            let el = null;
            for (const sel of SELECTORS) {
              try {
                const found = document.querySelector(sel);
                if (found && (found.innerText || '').trim().length > 10) { el = found; break; }
              } catch (_) {}
            }
            if (!el) return { content: '', imageUrls: [], url: location.href };

            // 텍스트 추출
            const content = (el.innerText || '').replace(/\n{3,}/g, '\n\n').trim();

            // 이미지 URL만 추출 (fetch 없이 — CORS 적용되므로)
            const imageUrls = [];
            el.querySelectorAll('img[src]').forEach(img => {
              const src = img.getAttribute('src') || '';
              if (src && !imageUrls.includes(src)) imageUrls.push(src);
            });

            return { content, imageUrls: imageUrls.slice(0, 6), url: location.href };
          },
        });

        await chrome.tabs.remove(tab.id);
        tab = null;
        const { content = '', imageUrls = [], url: pageUrl = '' } = result?.result || {};

        // ── background 서비스워커에서 이미지 fetch (host_permissions → CORS 우회) ──
        const images = [];
        for (const imgUrl of imageUrls) {
          try {
            const resp = await fetch(imgUrl);
            if (!resp.ok) continue;
            const buffer = await resp.arrayBuffer();
            const uint8  = new Uint8Array(buffer);
            let binary   = '';
            uint8.forEach(b => { binary += String.fromCharCode(b); });
            const base64 = btoa(binary);
            const mime   = /\.png(\?|$)/i.test(imgUrl)  ? 'image/png'  :
                           /\.gif(\?|$)/i.test(imgUrl)  ? 'image/gif'  :
                           /\.webp(\?|$)/i.test(imgUrl) ? 'image/webp' : 'image/jpeg';
            images.push(`data:${mime};base64,${base64}`);
          } catch (e) {
            console.warn('[Eden Crawl BG] 이미지 fetch 실패:', imgUrl, e.message);
          }
        }

        console.log('[Eden Crawl BG] 아이보스 본문:', { len: content.length, images: images.length, pageUrl });
        chrome.storage.local.set({ eden_iboss_content: { sourceUrl, content, images, ts: Date.now() } });
      } catch (err) {
        if (tab) await chrome.tabs.remove(tab.id).catch(() => {});
        console.error('[Eden Crawl BG] 아이보스 본문 오류:', err.message);
        chrome.storage.local.set({ eden_iboss_content: { sourceUrl, content: '', error: err.message, ts: Date.now() } });
      }
    })();
    return false;
  }

  // ── X 수집 시작 ──
  if (message.type === 'EDEN_START_X_CRAWL') {
    const { keyword, count = 30 } = message;
    sendResponse({ ok: true, crawling: isXCrawling });
    if (!isXCrawling) {
      crawlX(keyword, count).catch(err => {
        console.error('[Eden Crawl BG] crawlX 오류:', err);
        setXStatus(`오류: ${err.message}`, true, true);
      });
    }
    return false;
  }

  // ── X 수집 중지 ──
  if (message.type === 'EDEN_STOP_X_CRAWL') {
    if (isXCrawling) {
      stopXRequested = true;
      setXStatus('X 중지 요청됨... 현재 단계 완료 후 중지합니다.');
      console.log('[Eden Crawl BG] X 수집 중지 요청');
    }
    sendResponse({ ok: true });
    return false;
  }

  if (message.type === 'EDEN_GET_POST_IMAGES') {
    const { postUrl } = message;
    sendResponse({ ok: true });
    fetchPostImages(postUrl).then(urls => {
      chrome.storage.local.set({ eden_post_images: { postUrl, urls, ts: Date.now() } });
    });
    return false;
  }

  // ── Wing 데이터 수집 ──
  if (message.type === 'EDEN_WING_FETCH') {
    sendResponse({ ok: true });
    runWingFetch(message.targets || []).catch(err => {
      console.error('[Eden Wing BG] 오류:', err);
      setWingStatus(`오류: ${err.message}`, true, true);
    });
    return false;
  }

  // ── LinkedIn 수집 시작 ──
  if (message.type === 'EDEN_START_LINKEDIN_CRAWL') {
    const { keyword, count = 20 } = message;
    sendResponse({ ok: true, crawling: isLinkedInCrawling });
    if (!isLinkedInCrawling) {
      runLinkedInCrawl(keyword, count).catch(err => {
        console.error('[Eden Crawl BG] LinkedIn 오류:', err);
        setLinkedInStatus(`오류: ${err.message}`, true, true);
      });
    }
    return false;
  }

  // ── LinkedIn 수집 중지 ──
  if (message.type === 'EDEN_STOP_LINKEDIN_CRAWL') {
    if (isLinkedInCrawling) {
      linkedInStopRequested = true;
      setLinkedInStatus('LinkedIn 중지 요청됨... 현재 단계 완료 후 중지합니다.');
      console.log('[Eden Crawl BG] LinkedIn 수집 중지 요청');
    }
    sendResponse({ ok: true });
    return false;
  }
});

// ══════════════════════════════════════════════════════════════
// LinkedIn 크롤링 모듈
// ══════════════════════════════════════════════════════════════

const LINKEDIN_RESULT_KEY = 'eden_linkedin_results';
const LINKEDIN_STATUS_KEY = 'eden_linkedin_status';

let isLinkedInCrawling    = false;
let linkedInStopRequested = false;

function setLinkedInStatus(msg, done = false, error = false) {
  console.log('[Eden Crawl BG] LinkedIn 상태:', msg);
  chrome.storage.local.set({ [LINKEDIN_STATUS_KEY]: { msg, done, error, ts: Date.now() } });
}

// ── LinkedIn 콘텐츠 로딩 대기 ──
async function waitForLinkedInContent(tabId, prevCount, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    await sleep(800);
    try {
      const [r] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const candidates = [
            'div[data-urn*="activity:"]',
            'li.reusable-search__result-container',
            '.scaffold-finite-scroll__content > div > ul > li',
          ];
          for (const sel of candidates) {
            const n = document.querySelectorAll(sel).length;
            if (n > 0) return n;
          }
          return 0;
        },
      });
      if (r.result > prevCount) {
        await sleep(600);
        return true;
      }
    } catch (_) {}
  }
  return false;
}

// ──────────────────────────────────────────────────────────────
// LinkedIn 1회 스크래핑 (탭 내 실행 — 완전히 독립적이어야 함)
// ──────────────────────────────────────────────────────────────
function scrapeLinkedIn(seenUrlsArray) {
  function parseCount(text) {
    if (!text) return 0;
    const t = text.trim().replace(/,/g, '');
    const m = t.match(/([\d.]+)\s*(억|만|천|K|M|B)?/i);
    if (!m) return 0;
    const n = parseFloat(m[1]);
    if (isNaN(n)) return 0;
    const sfx = (m[2] || '').toLowerCase();
    if (sfx === '억') return Math.round(n * 100_000_000);
    if (sfx === '만') return Math.round(n * 10_000);
    if (sfx === '천' || sfx === 'k') return Math.round(n * 1_000);
    if (sfx === 'm') return Math.round(n * 1_000_000);
    if (sfx === 'b') return Math.round(n * 1_000_000_000);
    return Math.round(n);
  }

  function getFirstText(el, selectors) {
    for (const sel of selectors) {
      try {
        const found = el.querySelector(sel);
        if (found) {
          const t = (found.innerText || found.textContent || '').trim();
          if (t) return t;
        }
      } catch (_) {}
    }
    return '';
  }

  const seenSet  = new Set(seenUrlsArray);
  const newPosts = [];

  // 컨테이너 탐색
  let containers = [];
  const containerCandidates = [
    'div[data-urn*="activity:"]',
    'li.reusable-search__result-container',
    '.scaffold-finite-scroll__content > div > ul > li',
  ];
  for (const sel of containerCandidates) {
    const found = document.querySelectorAll(sel);
    if (found.length > 0) { containers = Array.from(found); break; }
  }

  containers.forEach(el => {
    try {
      // ── 작성자 이름 ──
      const author = getFirstText(el, [
        '.update-components-actor__name span[aria-hidden="true"]',
        '.feed-shared-actor__name span[aria-hidden="true"]',
        '.update-components-actor__title span[aria-hidden="true"]',
        '[data-test-app-aware-link] span[aria-hidden="true"]',
        '.entity-result__title-text a span[aria-hidden="true"]',
        '.update-components-actor__name',
      ]);
      if (!author) return;

      // ── 프로필 URL ──
      let profileUrl = '';
      for (const sel of [
        'a[href*="/in/"]:not([href*="search"]):not([href*="miniProfile"])',
        'a[href*="/company/"]:not([href*="search"])',
        '.update-components-actor__meta a',
        '.feed-shared-actor__container-link',
      ]) {
        try {
          const a = el.querySelector(sel);
          if (a?.href) { profileUrl = a.href.split('?')[0]; break; }
        } catch (_) {}
      }

      // ── 게시물 URL ──
      let postUrl = '';
      for (const sel of [
        'a[href*="/posts/"]',
        'a[href*="/feed/update/"]',
        'a[href*="ugcPost"]',
        'a[href*="activity-"]',
        'time a',
      ]) {
        try {
          const a = el.querySelector(sel);
          if (a?.href) { postUrl = a.href.split('?')[0]; break; }
        } catch (_) {}
      }
      if (postUrl && seenSet.has(postUrl)) return;

      // ── 게시물 내용 ──
      const content = getFirstText(el, [
        '.update-components-text span[dir]',
        '.feed-shared-text__text-view span[dir]',
        '.feed-shared-text span[dir]',
        '.update-components-text .update-components-text__text-view',
        '[data-test-id="main-feed-activity-card__commentary"] span',
        '.update-components-text',
      ]);
      if (!content) return;

      // ── 날짜 ──
      const timeEl = el.querySelector('time, .update-components-actor__sub-description span:last-child');
      const datetime = timeEl?.getAttribute('datetime') || '';
      const timeText = timeEl?.textContent?.trim() || '';

      // ── 반응수 ──
      let likes = 0;
      const likesText = getFirstText(el, [
        '.social-details-social-counts__reactions-count',
        '.social-details-social-counts__count-value:first-child',
      ]);
      if (likesText) { likes = parseCount(likesText); }
      if (!likes) {
        el.querySelectorAll('button[aria-label]').forEach(btn => {
          const label = btn.getAttribute('aria-label') || '';
          if (/reaction|like|좋아요|응원|추천|공감/i.test(label)) {
            const match = label.match(/([\d,]+)/);
            if (match) likes = Math.max(likes, parseCount(match[1]));
          }
        });
      }

      // ── 댓글수 ──
      let comments = 0;
      const commentsText = getFirstText(el, [
        '.social-details-social-counts__comments a',
        'button[aria-label*="comment"] span:not(.visually-hidden)',
      ]);
      if (commentsText) { comments = parseCount(commentsText); }
      if (!comments) {
        el.querySelectorAll('button[aria-label]').forEach(btn => {
          const label = btn.getAttribute('aria-label') || '';
          if (/comment|댓글/i.test(label)) {
            const match = label.match(/([\d,]+)/);
            if (match) comments = Math.max(comments, parseCount(match[1]));
          }
        });
      }

      newPosts.push({ author, profileUrl, postUrl, content, datetime, time: timeText || datetime.slice(0, 10), likes, comments });
      if (postUrl) seenSet.add(postUrl);
    } catch (_) {}
  });

  return { newPosts, debug: { containerCount: containers.length, url: location.href } };
}

// ──────────────────────────────────────────────────────────────
// 단일 키워드 LinkedIn 크롤
// ──────────────────────────────────────────────────────────────
async function crawlLinkedInKeyword(keyword, targetCount, prefix) {
  let tab = null;
  const allPosts = [];
  const seenUrls = new Set();

  try {
    const [originTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword)}&sortBy=date_posted`;

    tab = await chrome.tabs.create({ url, active: true });
    await waitForTabLoad(tab.id);

    setLinkedInStatus(`${prefix} 렌더링 대기 중...`);
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    }).catch(() => {});

    if (originTab?.id) await chrome.tabs.update(originTab.id, { active: true }).catch(() => {});

    await waitForLinkedInContent(tab.id, 0, 12000);

    let noNewCount = 0;
    const MAX_NO_NEW = 6;
    setLinkedInStatus(`(0/${targetCount}) ${prefix} 수집 시작`);

    while (allPosts.length < targetCount && noNewCount < MAX_NO_NEW && !linkedInStopRequested) {
      // 현재 컨테이너 수 기록
      const [countRes] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const candidates = [
            'div[data-urn*="activity:"]',
            'li.reusable-search__result-container',
            '.scaffold-finite-scroll__content > div > ul > li',
          ];
          for (const sel of candidates) {
            const n = document.querySelectorAll(sel).length;
            if (n > 0) return n;
          }
          return 0;
        },
      }).catch(() => [{ result: 0 }]);
      const prevContainerCount = countRes?.result || 0;

      // 로그인/authwall 확인
      const [urlCheck] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => location.href,
      }).catch(() => [{ result: '' }]);
      const currentUrl = urlCheck?.result || '';
      if (currentUrl.includes('/login') || currentUrl.includes('authwall') || currentUrl.includes('checkpoint')) {
        setLinkedInStatus('LinkedIn 로그인이 필요합니다. 브라우저에서 로그인 후 재시도하세요.', true, true);
        break;
      }

      // 스크래핑
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: scrapeLinkedIn,
        args: [Array.from(seenUrls)],
      }).catch(() => [{ result: { newPosts: [], debug: { containerCount: 0, url: '' } } }]);

      const { newPosts = [] } = result?.result || {};

      if (newPosts.length > 0) {
        newPosts.forEach(p => {
          if (allPosts.length >= targetCount) return;
          allPosts.push({ ...p, rank: allPosts.length + 1, keyword });
          if (p.postUrl) seenUrls.add(p.postUrl);
        });
        noNewCount = 0;
        setLinkedInStatus(`(${allPosts.length}/${targetCount}) ${prefix} 수집 중`);
      } else {
        noNewCount++;
        setLinkedInStatus(`(${allPosts.length}/${targetCount}) ${prefix} 로딩 대기 중... [${noNewCount}/${MAX_NO_NEW}]`);
        await activateAndClick(tab.id, originTab?.id);
      }

      if (allPosts.length < targetCount) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => window.scrollBy(0, 1200),
        }).catch(() => {});
        await waitForLinkedInContent(tab.id, prevContainerCount, 8000);
      }
    }

    await chrome.tabs.remove(tab.id).catch(() => {});
    tab = null;
    return { posts: allPosts };
  } catch (err) {
    if (tab) await chrome.tabs.remove(tab.id).catch(() => {});
    throw err;
  }
}

// ──────────────────────────────────────────────────────────────
// LinkedIn 메인 크롤 실행
// ──────────────────────────────────────────────────────────────
async function runLinkedInCrawl(rawKeyword, defaultCount) {
  if (isLinkedInCrawling) {
    setLinkedInStatus('이미 LinkedIn 수집이 진행 중입니다.', true, true);
    return;
  }
  isLinkedInCrawling    = true;
  linkedInStopRequested = false;

  try {
    const keywords = parseKeywords(rawKeyword, defaultCount);
    if (keywords.length === 0) return;

    const isMulti  = keywords.length > 1;
    const allPosts = [];

    for (let i = 0; i < keywords.length; i++) {
      if (linkedInStopRequested) break;

      const { keyword, count } = keywords[i];
      const prefix = isMulti ? `[${i + 1}/${keywords.length}] ${keyword}` : `"${keyword}"`;

      setLinkedInStatus(`${prefix} 검색 탭 열기 중...`);
      const { posts } = await crawlLinkedInKeyword(keyword, count, prefix);

      allPosts.push(...posts);

      if (isMulti && posts.length > 0 && !linkedInStopRequested) {
        setLinkedInStatus(`[${i + 1}/${keywords.length}] ${keyword} 완료 — ${posts.length}개 수집 (누적 ${allPosts.length}개)`);
        await sleep(800);
      }
    }

    if (allPosts.length === 0) {
      setLinkedInStatus(
        linkedInStopRequested
          ? '수집이 중지됐습니다. (수집된 게시물 없음)'
          : '게시물을 수집하지 못했습니다. LinkedIn 로그인 후 재시도하세요.',
        true, !linkedInStopRequested
      );
      return;
    }

    allPosts.forEach((p, i) => { p.rank = i + 1; });
    const combinedKeyword = keywords.map(k => k.keyword).join(', ');

    await chrome.storage.local.set({
      [LINKEDIN_RESULT_KEY]: { keyword: combinedKeyword, posts: allPosts, timestamp: Date.now() },
    });

    setLinkedInStatus(
      linkedInStopRequested ? `중지됨 — ${allPosts.length}개 수집됨` : `완료 — ${allPosts.length}개 수집됨`,
      true
    );
    console.log('[Eden Crawl BG] LinkedIn 수집 완료:', { combinedKeyword, total: allPosts.length });

  } catch (err) {
    setLinkedInStatus(`오류: ${err.message}`, true, true);
    console.error('[Eden Crawl BG] LinkedIn 오류:', err);
  } finally {
    isLinkedInCrawling    = false;
    linkedInStopRequested = false;
  }
}

// ══════════════════════════════════════════════════════════════
// Wing 쿠팡 데이터 수집 모듈
// Wing 로그인 세션을 이용해 내부 API 직접 호출
// ══════════════════════════════════════════════════════════════

const WING_STATUS_KEY = 'eden_wing_status';
const WING_DATA_KEY   = 'eden_wing_data';
const WING_APIS_KEY   = 'eden_wing_apis';

function setWingStatus(msg, done = false, error = false) {
  console.log('[Eden Wing BG] 상태:', msg);
  chrome.storage.local.set({ [WING_STATUS_KEY]: { msg, done, error, ts: Date.now() } });
}

// ── Wing 탭 찾기 (이미 열려있으면 재사용) ──
async function getWingTab() {
  const tabs = await chrome.tabs.query({ url: 'https://wing.coupang.com/*' });
  if (tabs.length > 0) return tabs[0];
  return null;
}

// ── Wing 페이지에서 직접 API 호출 ──
async function callWingAPI(tabId, path, params = {}) {
  const query = Object.keys(params).length
    ? '?' + new URLSearchParams(params).toString()
    : '';

  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (p) => {
      try {
        const resp = await fetch(p, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        });
        const text = await resp.text();
        return { ok: resp.ok, status: resp.status, text };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },
    args: [path + query],
  });

  if (!result?.result?.ok) return null;
  try { return JSON.parse(result.result.text); } catch (_) { return null; }
}

// ── Wing API 탐색 (주요 페이지 방문 → fetch 인터셉터가 API 수집) ──
async function discoverWingAPIs(tabId) {
  const pages = [
    'https://wing.coupang.com/wing/order/list',
    'https://wing.coupang.com/wing/settlement',
    'https://wing.coupang.com/wing/statistics',
  ];

  const seenAPIs = {};

  // 이벤트 리스너 등록 (MAIN world에서 dispatched 이벤트를 ISOLATED world에서 수신)
  // content_wing.js가 MAIN world에서 실행되므로, storage.onChanged로 수신
  for (const pageUrl of pages) {
    await chrome.tabs.update(tabId, { url: pageUrl });
    await waitForTabLoad(tabId);
    await sleep(3000); // 페이지가 API 호출할 시간

    // 현재까지 수집된 API 목록 가져오기
    const stored = await chrome.storage.local.get(WING_APIS_KEY);
    Object.assign(seenAPIs, stored[WING_APIS_KEY] || {});
  }

  return seenAPIs;
}

// ── Wing 알려진 API 직접 시도 ──
async function tryKnownAPIs(tabId) {
  const now = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  // 최근 30일
  const fromDate = new Date(now - 30 * 24 * 3600 * 1000);
  const from = fromDate.toISOString().slice(0, 10);
  const to   = now.toISOString().slice(0, 10);

  const candidates = [
    // 주문 목록
    ['/api/v1/order/orderList', { searchStartDate: from, searchEndDate: to, pageNum: 1, pageSize: 50 }],
    ['/api/v2/order/list',      { startDate: from, endDate: to }],
    ['/order/list',             { startDate: from, endDate: to }],
    // 정산
    ['/api/v1/revenue/monthly', { year, month }],
    ['/api/v2/settlement/monthly', { year, month }],
    ['/settlement/monthly',     { year, month }],
    // 매출 통계
    ['/api/v1/statistics/sale', { startDate: from, endDate: to }],
    ['/api/v2/sale/summary',    { startDate: from, endDate: to }],
    // 재고
    ['/api/v1/product/inventory', { pageNum: 1, pageSize: 50 }],
    ['/api/v2/vendor/inventory',  {}],
  ];

  const results = {};

  for (const [path, params] of candidates) {
    try {
      const data = await callWingAPI(tabId, path, params);
      if (data && !data.error) {
        results[path] = data;
        console.log('[Eden Wing BG] API 성공:', path, JSON.stringify(data).slice(0, 100));
        // 성공한 API 기록
        const stored = await chrome.storage.local.get(WING_APIS_KEY);
        const apis   = stored[WING_APIS_KEY] || {};
        apis[path]   = { url: 'https://wing.coupang.com' + path, found: true, ts: Date.now() };
        chrome.storage.local.set({ [WING_APIS_KEY]: apis });
      }
    } catch (_) {}
  }

  return results;
}

// ── Wing 데이터 수집 메인 ──
async function runWingFetch(targets = ['orders', 'settlement', 'inventory']) {
  setWingStatus('Wing 탭 확인 중...');

  let tab = await getWingTab();
  let tabCreated = false;

  if (!tab) {
    // Wing 탭이 없으면 새로 열기
    tab = await chrome.tabs.create({ url: 'https://wing.coupang.com', active: false });
    tabCreated = true;
    await waitForTabLoad(tab.id);
    await sleep(2000);
  }

  // Wing 로그인 확인
  const [urlCheck] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => ({ href: location.href, title: document.title }),
  });
  const currentUrl = urlCheck?.result?.href || '';
  if (currentUrl.includes('/login') || currentUrl.includes('accounts/login')) {
    setWingStatus('Wing 로그인이 필요합니다. wing.coupang.com에서 로그인 후 재시도하세요.', true, true);
    if (tabCreated) await chrome.tabs.remove(tab.id).catch(() => {});
    return;
  }

  setWingStatus('Wing API 호출 중...');

  // 1단계: 알려진 API 직접 시도
  const knownResults = await tryKnownAPIs(tab.id);
  const knownCount   = Object.keys(knownResults).length;

  let collectedData = { ...knownResults };

  // 2단계: API 미발견 시 페이지 방문으로 인터셉트 탐색
  if (knownCount === 0) {
    setWingStatus('API 탐색 중 (페이지 방문)...');
    const discovered = await discoverWingAPIs(tab.id);
    const discoveredCount = Object.keys(discovered).length;
    setWingStatus(`API ${discoveredCount}개 발견. 데이터 수집 중...`);
  }

  // 수집된 데이터 저장
  chrome.storage.local.set({
    [WING_DATA_KEY]: {
      data: collectedData,
      apiCount: knownCount,
      ts: Date.now(),
    },
  });

  if (tabCreated) await chrome.tabs.remove(tab.id).catch(() => {});

  if (knownCount > 0) {
    setWingStatus(`완료 — ${knownCount}개 API에서 데이터 수집`, true);
  } else {
    setWingStatus('직접 API 호출 실패. Wing 페이지에서 수동으로 주문/정산 페이지를 열어주세요.', true, false);
  }
}

console.log('[Eden Crawl BG] background.js 로드 완료');
