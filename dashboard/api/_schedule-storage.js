import { del, list, put } from "@vercel/blob";
import {
  isSupabaseSchedulesAvailable,
  upsertScheduleToSupabase,
  listSchedulesFromSupabase,
  updateScheduleInSupabase,
  deleteScheduleFromSupabase,
  clearNonPendingSchedulesFromSupabase,
  listUsernamesFromSupabase,
} from "./_supabase-schedules.js";

export const SCHEDULE_PREFIX = "threads-schedule";

function normalizeSchedulePlatform(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "instagram") return "instagram";
  return "threads";
}

function normalizeScheduleText(text) {
  return String(text || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function createDuplicateScheduleError(duplicate) {
  const error = new Error("같은 본문의 예약 글이 이미 있습니다");
  error.code = "DUPLICATE_SCHEDULE_TEXT";
  error.status = 409;
  error.duplicate = duplicate || null;
  return error;
}

export function isDuplicateScheduleTextError(error) {
  return error?.code === "DUPLICATE_SCHEDULE_TEXT";
}

function sortByUploadedAtDesc(a, b) {
  return new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0);
}

function sortSchedulesAsc(a, b) {
  const aTime = Date.parse(a?.scheduledAt || "") || Date.parse(a?.createdAt || "") || 0;
  const bTime = Date.parse(b?.scheduledAt || "") || Date.parse(b?.createdAt || "") || 0;
  if (aTime !== bTime) return aTime - bTime;
  return String(a?.id || "").localeCompare(String(b?.id || ""));
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

async function getLatestBlob(prefix) {
  const { blobs } = await list({ prefix });
  if (!blobs.length) return null;
  return [...blobs].sort(sortByUploadedAtDesc)[0];
}

function toLegacyPath(username) {
  return `${SCHEDULE_PREFIX}/${username}.json`;
}

function toItemPath(username, scheduleId) {
  return `${SCHEDULE_PREFIX}/${username}/${scheduleId}.json`;
}

function toStoredSchedule(schedule) {
  return {
    ...schedule,
    scheduledAt: normalizeScheduledAt(schedule?.scheduledAt),
    platform: normalizeSchedulePlatform(schedule?.platform),
  };
}

export function normalizeScheduledAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(raw)) {
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? raw : parsed.toISOString();
  }
  const parsed = new Date(raw);
  if (!isNaN(parsed.getTime())) return parsed.toISOString();
  return raw;
}

export async function readLegacySchedules(username) {
  try {
    const blob = await getLatestBlob(toLegacyPath(username));
    if (!blob) return { blob: null, schedules: [] };
    const data = await fetchJson(blob.url);
    const schedules = Array.isArray(data) ? data.map(toStoredSchedule) : [];
    return { blob, schedules };
  } catch {
    return { blob: null, schedules: [] };
  }
}

export async function listScheduleItemBlobs(username) {
  try {
    const { blobs } = await list({ prefix: `${SCHEDULE_PREFIX}/${username}/` });
    return blobs.filter((blob) => blob.pathname.endsWith(".json"));
  } catch {
    return [];
  }
}

export async function readScheduleItem(username, scheduleId) {
  try {
    const blob = await getLatestBlob(toItemPath(username, scheduleId));
    if (!blob) return { blob: null, schedule: null };
    const data = await fetchJson(blob.url);
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      return { blob, schedule: null };
    }
    return { blob, schedule: toStoredSchedule(data) };
  } catch {
    return { blob: null, schedule: null };
  }
}

export async function readAllSchedules(username) {
  // Supabase + Blob 양쪽에서 읽어 id로 merge. Supabase 데이터가 우선(최신).
  // 마이그레이션 완료 후엔 Blob 읽기 제거 예정.
  const [supabaseSchedules, { schedules: legacySchedules }, itemBlobs] = await Promise.all([
    isSupabaseSchedulesAvailable() ? listSchedulesFromSupabase(username) : Promise.resolve(null),
    readLegacySchedules(username),
    listScheduleItemBlobs(username),
  ]);

  const itemEntries = await Promise.all(
    itemBlobs.map(async (blob) => {
      try {
        const data = await fetchJson(blob.url);
        if (!data || typeof data !== "object" || Array.isArray(data)) return null;
        return { blob, schedule: toStoredSchedule(data) };
      } catch {
        return null;
      }
    })
  );

  const byId = new Map();

  for (const schedule of legacySchedules) {
    if (!schedule?.id) continue;
    byId.set(schedule.id, schedule);
  }

  for (const entry of itemEntries) {
    const schedule = entry?.schedule;
    if (!schedule?.id) continue;
    byId.set(schedule.id, schedule);
  }

  // Supabase가 마지막 — 동일 ID면 덮어씀 (Supabase가 source of truth)
  if (Array.isArray(supabaseSchedules)) {
    for (const schedule of supabaseSchedules) {
      if (!schedule?.id) continue;
      byId.set(schedule.id, schedule);
    }
  }

  return [...byId.values()].sort(sortSchedulesAsc);
}

