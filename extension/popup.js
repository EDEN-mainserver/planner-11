// ── Eden Crawl v2 — popup.js ──

const STORAGE = {
  VERCEL_URL: 'eden_vercel_url',
  GEMINI_KEY: 'eden_gemini_key',
};

// ── DOM 참조 ──
const keywordInput    = document.getElementById('keyword');
const countInput      = document.getElementById('count-input');
const crawlBtn        = document.getElementById('crawl-btn');
const statusEl        = document.getElementById('status');
const resultsEl       = document.getElementById('results');
const settingsToggle  = document.getElementById('settings-toggle');
const settingsPanel   = document.getElementById('settings-panel');
const vercelUrlInput  = document.getElementById('vercel-url');
const geminiKeyInput  = document.getElementById('gemini-key');
const saveSettingsBtn = document.getElementById('save-settings');

let _posts = [];

// ── 키워드 파싱 (멀티 키워드 지원) ──
// "AI마케팅:20, 숏폼:30" → [{keyword:"AI마케팅",count:20},{keyword:"숏폼",count:30}]
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

// ── 설정 로드/저장 ──
async function loadSettings() {
  const data = await chrome.storage.local.get([STORAGE.VERCEL_URL, STORAGE.GEMINI_KEY]);
  vercelUrlInput.value = data[STORAGE.VERCEL_URL] || '';
  geminiKeyInput.value = data[STORAGE.GEMINI_KEY] || '';
}

saveSettingsBtn.addEventListener('click', async () => {
  await chrome.storage.local.set({
    [STORAGE.VERCEL_URL]: vercelUrlInput.value.trim().replace(/\/$/, ''),
    [STORAGE.GEMINI_KEY]: geminiKeyInput.value.trim(),
  });
  showStatus('설정이 저장됐습니다', 'success');
  setTimeout(() => settingsPanel.classList.remove('open'), 800);
});

settingsToggle.addEventListener('click', () => {
  settingsPanel.classList.toggle('open');
});

// ── 상태 메시지 ──
function showStatus(msg, type = 'info') {
  statusEl.textContent = msg;
  statusEl.className = `status ${type}`;
}
function hideStatus() {
  statusEl.className = 'status';
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

// ──────────────────────────────────────────────────────────────
// "1/M" 쓰레드 표식 감지 (팝업 스코프 — 본문 텍스트에서 호출)
// "1/3", " 1/3 ", "내용 1/2." 등 첫 부분(1)이고 M=2~10인 경우만 인정
// ──────────────────────────────────────────────────────────────
function detectThreadTotal(content) {
  if (!content) return 0;
  const re = /(?:^|[^\d])1\s*\/\s*(\d{1,2})(?=\s|$|[.!?,])/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const total = parseInt(m[1], 10);
    if (total >= 2 && total <= 10) return total;
  }
  return 0;
}

