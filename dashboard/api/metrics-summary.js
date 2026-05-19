// 학습 루프 데이터 요약 — 비개발자도 브라우저에서 한 번에 보는 GET endpoint.
// GET /api/metrics-summary?username=eden&days=30
// 반환: 외부 인기글 풀, 내 글 메트릭, 누적 통계.

import { getSupabaseAdmin } from "./_lib/supabaseAdmin.js";

export const config = { maxDuration: 30, memory: 512 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  const username = String(req.query?.username || "").trim();
  const days = Math.max(1, Math.min(90, Number(req.query?.days) || 30));
  if (!username) return res.status(400).json({ error: "username 필요" });

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(500).json({ error: "Supabase 미설정" });

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  try {
    const [externalAll, postMetricsRecent, schedulesRecent] = await Promise.all([
      supabase
        .from("external_trending")
        .select("post_url, platform, keyword, author, content, likes, replies, shares, views, crawled_at")
        .eq("username", username)
        .gte("crawled_at", cutoff)
        .order("crawled_at", { ascending: false })
        .limit(500),
      supabase
        .from("post_metrics")
        .select("*")
        .gte("fetched_at", cutoff)
        .order("fetched_at", { ascending: false })
        .limit(500),
      supabase
        .from("schedules")
        .select("id, platform, status, scheduled_at, caption, source_info")
        .eq("username", username)
        .eq("status", "posted")
        .gte("scheduled_at", cutoff),
    ]);

    const external = externalAll.data || [];
    const myMetrics = postMetricsRecent.data || [];
    const mySchedules = schedulesRecent.data || [];

    // 외부 인기글 요약
    const externalSummary = summarizeExternal(external);

    // 내 글 요약 (schedule + 최신 metric 머지)
    const latestMetricByScheduleId = new Map();
    for (const m of myMetrics) {
      if (!latestMetricByScheduleId.has(m.schedule_id)) {
        latestMetricByScheduleId.set(m.schedule_id, m);
      }
    }
    const mySummary = summarizeMy(mySchedules, latestMetricByScheduleId);

    return res.status(200).json({
      ok: true,
      username,
      window: `최근 ${days}일`,
      external: externalSummary,
      my: mySummary,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function summarizeExternal(rows) {
  if (!rows.length) {
    return { total: 0, by_platform: {}, top5_threads: [], top5_x: [], top_hashtags: [], top_authors: [] };
  }
  const byPlatform = {};
  for (const r of rows) {
    byPlatform[r.platform] = (byPlatform[r.platform] || 0) + 1;
  }
  const sortByLikes = (a, b) => (b.likes || 0) - (a.likes || 0);
  const top = (platform) => rows
    .filter((r) => r.platform === platform)
    .sort(sortByLikes)
    .slice(0, 5)
    .map((r) => ({
      author: r.author,
      content: String(r.content || "").slice(0, 200),
      likes: r.likes || 0,
      replies: r.replies || 0,
      shares: r.shares || 0,
      views: r.views || 0,
      crawled_at: r.crawled_at,
      url: r.post_url,
    }));

  // 해시태그 추출 (content에서)
  const hashtagCount = {};
  for (const r of rows) {
    const tags = String(r.content || "").match(/#[\p{L}\p{N}_]+/gu) || [];
    for (const t of tags) hashtagCount[t] = (hashtagCount[t] || 0) + 1;
  }
  const top_hashtags = Object.entries(hashtagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  // 작성자 빈도
  const authorCount = {};
  for (const r of rows) {
    if (!r.author) continue;
    authorCount[r.author] = (authorCount[r.author] || 0) + 1;
  }
  const top_authors = Object.entries(authorCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([author, count]) => ({ author, count }));

  return {
    total: rows.length,
    by_platform: byPlatform,
    top5_threads: top("threads"),
    top5_x: top("x"),
    top_hashtags,
    top_authors,
  };
}

function summarizeMy(schedules, latestMetricByScheduleId) {
  if (!schedules.length) {
    return { total: 0, by_platform: {}, with_metrics: 0, avg_engagement: 0, top5: [] };
  }
  const byPlatform = {};
  const merged = [];
  for (const s of schedules) {
    byPlatform[s.platform] = (byPlatform[s.platform] || 0) + 1;
    const m = latestMetricByScheduleId.get(s.id);
    merged.push({
      id: s.id,
      platform: s.platform,
      scheduled_at: s.scheduled_at,
      caption_preview: String(s.caption || "").slice(0, 100),
      mediaId: s.source_info?._postMeta?.mediaId || null,
      permalink: s.source_info?._postMeta?.permalink || null,
      metric: m ? {
        likes: m.likes, replies: m.replies, shares: m.shares, saves: m.saves,
        views: m.views, impressions: m.impressions, reach: m.reach,
        engagement: m.engagement, engagement_rate: m.engagement_rate,
        fetched_at: m.fetched_at,
      } : null,
    });
  }
  const withMetrics = merged.filter((x) => x.metric);
  const totalEng = withMetrics.reduce((s, x) => s + (x.metric.engagement || 0), 0);
  const avgEngagement = withMetrics.length ? Math.round(totalEng / withMetrics.length) : 0;
  const top5 = [...withMetrics]
    .sort((a, b) => (b.metric.engagement || 0) - (a.metric.engagement || 0))
    .slice(0, 5);
  return {
    total: schedules.length,
    by_platform: byPlatform,
    with_metrics: withMetrics.length,
    avg_engagement: avgEngagement,
    top5,
  };
}
