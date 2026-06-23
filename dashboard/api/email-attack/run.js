// POST /api/email-attack/run
// 키워드 1개 → 유관 키워드 자동 확장 → 구글+네이버 검색 → 이메일 추출 → ea_results 저장
//
// 입력: { keyword, sources: ['google','naver'], target_count: 20 }
// 출력: { job_id, results: [...] }
//
// maxDuration: 300초 (vercel.json에서 설정)
// 5분 안에 끝나는 게 일반적 (병렬 처리 덕분)

import { db } from "./_lib/supabase.js";
import { searchGoogle } from "./_lib/search-google.js";
import { searchNaver } from "./_lib/search-naver.js";
import { extractFromDomain } from "./_lib/extract.js";
import { domainOf } from "./_lib/blocklist.js";


// 유관 키워드 자동 확장 (간단한 휴리스틱)
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


export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const { keyword, sources = ["google", "naver"], target_count = 20 } = req.body || {};
  if (!keyword || typeof keyword !== "string") {
    return res.status(400).json({ error: "keyword 필수" });
  }

  const supabase = db();

  // 1. job 생성
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
    // 2. 유관 키워드 확장
    const keywords = expandKeywords(keyword.trim());
    await updateJob(jobId, {
      related_keywords: keywords,
      progress: { phase: "search", current: 0, total: keywords.length },
    });

    // 3. 검색 (구글 + 네이버 병렬, 키워드별 순차)
    const allCandidates = new Map(); // domain → {url, title, source, source_keyword}
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
      await updateJob(jobId, {
        status: "done",
        progress: { phase: "empty", current: 0, total: 0 },
      });
      return res.status(200).json({ job_id: jobId, results: [], message: "검색 결과 0건" });
    }

    // 4. 이메일 추출 (병렬, target_count * 3 만큼만 시도)
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

    // 5. 결과 정리 + 이메일 있는 것만 저장
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
      if (insErr) {
        console.error("[ea_results insert]", insErr);
      }
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
    await updateJob(jobId, {
      status: "failed",
      error: `${e.name}: ${e.message}`,
    });
    return res.status(500).json({ job_id: jobId, error: e.message });
  }
}
