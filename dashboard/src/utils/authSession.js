const SESSION_KEY = "eden_auth_v1";

function isValidSession(session) {
  return Boolean(session && typeof session === "object" && session.id);
}

export function getSession() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (isValidSession(session)) return session;
    localStorage.removeItem(SESSION_KEY);
    return null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(user) {
  const session = {
    id: user.id,
    username: user.username,
    displayName: user.displayName || user.username,
    email: user.email,
    picture: user.picture,
    provider: user.provider,
    role: user.role,
  };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("eden-session-change", { detail: session }));
  return session;
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent("eden-session-change", { detail: null }));
}
