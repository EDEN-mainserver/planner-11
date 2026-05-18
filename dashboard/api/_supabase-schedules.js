// Supabase schedules 테이블 CRUD 헬퍼. _schedule-storage.js의 Blob 함수와 짝.
// Supabase 미설정 시 모든 함수가 null/false 반환 → 호출자가 Blob 폴백.

import { getSupabaseAdmin } from "./_lib/supabaseAdmin.js";

// JS 스케줄 객체(camelCase) → Postgres row(snake_case)
export function scheduleToRow(username, schedule) {
  if (!schedule?.id) throw new Error("schedule.id is required");
  const captionText = schedule.caption || schedule.text || "";
  const imageUrls = Array.isArray(schedule.imageUrls)
    ? schedule.imageUrls
    : Array.isArray(schedule.images)
      ? schedule.images
      : [];
  return {
    id: String(schedule.id),
    username: String(username),
    platform: String(schedule.platform || "threads").toLowerCase(),
    status: String(schedule.status || "pending").toLowerCase(),
    scheduled_at: schedule.scheduledAt || null,
    retry_at: schedule.retryAt || null,
    last_attempt_at: schedule.lastAttemptAt || null,
    // created_at / updated_at: Supabase default / trigger
    caption: captionText || null,
    image_urls: imageUrls,
    account_id: schedule.accountId || null,
    access_token: schedule.accessToken || null,
    user_id: schedule.userId || null,
    auto: Boolean(schedule.auto),
    retry_count: Number.isFinite(schedule.retryCount) ? Number(schedule.retryCount) : 0,
    last_error: schedule.lastError || null,
    run_id: schedule.runId || null,
    topic: schedule.topic || null,
    slide_count: Number.isFinite(schedule.slideCount) ? Number(schedule.slideCount) : null,
    source_info: schedule.sourceInfo || null,
  };
}

// Postgres row → JS 스케줄 객체 (Blob 포맷과 호환되도록 alias 포함)
export function rowToSchedule(row) {
  if (!row) return null;
  const imageUrls = Array.isArray(row.image_urls) ? row.image_urls : [];
  return {
    id: row.id,
    platform: row.platform,
    status: row.status,
    scheduledAt: row.scheduled_at,
    retryAt: row.retry_at,
    lastAttemptAt: row.last_attempt_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    caption: row.caption || "",
    text: row.caption || "",
    imageUrls,
    images: imageUrls,
    accountId: row.account_id || "",
    accessToken: row.access_token || "",
    userId: row.user_id || "",
    auto: Boolean(row.auto),
    retryCount: row.retry_count || 0,
    lastError: row.last_error || null,
    runId: row.run_id || null,
    topic: row.topic || "",
    slideCount: row.slide_count || 0,
    sourceInfo: row.source_info || null,
  };
}

// Supabase 사용 가능 여부 (호출자가 폴백 분기에 사용)
export function isSupabaseSchedulesAvailable() {
  return Boolean(getSupabaseAdmin());
}

// 단건 upsert (INSERT ON CONFLICT DO UPDATE). 실패 시 throw.
export async function upsertScheduleToSupabase(username, schedule) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const row = scheduleToRow(username, schedule);
  const { data, error } = await supabase
    .from("schedules")
    .upsert(row, { onConflict: "id" })
    .select()
    .single();
  if (error) throw new Error(`Supabase upsert 실패: ${error.message}`);
  return rowToSchedule(data);
}

// 사용자별 전체 스케줄 조회. 실패 시 null 반환 (폴백 트리거).
export async function listSchedulesFromSupabase(username) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .eq("username", username)
    .order("scheduled_at", { ascending: true });
  if (error) {
    console.error("[supabase-schedules] list 실패:", error.message);
    return null;
  }
  return (data || []).map(rowToSchedule);
}

// 단건 조회. 없으면 null, 에러 시 null (로그).
export async function getScheduleFromSupabase(username, scheduleId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("schedules")
    .select("*")
    .eq("username", username)
    .eq("id", scheduleId)
    .maybeSingle();
  if (error) {
    console.error("[supabase-schedules] get 실패:", error.message);
    return null;
  }
  return data ? rowToSchedule(data) : null;
}

// 부분 업데이트. 실패 시 throw. 없는 ID이면 null.
export async function updateScheduleInSupabase(username, scheduleId, updates) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  // updates는 camelCase. snake_case 매핑만 적용.
  const patch = {};
  if (updates.status != null) patch.status = updates.status;
  if (updates.scheduledAt != null) patch.scheduled_at = updates.scheduledAt;
  if (updates.retryAt !== undefined) patch.retry_at = updates.retryAt;
  if (updates.lastAttemptAt !== undefined) patch.last_attempt_at = updates.lastAttemptAt;
  if (updates.caption != null) patch.caption = updates.caption;
  if (updates.text != null && patch.caption == null) patch.caption = updates.text;
  if (updates.imageUrls != null) patch.image_urls = updates.imageUrls;
  if (updates.retryCount != null) patch.retry_count = updates.retryCount;
  if (updates.lastError !== undefined) patch.last_error = updates.lastError;
  if (updates.accessToken != null) patch.access_token = updates.accessToken;
  if (updates.sourceInfo != null) patch.source_info = updates.sourceInfo;
  // updated_at은 트리거가 자동 갱신

  const { data, error } = await supabase
    .from("schedules")
    .update(patch)
    .eq("username", username)
    .eq("id", scheduleId)
    .select()
    .maybeSingle();
  if (error) throw new Error(`Supabase update 실패: ${error.message}`);
  return data ? rowToSchedule(data) : null;
}

// 단건 삭제. 없으면 false, 성공 시 true.
export async function deleteScheduleFromSupabase(username, scheduleId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error, count } = await supabase
    .from("schedules")
    .delete({ count: "exact" })
    .eq("username", username)
    .eq("id", scheduleId);
  if (error) {
    console.error("[supabase-schedules] delete 실패:", error.message);
    return false;
  }
  return (count || 0) > 0;
}

// 비-pending 일괄 삭제. 삭제 수 반환.
export async function clearNonPendingSchedulesFromSupabase(username) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;
  const { error, count } = await supabase
    .from("schedules")
    .delete({ count: "exact" })
    .eq("username", username)
    .neq("status", "pending");
  if (error) {
    console.error("[supabase-schedules] clear-non-pending 실패:", error.message);
    return 0;
  }
  return count || 0;
}

// 모든 username 목록 (cron이 전체 순회할 때 사용)
export async function listUsernamesFromSupabase() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  // distinct username 쿼리 — Supabase JS는 distinct 없으니 raw로
  const { data, error } = await supabase
    .from("schedules")
    .select("username");
  if (error) {
    console.error("[supabase-schedules] list-usernames 실패:", error.message);
    return null;
  }
  return [...new Set((data || []).map((r) => r.username).filter(Boolean))].sort();
}
