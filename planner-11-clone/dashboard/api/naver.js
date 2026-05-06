// 네이버 API 통합 핸들러
// ?_fn=blog-crawl → 블로그 크롤러 (GET ?blogId=xxx)
// ?_fn=datalab    → 데이터랩 검색 트렌드 (POST { keywords })

function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function parseRss(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = (block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/) ||
                   block.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim() || '';
    const link  = (block.match(/<link>([\s\S]*?)<\/link>/))?.[1]?.trim() || '';
    const desc  = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
                   block.match(/<description>([\s\S]*?)<\/description>/))?.[1]?.trim() || '';
    if (title && link) items.push({ title, link, excerpt: extractText(desc).slice(0, 300) });
  }
  return items;
}

async function fetchPostContent(url) {
  try {
    const mobileUrl = url
      .replace('blog.naver.com', 'm.blog.naver.com')
      .replace('https://m.m.', 'https://m.');
    const resp = await fetch(mobileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept-Language': 'ko-KR,ko;q=0.9',
      },
    });
    if (!resp.ok) return '';
    const html = await resp.text();
    const contentMatch =
      html.match(/<div[^>]+class="[^"]*se-main-container[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i) ||
      html.match(/<div[^>]+id="postViewArea"[^>]*>([\s\S]*?)<\/div>/i) ||
      html.match(/<div[^>]+class="[^"]*post_ct[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const raw = contentMatch ? contentMatch[1] : html.slice(0, 8000);
    return extractText(raw).slice(0, 2000);
  } catch {
    return '';
  }
}

async function handleBlogCrawl(req, res) {
  const { blogId } = req.query;
  if (!blogId) return res.status(400).json({ error: 'blogId가 필요합니다.' });

  const rssResp = await fetch(`https://rss.blog.naver.com/${blogId}.xml`, {
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR' },
  });
  if (!rssResp.ok) throw new Error('블로그를 찾을 수 없습니다. 블로그 ID를 확인해 주세요.');
  const items = parseRss(await rssResp.text());
  if (items.length === 0) throw new Error('분석할 글이 없습니다.');

  const posts = await Promise.all(
    items.slice(0, Math.min(8, items.length)).map(async (item) => {
      const content = await fetchPostContent(item.link);
      return { title: item.title, url: item.link, excerpt: item.excerpt, content: content || item.excerpt };
    })
  );
  return res.status(200).json({ blogId, total: items.length, posts: posts.filter((p) => p.content.length > 50) });
}

async function handleDatalab(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const CLIENT_ID     = process.env.NAVER_CLIENT_ID;
  const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(503).json({
      error: 'NAVER_NOT_CONFIGURED',
      message: 'Vercel 환경변수에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET이 설정되지 않았습니다.',
    });
  }

  const { keywords } = req.body;
  if (!keywords || !Array.isArray(keywords) || keywords.length === 0) {
    return res.status(400).json({ error: '키워드 배열이 필요합니다.' });
  }

  const endDate   = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);
  const fmt = (d) => d.toISOString().split('T')[0];

  const results = {};
  const batches = [];
  for (let i = 0; i < keywords.length; i += 5) batches.push(keywords.slice(i, i + 5));

  for (const batch of batches) {
    const resp = await fetch('https://openapi.naver.com/v1/datalab/search', {
      method: 'POST',
      headers: {
        'Content-Type':          'application/json',
        'X-Naver-Client-Id':     CLIENT_ID,
        'X-Naver-Client-Secret': CLIENT_SECRET,
      },
      body: JSON.stringify({
        startDate: fmt(startDate),
        endDate:   fmt(endDate),
        timeUnit:  'month',
        keywordGroups: batch.map((kw) => ({ groupName: kw, keywords: [kw] })),
      }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.errorMessage || `데이터랩 API 오류 ${resp.status}`);
    }
    const data = await resp.json();
    for (const item of (data.results || [])) {
      const ratios = (item.data || []).map((d) => d.ratio);
      results[item.title] = ratios.length > 0 ? Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length) : 0;
    }
  }

  const sorted = Object.entries(results).sort((a, b) => b[1] - a[1]).map(([keyword, score]) => ({ keyword, score }));
  return res.status(200).json({ results: sorted });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const fn = req.query._fn;
  try {
    if (fn === 'blog-crawl') return await handleBlogCrawl(req, res);
    if (fn === 'datalab')    return await handleDatalab(req, res);
    return res.status(400).json({ error: '_fn 파라미터가 필요합니다 (blog-crawl | datalab)' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
