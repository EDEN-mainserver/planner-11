import { fullAutoKey } from "../../pages/admin/constants";

export function loadFullAuto(username) {
  try { return JSON.parse(localStorage.getItem(fullAutoKey(username))) || {}; }
  catch { return {}; }
}

export function saveFullAutoSettings(username, data) {
  localStorage.setItem(fullAutoKey(username), JSON.stringify(data));
}
