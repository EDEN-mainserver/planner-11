// GET /api/email-attack/status?job_id=...
// 작업 진행 상황 + 결과 반환 (대시보드가 폴링)

import { db } from "./_ea-lib/supabase.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  const jobId = req.query.job_id;
  if (!jobId) return res.status(400).json({ error: "job_id 필수" });

  const supabase = db();
  const { data: job, error: jobErr } = await supabase
    .from("ea_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();
  if (jobErr || !job) {
    return res.status(404).json({ error: "job not found" });
  }

  const { data: results } = await supabase
    .from("ea_results")
    .select("*")
    .eq("job_id", jobId)
    .order("created_at", { ascending: true });

  return res.status(200).json({ job, results: results || [] });
}
