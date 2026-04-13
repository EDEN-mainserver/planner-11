// Gemini API 호출 — 로컬: 직접 호출, Vercel: 서버 함수 경유
const IS_LOCAL = import.meta.env.DEV;
const GEMINI_KEY = import.meta.env.VITE_GEMINI_API_KEY || '';

export async function callGemini(history, systemPrompt) {
  // 로컬 개발환경: 직접 Google API 호출
  if (IS_LOCAL && GEMINI_KEY) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_KEY}`;
    const contents = history.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 8192 },
      }),
    });
    if (!resp.ok) {
      const err = await resp.json();
      throw new Error(err.error?.message || `API 오류 ${resp.status}`);
    }
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
