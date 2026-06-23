// E-MAIL Attack 통합 라우터
// - Vercel 함수 개수 절약을 위해 4개 endpoint를 1개로 통합
// - fn query parameter (또는 body.fn)로 분기:
//   ?fn=run       (POST)   → 키워드 → 풀 파이프라인 실행
//   ?fn=status    (GET)    → 작업 진행상황 + 결과
//   ?fn=jobs      (GET)    → 작업 히스토리
//   ?fn=jobs      (DELETE) → 작업 삭제 (id query)
//   ?fn=settings  (GET)    → 설정 전체
//   ?fn=settings  (PATCH)  → 설정 1건 저장
//
// vercel.json에서 maxDuration 300 (run이 가장 오래 걸림)

import { db } from "./_ea-lib/supabase.js";
import { searchGoogle } from "./_ea-lib/search-google.js";
import { searchNaver } from "./_ea-lib/search-naver.js";
import { extractFromDomain } from "./_ea-lib/extract.js";


// ─── 공통 ───
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}


// ─── /run 핸들러 ───
function expandKeywords(base) {
  const variants = new Set([base]);
  const suffixes = ["브랜드", "추천", "공식몰", "자사몰"];
  for (const s of suffixes) {
    if (!base.includes(s)) variants.add(`${base} ${s}`);
  }
  return Array.from(variants).slice(0, 5);
}

async function updateJob(jobId, patch) {
  await db().from("ea_jobs").update({
    ...patch,
    updated_at: new Date().toISOString(),
  }).eq("id", jobId);
}

async function runHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }
  const { keyword, sources = ["google", "naver"], target_count = 20 } = req.body || {};
  if (!keyword || typeof keyword !== "string") {
    return res.status(400).json({ error: "keyword 필수" });
  }

  const supabase = db();

  // job 생성
  const { data: jobRow, error: jobErr } = await supabase
    .from("ea_jobs")
    .insert({
      keyword: keyword.trim(),
      sources,
      target_count,
      status: "running",
      progress: { phase: "search", current: 0, total: 0 },
    })
    .select()
    .single();
  if (jobErr) {
    return res.status(500).json({ error: "job 생성 실패", detail: jobErr.message });
  }
  const jobId = jobRow.id;

  try {
    const keywords = expandKeywords(keyword.trim());
    await updateJob(jobId, {
      related_keywords: keywords,
      progress: { phase: "search", current: 0, total: keywords.length },
    });

    // 키워드별 구글+네이버 병렬 검색
    const allCandidates = new Map();
    for (let i = 0; i < keywords.length; i++) {
      const kw = keywords[i];
      const tasks = [];
      if (sources.includes("google")) {
        tasks.push(searchGoogle({ keyword: kw, topN: 10 }).catch((e) => {
          console.error(`[google ${kw}]`, e.message);
          return [];
        }));
      }
      if (sources.includes("naver")) {
        tasks.push(searchNaver({ keyword: kw, topN: 10 }).catch((e) => {
          console.error(`[naver ${kw}]`, e.message);
          return [];
        }));
      }
      const arrs = await Promise.all(tasks);
      for (const arr of arrs) {
        for (const r of arr) {
          if (!allCandidates.has(r.domain)) {
            allCandidates.set(r.domain, { ...r, source_keyword: kw });
          }
        }
      }
      await updateJob(jobId, {
        progress: { phase: "search", current: i + 1, total: keywords.length, found_domains: allCandidates.size },
      });
    }

    const candidates = Array.from(allCandidates.values());
    if (candidates.length === 0) {
      await updateJob(jobId, { status: "done", progress: { phase: "empty", current: 0, total: 0 } });
      return res.status(200).json({ job_id: jobId, results: [], message: "검색 결과 0건" });
    }

    // 이메일 추출 (병렬)
    const maxToTry = Math.min(candidates.length, target_count * 3);
    const toExtract = candidates.slice(0, maxToTry);
    await updateJob(jobId, {
      progress: { phase: "extracting", current: 0, total: toExtract.length },
    });

    const extractTasks = toExtract.map((c) =>
      extractFromDomain(c.domain).catch((e) => {
        console.error(`[extract ${c.domain}]`, e.message);
        return { homepage_url: `https://${c.domain}`, brand_name: "", emails: [], language: "ko" };
      })
    );
    const extracts = await Promise.all(extractTasks);

    // 결과 저장
    const rows = [];
    for (let i = 0; i < extracts.length; i++) {
      const ext = extracts[i];
      const cand = toExtract[i];
      if (!ext.emails || ext.emails.length === 0) continue;
      rows.push({
        job_id: jobId,
        domain: cand.domain,
        homepage_url: ext.homepage_url,
        brand_name: ext.brand_name || cand.title || cand.domain,
        emails: ext.emails,
        language: ext.language || "ko",
        source: cand.source,
        source_keyword: cand.source_keyword,
        rank: cand.rank || null,
      });
      if (rows.length >= target_count) break;
    }

    if (rows.length > 0) {
      const { error: insErr } = await supabase.from("ea_results").insert(rows);
      if (insErr) console.error("[ea_results insert]", insErr);
    }

    await updateJob(jobId, {
      status: "done",
      progress: { phase: "done", current: rows.length, total: rows.length },
    });

    return res.status(200).json({
      job_id: jobId,
      candidates: candidates.length,
      extracted: extracts.length,
      saved: rows.length,
      results: rows,
    });
  } catch (e) {
    console.error("[ea/run error]", e);
    await updateJob(jobId, { status: "failed", error: `${e.name}: ${e.message}` });
    return res.status(500).json({ job_id: jobId, error: e.message });
  }
}


// ─── /status 핸들러 ───
async function statusHandler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  const jobId = req.query.job_id;
  if (!jobId) return res.status(400).json({ error: "job_id 필수" });

  const supabase = db();
  const { data: job } = await supabase
    .from("ea_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) return res.status(404).json({ error: "job not found" });

  const { data: results } = await supabase
    .from("ea_results").select("*").eq("job_id", jobId)
    .order("created_at", { ascending: true });

  return res.status(200).json({ job, results: results || [] });
}


// ─── /jobs 핸들러 ───
async function jobsHandler(req, res) {
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


// ─── /settings 핸들러 ───
async function settingsHandler(req, res) {
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


// ─── 메인 dispatcher ───
export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const fn = req.query.fn || (req.body && req.body.fn);
  switch (fn) {
    case "run":      return runHandler(req, res);
    case "status":   return statusHandler(req, res);
    case "jobs":     return jobsHandler(req, res);
    case "settings": return settingsHandler(req, res);
    default:
      return res.status(400).json({
        error: "fn 필수: run | status | jobs | settings",
      });
  }
}
