// Vercel Serverless Function — 쿠팡 Open API 프록시
import { createHmac } from 'crypto';

function makeAuthHeader(method, path, query, accessKey, secretKey) {
  // 쿠팡 공식 스펙: yyMMddTHHmmssZ, query는 ? 없이 그대로 (정렬된 상태로 전달)
  const dt  = new Date().toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d+Z$/, 'Z')
    .substring(2); // "260421T153045Z"
  const msg = dt + method + path + (query || '');
  const sig = createHmac('sha256', secretKey).update(msg).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${dt}, signature=${sig}`;
}

// 파라미터 → 알파벳 정렬 후 query string 생성 (서명과 URL 동일하게)
function buildQuery(params) {
  return Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  const raw = req.body;
  const accessKey = (raw.accessKey || '').trim();
  const secretKey = (raw.secretKey || '').trim();
  const vendorId  = (raw.vendorId  || '').trim();
  const endpoint  = raw.endpoint || 'seller-products';
  const params    = raw.params   || {};

  if (!accessKey || !secretKey || !vendorId) {
    res.status(400).json({ error: '쿠팡 API 키가 설정되지 않았습니다.' });
    return;
  }

  let apiPath, query;
  if (endpoint === 'seller-products') {
    apiPath = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';
    query   = buildQuery({ maxPerPage: String(params.maxPerPage || 50), status: 'APPROVED', vendorId });
  } else if (endpoint === 'vendor-inventory') {
    apiPath = '/v2/providers/seller_api/apis/api/v1/marketplace/vendor-inventory';
    query   = buildQuery({ maxPerPage: '50', vendorId });
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
        'Authorization':  auth,
        'Content-Type':   'application/json;charset=UTF-8',
        'X-Requested-By': vendorId,
      },
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    if (!resp.ok) {
      // 디버그용: 쿠팡 에러 메시지 포함해서 반환
      return res.status(resp.status).json({
        error: `쿠팡 API ${resp.status}`,
        message: data?.message || data?.code || text.slice(0, 300),
        detail: data,
        signedUrl: url,
      });
    }
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: '쿠팡 API 호출 실패', detail: err.message });
  }
}
