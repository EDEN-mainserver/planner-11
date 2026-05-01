import { del, list, put } from "@vercel/blob";

export const SCHEDULE_PREFIX = "threads-schedule";

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
  const [{ schedules: legacySchedules }, itemBlobs] = await Promise.all([
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
  await put(toItemPath(username, stored.id), JSON.stringify(stored), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
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

  return itemBlob?.url || nextLegacy.length !== legacy.schedules.length;
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

  return nextLegacy.length + (itemEntries.length - removable.length);
}

export async function listScheduleUsernames() {
  const { blobs } = await list({ prefix: `${SCHEDULE_PREFIX}/` });
  const usernames = new Set();

  for (const blob of blobs) {
    const suffix = blob.pathname.replace(`${SCHEDULE_PREFIX}/`, "");
    if (!suffix) continue;
    const [firstSegment] = suffix.split("/");
    if (!firstSegment) continue;
    usernames.add(firstSegment.replace(/\.json$/, ""));
  }

  return [...usernames].sort();
}
