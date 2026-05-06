// Gemini API 호출 — localStorage(관리자 AI API 키) > VITE_GEMINI_API_KEY > 서버 함수 순서로 호출
import { getApiKey, getModel } from './aiKeys';

function getGeminiKey() {
  return getApiKey('gemini') || import.meta.env.VITE_GEMINI_API_KEY || '';
}

function getGeminiModel() {
  return getModel('gemini') || 'gemini-2.5-pro';
}

function getGeminiModels() {
  const selected = getGeminiModel();
  return [...new Set([
    selected,
    'gemini-2.5-pro',
    'gemini-2.5-flash',
    'gemini-2.0-flash-lite',
  ])];
}

function isTransientGeminiError(status, message) {
  const text = String(message || '').toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    text.includes('high demand') ||
    text.includes('please try again later') ||
    text.includes('resource exhausted') ||
    text.includes('quota')
  );
}

// 브라우저 사이드 이미지 → base64 변환 (CORS 허용 이미지에만 동작)
async function fetchImageB64Client(url) {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result?.split(',')[1] || null;
        resolve(base64 ? { base64, mimeType: blob.type || 'image/jpeg' } : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function callGemini(history, systemPrompt) {
  const GEMINI_KEY = getGeminiKey();
  // API 키가 있으면 직접 Google API 호출
  if (GEMINI_KEY) {
    const contents = await Promise.all(history.map(async m => {
      const parts = [{ text: m.content }];
      // 인라인 이미지 (업로드 base64)
      if (Array.isArray(m.inlineImages) && m.inlineImages.length > 0) {
        parts.push(...m.inlineImages.slice(0, 4).map(img => ({
          inlineData: { mimeType: img.mimeType, data: img.base64 },
        })));
      }
      // URL 이미지 — data: URL 직접 처리 or fetch
      if (Array.isArray(m.images) && m.images.length > 0) {
        for (const imgUrl of m.images.slice(0, 4)) {
          if (imgUrl.startsWith('data:')) {
            const match = imgUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
          } else {
            const result = await fetchImageB64Client(imgUrl);
            if (result) parts.push({ inlineData: { mimeType: result.mimeType, data: result.base64 } });
          }
        }
      }
      return {
        role: m.role === 'assistant' ? 'model' : 'user',
        parts,
      };
    }));

    for (const model of getGeminiModels()) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      }

      const err = await resp.json().catch(() => ({}));
      const message = err.error?.message || `API 오류 ${resp.status}`;
      if (!isTransientGeminiError(resp.status, message)) {
        break;
      }
    }

    throw new Error(
      'Gemini 모델이 일시적으로 혼잡합니다. 잠시 후 다시 시도하거나 Gemini 2.5 Flash로 바꿔보세요.'
    );
  }

  // 프로덕션(Vercel): 서버 함수 경유 (키 노출 없음)
  const resp = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history, systemPrompt }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || `API 오류 ${resp.status}`);
  }
  const data = await resp.json();
  return data.text || '';
}

/**
 * Imagen API로 이미지 생성 — 브라우저에서 직접 호출 (VITE_GEMINI_API_KEY 사용)
 * @param {string} prompt - 이미지 프롬프트 (영어 권장)
 * @param {string} aspectRatio - '3:4' | '1:1' | '16:9' 등
 * @returns {Promise<string>} data URL (data:image/png;base64,...)
 */
export async function generateImage(prompt, aspectRatio = '3:4') {
  const GEMINI_KEY = getGeminiKey();
  if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY가 설정되지 않았습니다.');

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
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Imagen 오류 ${resp.status}`);
  }

  const data = await resp.json();
  const prediction = data.predictions?.[0];
  if (!prediction?.bytesBase64Encoded) throw new Error('이미지 데이터를 받지 못했습니다.');

  return `data:${prediction.mimeType || 'image/png'};base64,${prediction.bytesBase64Encoded}`;
}

export function deepMergePrd(current, update) {
  const result = JSON.parse(JSON.stringify(current));
  for (const secKey of Object.keys(update || {})) {
    const upSec = update[secKey];
    if (Array.isArray(upSec)) {
      if (upSec.length > 0) result[secKey] = upSec;
    } else if (upSec && typeof upSec === 'object') {
      result[secKey] = result[secKey] || {};
      for (const fieldKey of Object.keys(upSec)) {
        const v = upSec[fieldKey];
        if (Array.isArray(v) && v.length > 0) result[secKey][fieldKey] = v;
        else if (typeof v === 'string' && v.trim() && v !== '...' && v !== 'TODO') result[secKey][fieldKey] = v;
      }
    }
  }
  return result;
}
