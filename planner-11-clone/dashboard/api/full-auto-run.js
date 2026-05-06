// 풀가동화 콘텐츠 — 수동 실행 엔드포인트
// POST body: { account: { id, name, igAccountId, igAccessToken, threadsUserId, threadsAccessToken, settings }, triggeredBy }
// 계정 데이터는 프론트엔드(localStorage)에서 직접 전달 → Blob 조회 불필요

import { put, head } from "@vercel/blob";
import { runFullAutoPipeline } from "./_pipeline.js";

const HISTORY_PATH = "full-auto/history.json";
const MAX_HISTORY = 50;

// ─── 인증 검증 ───
function checkAuth(req) {
  const secret = process.env.FULL_AUTO_SECRET;
  if (!secret) return true; // 미설정 시 개발 모드 허용
  const auth = req.headers["authorization"] || "";
  return auth === `Bearer ${secret}`;
}

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

// ─── 이력에 결과 추가 ───
async function appendHistory(entry) {
  const history = (await readBlob(HISTORY_PATH)) || [];
  const updated = [entry, ...(Array.isArray(history) ? history : [])].slice(0, MAX_HISTORY);
  await writeBlob(HISTORY_PATH, updated);
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized" });

  const { account, triggeredBy = "manual" } = req.body || {};

  // account를 body에서 직접 받음 (localStorage에서 전달)
  if (!account || !account.id) {
    return res.status(400).json({ error: "account 데이터가 필요합니다" });
  }

  const startedAt = new Date().toISOString();

  try {
    const result = await runFullAutoPipeline(account, process.env);

    const historyEntry = {
      runId: result.runId,
      accountId: account.id,
      accountName: account.name,
      triggeredBy,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "success",
      topic: result.topic,
      slideCount: result.slideCount,
      igPermalink: result.igPermalink,
      threadsMediaId: result.threadsMediaId,
    };
    await appendHistory(historyEntry);

    return res.status(200).json({ ok: true, runId: result.runId, result });
  } catch (err) {
    console.error("[full-auto-run] 파이프라인 오류:", err);

    const historyEntry = {
      runId: `run-${Date.now()}-${account.id}`,
      accountId: account.id,
      accountName: account.name,
      triggeredBy,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "failed",
      error: err.message,
    };
    await appendHistory(historyEntry).catch(() => {});

    return res.status(500).json({ error: err.message });
  }
}
