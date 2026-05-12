export function normalizeInstagramToken(value) {
  return String(value || "").replace(/[\s​-‍﻿]+/g, "").trim();
}

export function normalizeInstagramConfig(config = {}) {
  return {
    ...config,
    accessToken: normalizeInstagramToken(config.accessToken),
    accountId: String(config.accountId || "").trim(),
    username: String(config.username || "").trim(),
  };
}
