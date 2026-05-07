// Instagram 예약 게시 크론 핸들러
// Vercel Cron (Pro): * * * * *  매 분 실행
// 또는 cron-job.org 등 외부 무료 크론 서비스로 1분마다 이 URL 호출 가능

import {
  listScheduleUsernames,
  readAllSchedules,
  updateScheduleRecord,
} from "./_schedule-storage.js";
import { postInstagram } from "./instagram-post.js";

const MAX_RETRY_ATTEMPTS = 3;

function normalizeScheduledAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(raw)) {
    const kst = new Date(`${raw.replace(" ", "T")}+09:00`);
    return isNaN(kst.getTime()) ? null : kst;
  }
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

function isRetryableInstagramError(message) {
  const text = String(message || "").toLowerCase();
  if (!text) return true;
  const fatalMarkers = [
    "accountid",
    "access token",
    "token",
    "unauthorized",
    "forbidden",
    "permission",
    "필수",
    "없습니다",
    "잘못된",
    "지원하지 않는",
    "이미지가 없습니다",
    "invalid",
  ];
  return !fatalMarkers.some((marker) => text.includes(marker));
}

function getRetryDelayMs(retryCount) {
  const minutes = Math.min(15, 5 * (retryCount + 1));
  return minutes * 60 * 1000;
}

export const config = { maxDuration: 90, memory: 512 };

async function postInstagramSchedule(post) {
  const accountId = post.accountId || post.userId;
  const accessToken = post.accessToken;
  const images = Array.isArray(post.images) && post.images.length > 0
    ? post.images
    : Array.isArray(post.imageUrls) ? post.imageUrls : [];
  const caption = post.caption || post.text || "";
  const result = await postInstagram(accountId, accessToken, images, caption);
  return {
    mediaId: result.mediaId,
    permalink: result.permalink || null,
  };
}

export default async function handler(req, res) {
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

  const now = new Date();
  const results = [];
  let checked = 0;

  try {
    const usernames = await listScheduleUsernames();
    checked = usernames.length;

    for (const username of usernames) {
      const schedules = await readAllSchedules(username);
      const due = schedules.filter((schedule) => {
        const platform = String(schedule.platform || "threads").toLowerCase();
        const scheduled = normalizeScheduledAt(schedule.scheduledAt);
        const retryAt = normalizeScheduledAt(schedule.retryAt);
        return platform === "instagram" && schedule.status === "pending" && scheduled && scheduled <= now && (!retryAt || retryAt <= now);
      });
      if (!due.length) continue;

      for (const post of due) {
        try {
          const posted = await postInstagramSchedule(post);
          await updateScheduleRecord(username, post.id, {
            status: "posted",
            postedAt: new Date().toISOString(),
            mediaId: posted.mediaId,
            permalink: posted.permalink || post.permalink || null,
            retryCount: 0,
            retryAt: null,
            lastError: null,
          });
          results.push({ id: post.id, username, status: "posted", mediaId: posted.mediaId, platform: "instagram" });
        } catch (e) {
          const nowIso = new Date().toISOString();
          const retryCount = Number(post.retryCount) || 0;
          const retryable = isRetryableInstagramError(e.message);
          if (retryable && retryCount + 1 < MAX_RETRY_ATTEMPTS) {
            const nextRetryAt = new Date(now.getTime() + getRetryDelayMs(retryCount)).toISOString();
            await updateScheduleRecord(username, post.id, {
              status: "pending",
              retryCount: retryCount + 1,
              retryAt: nextRetryAt,
              lastAttemptAt: nowIso,
              lastError: e.message,
            });
            results.push({
              id: post.id,
              username,
              status: "retrying",
              retryCount: retryCount + 1,
              nextRetryAt,
              error: e.message,
            });
          } else {
            await updateScheduleRecord(username, post.id, {
              status: "failed",
              failedAt: nowIso,
              error: e.message,
              retryCount: retryCount + 1,
              retryAt: null,
              lastAttemptAt: nowIso,
              lastError: e.message,
            });
            results.push({ id: post.id, username, status: "failed", error: e.message });
          }
        }
      }
    }

    return res.status(200).json({
      ok: true,
      at: now.toISOString(),
      checked,
      processed: results.length,
      results,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message, at: now.toISOString() });
  }
}
