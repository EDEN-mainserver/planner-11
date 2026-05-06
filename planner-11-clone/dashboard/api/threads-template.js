import { list, put, del } from "@vercel/blob";

const PREFIX = "threads-template";

async function readLatest() {
  try {
    const { blobs } = await list({ prefix: `${PREFIX}/latest.json` });
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url, { cache: "no-store" });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function writeLatest(data) {
  const { blobs } = await list({ prefix: `${PREFIX}/latest.json` });
  if (blobs.length) await Promise.allSettled(blobs.map((b) => del(b.url)));
  await put(`${PREFIX}/latest.json`, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

async function deleteLatest() {
  const { blobs } = await list({ prefix: `${PREFIX}/latest.json` });
  if (blobs.length) await Promise.allSettled(blobs.map((b) => del(b.url)));
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method === "GET") {
    const data = await readLatest();
    return res.status(200).json({ data });
  }

  if (req.method === "POST") {
    const body = req.body || {};
    if (body.deleted) {
      await deleteLatest();
      return res.status(200).json({ ok: true, deleted: true });
    }
    const payload = {
      savedAt: body.savedAt || new Date().toISOString(),
      keyword: body.keyword || "",
      data: body.data || null,
      posts: Array.isArray(body.posts) ? body.posts : [],
    };
    await writeLatest(payload);
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    await deleteLatest();
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
