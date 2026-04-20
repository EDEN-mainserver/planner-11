// Vercel Serverless Function — Gemini Imagen 3 이미지 생성
// GEMINI_API_KEY 환경변수 사용 (api/gemini.js와 동일한 키)

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_KEY) {
    return res.status(503).json({
      error: 'IMAGE_API_NOT_CONFIGURED',
      message: 'GEMINI_API_KEY 환경변수가 설정되지 않았습니다.',
    });
  }

  const { prompt, aspectRatio = '16:9' } = req.body;
  if (!prompt) return res.status(400).json({ error: 'prompt가 필요합니다.' });

  try {
    // Imagen 3 호출
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_KEY}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio,
          safetyFilterLevel: 'BLOCK_ONLY_HIGH',
        },
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error?.message || `Imagen API 오류 ${resp.status}`);
    }

    const data = await resp.json();
    const prediction = data.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      throw new Error('이미지 데이터를 받지 못했습니다.');
    }

    // base64 → data URL로 변환하여 반환
    const mimeType = prediction.mimeType || 'image/png';
    const imageUrl = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`;

    return res.status(200).json({ imageUrl });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
