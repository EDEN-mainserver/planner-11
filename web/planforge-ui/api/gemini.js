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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(500).json({ error: 'Gemini API 키가 서버에 설정되지 않았습니다.' });
  }

  const { history, systemPrompt } = req.body;
  const contents = history.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
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
