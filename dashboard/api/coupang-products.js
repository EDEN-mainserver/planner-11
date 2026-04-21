// Vercel Serverless Function — 쿠팡 Open API 프록시
const crypto = require('crypto');
const https  = require('https');

// ── body 파싱 (Vercel이 자동으로 안 할 경우 대비) ──
function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body && typeof req.body === 'object') {
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', chunk => { raw += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(raw)); }
      catch { resolve({}); }
    });
  });
}

// ── 쿠팡 CEA HMAC 서명 생성 ──
function makeAuthHeader(method, path, query, accessKey, secretKey) {
  const now  = new Date();
  const pad  = (n) => String(n).padStart(2, '0');
  const dt   = `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}` +
               `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const msg  = dt + method + path + (query ? `?${query}` : '');
  const sig  = crypto.createHmac('sha256', secretKey).update(msg).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${dt}, signature=${sig}`;
}

// ── Node.js https GET 래퍼 ──
function httpsGet(urlStr, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request({
      hostname: u.hostname,
      path:     u.pathname + u.search,
      method:   'GET',
      headers,
    }, (res) => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch { resolve({ status: res.statusCode, data: { error: 'JSON 파싱 실패', raw: body.slice(0, 300) } }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  let body;
  try {
    body = await parseBody(req);
  } catch (e) {
    return res.status(400).json({ error: 'body 파싱 실패', detail: e.message });
  }

  const { accessKey, secretKey, vendorId, endpoint = 'seller-products', params = {} } = body;
  if (!accessKey || !secretKey || !vendorId) {
    return res.status(400).json({ error: '쿠팡 API 키가 설정되지 않았습니다.' });
  }

  const ENDPOINTS = {
    'seller-products': {
      path:  `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products`,
      query: () => `vendorId=${vendorId}&nextToken=&maxPerPage=${params.maxPerPage || 50}&status=APPROVED`,
    },
    'vendor-inventory': {
      path:  `/v2/providers/seller_api/apis/api/v1/marketplace/vendor-inventory`,
      query: () => `vendorId=${vendorId}&nextToken=&maxPerPage=50`,
    },
    'product-detail': {
      path:  `/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/${params.sellerProductId}`,
      query: () => '',
    },
  };

  const ep = ENDPOINTS[endpoint];
  if (!ep) return res.status(400).json({ error: `지원하지 않는 endpoint: ${endpoint}` });

  const query = ep.query();
  const auth  = makeAuthHeader('GET', ep.path, query, accessKey, secretKey);
  const url   = `https://api-gateway.coupang.com${ep.path}${query ? '?' + query : ''}`;

  try {
    const result = await httpsGet(url, {
      'Authorization': auth,
      'Content-Type':  'application/json;charset=UTF-8',
    });
    return res.status(result.status).json(result.data);
  } catch (err) {
    return res.status(500).json({ error: '쿠팡 API 호출 실패', detail: err.message });
  }
};
