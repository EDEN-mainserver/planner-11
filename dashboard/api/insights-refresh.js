// 게시된 글의 메트릭을 주기적으로 갱신.
// Vercel cron: 0 *\/6 * * *  (6시간마다)
// 흐름: 모든 username × 최근 7일 posted schedules → 각 platform insights API 호출 → post_metrics 행 추가

import {
  listScheduleUsernames,
  readAllSchedules,
} from "./_schedule-storage.js";
import { insertMetricRow, latestMetricsByScheduleIds } from "./_metrics-storage.js";
import { normalizeThreadsInsights } from "./threads-insights.js";
import { normalizeInstagramInsights } from "./instagram-insights.js";

export const config = { maxDuration: 300, memory: 512 };

const POSTED_WINDOW_DAYS = 7;
const REFRESH_INTERVAL_MS = 5.5 * 60 * 60 * 1000; // 5.5h — 6h cron 안에 확실히 한 번 들어오게
const TH_API = "https://graph.threads.net/v1.0";
const IG_API = "https://graph.instagram.com/v22.0";
const FETCH_TIMEOUT_MS = 20000;

function isPostedRecently(schedule) {
  if (schedule?.status !== "posted") return false;
  const postedAt = schedule.postedAt || schedule.updatedAt || schedule.scheduledAt;
  if (!postedAt) return false;
  const ts = Date.parse(postedAt);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts < POSTED_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function needsRefresh(scheduleId, latestMap) {
  const latest = latestMap.get(scheduleId);
  if (!latest) return true;
  const ts = Date.parse(latest.fetched_at);
  if (!Number.isFinite(ts)) return true;
  return Date.now() - ts > REFRESH_INTERVAL_MS;
}

async function fetchThreadsMetrics(mediaId, accessToken) {
  const url = `${TH_API}/${encodeURIComponent(mediaId)}/insights?metric=views,likes,replies,reposts,quotes,shares&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const raw = await res.json();
  if (!res.ok) throw new Error(raw?.error?.message || `Threads insights ${res.status}`);
  return { metrics: normalizeThreadsInsights(raw), raw };
}

async function fetchInstagramMetrics(mediaId, accessToken, mediaType) {
  const metrics = mediaType === "CAROUSEL_ALBUM"
    ? "impressions,reach,saved,likes,comments,shares,total_interactions"
    : "impressions,reach,saved,likes,comments,shares";
  const url = `${IG_API}/${encodeURIComponent(mediaId)}/insights?metric=${encodeURIComponent(metrics)}&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const raw = await res.json();
  if (!res.ok) throw new Error(raw?.error?.message || `Instagram insights ${res.status}`);
  return { metrics: normalizeInstagramInsights(raw), raw };
}

export default async function handler(req, res) {
  // Vercel cron 인증 (CRON_SECRET 설정 시)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers["authorization"];
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const startedAt = new Date().toISOString();
  const summary = { startedAt, checkedUsers: 0, candidates: 0, refreshed: 0, skipped: 0, failed: 0, errors: [] };

  try {
    const usernames = await listScheduleUsernames();
    summary.checkedUsers = usernames.length;

    for (const username of usernames) {
      const schedules = await readAllSchedules(username);
      const targets = schedules.filter(isPostedRecently).filter((s) => s.mediaId);
      if (!targets.length) continue;
      summary.candidates += targets.length;

      const latest = await latestMetricsByScheduleIds(targets.map((s) => s.id));
      const latestMap = new Map(latest.map((r) => [r.schedule_id, r]));

      for (const schedule of targets) {
        if (!needsRefresh(schedule.id, latestMap)) {
          summary.skipped += 1;
          continue;
        }
        const accessToken = schedule.accessToken;
        if (!accessToken) {
          summary.skipped += 1;
          continue;
        }
        try {
          const platform = String(schedule.platform || "threads").toLowerCase();
          let result;
          if (platform === "threads") {
            result = await fetchThreadsMetrics(schedule.mediaId, accessToken);
          } else if (platform === "instagram") {
            const mediaType = schedule.sourceInfo?.mediaType || (Array.isArray(schedule.imageUrls) && schedule.imageUrls.length > 1 ? "CAROUSEL_ALBUM" : "");
            result = await fetchInstagramMetrics(schedule.mediaId, accessToken, mediaType);
          } else {
            summary.skipped += 1;
            continue;
          }
          await insertMetricRow(schedule.id, platform, result.metrics, result.raw);
          summary.refreshed += 1;
        } catch (err) {
          summary.failed += 1;
          summary.errors.push({ scheduleId: schedule.id, message: err.message });
          if (summary.errors.length > 20) summary.errors.length = 20;
        }
      }
    }

    summary.finishedAt = new Date().toISOString();
    return res.status(200).json({ ok: true, summary });
  } catch (err) {
    return res.status(500).json({ error: err.message, summary });
  }
}
