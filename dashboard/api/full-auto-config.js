// 풀가동화 콘텐츠 — 팀 계정 설정 CRUD
// Vercel Blob에 full-auto/team-config.json 으로 저장/로드

import { put, head } from "@vercel/blob";

const CONFIG_PATH = "full-auto/team-config.json";
const HISTORY_PATH = "full-auto/history.json";

// ─── 인증 검증 ───
function checkAuth(req) {
  const secret = process.env.FULL_AUTO_SECRET;
  if (!secret) return true; // 시크릿 미설정 시 개발 모드로 허용
  const auth = req.headers["authorization"] || "";
  return auth === `Bearer ${secret}`;
}

// ─── Blob에서 JSON 읽기 ───
async function readBlob(path) {
  try {
    // Vercel Blob에서 직접 fetch (put으로 저장된 공개 URL 사용)
    // head()로 URL 확인 후 fetch
    const info = await head(path).catch(() => null);
    if (!info) return null;
    const res = await fetch(info.url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Blob에 JSON 쓰기 ───
async function writeBlob(path, data) {
  const json = JSON.stringify(data, null, 2);
  await put(path, json, {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (!checkAuth(req)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  // ── GET: 설정 + 이력 로드 ──
  if (req.method === "GET") {
    const config = await readBlob(CONFIG_PATH) || { accounts: [] };
    const history = await readBlob(HISTORY_PATH) || [];
    return res.status(200).json({ ...config, history: Array.isArray(history) ? history : [] });
  }

  // ── POST: 계정 추가/업데이트 ──
  if (req.method === "POST") {
    const { account } = req.body || {};
    if (!account || !account.id) {
      return res.status(400).json({ error: "account.id 가 필요합니다" });
    }

    const config = await readBlob(CONFIG_PATH) || { accounts: [] };
    const idx = config.accounts.findIndex((a) => a.id === account.id);
    if (idx >= 0) {
      config.accounts[idx] = { ...config.accounts[idx], ...account };
    } else {
      config.accounts.push(account);
    }

    await writeBlob(CONFIG_PATH, config);
    return res.status(200).json({ ok: true, accounts: config.accounts });
  }

  // ── DELETE: 계정 삭제 ──
  if (req.method === "DELETE") {
    const { accountId } = req.body || {};
    if (!accountId) {
      return res.status(400).json({ error: "accountId 가 필요합니다" });
    }

    const config = await readBlob(CONFIG_PATH) || { accounts: [] };
    config.accounts = config.accounts.filter((a) => a.id !== accountId);
    await writeBlob(CONFIG_PATH, config);
    return res.status(200).json({ ok: true, accounts: config.accounts });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
