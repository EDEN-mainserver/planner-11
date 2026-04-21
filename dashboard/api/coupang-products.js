// Vercel Serverless Function — 쿠팡 Open API 프록시
import crypto from 'crypto';

function makeAuthHeader(method, path, query, accessKey, secretKey) {
  const now = new Date();
  const p   = (n) => String(n).padStart(2, '0');
  const dt  = `${now.getUTCFullYear()}${p(now.getUTCMonth()+1)}${p(now.getUTCDate())}T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z`;
  const msg = dt + method + path + (query ? '?' + query : '');
  const sig = crypto.createHmac('sha256', secretKey).update(msg).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${dt}, signature=${sig}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const { accessKey, secretKey, vendorId, endpoint = 'seller-products', params = {} } = req.body;

  if (!accessKey || !secretKey || !vendorId) {
    res.status(400).json({ error: '쿠팡 API 키가 설정되지 않았습니다.' });
    return;
  }

  let apiPath, query;
  if (endpoint === 'seller-products') {
    apiPath = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';
    query   = `vendorId=${vendorId}&nextToken=&maxPerPage=${params.maxPerPage || 50}&status=APPROVED`;
  } else if (endpoint === 'vendor-inventory') {
    apiPath = '/v2/providers/seller_api/apis/api/v1/marketplace/vendor-inventory';
    query   = `vendorId=${vendorId}&nextToken=&maxPerPage=50`;
  } else if (endpoint === 'product-detail') {
    apiPath = `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${params.sellerProductId}`;
    query   = '';
  } else {
    res.status(400).json({ error: `지원하지 않는 endpoint: ${endpoint}` });
    return;
  }

  const auth = makeAuthHeader('GET', apiPath, query, accessKey, secretKey);
  const url  = `https://api-gateway.coupang.com${apiPath}${query ? '?' + query : ''}`;

  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': auth,
        'Content-Type':  'application/json;charset=UTF-8',
      },
    });
    const data = await resp.json();
    res.status(resp.status).json(data);
  } catch (err) {
    res.status(500).json({ error: '쿠팡 API 호출 실패', detail: err.message });
  }
}
