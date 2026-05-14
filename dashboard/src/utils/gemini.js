// Gemini API 호출 — 항상 서버 함수(/api/gemini) 경유.
// 우리 키는 서버 환경변수에만 두고 클라이언트 노출 차단.
// 사용자 키 입력 옵션은 Admin 페이지에 보존하지만, 클라이언트가 직접 Google API를 호출하지 않음.
//
// 호출 위치별 차이:
// - 일반 사용자: 서버가 GEMINI_API_KEY로 호출. usage_count 차감 적용.
// - 관리자 override: AdminPage에서 키 입력 시 그 키를 body에 동봉. 서버가 우선 사용.

import { getApiKey } from './aiKeys';

export async function callGemini(history, systemPrompt) {
  // 사용자가 Admin에서 자기 키를 등록한 경우 body에 동봉해서 서버에 전달.
  const userKey = getApiKey('gemini') || '';

  const resp = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history, systemPrompt, userKey: userKey || undefined }),
  });
  if (!resp.ok) {
    // 응답이 JSON이 아닐 수 있음 (Vercel 인프라 에러: 타임아웃/페이로드 초과 등은 평문/HTML 반환)
    const raw = await resp.text();
    let message;
    try {
      const err = JSON.parse(raw);
      message = err.error || err.message;
    } catch {
      const snippet = raw.replace(/<[^>]*>/g, '').trim().slice(0, 180);
      message = snippet || `HTTP ${resp.status}`;
    }
    if (resp.status === 504 || /timeout|FUNCTION_INVOCATION_TIMEOUT/i.test(raw)) {
      throw new Error(`서버 응답 시간 초과 (${resp.status}) — 잠시 후 다시 시도하거나 게시물 수를 줄여주세요.`);
    }
    if (resp.status === 413 || /PAYLOAD_TOO_LARGE/i.test(raw)) {
      throw new Error(`요청 본문이 너무 큽니다 (${resp.status}) — 게시물/이미지 수를 줄여주세요.`);
    }
    throw new Error(`서버 오류 ${resp.status}: ${message}`);
  }
  const data = await resp.json();
  return data.text || '';
}

/**
 * Imagen API로 이미지 생성 — 서버 함수(/api/image-generate) 경유.
 * 우리 키 보호 + 향후 토큰 차감을 한 곳에서 통제.
 * @param {string} prompt - 이미지 프롬프트 (영어 권장)
 * @param {string} aspectRatio - '3:4' | '1:1' | '16:9' 등
 * @returns {Promise<string>} data URL (data:image/png;base64,...)
 */
export async function generateImage(prompt, aspectRatio = '3:4') {
  const resp = await fetch('/api/image-generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, aspectRatio }),
  });

  if (!resp.ok) {
    const raw = await resp.text();
    let message;
    try {
      const err = JSON.parse(raw);
      message = err.message || err.error || `HTTP ${resp.status}`;
    } catch {
      message = raw.replace(/<[^>]*>/g, '').trim().slice(0, 180) || `HTTP ${resp.status}`;
    }
    throw new Error(`이미지 생성 실패 (${resp.status}): ${message}`);
  }

  const data = await resp.json();
  if (!data.imageUrl) throw new Error('이미지 데이터를 받지 못했습니다.');
  return data.imageUrl;
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
