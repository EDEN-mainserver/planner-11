// Vercel Serverless Function — 네이버 데이터랩 검색어 트렌드 API
// 키워드 목록을 받아 최근 6개월 검색량 트렌드 점수(0~100)를 반환

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
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

  // 최근 6개월 날짜 계산
  const endDate   = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6);
  const fmt = (d) => d.toISOString().split('T')[0];

  // 데이터랩 API는 1회 요청에 최대 5개 키워드 그룹
  const BATCH = 5;
  const results = {};

  try {
    const batches = [];
    for (let i = 0; i < keywords.length; i += BATCH) {
      batches.push(keywords.slice(i, i + BATCH));
    }

    for (const batch of batches) {
      const body = {
        startDate: fmt(startDate),
        endDate:   fmt(endDate),
        timeUnit:  'month',
        keywordGroups: batch.map((kw) => ({
          groupName: kw,
          keywords:  [kw],
        })),
      };

      const resp = await fetch('https://openapi.naver.com/v1/datalab/search', {
        method: 'POST',
        headers: {
          'Content-Type':          'application/json',
          'X-Naver-Client-Id':     CLIENT_ID,
          'X-Naver-Client-Secret': CLIENT_SECRET,
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.errorMessage || `데이터랩 API 오류 ${resp.status}`);
      }

      const data = await resp.json();

      // 각 키워드의 평균 ratio 계산
      for (const item of (data.results || [])) {
        const ratios = (item.data || []).map((d) => d.ratio);
        const avg = ratios.length > 0
          ? Math.round(ratios.reduce((a, b) => a + b, 0) / ratios.length)
          : 0;
        results[item.title] = avg;
      }
    }

    // 점수 높은 순 정렬
    const sorted = Object.entries(results)
      .sort((a, b) => b[1] - a[1])
      .map(([keyword, score]) => ({ keyword, score }));

    return res.status(200).json({ results: sorted });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
