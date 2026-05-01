import { list, put } from "@vercel/blob";

const PREFIX_MONITOR = "threads-auto-monitor";

function monitorPath(username, runId) {
  return `${PREFIX_MONITOR}/${username}/${runId}.json`;
}

function summarizeRun(run) {
  if (!run) return null;
  return {
    username: run.username,
    runId: run.runId,
    status: run.status || "running",
    phase: run.phase || "starting",
    startedAt: run.startedAt || null,
    updatedAt: run.updatedAt || null,
    scheduledAt: run.scheduledAt || null,
    summary: run.summary || null,
    error: run.error || null,
    skipReason: run.skipReason || null,
    sourceLabel: run.sourceLabel || null,
    sourceInfo: run.sourceInfo || null,
    text: run.text || "",
    textLength: run.text ? String(run.text).length : 0,
    logs: Array.isArray(run.logs) ? run.logs : [],
    control: run.control || {},
  };
}

async function listRuns(username) {
  const { blobs } = await list({ prefix: `${PREFIX_MONITOR}/${username}/` });
  const sorted = blobs.sort((a, b) => {
    const at = new Date(a.uploadedAt || a.pathname || 0).getTime();
    const bt = new Date(b.uploadedAt || b.pathname || 0).getTime();
    return bt - at;
  });
  const runs = [];
  for (const blob of sorted.slice(0, 30)) {
    try {
      const res = await fetch(blob.url, { cache: "no-store" });
      if (!res.ok) continue;
      const data = await res.json();
      runs.push(summarizeRun(data));
    } catch {
      continue;
    }
  }
  return runs;
}

async function readRun(username, runId) {
  const { blobs } = await list({ prefix: monitorPath(username, runId) });
  if (!blobs.length) return null;
  const res = await fetch(blobs[0].url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

async function writeRun(username, runId, data) {
  await put(monitorPath(username, runId), JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const username = req.query?.username || req.body?.username;
  if (!username) return res.status(400).json({ error: "username 필요" });

  if (req.method === "GET") {
    const runId = req.query?.runId || null;
    const runs = await listRuns(username);
    const current = runId
      ? await readRun(username, runId)
      : runs.find((run) => run?.status === "running") || runs[0] || null;
    return res.status(200).json({
      ok: true,
      current: summarizeRun(current),
      runs,
    });
  }

  if (req.method === "PATCH") {
    const runId = req.body?.runId || req.query?.runId || null;
    const runs = await listRuns(username);
    const current = runId
      ? await readRun(username, runId)
      : runs.find((run) => run?.status === "running") || runs[0] || null;
    if (!current) return res.status(404).json({ error: "실행 중인 작업이 없습니다" });

    const next = {
      ...current,
      control: {
        ...(current.control || {}),
        canceled: true,
        cancelRequestedAt: new Date().toISOString(),
      },
      status: current.status === "completed" || current.status === "skipped" ? current.status : "canceling",
      phase: current.status === "completed" || current.status === "skipped" ? current.phase : "canceling",
      updatedAt: new Date().toISOString(),
    };
    await writeRun(username, current.runId || runId, next);
    return res.status(200).json({ ok: true, current: summarizeRun(next) });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
