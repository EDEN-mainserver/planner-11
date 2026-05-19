// 외부 인기글 ingest — Eden Crawl v2 확장 결과를 Supabase에 저장.
// POST /api/external-trending-ingest
// Body: { username, platform: 'threads'|'x', keyword, posts: [{author, content, postUrl|link, likes, replies, shares, views, datetime}] }

import { upsertExternalTrending } from "./_external-trending-storage.js";

export const config = { maxDuration: 30, memory: 256 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  const username = String(body.username || "").trim();
  const platform = String(body.platform || "").toLowerCase();
  const keyword = body.keyword ? String(body.keyword) : null;
  const posts = Array.isArray(body.posts) ? body.posts : [];

  if (!username) return res.status(400).json({ error: "username 필요" });
  if (!["threads", "x"].includes(platform)) {
    return res.status(400).json({ error: "platform은 threads 또는 x" });
  }
  if (!posts.length) return res.status(200).json({ ok: true, inserted: 0, skipped: "posts 비어있음" });

  try {
    const { inserted } = await upsertExternalTrending(username, platform, keyword, posts);
    return res.status(200).json({ ok: true, inserted, total: posts.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function safeParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}
