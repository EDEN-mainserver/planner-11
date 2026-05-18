// image-gen/ 프리픽스의 Blob 중 7일 지난 파일 자동 삭제
// Vercel Cron이 매일 새벽 4시(KST 13시) GET으로 호출. Authorization: Bearer CRON_SECRET 필요.
// 수동 실행 시: GET /api/cleanup-image-blobs?dryRun=1 → 삭제 안 하고 대상만 리턴

import { list, del } from "@vercel/blob";

const PREFIX = "image-gen/";
const TTL_DAYS = 7;
const BATCH_DEL_LIMIT = 200;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  // CRON_SECRET 검증 (Vercel cron이 자동 주입). 수동 호출 시도는 막힘.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const dryRun = req.query?.dryRun === "1" || req.query?.dryRun === "true";
  const cutoffMs = Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000;

  let cursor = undefined;
  let scanned = 0;
  let deleted = 0;
  const errors = [];

  try {
    do {
      const { blobs, cursor: nextCursor } = await list({ prefix: PREFIX, cursor, limit: 1000 });
      scanned += blobs.length;

      const toDelete = blobs
        .filter((b) => {
          const ts = new Date(b.uploadedAt || 0).getTime();
          return Number.isFinite(ts) && ts < cutoffMs;
        })
        .slice(0, BATCH_DEL_LIMIT - deleted);

      if (toDelete.length > 0 && !dryRun) {
        const results = await Promise.allSettled(toDelete.map((b) => del(b.url)));
        for (const r of results) {
          if (r.status === "fulfilled") deleted += 1;
          else errors.push(String(r.reason?.message || r.reason));
        }
      } else if (dryRun) {
        deleted += toDelete.length;
      }

      cursor = nextCursor;
      if (deleted >= BATCH_DEL_LIMIT) break;
    } while (cursor);

    return res.status(200).json({
      ok: true,
      dryRun,
      ttlDays: TTL_DAYS,
      prefix: PREFIX,
      scanned,
      deleted,
      errorCount: errors.length,
      errors: errors.slice(0, 5),
      hasMore: Boolean(cursor),
    });
  } catch (err) {
    console.error("[cleanup-image-blobs] 실패:", err);
    return res.status(500).json({ error: err.message, scanned, deleted });
  }
}
