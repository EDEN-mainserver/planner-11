export function loadSocial(keyFn, username) {
  try { return JSON.parse(localStorage.getItem(keyFn(username))) || {}; }
  catch { return {}; }
}

export function saveSocial(keyFn, username, data) {
  localStorage.setItem(keyFn(username), JSON.stringify(data));
}

export function loadLocalText(key) {
  try { return localStorage.getItem(key) || ""; }
  catch { return ""; }
}

export function saveLocalText(key, value) {
  localStorage.setItem(key, value);
}
