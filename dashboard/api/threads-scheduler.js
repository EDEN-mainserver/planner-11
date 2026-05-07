// Threads 예약 게시 크론 핸들러
// Vercel Cron (Pro): * * * * *  매 분 실행
// 또는 cron-job.org 등 외부 무료 크론 서비스로 1분마다 이 URL 호출 가능
//
// 환경변수:
//   CRON_SECRET  — Vercel이 자동 주입 (Vercel 크론 사용 시), 외부 크론은 Authorization: Bearer {값} 헤더 전송

import {
  listScheduleUsernames,
  readAllSchedules,
  updateScheduleRecord,
} from "./_schedule-storage.js";

const TH_API = "https://graph.threads.net/v1.0";

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

export const config = { maxDuration: 90, memory: 512 };

// Threads 텍스트 게시 (threads-post.js와 동일 로직)
async function postText(userId, accessToken, text) {
  const params = new URLSearchParams({
    media_type: "TEXT",
    text,
    access_token: accessToken,
  });

  const containerRes = await fetch(`${TH_API}/${userId}/threads`, {
    method: "POST",
    body: params,
  });
  const containerData = await containerRes.json();
  if (!containerRes.ok || !containerData.id) {
    throw new Error(containerData.error?.message || `컨테이너 생성 실패 (${containerRes.status})`);
  }

  // Threads API 요구사항: 컨테이너 생성 후 최소 30초 대기
  await new Promise((r) => setTimeout(r, 30000));

  const publishParams = new URLSearchParams({
    creation_id: containerData.id,
    access_token: accessToken,
  });
  const publishRes = await fetch(`${TH_API}/${userId}/threads_publish`, {
    method: "POST",
    body: publishParams,
  });
  const publishData = await publishRes.json();
  if (!publishRes.ok || !publishData.id) {
    throw new Error(publishData.error?.message || `게시 실패 (${publishRes.status})`);
  }
  return publishData.id;
}

export default async function handler(req, res) {
  // CRON_SECRET 검증 (Vercel 크론은 자동으로 Authorization 헤더 포함)
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

      // 현재 시각 이전인 pending 항목 추출
      const due = schedules.filter(
        (s) => {
          const platform = String(s.platform || "threads").toLowerCase();
          const scheduled = normalizeScheduledAt(s.scheduledAt);
          return platform === "threads" && s.status === "pending" && scheduled && scheduled <= now;
        }
      );
      if (!due.length) continue;

      for (const post of due) {
        try {
          const posted = { mediaId: await postText(post.userId, post.accessToken, post.text) };
          await updateScheduleRecord(username, post.id, {
            status: "posted",
            postedAt: new Date().toISOString(),
            mediaId: posted.mediaId,
            permalink: posted.permalink || post.permalink || null,
          });
          results.push({ id: post.id, username, status: "posted", mediaId: posted.mediaId, platform: "threads" });
        } catch (e) {
          await updateScheduleRecord(username, post.id, {
            status: "failed",
            failedAt: new Date().toISOString(),
            error: e.message,
          });
          results.push({ id: post.id, username, status: "failed", error: e.message });
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
