import { head } from "@vercel/blob";

const STATUS_PREFIX = "upload-post-local/status";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function buildStatusPath(requestId) {
  return `${STATUS_PREFIX}/${requestId}.json`;
}

async function readStatus(requestId) {
  const info = await head(buildStatusPath(requestId)).catch(() => null);
  if (!info?.url) return null;
  const res = await fetch(info.url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  const requestId = String(req.query?.request_id || req.query?.requestId || "").trim();
  if (!requestId) {
    return res.status(400).json({ error: "request_id or job_id is required" });
  }

  const status = await readStatus(requestId);
  if (!status) {
    return res.status(404).json({ error: "해당 request_id 상태를 찾을 수 없습니다" });
  }

  return res.status(200).json({
    request_id: status.request_id,
    status: status.status,
    completed: status.completed,
    total: status.total,
    results: status.results,
    last_update: status.last_update,
  });
}
