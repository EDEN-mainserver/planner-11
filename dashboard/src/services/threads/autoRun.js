import { autoRunKey, autoMonitorCacheKey } from "../../eattack/threads/constants";

export function loadAutoRunId(username) {
  try {
    return localStorage.getItem(autoRunKey(username)) || "";
  } catch {
    return "";
  }
}

export function saveAutoRunId(username, runId) {
  localStorage.setItem(autoRunKey(username), runId || "");
}

export function loadAutoMonitorCache(username) {
  try {
    return JSON.parse(localStorage.getItem(autoMonitorCacheKey(username))) || null;
  } catch {
    return null;
  }
}

export function saveAutoMonitorCache(username, data) {
  localStorage.setItem(autoMonitorCacheKey(username), JSON.stringify(data || null));
}
