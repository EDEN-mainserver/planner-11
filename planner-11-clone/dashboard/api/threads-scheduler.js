// Threads 예약 게시 크론 핸들러
// Vercel Cron (Pro): * * * * *  매 분 실행
// 또는 cron-job.org 등 외부 무료 크론 서비스로 1분마다 이 URL 호출 가능
//
// 환경변수:
//   CRON_SECRET  — Vercel이 자동 주입 (Vercel 크론 사용 시), 외부 크론은 Authorization: Bearer {값} 헤더 전송

import { list, put, del } from "@vercel/blob";

const TH_API = "https://graph.threads.net/v1.0";
const PREFIX = "threads-schedule";

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

// Blob에서 스케줄 파일 읽기
async function readSchedules(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return [];
  return await res.json();
}

// Blob 스케줄 파일 덮어쓰기
async function writeSchedules(username, schedules, oldUrl) {
  if (oldUrl) {
    await del(oldUrl).catch(() => {});
  }
  await put(`${PREFIX}/${username}.json`, JSON.stringify(schedules), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

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
    // 모든 사용자의 스케줄 파일 조회
    const { blobs } = await list({ prefix: `${PREFIX}/` });
    checked = blobs.length;

    for (const blob of blobs) {
      // 파일명에서 username 추출: threads-schedule/username.json
      const username = blob.pathname
        .replace(`${PREFIX}/`, "")
        .replace(/\.json$/, "");

      let schedules;
      try {
        schedules = await readSchedules(blob.url);
      } catch {
        continue;
      }

      // 현재 시각 이전인 pending 항목 추출
      const due = schedules.filter(
        (s) => {
          const scheduled = normalizeScheduledAt(s.scheduledAt);
          return s.status === "pending" && scheduled && scheduled <= now;
        }
      );
      if (!due.length) continue;

      let modified = false;

      for (const post of due) {
        const idx = schedules.findIndex((s) => s.id === post.id);
        try {
          const mediaId = await postText(post.userId, post.accessToken, post.text);
          schedules[idx] = {
            ...schedules[idx],
            status: "posted",
            postedAt: new Date().toISOString(),
            mediaId,
          };
          results.push({ id: post.id, username, status: "posted", mediaId });
        } catch (e) {
          schedules[idx] = {
            ...schedules[idx],
            status: "failed",
            failedAt: new Date().toISOString(),
            error: e.message,
          };
          results.push({ id: post.id, username, status: "failed", error: e.message });
        }
        modified = true;
      }

      if (modified) {
        await writeSchedules(username, schedules, blob.url);
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
