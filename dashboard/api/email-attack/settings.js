// GET  /api/email-attack/settings        → 전체 설정 맵
// PATCH /api/email-attack/settings        → {key, value} 1건 저장

import { db } from "./_lib/supabase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const supabase = db();

  if (req.method === "GET") {
    const { data, error } = await supabase.from("ea_settings").select("*");
    if (error) return res.status(500).json({ error: error.message });
    const map = {};
    for (const r of data || []) map[r.key] = r.value;
    return res.status(200).json(map);
  }

  if (req.method === "PATCH") {
    const { key, value } = req.body || {};
    if (!key) return res.status(400).json({ error: "key 필수" });
    const { error } = await supabase
      .from("ea_settings")
      .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: "Method Not Allowed" });
}
