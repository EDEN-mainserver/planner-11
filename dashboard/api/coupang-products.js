// Vercel Serverless Function — 쿠팡 Open API 프록시
// HMAC-SHA256 서명을 서버에서 처리해 브라우저에 secretKey 노출 없음
const crypto = require('crypto');

// ── 쿠팡 CEA HMAC 서명 생성 ──
function makeAuthHeader(method, path, query, accessKey, secretKey) {
  const now    = new Date();
  const pad    = (n) => String(n).padStart(2, '0');
  const datetime = `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}` +
                   `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const message   = datetime + method + path + (query ? `?${query}` : '');
  const signature = crypto.createHmac('sha256', secretKey).update(message).digest('hex');
  const auth = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;
  return auth;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const { accessKey, secretKey, vendorId, endpoint = 'seller-products', params = {} } = req.body || {};
  if (!accessKey || !secretKey || !vendorId) {
    return res.status(400).json({ error: '쿠팡 API 키가 설정되지 않았습니다.' });
  }

  // ── 엔드포인트 라우팅 ──
  const ENDPOINTS = {
    // 판매 상품 목록
    'seller-products': {
      method: 'GET',
      path:   `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`,
      query:  () => `vendorId=${vendorId}&nextToken=&maxPerPage=${params.maxPerPage || 50}&status=APPROVED`,
    },
    // 상품별 재고/판매 현황
    'vendor-inventory': {
      method: 'GET',
      path:   `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-inventory`,
      query:  () => `vendorId=${vendorId}&nextToken=&maxPerPage=50`,
    },
    // 상품 상세 (단건)
    'product-detail': {
      method: 'GET',
      path:   `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${params.sellerProductId}`,
      query:  () => '',
    },
  };

  const ep = ENDPOINTS[endpoint];
  if (!ep) return res.status(400).json({ error: `지원하지 않는 endpoint: ${endpoint}` });

  const query    = ep.query();
  const fullPath = query ? `${ep.path}?${query}` : ep.path;
  const auth     = makeAuthHeader(ep.method, ep.path, query, accessKey, secretKey);

  try {
    const url  = `https://api-gateway.coupang.com${fullPath}`;
    const resp = await fetch(url, {
      method: ep.method,
      headers: {
        'Authorization': auth,
        'Content-Type':  'application/json;charset=UTF-8',
      },
    });
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: '쿠팡 API 호출 실패', detail: err.message });
  }
};
