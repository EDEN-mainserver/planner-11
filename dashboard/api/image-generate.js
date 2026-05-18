// Vercel Serverless Function — Gemini Imagen 4 Fast 이미지 생성
// GEMINI_API_KEY 환경변수 사용 (api/gemini.js와 동일한 키)
// 결과: Imagen base64 → Vercel Blob에 즉시 업로드 후 공개 URL 반환
// (브라우저에 base64를 들고 다니지 않아 게시 단계의 413(Request Entity Too Large) 회피)

import { Buffer } from "node:buffer";
import { put } from "@vercel/blob";

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
    // Imagen 4 Fast 호출 (imagen-3 → imagen-4로 업그레이드됨)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-fast-generate-001:predict?key=${GEMINI_KEY}`;
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
      const errBody = await resp.json().catch(() => ({}));
      const msg = errBody.error?.message || errBody.error?.status || JSON.stringify(errBody);
      console.error('[image-generate] Imagen API error:', resp.status, msg);
      throw new Error(`Imagen ${resp.status}: ${msg}`);
    }

    const data = await resp.json();
    const prediction = data.predictions?.[0];
    if (!prediction?.bytesBase64Encoded) {
      console.error('[image-generate] No image data in response:', JSON.stringify(data).slice(0, 200));
      throw new Error('이미지 데이터를 받지 못했습니다.');
    }

    // base64 → Vercel Blob 업로드 → 공개 URL 반환
    // 청소 정책: image-gen/ 프리픽스의 파일은 cleanup-image-blobs cron이 7일 이후 자동 삭제
    const mimeType = prediction.mimeType || 'image/png';
    const ext = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    const buffer = Buffer.from(prediction.bytesBase64Encoded, 'base64');
    const filename = `image-gen/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const blob = await put(filename, buffer, {
      access: 'public',
      contentType: mimeType,
    });

    return res.status(200).json({ imageUrl: blob.url });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
