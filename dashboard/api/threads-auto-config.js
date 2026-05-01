// Threads 자동화 설정 관리 API
// GET  /api/threads-auto-config?username=xxx  → 설정 조회
// POST /api/threads-auto-config               → 설정 저장 { username, config }

import { put, list } from "@vercel/blob";

const PREFIX = "threads-auto";

async function readConfig(username) {
  try {
    const { blobs } = await list({ prefix: `${PREFIX}/${username}.json` });
    if (!blobs.length) return null;
    const latest = [...blobs].sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))[0];
    const res = await fetch(latest.url, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function writeConfig(username, config) {
  await put(`${PREFIX}/${username}.json`, JSON.stringify(config), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const username = req.query?.username;
    if (!username) return res.status(400).json({ error: "username 필요" });
    const config = await readConfig(username);
    return res.status(200).json({ config });
  }

  if (req.method === "POST") {
    const { username, config } = req.body || {};
    if (!username || !config) return res.status(400).json({ error: "username, config 필요" });
    await writeConfig(username, { ...config, updatedAt: new Date().toISOString() });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
