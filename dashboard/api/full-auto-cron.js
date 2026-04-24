// 풀가동화 콘텐츠 — Vercel Cron 핸들러
// Vercel이 매시 정각에 Authorization: Bearer CRON_SECRET 헤더로 GET 요청

import { put, head } from "@vercel/blob";
import { runFullAutoPipeline } from "./_pipeline.js";

const CONFIG_PATH = "full-auto/team-config.json";
const HISTORY_PATH = "full-auto/history.json";
const MAX_HISTORY = 50;

// ─── Blob JSON 읽기 ───
async function readBlob(path) {
  try {
    const info = await head(path).catch(() => null);
    if (!info) return null;
    const res = await fetch(info.url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ─── Blob JSON 쓰기 ───
async function writeBlob(path, data) {
  const json = JSON.stringify(data, null, 2);
  await put(path, json, { access: "public", contentType: "application/json", allowOverwrite: true });
}

export default async function handler(req, res) {
  // Vercel Cron은 GET으로 호출
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  // CRON_SECRET 검증 (Vercel이 자동 주입)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  const startedAt = new Date().toISOString();
  console.log(`[full-auto-cron] 실행 시작: ${startedAt}`);

  // 설정 로드
  const config = await readBlob(CONFIG_PATH);
  if (!config || !config.accounts || config.accounts.length === 0) {
    console.log("[full-auto-cron] 등록된 계정 없음. 종료.");
    return res.status(200).json({ ok: true, message: "등록된 계정 없음", processed: 0 });
  }

  // enabled 계정만 필터
  const enabledAccounts = config.accounts.filter((a) => a.enabled);
  console.log(`[full-auto-cron] 활성 계정: ${enabledAccounts.length}/${config.accounts.length}`);

  if (enabledAccounts.length === 0) {
    return res.status(200).json({ ok: true, message: "활성화된 계정 없음", processed: 0 });
  }

  // 기존 이력 로드
  const historyData = (await readBlob(HISTORY_PATH)) || [];
  const history = Array.isArray(historyData) ? historyData : [];
  const newEntries = [];

  // ⚠️ Promise.all 금지 — Blob 동시 쓰기 방지, 타임아웃 방지
  for (const account of enabledAccounts) {
    const accountStart = new Date().toISOString();
    console.log(`[full-auto-cron] 계정 처리: ${account.name || account.id}`);

    try {
      const result = await runFullAutoPipeline(account, process.env);
      newEntries.push({
        runId: result.runId,
        accountId: account.id,
        accountName: account.name,
        triggeredBy: "cron",
        startedAt: accountStart,
        finishedAt: new Date().toISOString(),
        status: "success",
        topic: result.topic,
        slideCount: result.slideCount,
        igPermalink: result.igPermalink,
        threadsMediaId: result.threadsMediaId,
      });
      console.log(`[full-auto-cron] ✓ ${account.name || account.id} 완료`);
    } catch (err) {
      console.error(`[full-auto-cron] ✗ ${account.name || account.id} 실패:`, err.message);
      newEntries.push({
        runId: `run-${Date.now()}-${account.id}`,
        accountId: account.id,
        accountName: account.name,
        triggeredBy: "cron",
        startedAt: accountStart,
        finishedAt: new Date().toISOString(),
        status: "failed",
        error: err.message,
      });
    }
  }

  // 이력 저장 (최신 50건 유지)
  const updatedHistory = [...newEntries, ...history].slice(0, MAX_HISTORY);
  await writeBlob(HISTORY_PATH, updatedHistory).catch((e) => {
    console.error("[full-auto-cron] 이력 저장 실패:", e.message);
  });

  const summary = {
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    total: enabledAccounts.length,
    succeeded: newEntries.filter((e) => e.status === "success").length,
    failed: newEntries.filter((e) => e.status === "failed").length,
    entries: newEntries.map((e) => ({ accountId: e.accountId, status: e.status, igPermalink: e.igPermalink })),
  };

  console.log(`[full-auto-cron] 완료:`, JSON.stringify(summary));
  return res.status(200).json(summary);
}
