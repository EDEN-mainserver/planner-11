/**
 * Claude 백엔드 API 클라이언트
 *
 * 로컬 개발: http://localhost:8000
 * 프로덕션:  VITE_API_BASE_URL 환경 변수로 지정
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }

  return res.json();
}

/**
 * 카드뉴스 템플릿 생성
 * @param {{ brandName, tone, layoutStyle, colorScheme, target, purpose, refImageCount }} params
 * @returns {{ color1, color2, font, slides }}
 */
export async function generateCardnewsTemplate({
  brandName = '',
  tone = '',
  layoutStyle = '',
  colorScheme = '',
  target = '',
  purpose = '',
  refImageCount = 0,
} = {}) {
  return post('/ai/cardnews/template', {
    brand_name:      brandName,
    tone,
    layout_style:    layoutStyle,
    color_scheme:    colorScheme,
    target,
    purpose,
    ref_image_count: refImageCount,
  });
}

/**
 * 카드뉴스 슬라이드 내용 생성
 * @param {{ brandName, color1, tone, target, purpose, topic, slideCount }} params
 * @returns {{ slides }}
 */
export async function generateCardnewsSlides({
  brandName = '',
  color1 = '#7c3aed',
  tone = '',
  target = '',
  purpose = '',
  topic,
  slideCount = 5,
} = {}) {
  return post('/ai/cardnews/slides', {
    brand_name:  brandName,
    color1,
    tone,
    target,
    purpose,
    topic,
    slide_count: slideCount,
  });
}
