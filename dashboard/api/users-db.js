// 회원 DB 조회/관리 API
// GET  → 전체 회원 목록
// POST → role 변경 또는 삭제

import { put, list } from "@vercel/blob";

const USERS_BLOB_PATH = "auth/google-users.json";

async function readUsers() {
  try {
    const { blobs } = await list({ prefix: USERS_BLOB_PATH });
    if (!blobs.length) return [];
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    return res.ok ? await res.json() : [];
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  await put(USERS_BLOB_PATH, JSON.stringify(users, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const users = await readUsers();
    return res.status(200).json({ users, total: users.length });
  }

  if (req.method === "POST") {
    const { action, userId, role } = req.body || {};
    const users = await readUsers();

    if (action === "setRole" && userId && role) {
      const idx = users.findIndex(u => u.id === userId);
      if (idx < 0) return res.status(404).json({ error: "사용자 없음" });
      users[idx].role = role;
      await writeUsers(users);
      return res.status(200).json({ ok: true, user: users[idx] });
    }

    if (action === "delete" && userId) {
      const next = users.filter(u => u.id !== userId);
      await writeUsers(next);
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "action 이 올바르지 않습니다 (setRole | delete)" });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
