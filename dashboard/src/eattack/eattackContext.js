const EVENT_NAME = "eattack-context";
const COMMAND_NAME = "eattack-command";

export function emitEAttackContext(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail }));
}

export function clearEAttackContext() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: null }));
}

export function emitEAttackCommand(detail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(COMMAND_NAME, { detail }));
}

export function onEAttackCommand(handler) {
  if (typeof window === "undefined") return () => {};
  const listener = (event) => handler(event?.detail || null);
  window.addEventListener(COMMAND_NAME, listener);
  return () => window.removeEventListener(COMMAND_NAME, listener);
}

export function summarizeText(value, max = 120) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
