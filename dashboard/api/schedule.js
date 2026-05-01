// Threads 예약 게시 관리 API
// GET  /api/schedule?username=xxx  → 예약 목록 반환
// POST /api/schedule               → 예약 추가   { username, schedule }
// DELETE /api/schedule             → 예약 취소   { username, id }
// PATCH  /api/schedule             → 완료 항목 일괄 삭제 { username }
// PATCH  /api/schedule             → 예약 수정 { username, id, updates }

import { put, list } from "@vercel/blob";

const PREFIX = "threads-schedule";

function normalizeScheduledAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(raw)) return new Date(raw).toISOString();
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return raw;
}

async function readSchedules(username) {
  try {
    const { blobs } = await list({ prefix: `${PREFIX}/${username}.json` });
    if (!blobs.length) return [];
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function writeSchedules(username, schedules) {
  await put(`${PREFIX}/${username}.json`, JSON.stringify(schedules), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export const config = { api: { bodyParser: { sizeLimit: "2mb" } } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // GET — 목록 조회
  if (req.method === "GET") {
    const username = req.query?.username;
    if (!username) return res.status(400).json({ error: "username 필요" });
    const schedules = await readSchedules(username);
    return res.status(200).json({ schedules });
  }

  // POST — 예약 추가
  if (req.method === "POST") {
    const { username, schedule } = req.body || {};
    if (!username || !schedule) return res.status(400).json({ error: "username, schedule 필요" });
    const schedules = await readSchedules(username);
    schedules.push({ ...schedule, scheduledAt: normalizeScheduledAt(schedule.scheduledAt) });
    await writeSchedules(username, schedules);
    return res.status(200).json({ ok: true });
  }

  // DELETE — 예약 취소 (단건)
  if (req.method === "DELETE") {
    const { username, id } = req.body || {};
    if (!username || !id) return res.status(400).json({ error: "username, id 필요" });
    const schedules = await readSchedules(username);
    const updated = schedules.filter((s) => s.id !== id);
    await writeSchedules(username, updated);
    return res.status(200).json({ ok: true });
  }

  // PATCH — 완료/실패 항목 일괄 삭제
  if (req.method === "PATCH") {
    const { username, id, updates } = req.body || {};
    if (!username) return res.status(400).json({ error: "username 필요" });
    const schedules = await readSchedules(username);

    if (id && updates && typeof updates === "object") {
      const index = schedules.findIndex((s) => s.id === id);
      if (index === -1) return res.status(404).json({ error: "예약을 찾을 수 없습니다" });
      const next = [...schedules];
      next[index] = {
        ...next[index],
        ...updates,
        scheduledAt: updates.scheduledAt
          ? normalizeScheduledAt(updates.scheduledAt)
          : normalizeScheduledAt(next[index].scheduledAt),
        updatedAt: new Date().toISOString(),
      };
      await writeSchedules(username, next);
      return res.status(200).json({ ok: true, schedule: next[index] });
    }

    const updated = schedules.filter((s) => s.status === "pending");
    await writeSchedules(username, updated);
    return res.status(200).json({ ok: true, remaining: updated.length });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
