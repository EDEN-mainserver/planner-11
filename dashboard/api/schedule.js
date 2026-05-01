// Threads 예약 게시 관리 API
// GET  /api/schedule?username=xxx  → 예약 목록 반환
// POST /api/schedule               → 예약 추가   { username, schedule }
// DELETE /api/schedule             → 예약 취소   { username, id }
// PATCH  /api/schedule             → 완료 항목 일괄 삭제 { username }
// PATCH  /api/schedule             → 예약 수정 { username, id, updates }

import {
  clearNonPendingSchedules,
  deleteScheduleRecord,
  isDuplicateScheduleTextError,
  readAllSchedules,
  saveSchedule,
  updateScheduleRecord,
} from "./_schedule-storage.js";

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
    const schedules = await readAllSchedules(username);
    return res.status(200).json({ schedules });
  }

  // POST — 예약 추가
  if (req.method === "POST") {
    const { username, schedule } = req.body || {};
    if (!username || !schedule) return res.status(400).json({ error: "username, schedule 필요" });
    try {
      const saved = await saveSchedule(username, schedule);
      return res.status(200).json({ ok: true, schedule: saved });
    } catch (error) {
      if (isDuplicateScheduleTextError(error)) {
        return res.status(409).json({ error: error.message, duplicate: error.duplicate || null });
      }
      throw error;
    }
  }

  // DELETE — 예약 취소 (단건)
  if (req.method === "DELETE") {
    const { username, id } = req.body || {};
    if (!username || !id) return res.status(400).json({ error: "username, id 필요" });
    await deleteScheduleRecord(username, id);
    return res.status(200).json({ ok: true });
  }

  // PATCH — 완료/실패 항목 일괄 삭제
  if (req.method === "PATCH") {
    const { username, id, updates } = req.body || {};
    if (!username) return res.status(400).json({ error: "username 필요" });

    if (id && updates && typeof updates === "object") {
      try {
        const schedule = await updateScheduleRecord(username, id, updates);
        if (!schedule) return res.status(404).json({ error: "예약을 찾을 수 없습니다" });
        return res.status(200).json({ ok: true, schedule });
      } catch (error) {
        if (isDuplicateScheduleTextError(error)) {
          return res.status(409).json({ error: error.message, duplicate: error.duplicate || null });
        }
        throw error;
      }
    }

    const remaining = await clearNonPendingSchedules(username);
    return res.status(200).json({ ok: true, remaining });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
