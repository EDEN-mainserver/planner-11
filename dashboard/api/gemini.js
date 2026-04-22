// Vercel Serverless Function — Gemini API 프록시
// API 키는 서버에만 존재하며 브라우저에 노출되지 않음

const MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
];

async function callModel(modelName, body, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return resp;
}

// 이미지 URL을 서버 사이드에서 base64로 변환
async function fetchImageAsBase64(url) {
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const mimeType = (resp.headers.get('content-type') || 'image/jpeg').split(';')[0];
    return { base64, mimeType };
  } catch {
    return null;
  }
}

export const config = { api: { bodyParser: { sizeLimit: '10mb' } } };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'Gemini API 키가 서버에 설정되지 않았습니다.' });
  }

  const { history, systemPrompt } = req.body;

  // 멀티모달 지원: 메시지에 images 배열이 있으면 서버 사이드에서 base64 변환
  const contents = await Promise.all(history.map(async m => {
    const parts = [{ text: m.content }];
    // URL 이미지 — 서버에서 base64 변환
    if (Array.isArray(m.images) && m.images.length > 0) {
      const imgParts = await Promise.all(
        m.images.slice(0, 4).map(async (imgUrl) => {
          const result = await fetchImageAsBase64(imgUrl);
          if (!result) return null;
          return { inlineData: { mimeType: result.mimeType, data: result.base64 } };
        })
      );
      parts.push(...imgParts.filter(Boolean));
    }
    // 인라인 이미지 — 이미 base64 (업로드 이미지)
    if (Array.isArray(m.inlineImages) && m.inlineImages.length > 0) {
      parts.push(...m.inlineImages.slice(0, 4).map(img => ({
        inlineData: { mimeType: img.mimeType, data: img.base64 },
      })));
    }
    return {
      role: m.role === 'assistant' ? 'model' : 'user',
      parts,
    };
  }));

  const requestBody = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
  };

  // 모델 순서대로 시도 (실패 시 다음 모델로 폴백)
  let lastError = '';
  for (const model of MODELS) {
    try {
      const resp = await callModel(model, requestBody, GEMINI_KEY);
      if (resp.ok) {
        const data = await resp.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return res.status(200).json({ text, model });
      }
      const err = await resp.json();
      lastError = err.error?.message || `오류 ${resp.status}`;
      // 503(과부하) 또는 429(한도 초과)일 때만 다음 모델로 폴백
      if (resp.status !== 503 && resp.status !== 429) {
        return res.status(resp.status).json({ error: lastError });
      }
    } catch (err) {
      lastError = err.message;
    }
  }

  return res.status(503).json({ error: `모든 모델 실패: ${lastError}` });
}
