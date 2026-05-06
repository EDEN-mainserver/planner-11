// 쿠팡 API 자격증명 저장/불러오기 유틸리티
export const COUPANG_KEY = "eden_coupang_api_v1";

export function loadCoupangCreds() {
  try { return JSON.parse(localStorage.getItem(COUPANG_KEY)) || {}; }
  catch { return {}; }
}
