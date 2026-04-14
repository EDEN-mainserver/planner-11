// ── Eden Crawl — popup.js ──

const STORAGE = {
  VERCEL_URL: 'eden_vercel_url',
  GEMINI_KEY: 'eden_gemini_key',
};

// ── DOM 참조 ──
const keywordInput   = document.getElementById('keyword');
const crawlBtn       = document.getElementById('crawl-btn');
const statusEl       = document.getElementById('status');
const resultsEl      = document.getElementById('results');
const settingsToggle = document.getElementById('settings-toggle');
const settingsPanel  = document.getElementById('settings-panel');
const vercelUrlInput = document.getElementById('vercel-url');
const geminiKeyInput = document.getElementById('gemini-key');
const saveSettingsBtn = document.getElementById('save-settings');

// ── 저장된 게시물 (AI 분석용) ──
let _posts = [];

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

// ── Threads DOM 스크래핑 함수 (탭 내 실행) ──
// ⚠️ 외부 변수 참조 불가 — 완전히 독립적이어야 함
function scrapeThreadsPosts() {
  const containers = document.querySelectorAll('div[data-pressable-container="true"]');
  const posts = [];

  containers.forEach((el, idx) => {
    try {
      const authorEl = el.querySelector('a[href^="/@"]');
      if (!authorEl) return;
      const author = authorEl.getAttribute('href').replace(/^\//, '');

      const postLinkEl = el.querySelector('a[href*="/post/"]');
      const postUrl = postLinkEl
        ? 'https://www.threads.com' + postLinkEl.getAttribute('href')
        : '';

      const timeEl = el.querySelector('time[datetime]');
      const datetime = timeEl?.getAttribute('datetime') || '';
      const timeText = timeEl?.textContent?.trim() || '';

      const paragraphs = new Set();
      el.querySelectorAll("div.xat24cr span[dir='auto'], span[dir='auto']").forEach((span) => {
        const t = span.textContent.trim();
        if (t && t.length > 4) paragraphs.add(t);
      });
      const content = [...paragraphs].join('\n');
      if (!content) return;

      const getCount = (label) => {
        const svg = el.querySelector(`svg[aria-label="${label}"]`);
        if (!svg) return 0;
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
      };

      posts.push({
        rank: idx + 1,
        author: '@' + author.replace(/^@/, ''),
        content,
        postUrl,
        datetime,
        time: timeText || datetime.slice(0, 10),
        likes:    getCount('좋아요'),
        comments: getCount('답글'),
        shares:   getCount('리포스트'),
      });
    } catch (_) {}
  });

  return {
    posts,
    debug: {
      containerCount: containers.length,
      pageTitle: document.title,
      url: location.href,
    },
  };
}

// ── 메인 크롤 ──
crawlBtn.addEventListener('click', handleCrawl);
keywordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !crawlBtn.disabled) handleCrawl();
});

