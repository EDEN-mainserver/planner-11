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
import { generateOne } from "./_ea-lib/proposal.js";
import nodemailer from "nodemailer";

const DEFAULT_TEST_TO_EMAIL = "EDEN@teamedenmarketing.com";
const DEFAULT_SMTP_USER = "EDEN@teamedenmarketing.com";


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
        summary: ext.summary || "",
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


// ─── /generate 핸들러 ─── (job 1개의 results 전체에 대해 일괄 제안서 생성)
async function generateHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const { job_id, sender = {}, only_missing = true, concurrency = 4 } = req.body || {};
  if (!job_id) return res.status(400).json({ error: "job_id 필수" });

  const supabase = db();

  // 결과 가져오기 (excluded 제외)
  const { data: results, error: rErr } = await supabase
    .from("ea_results")
    .select("*")
    .eq("job_id", job_id)
    .eq("excluded", false);
  if (rErr) return res.status(500).json({ error: rErr.message });
  if (!results || results.length === 0) {
    return res.status(200).json({ generated: 0, skipped: 0, errors: [] });
  }

  // 이미 만든 제안서 (only_missing=true면 스킵)
  let existingByResult = new Set();
  if (only_missing) {
    const ids = results.map((r) => r.id);
    const { data: existing } = await supabase
      .from("ea_proposals")
      .select("result_id")
      .in("result_id", ids);
    existingByResult = new Set((existing || []).map((p) => p.result_id));
  }

  const toGenerate = results.filter((r) => !existingByResult.has(r.id));

  // 병렬 호출 (concurrency 제한)
  let generated = 0;
  const errors = [];
  const queue = [...toGenerate];

  async function worker() {
    while (queue.length > 0) {
      const r = queue.shift();
      if (!r) return;
      try {
        const p = await generateOne({ recipient: r, sender });
        const recipient_email = (r.emails || [])[0] || "";
        const { error: insErr } = await supabase.from("ea_proposals").insert({
          result_id: r.id,
          recipient_email,
          subject: p.subject,
          body_html: p.body_html,
          body_text: p.body_text,
          language: p.language,
          model: p.model,
        });
        if (insErr) {
          errors.push({ domain: r.domain, error: insErr.message });
        } else {
          generated++;
        }
      } catch (e) {
        errors.push({ domain: r.domain, error: e.message });
      }
    }
  }

  const n = Math.max(1, Math.min(8, Number(concurrency) || 4));
  await Promise.all(Array.from({ length: n }, () => worker()));

  return res.status(200).json({
    generated,
    skipped: results.length - toGenerate.length,
    errors,
    total: results.length,
  });
}


// ─── /proposals 핸들러 ─── (job의 제안서 목록)
async function proposalsHandler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });
  const jobId = req.query.job_id;
  if (!jobId) return res.status(400).json({ error: "job_id 필수" });

  // result_id로 join 해서 가져오기 (브랜드명 같이)
  const { data: results } = await db()
    .from("ea_results")
    .select("id, domain, brand_name, homepage_url, emails")
    .eq("job_id", jobId);
  const resultMap = new Map((results || []).map((r) => [r.id, r]));

  const { data: proposals, error } = await db()
    .from("ea_proposals")
    .select("*")
    .in("result_id", Array.from(resultMap.keys()))
    .order("created_at", { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  // 결합
  const merged = (proposals || []).map((p) => ({
    ...p,
    result: resultMap.get(p.result_id) || null,
  }));

  return res.status(200).json({ proposals: merged });
}


// ─── /update_proposal 핸들러 ─── (제안서 수정 저장)
async function updateProposalHandler(req, res) {
  if (req.method !== "PATCH") return res.status(405).json({ error: "Method Not Allowed" });
  const { id, subject, body_html, body_text, approved } = req.body || {};
  if (!id) return res.status(400).json({ error: "id 필수" });

  const patch = {};
  if (subject !== undefined) patch.subject = subject;
  if (body_html !== undefined) patch.body_html = body_html;
  if (body_text !== undefined) patch.body_text = body_text;
  if (approved !== undefined) patch.approved = approved;
  if (Object.keys(patch).length === 0) return res.status(400).json({ error: "수정 필드 없음" });

  const { data, error } = await db()
    .from("ea_proposals")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ ok: true, proposal: data });
}


// ─── /send_test_proposal 핸들러 ───
function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildHookSubject(proposal) {
  const raw = String(proposal.subject || "").trim();
  const brand = String(proposal.result?.brand_name || proposal.result?.domain || "").split("|")[0].trim();
  const generic = !raw || /제안서|자동 생성|B2B 영업|협업 제안/i.test(raw);
  const fallback = brand
    ? `${brand}, 지금 놓치면 고객을 빼앗깁니다`
    : "지금 놓치면 고객을 빼앗깁니다";
  const subject = generic ? fallback : raw;
  return subject.length > 48 ? `${subject.slice(0, 47)}…` : subject;
}

