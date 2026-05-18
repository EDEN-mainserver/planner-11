// 일회성 마이그레이션 엔드포인트 — Blob의 모든 schedule을 Supabase로 임포트.
// 검증 후 이 파일 삭제 가능.
//
// 사용법:
//   POST /api/admin/import-schedules-to-supabase
//   Body: { dryRun?: boolean, username?: string }   (기본 dryRun=true)
//
// 응답: { ok, scanned, inserted, skipped, errors[], dryRun }

import { list } from "@vercel/blob";
import {
  isSupabaseSchedulesAvailable,
  upsertScheduleToSupabase,
} from "../_supabase-schedules.js";
import {
  SCHEDULE_PREFIX,
  readLegacySchedules,
  listScheduleItemBlobs,
} from "../_schedule-storage.js";

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  if (!isSupabaseSchedulesAvailable()) return res.status(503).json({ error: "Supabase 미설정" });

  const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
  const dryRun = body.dryRun !== false; // 기본 true (안전)
  const onlyUsername = body.username || null;

  let usernames = [];
  if (onlyUsername) {
    usernames = [onlyUsername];
  } else {
    // 모든 username 추출
    const { blobs } = await list({ prefix: `${SCHEDULE_PREFIX}/` });
    const set = new Set();
    for (const blob of blobs) {
      const suffix = blob.pathname.replace(`${SCHEDULE_PREFIX}/`, "");
      if (!suffix) continue;
      const [firstSegment] = suffix.split("/");
      if (!firstSegment) continue;
      set.add(firstSegment.replace(/\.json$/, ""));
    }
    usernames = [...set];
  }

  let scanned = 0;
  let inserted = 0;
  let skipped = 0;
  const errors = [];
  const perUser = {};

  for (const username of usernames) {
    perUser[username] = { scanned: 0, inserted: 0, skipped: 0, errors: 0 };
    try {
      // 1) 레거시 단일 blob의 schedules
      const { schedules: legacySchedules } = await readLegacySchedules(username);
      // 2) per-item blobs
      const itemBlobs = await listScheduleItemBlobs(username);
      const itemSchedules = await Promise.all(
        itemBlobs.map(async (blob) => {
          try {
            const data = await fetchJson(blob.url);
            if (!data || typeof data !== "object" || Array.isArray(data)) return null;
            return data;
          } catch {
            return null;
          }
        })
      );

      // merge by id (per-item이 더 최신)
      const byId = new Map();
      for (const s of legacySchedules) {
        if (s?.id) byId.set(s.id, s);
      }
      for (const s of itemSchedules) {
        if (s?.id) byId.set(s.id, s);
      }

      for (const schedule of byId.values()) {
        scanned += 1;
        perUser[username].scanned += 1;
        if (dryRun) {
          inserted += 1;
          perUser[username].inserted += 1;
          continue;
        }
        try {
          await upsertScheduleToSupabase(username, schedule);
          inserted += 1;
          perUser[username].inserted += 1;
        } catch (e) {
          errors.push({ username, id: schedule.id, error: e.message });
          perUser[username].errors += 1;
        }
      }
    } catch (e) {
      errors.push({ username, error: `사용자 단위 실패: ${e.message}` });
    }
  }

  return res.status(200).json({
    ok: true,
    dryRun,
    usernames: usernames.length,
    scanned,
    inserted,
    skipped,
    errorCount: errors.length,
    errors: errors.slice(0, 20),
    perUser,
  });
}
