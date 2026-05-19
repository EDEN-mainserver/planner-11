// 외부 인기글(Threads/X) 저장소 — Supabase external_trending 테이블.
// post_url unique 키로 중복 차단. 7일 이상된 행은 별도 정리.

import { getSupabaseAdmin } from "./_lib/supabaseAdmin.js";

const RETENTION_DAYS = 7;

// 단건 또는 배치 upsert. posts 배열 — { post_url, ... }
export async function upsertExternalTrending(username, platform, keyword, posts, rawByUrl = {}) {
  const supabase = getSupabaseAdmin();
  if (!supabase || !Array.isArray(posts) || posts.length === 0) return { inserted: 0 };
  const rows = posts
    .filter((p) => p?.post_url || p?.postUrl || p?.link)
    .map((p) => {
      const post_url = String(p.post_url || p.postUrl || p.link).trim();
      return {
        post_url,
        username: String(username),
        platform: String(platform).toLowerCase(),
        keyword: keyword ? String(keyword) : null,
        author: p.author || null,
        content: String(p.content || "").slice(0, 2000),
        hashtags: extractHashtags(p.content || ""),
        likes: numOrNull(p.likes),
        replies: numOrNull(p.replies ?? p.comments),
        shares: numOrNull(p.shares),
        views: numOrNull(p.views),
        posted_at: p.posted_at || p.datetime || null,
        crawled_at: new Date().toISOString(),
        raw_payload: rawByUrl[post_url] || p.raw || null,
      };
    });
  if (!rows.length) return { inserted: 0 };
  const { data, error } = await supabase
    .from("external_trending")
    .upsert(rows, { onConflict: "post_url" })
    .select("post_url");
  if (error) {
    console.error("[external-trending] upsert 실패:", error.message);
    throw new Error(`external_trending upsert: ${error.message}`);
  }
  return { inserted: data?.length || 0 };
}

// 7일 지난 행 정리 (cron이 호출). cleanup
export async function pruneOldExternalTrending() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return 0;
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("external_trending")
    .delete()
    .lt("crawled_at", cutoff)
    .select("post_url");
  if (error) {
    console.error("[external-trending] prune 실패:", error.message);
    return 0;
  }
  return data?.length || 0;
}

// 사용자별 최근 인기글 조회 — 헤르메스 / 자동 리서치 학습 입력
export async function listRecentExternalTrending(username, platform, limit = 100) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return [];
  let query = supabase
    .from("external_trending")
    .select("*")
    .eq("username", username)
    .order("crawled_at", { ascending: false })
    .limit(limit);
  if (platform) query = query.eq("platform", String(platform).toLowerCase());
  const { data, error } = await query;
  if (error) {
    console.error("[external-trending] list 실패:", error.message);
    return [];
  }
  return data || [];
}

function numOrNull(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function extractHashtags(text) {
  if (!text) return [];
  const tags = String(text).match(/#[\p{L}\p{N}_]+/gu);
  return tags ? [...new Set(tags)] : [];
}
