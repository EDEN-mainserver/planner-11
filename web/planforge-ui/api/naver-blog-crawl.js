// Vercel Serverless Function — 네이버 블로그 크롤러
// RSS + 모바일 페이지로 최근 글 수집 후 텍스트 반환

// HTML 태그 및 불필요 요소 제거
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

// RSS에서 포스트 목록 파싱
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

// 네이버 모바일 블로그 본문 추출
async function fetchPostContent(url) {
  try {
    // 모바일 URL로 변환
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

    // 본문 영역 추출 (se-main-container 또는 postViewArea)
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { blogId } = req.query;
  if (!blogId) return res.status(400).json({ error: 'blogId가 필요합니다.' });

  try {
    // 1. RSS로 최근 포스트 목록 가져오기
    const rssResp = await fetch(`https://rss.blog.naver.com/${blogId}.xml`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'ko-KR' },
    });
    if (!rssResp.ok) throw new Error('블로그를 찾을 수 없습니다. 블로그 ID를 확인해 주세요.');
    const rssText = await rssResp.text();
    const items = parseRss(rssText);

    if (items.length === 0) throw new Error('분석할 글이 없습니다.');

    // 2. 최근 8개 글 본문 병렬 수집 (타임아웃 고려)
    const TARGET = Math.min(8, items.length);
    const posts = await Promise.all(
      items.slice(0, TARGET).map(async (item) => {
        const content = await fetchPostContent(item.link);
        return {
          title:   item.title,
          url:     item.link,
          excerpt: item.excerpt,
          content: content || item.excerpt,
        };
      })
    );

    return res.status(200).json({
      blogId,
      total: items.length,
      posts: posts.filter((p) => p.content.length > 50),
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
