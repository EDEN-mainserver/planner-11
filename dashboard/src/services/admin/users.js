import { USERS as SEED_USERS } from "../../config/users";
import { USERS_KEY } from "../../pages/admin/constants";

export function loadUsers() {
  try {
    const saved = JSON.parse(localStorage.getItem(USERS_KEY));
    if (saved && saved.length > 0) return saved;
  } catch { /* localStorage 파싱 실패 시 seed 사용 */ }
  localStorage.setItem(USERS_KEY, JSON.stringify(SEED_USERS));
  return [...SEED_USERS];
}

export function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}
