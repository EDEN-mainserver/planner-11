// 글 성과 메트릭 저장소 — Supabase post_metrics 테이블.
// 시계열: 같은 schedule_id에 대해 fetched_at 별로 행 누적.
// Supabase 미설정 시 모든 함수가 null/[] 반환 (graceful degradation).

import { getSupabaseAdmin } from "./_lib/supabaseAdmin.js";

// 단일 메트릭 행 삽입. payload 는 platform에 따라 다른 메트릭 셋.
export async function insertMetricRow(scheduleId, platform, metrics, rawPayload) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const row = {
    schedule_id: String(scheduleId),
    fetched_at: new Date().toISOString(),
    platform: String(platform).toLowerCase(),
    likes: numOrNull(metrics.likes),
    replies: numOrNull(metrics.replies),
    shares: numOrNull(metrics.shares),
    saves: numOrNull(metrics.saves),
    views: numOrNull(metrics.views),
    impressions: numOrNull(metrics.impressions),
    reach: numOrNull(metrics.reach),
    profile_visits: numOrNull(metrics.profile_visits),
    quotes: numOrNull(metrics.quotes),
    engagement: numOrNull(metrics.engagement),
    engagement_rate: metrics.engagement_rate != null ? Number(metrics.engagement_rate) : null,
    raw_payload: rawPayload || null,
  };
  const { error } = await supabase.from("post_metrics").insert(row);
  if (error) {
    console.error("[metrics-storage] insert 실패:", error.message);
    throw new Error(`post_metrics insert 실패: ${error.message}`);
  }
  return row;
}

// schedule_id 배열에 대해 각각의 최신 메트릭 행만 조회. distinct on 패턴.
export async function latestMetricsByScheduleIds(scheduleIds) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !Array.isArray(scheduleIds) || scheduleIds.length === 0) return [];
  // Supabase JS는 distinct on을 직접 지원하지 않음 → in() + order로 받고 클라이언트에서 dedup
  const { data, error } = await supabase
    .from("post_metrics")
    .select("*")
    .in("schedule_id", scheduleIds)
    .order("fetched_at", { ascending: false });
  if (error) {
    console.error("[metrics-storage] latest 조회 실패:", error.message);
    return [];
  }
  const seen = new Set();
  const latest = [];
  for (const row of data || []) {
    if (seen.has(row.schedule_id)) continue;
    seen.add(row.schedule_id);
    latest.push(row);
  }
  return latest;
}

function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
