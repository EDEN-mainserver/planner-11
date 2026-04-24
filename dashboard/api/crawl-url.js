// Vercel Serverless Function — 범용 URL 크롤러
// 고객사 홈페이지 텍스트 추출용

function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
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

// 메타 정보 추출 (title, description, og 태그)
function extractMeta(html) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
  const desc =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] ||
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1] || '';
  const ogTitle =
    html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] || '';
  const ogDesc =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1] || '';
  const keywords =
    html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)/i)?.[1] || '';

  return { title, desc, ogTitle, ogDesc, keywords };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = req.method === 'POST' ? req.body?.url : req.query?.url;
  if (!url) return res.status(400).json({ error: 'url이 필요합니다.' });

  // URL 유효성 검사
  let parsed;
  try {
    parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return res.status(400).json({ error: '유효하지 않은 URL입니다.' });
  }

  try {
    const resp = await fetch(parsed.href, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
      },
      signal: AbortSignal.timeout(10000), // 10초 타임아웃
    });

    if (!resp.ok) {
      return res.status(502).json({ error: `사이트 응답 오류: ${resp.status}` });
    }

    const html = await resp.text();
    const meta = extractMeta(html);

    // 본문 텍스트 (최대 6000자)
    const bodyText = extractText(html).slice(0, 6000);

    return res.status(200).json({
      url: parsed.href,
      domain: parsed.hostname,
      meta,
      text: bodyText,
    });
  } catch (err) {
    const msg = err.name === 'TimeoutError'
      ? '사이트 응답 시간 초과 (10초)'
      : `크롤링 실패: ${err.message}`;
    return res.status(500).json({ error: msg });
  }
}
