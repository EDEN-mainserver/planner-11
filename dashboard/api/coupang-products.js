// Vercel Serverless Function — 쿠팡 Open API 프록시
'use strict';
const crypto = require('crypto');
const https  = require('https');

function makeAuthHeader(method, path, query, accessKey, secretKey) {
  const now = new Date();
  const p   = (n) => String(n).padStart(2, '0');
  const dt  = `${now.getUTCFullYear()}${p(now.getUTCMonth()+1)}${p(now.getUTCDate())}T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z`;
  const msg = dt + method + path + (query ? '?' + query : '');
  const sig = crypto.createHmac('sha256', secretKey).update(msg).digest('hex');
  return 'CEA algorithm=HmacSHA256, access-key=' + accessKey + ', signed-date=' + dt + ', signature=' + sig;
}

function httpsGet(path, query, headers) {
  return new Promise(function(resolve, reject) {
    var fullPath = path + (query ? '?' + query : '');
    var options = {
      hostname: 'api-gateway.coupang.com',
      port: 443,
      path: fullPath,
      method: 'GET',
      headers: headers,
    };
    var req = https.request(options, function(res) {
      var body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, data: { error: 'JSON parse error', raw: body.slice(0, 200) } });
        }
      });
    });
    req.on('error', function(e) { reject(e); });
    req.end();
  });
}

module.exports = async function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method Not Allowed' }); return; }

  // body 파싱 — Vercel은 대부분 자동 파싱, 아니면 직접 읽기
  var body = req.body;
  if (!body || typeof body !== 'object') {
    try { body = JSON.parse(body); } catch(e) { body = {}; }
  }

  var accessKey = body.accessKey;
  var secretKey = body.secretKey;
  var vendorId  = body.vendorId;
  var endpoint  = body.endpoint || 'seller-products';
  var params    = body.params   || {};

  if (!accessKey || !secretKey || !vendorId) {
    res.status(400).json({ error: '쿠팡 API 키가 설정되지 않았습니다.' });
    return;
  }

  var apiPath, query;
  if (endpoint === 'seller-products') {
    apiPath = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products';
    query   = 'vendorId=' + vendorId + '&nextToken=&maxPerPage=' + (params.maxPerPage || 50) + '&status=APPROVED';
  } else if (endpoint === 'vendor-inventory') {
    apiPath = '/v2/providers/seller_api/apis/api/v1/marketplace/vendor-inventory';
    query   = 'vendorId=' + vendorId + '&nextToken=&maxPerPage=50';
  } else if (endpoint === 'product-detail') {
    apiPath = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/' + params.sellerProductId;
    query   = '';
  } else {
    res.status(400).json({ error: '지원하지 않는 endpoint: ' + endpoint });
    return;
  }

  var auth = makeAuthHeader('GET', apiPath, query, accessKey, secretKey);

  try {
    var result = await httpsGet(apiPath, query, {
      'Authorization': auth,
      'Content-Type': 'application/json;charset=UTF-8',
    });
    res.status(result.status).json(result.data);
  } catch(err) {
    res.status(500).json({ error: '쿠팡 API 호출 실패', detail: err.message });
  }
};
