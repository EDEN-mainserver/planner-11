import { COUPANG_KEY } from "../../utils/coupang";

export function saveCoupangCreds(data) {
  localStorage.setItem(COUPANG_KEY, JSON.stringify(data));
}
