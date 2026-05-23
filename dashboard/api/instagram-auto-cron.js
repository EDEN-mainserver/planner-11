// Instagram 자동화 스케줄러 (cron 전용 진입점)
// vercel.json crons에서 매일 KST 06:05 호출. 활성 사용자별로 기존 수동 엔드포인트
// /api/instagram-auto-research 를 그대로 POST 트리거한다.
// 수동 흐름 코드는 일체 수정하지 않고 진입점만 추가하는 구조.

import { list } from "@vercel/blob";

const PREFIX = "instagram-auto";
const BLOB_FETCH_TIMEOUT_MS = 10000;

export default async function handler(req, res) {
  // CRON_SECRET이 설정돼 있으면 Bearer 검증 (Vercel cron은 자동으로 헤더 첨부)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  // 자기 자신을 호출할 base URL (Vercel 환경변수 우선, 없으면 host 헤더 폴백)
  const rawHost =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    req.headers.host;
  if (!rawHost) {
    return res.status(500).json({ error: "self host 식별 불가" });
  }
  const baseUrl = String(rawHost).startsWith("http") ? rawHost : `https://${rawHost}`;

  let blobs = [];
  try {
    const r = await list({ prefix: `${PREFIX}/` });
    blobs = r.blobs || [];
  } catch (err) {
    return res.status(500).json({ error: `blob list 실패: ${err.message}` });
  }

  const results = [];
  for (const blob of blobs) {
    const username = blob.pathname.replace(`${PREFIX}/`, "").replace(/\.json$/, "");

    let cfg = null;
    try {
      const r = await fetch(blob.url, {
        cache: "no-store",
        signal: AbortSignal.timeout(BLOB_FETCH_TIMEOUT_MS),
      });
      cfg = r.ok ? await r.json() : null;
    } catch {
      results.push({ username, status: "skipped", reason: "config read 실패" });
      continue;
    }
    if (!cfg) { results.push({ username, status: "skipped", reason: "config 없음" }); continue; }
    if (!cfg.enabled) { results.push({ username, status: "skipped", reason: "비활성화" }); continue; }
    if (!cfg.accountId || !cfg.accessToken) {
      results.push({ username, status: "skipped", reason: "계정 정보 없음" });
      continue;
    }

    // 기존(수동) 엔드포인트를 그대로 호출 — body는 UI의 수동 트리거와 동일하게 username만 전달
    try {
      const resp = await fetch(`${baseUrl}/api/instagram-auto-research`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        results.push({
          username,
          status: "ok",
          scheduleId: data?.result?.schedule?.id || null,
          scheduledAt: data?.result?.schedule?.scheduledAt || null,
        });
      } else {
        results.push({
          username,
          status: "failed",
          code: resp.status,
          error: data?.error || `HTTP ${resp.status}`,
        });
      }
    } catch (err) {
      results.push({ username, status: "failed", error: err.message });
    }
  }

  return res.status(200).json({ ok: true, ran: results.length, results });
}
