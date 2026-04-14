// ── Eden Crawl v2 — background.js (Service Worker) ──
// 웹앱 요청을 받아 팝업 없이 백그라운드에서 크롤 실행
// 진행 상태 → chrome.storage(eden_crawl_status) → content_webapp.js → 웹앱 UI

const RESULT_KEY = 'eden_threads_results';
const STATUS_KEY = 'eden_crawl_status';
const VERCEL_URL_KEY = 'eden_vercel_url';

let isCrawling    = false; // 중복 실행 방지
let stopRequested = false; // 중지 요청 플래그

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

    // 조회수 수집 (중지 요청 시 건너뜀)
    const postsWithUrl = allPosts.filter(p => p.postUrl);
    if (postsWithUrl.length > 0 && !stopRequested) {
      setStatus(`조회수 수집 중... (0/${postsWithUrl.length})`);
      let detailTab = null;
      try {
        detailTab = await chrome.tabs.create({ url: 'about:blank', active: false });
        for (let i = 0; i < postsWithUrl.length; i++) {
          if (stopRequested) break; // 중지 요청 시 조회수 수집 중단
          const post = postsWithUrl[i];
          setStatus(`조회수 수집 중... (${i + 1}/${postsWithUrl.length})`);
          await chrome.tabs.update(detailTab.id, { url: post.postUrl });
          await waitForTabLoad(detailTab.id);
          // body 클릭으로 조회수 로딩 유도
          await chrome.scripting.executeScript({
            target: { tabId: detailTab.id },
            func: () => document.body.dispatchEvent(new MouseEvent('click', { bubbles: true })),
          }).catch(() => {});
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

  if (message.type === 'EDEN_GET_POST_IMAGES') {
    const { postUrl } = message;
    sendResponse({ ok: true });
    fetchPostImages(postUrl).then(urls => {
      chrome.storage.local.set({ eden_post_images: { postUrl, urls, ts: Date.now() } });
    });
    return false;
  }
});

console.log('[Eden Crawl BG] background.js 로드 완료');
