// Vercel Serverless Function — DigitalOcean 고정 IP 서버로 프록시
// 브라우저(HTTPS) → Vercel → DigitalOcean(고정IP) → 쿠팡 API

const DO_SERVER = process.env.DO_API_SERVER || 'http://152.42.207.15:8000';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const { accessKey, secretKey, vendorId, endpoint } = req.body || {};

  if (!accessKey || !secretKey || !vendorId) {
    return res.status(400).json({ error: '쿠팡 API 키가 설정되지 않았습니다.' });
  }

  // endpoint에 따라 DigitalOcean 서버의 적절한 경로로 프록시
  let doPath;
  if (!endpoint || endpoint === 'seller-products') {
    doPath = '/coupang/products';
  } else if (endpoint === 'connect') {
    doPath = '/coupang/connect';
  } else {
    doPath = '/coupang/products';
  }

  try {
    const resp = await fetch(`${DO_SERVER}${doPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_key: accessKey,
        secret_key: secretKey,
        vendor_id:  vendorId,
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json({
        error: data?.detail || data?.message || `HTTP ${resp.status}`,
      });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: `서버 연결 실패: ${err.message}` });
  }
}