async function handleCrawl() {
  const keyword = keywordInput.value.trim();
  if (!keyword) return;

  crawlBtn.disabled = true;
  _posts = [];
  resultsEl.innerHTML = '';
  showStatus(`"${keyword}" 검색 탭 열는 중...`, 'info');

  let tab = null;
  try {
    // 1. 백그라운드 탭으로 Threads 검색 열기
    const url = `https://www.threads.com/search?q=${encodeURIComponent(keyword)}&serp_type=default`;
    tab = await chrome.tabs.create({ url, active: false });

    // 2. 페이지 로드 완료 대기
    await waitForTabLoad(tab.id);
    showStatus('React 렌더링 대기 중...', 'info');

    // 3. SPA 렌더링 대기 (3초)
    await sleep(3000);

    // 4. 스크롤로 추가 콘텐츠 로드
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => window.scrollBy(0, 2500),
    });
    await sleep(2000);

    // 5. DOM 스크래핑
    showStatus('게시물 파싱 중...', 'info');
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapeThreadsPosts,
    });

    // 6. 탭 닫기
    await chrome.tabs.remove(tab.id);
    tab = null;

    const { posts, debug } = result.result;

    if (posts.length === 0) {
      if (debug.url.includes('/login') || debug.url.includes('accounts/login')) {
        showStatus('Threads 로그인이 필요합니다. 브라우저에서 로그인해주세요.', 'warning');
      } else {
        showStatus(
          `게시물 없음 — 컨테이너 ${debug.containerCount}개 감지. 로그인 후 재시도해주세요.`,
          'warning'
        );
      }
    } else {
      // chrome.storage에 결과 저장 → 웹앱 content script가 감지해서 자동 전달
      await chrome.storage.local.set({
        eden_threads_results: { keyword, posts, timestamp: Date.now() },
      });

      // 웹앱 탭 열기 또는 포커스
      const cfg = await chrome.storage.local.get(STORAGE.VERCEL_URL);
      const vercelUrl = cfg[STORAGE.VERCEL_URL];
      if (vercelUrl) {
        const existing = await chrome.tabs.query({ url: `${vercelUrl}/*` });
        if (existing.length > 0) {
          // 이미 열려있으면 포커스만
          await chrome.tabs.update(existing[0].id, { active: true });
          await chrome.windows.update(existing[0].windowId, { focused: true });
        } else {
          // 새 탭으로 열기
          await chrome.tabs.create({ url: vercelUrl, active: true });
        }
        showStatus(`웹앱으로 ${posts.length}개 게시물 전송 완료`, 'success');
      } else {
        hideStatus();
      }

      renderResults(posts, keyword);
    }

  } catch (err) {
    showStatus(`오류: ${err.message}`, 'error');
    if (tab) await chrome.tabs.remove(tab.id).catch(() => {});
  } finally {
    crawlBtn.disabled = false;
  }
}

// ── 결과 렌더링 ──
function renderResults(posts, keyword) {
  _posts = posts;

  resultsEl.innerHTML = `
    <div class="results-header">
      <strong>${posts.length}</strong>개 게시물 — "${keyword}"
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

    // 펼치기/접기
    card.querySelector(`#header-${i}`).addEventListener('click', () => {
      const body = document.getElementById(`body-${i}`);
      const header = document.getElementById(`header-${i}`);
      const isOpen = body.classList.toggle('open');
      header.classList.toggle('expanded', isOpen);
    });

    // AI 분석
    card.querySelector(`#analyze-${i}`).addEventListener('click', (e) => {
      e.stopPropagation();
      analyzePost(i);
    });
  });
}

// ── AI 바이럴 분석 ──
async function analyzePost(idx) {
  const post = _posts[idx];
  const btn    = document.getElementById(`analyze-${idx}`);
  const resultEl = document.getElementById(`analysis-${idx}`);

  btn.disabled = true;
  btn.textContent = '분석 중...';
  resultEl.innerHTML = '<p class="analysis-loading">Gemini 분석 중...</p>';

  try {
    const data = await chrome.storage.local.get([STORAGE.VERCEL_URL, STORAGE.GEMINI_KEY]);
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
      // Vercel /api/gemini 경유
      const res = await fetch(`${vercelUrl}/api/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: [{ role: 'user', content: prompt }],
          systemPrompt: '당신은 소셜미디어 바이럴 콘텐츠 분석 전문가입니다. JSON 형식으로만 응답하세요.',
        }),
      });
      const json = await res.json();
      text = json.text || '';
    } else if (geminiKey) {
      // Gemini 직접 호출
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: '당신은 소셜미디어 바이럴 콘텐츠 분석 전문가입니다. JSON 형식으로만 응답하세요.' }],
            },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
        }
      );
      const json = await res.json();
      text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      throw new Error('설정(⚙)에서 Vercel URL 또는 Gemini API Key를 입력해주세요.');
    }

    // JSON 파싱
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