export async function writeLegacySchedules(username, schedules) {
  await put(toLegacyPath(username), JSON.stringify(schedules.map(toStoredSchedule)), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function saveSchedule(username, schedule) {
  if (!schedule?.id) {
    throw new Error("schedule.id is required");
  }

  const stored = toStoredSchedule(schedule);
  const normalizedText = normalizeScheduleText(stored.text);
  if (normalizedText) {
    const schedules = await readAllSchedules(username);
    const duplicate = schedules.find((item) => {
      if (!item?.id || item.id === stored.id) return false;
      if (item.status !== "pending" && item.status !== "posted") return false;
      if (normalizeSchedulePlatform(item.platform) !== normalizeSchedulePlatform(stored.platform)) return false;
      return normalizeScheduleText(item.text) === normalizedText;
    });
    if (duplicate) {
      throw createDuplicateScheduleError(duplicate);
    }
  }

  // Dual-write: Supabase + Blob 동시 기록. Supabase가 source of truth.
  // Blob은 마이그레이션 안전망 (Supabase 장애 시 fallback). 검증 후 단계적 폐기.
  const writes = [
    put(toItemPath(username, stored.id), JSON.stringify(stored), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    }),
  ];
  if (isSupabaseSchedulesAvailable()) {
    writes.push(
      upsertScheduleToSupabase(username, stored).catch((e) => {
        console.error("[schedule-storage] Supabase upsert 실패, Blob에만 저장:", e.message);
        return null;
      })
    );
  }
  await Promise.all(writes);
  return stored;
}

export async function updateScheduleRecord(username, scheduleId, updates) {
  const { schedule: itemSchedule } = await readScheduleItem(username, scheduleId);
  if (itemSchedule) {
    const next = {
      ...itemSchedule,
      ...updates,
      id: scheduleId,
      scheduledAt: updates?.scheduledAt
        ? normalizeScheduledAt(updates.scheduledAt)
        : normalizeScheduledAt(itemSchedule.scheduledAt),
      updatedAt: new Date().toISOString(),
    };
    await saveSchedule(username, next);
    return next;
  }

  const { schedules: legacySchedules } = await readLegacySchedules(username);
  const legacySchedule = legacySchedules.find((schedule) => schedule.id === scheduleId);
  if (!legacySchedule) return null;

  const upgraded = {
    ...legacySchedule,
    ...updates,
    id: scheduleId,
    scheduledAt: updates?.scheduledAt
      ? normalizeScheduledAt(updates.scheduledAt)
      : normalizeScheduledAt(legacySchedule.scheduledAt),
    updatedAt: new Date().toISOString(),
  };
  await saveSchedule(username, upgraded);
  return upgraded;
}

export async function deleteScheduleRecord(username, scheduleId) {
  const [{ blob: itemBlob }, legacy] = await Promise.all([
    readScheduleItem(username, scheduleId),
    readLegacySchedules(username),
  ]);

  if (itemBlob?.url) {
    await del(itemBlob.url).catch(() => {});
  }

  const nextLegacy = legacy.schedules.filter((schedule) => schedule.id !== scheduleId);
  if (nextLegacy.length !== legacy.schedules.length) {
    await writeLegacySchedules(username, nextLegacy);
  }

  // Supabase에서도 삭제 (best-effort, 실패해도 Blob 측은 이미 처리됨)
  let supabaseDeleted = false;
  if (isSupabaseSchedulesAvailable()) {
    try {
      supabaseDeleted = await deleteScheduleFromSupabase(username, scheduleId);
    } catch (e) {
      console.error("[schedule-storage] Supabase 삭제 실패:", e.message);
    }
  }

  return Boolean(itemBlob?.url) || nextLegacy.length !== legacy.schedules.length || supabaseDeleted;
}

export async function clearNonPendingSchedules(username) {
  const [legacy, itemBlobs] = await Promise.all([
    readLegacySchedules(username),
    listScheduleItemBlobs(username),
  ]);

  const itemEntries = await Promise.all(
    itemBlobs.map(async (blob) => {
      try {
        const data = await fetchJson(blob.url);
        return { blob, schedule: data ? toStoredSchedule(data) : null };
      } catch {
        return { blob, schedule: null };
      }
    })
  );

  const removable = itemEntries.filter(({ schedule }) => schedule?.status && schedule.status !== "pending");
  const removableIds = new Set(removable.map(({ schedule }) => schedule?.id).filter(Boolean));
  const nextLegacy = legacy.schedules.filter(
    (schedule) => schedule.status === "pending" && !removableIds.has(schedule.id)
  );

  if (nextLegacy.length !== legacy.schedules.length) {
    await writeLegacySchedules(username, nextLegacy);
  }

  await Promise.allSettled(removable.map(({ blob }) => del(blob.url)));

  // Supabase에서도 비-pending 일괄 삭제 (best-effort)
  if (isSupabaseSchedulesAvailable()) {
    try {
      await clearNonPendingSchedulesFromSupabase(username);
    } catch (e) {
      console.error("[schedule-storage] Supabase clear-non-pending 실패:", e.message);
    }
  }

  return nextLegacy.length + (itemEntries.length - removable.length);
}

export async function listScheduleUsernames() {
  const usernames = new Set();

  // Supabase 우선
  if (isSupabaseSchedulesAvailable()) {
    try {
      const supabaseUsernames = await listUsernamesFromSupabase();
      if (Array.isArray(supabaseUsernames)) {
        supabaseUsernames.forEach((u) => usernames.add(u));
      }
    } catch (e) {
      console.error("[schedule-storage] Supabase list-usernames 실패:", e.message);
    }
  }

  // Blob 합집합 (마이그레이션 안전망)
  try {
    const { blobs } = await list({ prefix: `${SCHEDULE_PREFIX}/` });
    for (const blob of blobs) {
      const suffix = blob.pathname.replace(`${SCHEDULE_PREFIX}/`, "");
      if (!suffix) continue;
      const [firstSegment] = suffix.split("/");
      if (!firstSegment) continue;
      usernames.add(firstSegment.replace(/\.json$/, ""));
    }
  } catch (e) {
    console.error("[schedule-storage] Blob list 실패:", e.message);
  }

  return [...usernames].sort();
}
