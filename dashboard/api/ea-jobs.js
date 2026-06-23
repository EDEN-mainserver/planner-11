// GET  /api/email-attack/jobs  → 최근 작업 리스트 (히스토리)
// DELETE /api/email-attack/jobs?id=...  → 작업+결과 삭제

import { db } from "./_ea-lib/supabase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const supabase = db();

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from("ea_jobs")
      .select("id, keyword, status, progress, created_at, related_keywords")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ jobs: data || [] });
  }

  if (req.method === "DELETE") {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: "id 필수" });
    await supabase.from("ea_jobs").delete().eq("id", id);
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