function buildOutboundEmailHtml(proposal) {
  const brand = proposal.result?.brand_name || proposal.result?.domain || "제안 대상";
  const hookSubject = buildHookSubject(proposal);
  const body = proposal.body_html || "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(hookSubject)}</title>
  </head>
  <body style="margin:0;padding:0;background:#0f172a;color:#1f2937;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Noto Sans KR','Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:720px;background:#ffffff;border:1px solid #243044;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="height:10px;background:#ff6b00;"></td>
            </tr>
            <tr>
              <td style="padding:30px 30px 24px;background:#111827;border-bottom:1px solid #243044;">
                <p style="margin:0 0 10px;color:#ffb86b;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;">EDEN GROWTH SIGNAL</p>
                <h1 style="margin:0;color:#ffffff;font-size:27px;line-height:1.25;font-weight:900;">${escapeHtml(hookSubject)}</h1>
                <p style="margin:14px 0 0;color:#cbd5e1;font-size:13px;line-height:1.6;">${escapeHtml(brand)}에 맞춰 본 성장 기회 3가지입니다.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 30px 8px;background:#ffffff;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #fed7aa;background:#fff7ed;border-radius:12px;">
                  <tr>
                    <td style="padding:16px 18px;color:#9a3412;font-size:14px;line-height:1.65;font-weight:700;">
                      지금 고객은 긴 설명보다 짧은 확신, 한 번의 노출보다 반복되는 퍼널을 보고 움직입니다.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 30px 30px;font-size:15px;line-height:1.85;color:#111827;">
                <div style="font-size:15px;line-height:1.85;color:#111827;">
                  ${body}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px 24px;border-top:1px solid #e5e7eb;background:#f8fafc;color:#64748b;font-size:12px;line-height:1.6;">
                에덴 마케팅 테스트 발송 메일입니다. 실제 DB 대상에게 발송되지 않았습니다.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function sendWithResend({ to, subject, html, text }) {
  const upstream = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EA_FROM_EMAIL || "EDEN Marketing <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
      text,
      reply_to: process.env.EA_REPLY_TO_EMAIL || undefined,
    }),
  });
  const payload = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    const message = payload?.message || payload?.error || `Resend HTTP ${upstream.status}`;
    throw new Error(message);
  }
  return { provider: "resend", provider_id: payload?.id || null };
}

async function sendWithSmtp({ to, subject, html, text }) {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || process.env.GMAIL_SENDER || DEFAULT_SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const from = process.env.SMTP_SENDER || process.env.EA_FROM_EMAIL || user;
  if (!pass) {
    throw new Error("SMTP_PASS 또는 GMAIL_APP_PASSWORD 환경변수가 설정되지 않았습니다.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
    replyTo: process.env.EA_REPLY_TO_EMAIL || undefined,
  });
  return { provider: "smtp", provider_id: info.messageId || null };
}

async function insertSendLog({ proposalId, toEmail, status, error }) {
  const domain = String(toEmail || "").split("@")[1] || null;
  const { error: logError } = await db().from("ea_send_logs").insert({
    proposal_id: proposalId,
    to_email: toEmail,
    to_domain: domain,
    status,
    error: error || null,
  });
  if (logError) console.error("[ea_send_logs insert]", logError);
}

async function sendTestProposalHandler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const { id, to_email } = req.body || {};
  if (!id) return res.status(400).json({ error: "id 필수" });

  const testTo = String(to_email || process.env.EA_TEST_TO_EMAIL || DEFAULT_TEST_TO_EMAIL).trim();
  if (!isEmail(testTo)) {
    return res.status(400).json({ error: "테스트 수신 이메일 형식이 올바르지 않습니다." });
  }

  const supabase = db();
  const { data: proposal, error } = await supabase
    .from("ea_proposals")
    .select("*")
    .eq("id", id)
    .single();
  if (error || !proposal) {
    return res.status(404).json({ error: "제안서를 찾을 수 없습니다." });
  }

  const { data: result } = await supabase
    .from("ea_results")
    .select("id, domain, brand_name, homepage_url")
    .eq("id", proposal.result_id)
    .maybeSingle();
  proposal.result = result || null;

  const subject = `[TEST] ${buildHookSubject(proposal)}`;
  const html = buildOutboundEmailHtml(proposal);
  const text = proposal.body_text || stripHtml(proposal.body_html);

  try {
    const sent = process.env.RESEND_API_KEY
      ? await sendWithResend({ to: testTo, subject, html, text })
      : await sendWithSmtp({ to: testTo, subject, html, text });

    await insertSendLog({
      proposalId: proposal.id,
      toEmail: testTo,
      status: "sent",
    });
    return res.status(200).json({
      ok: true,
      provider: sent.provider,
      provider_id: sent.provider_id,
      to_email: testTo,
    });
  } catch (e) {
    await insertSendLog({
      proposalId: proposal.id,
      toEmail: testTo,
      status: "failed",
      error: e.message,
    });
    return res.status(500).json({ error: e.message });
  }
}


// ─── 메인 dispatcher ───
export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  const fn = req.query.fn || (req.body && req.body.fn);
  switch (fn) {
    case "run":              return runHandler(req, res);
    case "status":           return statusHandler(req, res);
    case "jobs":             return jobsHandler(req, res);
    case "settings":         return settingsHandler(req, res);
    case "generate":         return generateHandler(req, res);
    case "proposals":        return proposalsHandler(req, res);
    case "update_proposal":  return updateProposalHandler(req, res);
    case "send_test_proposal": return sendTestProposalHandler(req, res);
    default:
      return res.status(400).json({
        error: "fn 필수: run | status | jobs | settings | generate | proposals | update_proposal | send_test_proposal",
      });
  }
}