// ──────────────────────────────────────────────────────────────
// 상세 페이지 정보 수집 함수 (탭 내 실행)
// ⚠️ 외부 변수 참조 불가 — 완전히 독립적이어야 함
// 반환: { views, threadParts }
//   - views: 조회수 (Python 크롤러와 동일 — span:has-text("조회"))
//   - threadParts: 동일 작성자 답글 본문, 시간순 정렬, expectedThreadCount-1 개
// ──────────────────────────────────────────────────────────────
function extractDetailInfo(authorHandle, expectedThreadCount) {
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
    if (span.textContent.includes('조회')) {
      views = parseCount(span.textContent);
      break;
    }
  }

  // ── 쓰레드 연속글(동일 작성자 답글) ──
  const threadParts = [];
  const debugInfo = { containerCount: 0, sameAuthorCount: 0, wantHandle: '', sampleHandles: [] };

  if (authorHandle && expectedThreadCount > 1) {
    const wantHandle = String(authorHandle).replace(/^@/, '').trim().toLowerCase();
    debugInfo.wantHandle = wantHandle;
    const containers = document.querySelectorAll('div[data-pressable-container="true"]');
    debugInfo.containerCount = containers.length;

    // 원본 게시물 식별 — 현재 URL의 postId가 들어있는 컨테이너 1개를 스킵
    const currentPath = location.pathname;
    const postIdMatch = currentPath.match(/\/post\/([^/?#]+)/);
    const currentPostId = postIdMatch ? postIdMatch[1] : '';
    let originalSkipped = false;

    containers.forEach((el) => {
      // 작성자 핸들 추출 — href가 "/@name" / "/@name/post/xxx" / 쿼리/해시 형태 모두 대응
      const authorEl = el.querySelector('a[href^="/@"]');
      if (!authorEl) return;
      const rawHref = authorEl.getAttribute('href') || '';
      const handle = rawHref.replace(/^\/@?/, '').split(/[/?#]/)[0].toLowerCase();
      if (debugInfo.sampleHandles.length < 8) debugInfo.sampleHandles.push(handle);

      // 원본 게시물 스킵 — postId가 일치하면 원본
      if (!originalSkipped && currentPostId) {
        const postLink = el.querySelector(`a[href*="/post/${currentPostId}"]`);
        if (postLink) { originalSkipped = true; return; }
      }

      if (handle !== wantHandle) return;
      debugInfo.sameAuthorCount++;

      const paragraphs = new Set();
      el.querySelectorAll("div.xat24cr span[dir='auto'], span[dir='auto']").forEach((span) => {
        const t = span.textContent.trim();
        if (t && t.length > 4) paragraphs.add(t);
      });
      const text = [...paragraphs].join('\n');
      if (!text) return;

      const timeEl = el.querySelector('time[datetime]');
      const datetime = timeEl?.getAttribute('datetime') || '';

      threadParts.push({ text, datetime });
    });

    // 시간순 정렬 (오래된 것이 part 2)
    threadParts.sort((a, b) => (a.datetime || '').localeCompare(b.datetime || ''));
    // expectedThreadCount-1 개로 자르기
    threadParts.length = Math.min(threadParts.length, expectedThreadCount - 1);
  }

  return { views, threadParts: threadParts.map(p => p.text), debugInfo };
}

// ──────────────────────────────────────────────────────────────
// 1회 스크래핑 함수 (탭 내 실행) — 팝업 루프에서 반복 호출
// ⚠️ 외부 변수 참조 불가 — 완전히 독립적이어야 함
// Python 크롤러 로직 이식:
//   - parseCount: 1.4천→1400, 2.3만→23000 한국식 단위 파싱
//   - seenUrlsArray: 팝업에서 관리한 중복 URL 목록 전달
//   - svg + span 셀렉터: 좋아요/댓글/리포스트 정확히 추출
// ──────────────────────────────────────────────────────────────
function scrapeOnce(seenUrlsArray) {
  // ── 한국식 숫자 파싱 ──
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

  // ── svg[aria-label] 기반 카운트 추출 ──
  function getCount(el, label) {
    const svg = el.querySelector(`svg[aria-label="${label}"]`);
    if (!svg) return 0;
    const sibling = svg.nextElementSibling;
    if (sibling) return parseCount(sibling.textContent);
    const btn = svg.closest('div[role="button"], button');
    if (btn) {
      const span = btn.querySelector('span');
      if (span) return parseCount(span.textContent);
    }
    let node = svg.parentElement;
    for (let i = 0; i < 4 && node && node !== el; i++) {
      const span = node.querySelector('span.x1o0tod') || node.querySelector('span[class]');
      if (span) {
        const n = parseInt(span.textContent.replace(/[^0-9]/g, ''));
        if (!isNaN(n)) return n;
      }
      node = node.parentElement;
    }
    return 0;
  }

  const seenSet   = new Set(seenUrlsArray);
  const newPosts  = [];
  const containers = document.querySelectorAll('div[data-pressable-container="true"]');

  containers.forEach((el) => {
    try {
      const authorEl = el.querySelector('a[href^="/@"]');
      if (!authorEl) return;
      const author = authorEl.getAttribute('href').replace(/^\//, '');

      const postLinkEl = el.querySelector('a[href*="/post/"]');
      const postUrl = postLinkEl
        ? 'https://www.threads.com' + postLinkEl.getAttribute('href')
        : '';

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
        content,
        postUrl,
        datetime,
        time:     timeText || datetime.slice(0, 10),
        likes:    getCount(el, '좋아요'),
        comments: getCount(el, '답글'),
        shares:   getCount(el, '리포스트'),
      });
    } catch (_) {}
  });

  return {
    newPosts,
    debug: {
      containerCount: containers.length,
      pageTitle:      document.title,
      url:            location.href,
    },
  };
}

// ──────────────────────────────────────────────────────────────
// 단일 키워드 크롤 (멀티 키워드 루프에서 반복 호출)
// prefix: 진행 표시 문자열 (예: "[1/3] AI마케팅")
// 반환: { posts, lastDebug }
// ──────────────────────────────────────────────────────────────
async function crawlSingleKeyword(keyword, targetCount, prefix) {
  let tab = null;
  const allPosts = [];
  const seenUrls = new Set();

  try {
    const url = `https://www.threads.com/search?q=${encodeURIComponent(keyword)}&serp_type=default`;
    tab = await chrome.tabs.create({ url, active: false });
    await waitForTabLoad(tab.id);
    showStatus(`${prefix} React 렌더링 대기 중...`, 'info');
    await sleep(3000);

    let noNewCount = 0;
    const MAX_NO_NEW = 8;
    let lastDebug   = { containerCount: 0, pageTitle: '', url: '' };
    let loopCount   = 0;

    console.log('[Eden Crawl] 수집 시작:', { keyword, targetCount, tabId: tab.id });
    showStatus(`${prefix} 수집 중... 0 / ${targetCount}개`, 'info');

    while (allPosts.length < targetCount && noNewCount < MAX_NO_NEW) {
      loopCount++;
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func:   scrapeOnce,
        args:   [Array.from(seenUrls)],
      });

      const { newPosts, debug } = result.result;
      lastDebug = debug;

      console.log(`[Eden Crawl] 루프 ${loopCount}회:`, {
        keyword, containerCount: debug.containerCount,
        newPostsFound: newPosts.length, totalSoFar: allPosts.length,
      });

      if (debug.url.includes('/login') || debug.url.includes('accounts/login')) {
        console.warn('[Eden Crawl] 로그인 페이지 감지 → 중단');
        break;
      }

      if (newPosts.length > 0) {
        newPosts.forEach((p) => {
          if (allPosts.length >= targetCount) return;
          allPosts.push({ ...p, rank: allPosts.length + 1, keyword });
          if (p.postUrl) seenUrls.add(p.postUrl);
        });
        noNewCount = 0;
        showStatus(`${prefix} 수집 중... ${allPosts.length} / ${targetCount}개`, 'info');
      } else {
        noNewCount++;
        showStatus(`${prefix} 수집 중... ${allPosts.length} / ${targetCount}개 (대기 ${noNewCount}/${MAX_NO_NEW})`, 'info');
      }

      if (allPosts.length < targetCount) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func:   () => window.scrollBy(0, 900),
        });
        await sleep(1800);
      }
    }

    // 검색 탭 닫기
    await chrome.tabs.remove(tab.id);
    tab = null;

    // 상세 페이지 순차 방문 — 조회수 + 쓰레드 연속글(동일 작성자 답글) 동시 수집
    const postsWithUrl = allPosts.filter(p => p.postUrl);
    if (postsWithUrl.length > 0) {
      showStatus(`${prefix} 상세 수집 중... 0 / ${postsWithUrl.length}개`, 'info');
      let detailTab = null;
      try {
        detailTab = await chrome.tabs.create({ url: 'about:blank', active: false });
        for (let i = 0; i < postsWithUrl.length; i++) {
          const post = postsWithUrl[i];
          const threadTotal = detectThreadTotal(post.content);
          const label = threadTotal > 1 ? `쓰레드(${threadTotal}편)` : '조회수';
          showStatus(`${prefix} ${label} 수집 중... ${i + 1} / ${postsWithUrl.length}개`, 'info');

          await chrome.tabs.update(detailTab.id, { url: post.postUrl });
          await waitForTabLoad(detailTab.id);
          await sleep(2500);

          // 쓰레드일 경우 답글 lazy-load 트리거 — 추가 스크롤
          if (threadTotal > 1) {
            await chrome.scripting.executeScript({
              target: { tabId: detailTab.id },
              func:   () => window.scrollBy(0, 1500),
            });
            await sleep(1500);
          }

          try {
            const [res] = await chrome.scripting.executeScript({
              target: { tabId: detailTab.id },
              func:   extractDetailInfo,
              args:   [post.author, threadTotal],
            });
            const { views = 0, threadParts = [], debugInfo = {} } = res.result || {};
            post.views = views;
            if (threadTotal > 1) {
              console.log(`[Eden Crawl] 쓰레드 시도: ${post.author} (1/${threadTotal})`, {
                url:              post.postUrl,
                wantHandle:       debugInfo.wantHandle,
                containerCount:   debugInfo.containerCount,
                sampleHandles:    debugInfo.sampleHandles,
                sameAuthorFound:  debugInfo.sameAuthorCount,
                collected:        threadParts.length,
              });
            }
            if (threadTotal > 1 && threadParts.length > 0) {
              post.threadTotal = threadTotal;
              post.threadParts = threadParts;
            }
          } catch (e) {
            console.warn('[Eden Crawl] 상세 수집 실패:', e?.message);
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
// 메인 크롤 핸들러 (멀티 키워드 지원)
// ──────────────────────────────────────────────────────────────
crawlBtn.addEventListener('click', handleCrawl);
keywordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !crawlBtn.disabled) handleCrawl();
});

async function handleCrawl() {
  const rawInput = keywordInput.value.trim();
  if (!rawInput) return;

  const defaultCount = Math.min(Math.max(parseInt(countInput?.value || '30', 10) || 30, 5), 100);
  const keywords = parseKeywords(rawInput, defaultCount);
  if (keywords.length === 0) return;

  const isMulti = keywords.length > 1;

  crawlBtn.disabled = true;
  _posts = [];
  resultsEl.innerHTML = '';

  const allPosts = [];

  try {
    for (let i = 0; i < keywords.length; i++) {
      const { keyword, count } = keywords[i];
      const prefix = isMulti
        ? `[${i + 1}/${keywords.length}] ${keyword}`
        : `"${keyword}"`;

      showStatus(`${prefix} 검색 탭 열기 중...`, 'info');

      const { posts, lastDebug } = await crawlSingleKeyword(keyword, count, prefix);

      if (posts.length === 0) {
        if (lastDebug.url.includes('/login') || lastDebug.url.includes('accounts/login')) {
          showStatus('Threads 로그인이 필요합니다. 브라우저에서 로그인해주세요.', 'warning');
          return;
        }
        showStatus(`${prefix} 게시물 없음 — 컨테이너 ${lastDebug.containerCount}개 감지`, 'warning');
        continue;
      }

      allPosts.push(...posts);

      if (isMulti) {
        showStatus(`${prefix} 완료 — ${posts.length}개 (누적 ${allPosts.length}개)`, 'success');
        if (i < keywords.length - 1) await sleep(800);
      }
    }

    if (allPosts.length === 0) {
      showStatus('게시물을 수집하지 못했습니다. Threads 로그인 후 재시도하세요.', 'warning');
      return;
    }

    // rank 재정렬
    allPosts.forEach((p, i) => { p.rank = i + 1; });

    // chrome.storage 저장 → 웹앱 content script가 감지
    const combinedKeyword = keywords.map(k => k.keyword).join(', ');
    console.log('[Eden Crawl] storage 저장:', { combinedKeyword, postCount: allPosts.length });
    await chrome.storage.local.set({
      eden_threads_results: { keyword: combinedKeyword, posts: allPosts, timestamp: Date.now() },
    });

    // 웹앱 탭 열기 또는 포커스
    const cfg = await chrome.storage.local.get(STORAGE.VERCEL_URL);
    const vercelUrl = cfg[STORAGE.VERCEL_URL];
    if (vercelUrl) {
      const existing = await chrome.tabs.query({ url: `${vercelUrl}/*` });
      if (existing.length > 0) {
        await chrome.tabs.update(existing[0].id, { active: true });
        await chrome.windows.update(existing[0].windowId, { focused: true });
      } else {
        await chrome.tabs.create({ url: vercelUrl, active: true });
      }
      showStatus(`웹앱으로 ${allPosts.length}개 게시물 전송 완료`, 'success');
    } else {
      showStatus(`${allPosts.length}개 게시물 수집 완료`, 'success');
    }

    renderResults(allPosts, combinedKeyword);

  } catch (err) {
    showStatus(`오류: ${err.message}`, 'error');
  } finally {
    crawlBtn.disabled = false;
  }
}

// ── 결과 렌더링 ──
function renderResults(posts, keyword) {
  _posts = posts;

  // 멀티 키워드 여부 판단 (쉼표 포함 시)
  const _isMultiKw = keyword.includes(',');

  resultsEl.innerHTML = `
    <div class="results-header">
      <strong>${posts.length}</strong>개 게시물 — "${escHtml(keyword)}"
      &nbsp;·&nbsp; 행 클릭 시 원문 펼침
    </div>
  `;

  posts.forEach((post, i) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <div class="card-header" id="header-${i}">
        <span class="rank">${i + 1}</span>
        <div class="card-main">
          <div class="card-top">
            <span class="author">${escHtml(post.author)}</span>
            ${_isMultiKw && post.keyword
              ? `<span class="kw-badge">${escHtml(post.keyword)}</span>`
              : ''}
            <span class="time">${escHtml(post.time)}</span>
          </div>
          <p class="preview">${escHtml(post.content)}</p>
        </div>
        <div class="card-stats">
          <span>❤ ${Number(post.likes || 0).toLocaleString()}</span>
          <span>💬 ${Number(post.comments || 0).toLocaleString()}</span>
        </div>
      </div>
      <div class="card-body" id="body-${i}">
        <p class="post-text">${escHtml(post.content)}</p>
        ${post.postUrl
          ? `<a class="ext-link" href="${escHtml(post.postUrl)}" target="_blank" rel="noopener">↗ Threads에서 보기</a>`
          : ''}
        <button class="analyze-btn" id="analyze-${i}">AI 바이럴 분석</button>
        <div id="analysis-${i}"></div>
      </div>
    `;
    resultsEl.appendChild(card);

    card.querySelector(`#header-${i}`).addEventListener('click', () => {
      const body   = document.getElementById(`body-${i}`);
      const header = document.getElementById(`header-${i}`);
      const isOpen = body.classList.toggle('open');
      header.classList.toggle('expanded', isOpen);
    });

    card.querySelector(`#analyze-${i}`).addEventListener('click', (e) => {
      e.stopPropagation();
      analyzePost(i);
    });
  });
}

