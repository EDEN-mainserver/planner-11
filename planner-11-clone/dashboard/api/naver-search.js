// Vercel Serverless Function — 네이버 검색 API 프록시
// 네이버 Client ID / Secret은 Vercel 환경변수에만 저장 (브라우저 노출 없음)

export default async function handler(req, res) {
  // CORS 헤더
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const CLIENT_ID     = process.env.NAVER_CLIENT_ID;
  const CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return res.status(503).json({
      error: 'NAVER_NOT_CONFIGURED',
      message: 'Vercel 환경변수에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET이 설정되지 않았습니다.',
    });
  }

  const { query, display = '40', sort = 'sim' } = req.query;
  if (!query) return res.status(400).json({ error: '검색어(query)가 필요합니다.' });

  try {
    const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=${display}&sort=${sort}`;

    const response = await fetch(url, {
      headers: {
        'X-Naver-Client-Id':     CLIENT_ID,
        'X-Naver-Client-Secret': CLIENT_SECRET,
      },
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: err.errorMessage || `네이버 API 오류 ${response.status}`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
