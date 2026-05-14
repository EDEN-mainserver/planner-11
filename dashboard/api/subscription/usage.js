import { put, list } from "@vercel/blob";
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";

const INTERNAL_USERS = ["eden", "user2", "user3", "user4"];
const BLOB_PREFIX = "subscriptions";
const PLAN_LIMITS = { basic: 20, standard: 80, premium: 200 };

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ── Supabase 어댑터 ──
// subscriptions 테이블에서 1건 조회. 없으면 null.
async function getSubscriptionFromSupabase(userId) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return rowToJson(data);
}

async function upsertSubscriptionToSupabase(json) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return false;
  const { error } = await supabase
    .from("subscriptions")
    .upsert(jsonToRow(json), { onConflict: "user_id" });
  return !error;
}

function jsonToRow(json) {
  return {
    user_id: json.userId,
    plan_id: json.planId || "basic",
    status: json.status || "active",
    current_period_start: json.currentPeriodStart || null,
    current_period_end: json.currentPeriodEnd || null,
    usage_count: Number(json.usageCount) || 0,
    usage_reset_at: json.usageResetAt || null,
  };
}

function rowToJson(row) {
  return {
    userId: row.user_id,
    planId: row.plan_id,
    status: row.status,
    currentPeriodStart: row.current_period_start,
    currentPeriodEnd: row.current_period_end,
    usageCount: row.usage_count,
    usageResetAt: row.usage_reset_at,
  };
}

// ── Blob fallback ──
async function getSubscriptionFromBlob(userId) {
  try {
    const path = `${BLOB_PREFIX}/${userId}.json`;
    const { blobs } = await list({ prefix: path });
    if (!blobs.length) return null;
    const resp = await fetch(blobs[0].url);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

// dual-read: Supabase 우선, 없으면 Blob fallback.
async function getSubscription(userId) {
  const fromSupabase = await getSubscriptionFromSupabase(userId);
  if (fromSupabase) return fromSupabase;
  return getSubscriptionFromBlob(userId);
}

// write는 Supabase 우선, 실패 시 Blob에라도 저장 (안전망).
async function saveSubscription(data) {
  const ok = await upsertSubscriptionToSupabase(data);
  if (ok) return;
  // Supabase 실패 시 Blob에 저장 — 데이터 손실 방지
  const path = `${BLOB_PREFIX}/${data.userId}.json`;
  await put(path, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: "userId 필요" });

  if (INTERNAL_USERS.includes(userId)) {
    return res.status(200).json({ ok: true, usageCount: 0, limit: 9999, remaining: 9999 });
  }

  const sub = await getSubscription(userId);
  if (!sub) return res.status(403).json({ error: "구독 정보 없음. 플랜을 구독해주세요." });
  if (sub.status !== "active") return res.status(402).json({ error: "구독이 만료되었습니다." });

  const now = new Date();
  const resetAt = new Date(sub.usageResetAt);
  let usageCount = sub.usageCount || 0;

  if (now >= resetAt) {
    usageCount = 0;
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    sub.usageResetAt = nextReset.toISOString();
  }

  const limit = PLAN_LIMITS[sub.planId] || 20;
  if (usageCount >= limit) {
    return res.status(402).json({
      error: `이번 달 사용 횟수(${limit}회)를 모두 소진했습니다. 플랜을 업그레이드하세요.`,
      usageCount,
      limit,
      remaining: 0,
    });
  }

  usageCount += 1;
  sub.usageCount = usageCount;
  await saveSubscription(sub);

  return res.status(200).json({
    ok: true,
    usageCount,
    limit,
    remaining: limit - usageCount,
  });
}