// ── AI 바이럴 분석 ──
async function analyzePost(idx) {
  const post    = _posts[idx];
  const btn     = document.getElementById(`analyze-${idx}`);
  const resultEl = document.getElementById(`analysis-${idx}`);

  btn.disabled = true;
  btn.textContent = '분석 중...';
  resultEl.innerHTML = '<p class="analysis-loading">Gemini 분석 중...</p>';

  try {
    const data      = await chrome.storage.local.get([STORAGE.VERCEL_URL, STORAGE.GEMINI_KEY]);
    const vercelUrl = data[STORAGE.VERCEL_URL];
    const geminiKey = data[STORAGE.GEMINI_KEY];

    const prompt =
`다음 Threads 게시물의 바이럴 성공 요인을 분석해주세요.

작성자: ${post.author}
내용: ${post.content}
좋아요: ${post.likes} | 댓글: ${post.comments} | 공유: ${post.shares}

JSON 형식으로만 반환:
{
  "summary": "바이럴된 이유 한 줄 요약",
  "keywords": ["키워드1", "키워드2", "키워드3"],
  "tone": "유머러스|정보성|감성적|솔직한|도발적|공감형 중 하나",
  "viral_factors": [
    {"factor": "요인명", "desc": "설명 한 문장"},
    {"factor": "요인명", "desc": "설명 한 문장"}
  ]
}`;

    let text = '';

    if (vercelUrl) {
      const res = await fetch(`${vercelUrl}/api/gemini`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          history:      [{ role: 'user', content: prompt }],
          systemPrompt: '당신은 소셜미디어 바이럴 콘텐츠 분석 전문가입니다. JSON 형식으로만 응답하세요.',
        }),
      });
      const json = await res.json();
      text = json.text || '';
    } else if (geminiKey) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            systemInstruction: {
              parts: [{ text: '당신은 소셜미디어 바이럴 콘텐츠 분석 전문가입니다. JSON 형식으로만 응답하세요.' }],
            },
            contents:         [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
        }
      );
      const json = await res.json();
      text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      throw new Error('설정(⚙)에서 Vercel URL 또는 Gemini API Key를 입력해주세요.');
    }

    const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
    if (!match) throw new Error('분석 결과 파싱 실패');
    const analysis = JSON.parse(match[1] || match[0]);

    resultEl.innerHTML = `
      <div class="analysis-box">
        <p class="analysis-summary">${escHtml(analysis.summary)}</p>
        <div class="keywords">
          ${(analysis.keywords || []).map(k => `<span class="keyword">#${escHtml(k)}</span>`).join('')}
        </div>
        ${(analysis.viral_factors || []).map(f => `
          <div class="factor">
            <strong>${escHtml(f.factor)}</strong>${escHtml(f.desc)}
          </div>
        `).join('')}
      </div>
    `;
    btn.textContent = '재분석';
  } catch (err) {
    resultEl.innerHTML = `<p class="analysis-error">${escHtml(err.message)}</p>`;
    btn.textContent = 'AI 분석';
  } finally {
    btn.disabled = false;
  }
}

// ── XSS 방지 ──
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 초기화 ──
loadSettings();

// 웹앱에서 전달된 pending 키워드 자동 입력
chrome.storage.local.get('eden_pending_keyword', (data) => {
  if (data.eden_pending_keyword) {
    keywordInput.value = data.eden_pending_keyword;
    keywordInput.focus();
    // 사용 후 즉시 삭제 (한 번만 사용)
    chrome.storage.local.remove('eden_pending_keyword');
    console.log('[Eden Crawl] 웹앱 키워드 자동 입력:', data.eden_pending_keyword);
  }
});
