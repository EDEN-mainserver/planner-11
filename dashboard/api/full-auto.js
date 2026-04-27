// 풀자동화 통합 핸들러
// ?_fn=run    → 수동 실행 (POST)
// ?_fn=config → 팀 계정 설정 CRUD (GET / POST / DELETE)

import { put, head, del } from "@vercel/blob";
import { runFullAutoPipeline } from "./_pipeline.js";

export const config = { maxDuration: 300 };

const CONFIG_PATH  = "full-auto/team-config.json";
const HISTORY_PATH = "full-auto/history.json";
const MAX_HISTORY  = 50;

function checkAuth(req) {
  const secret = process.env.FULL_AUTO_SECRET;
  if (!secret) return true;
  return req.headers["authorization"] === `Bearer ${secret}`;
}

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

async function writeBlob(path, data) {
  await put(path, JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}

// ─── 수동 실행 ────────────────────────────────────────────────────────────────
async function handleRun(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized" });

  const { account, triggeredBy = "manual" } = req.body || {};
  if (!account || !account.id) return res.status(400).json({ error: "account 데이터가 필요합니다" });

  const startedAt = new Date().toISOString();
  try {
    const result = await runFullAutoPipeline(account, process.env);

    const entry = {
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
    const history = (await readBlob(HISTORY_PATH)) || [];
    await writeBlob(HISTORY_PATH, [entry, ...(Array.isArray(history) ? history : [])].slice(0, MAX_HISTORY));

    return res.status(200).json({ ok: true, runId: result.runId, result });
  } catch (err) {
    console.error("[full-auto/run] 오류:", err);
    const entry = {
      runId: `run-${Date.now()}-${account.id}`,
      accountId: account.id,
      accountName: account.name,
      triggeredBy,
      startedAt,
      finishedAt: new Date().toISOString(),
      status: "failed",
      error: err.message,
    };
    const history = (await readBlob(HISTORY_PATH)) || [];
    await writeBlob(HISTORY_PATH, [entry, ...(Array.isArray(history) ? history : [])].slice(0, MAX_HISTORY)).catch(() => {});
    return res.status(500).json({ error: err.message });
  }
}

// ─── 설정 CRUD ────────────────────────────────────────────────────────────────
async function handleConfig(req, res) {
  if (!checkAuth(req)) return res.status(401).json({ error: "Unauthorized" });

  if (req.method === "GET") {
    const config  = await readBlob(CONFIG_PATH)  || { accounts: [] };
    const history = await readBlob(HISTORY_PATH) || [];
    return res.status(200).json({ ...config, history: Array.isArray(history) ? history : [] });
  }

  if (req.method === "POST") {
    const { account } = req.body || {};
    if (!account || !account.id) return res.status(400).json({ error: "account.id 가 필요합니다" });

    const cfg = await readBlob(CONFIG_PATH) || { accounts: [] };
    const idx = cfg.accounts.findIndex((a) => a.id === account.id);
    if (idx >= 0) cfg.accounts[idx] = { ...cfg.accounts[idx], ...account };
    else cfg.accounts.push(account);
    await writeBlob(CONFIG_PATH, cfg);
    return res.status(200).json({ ok: true, accounts: cfg.accounts });
  }

  if (req.method === "DELETE") {
    const { accountId } = req.body || {};
    if (!accountId) return res.status(400).json({ error: "accountId 가 필요합니다" });

    const cfg = await readBlob(CONFIG_PATH) || { accounts: [] };
    cfg.accounts = cfg.accounts.filter((a) => a.id !== accountId);
    await writeBlob(CONFIG_PATH, cfg);
    return res.status(200).json({ ok: true, accounts: cfg.accounts });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}

// ─── 메인 라우터 ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();

  const fn = req.query._fn;
  if (fn === "run")    return handleRun(req, res);
  if (fn === "config") return handleConfig(req, res);
  return res.status(400).json({ error: "_fn 파라미터가 필요합니다 (run | config)" });
}
