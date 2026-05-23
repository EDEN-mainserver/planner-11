// Instagram 자동화 리서치 크론/수동 실행
// 흐름: 키워드 리서치 → 카드뉴스 생성 → 이미지 생성 → 예약 등록
//
// cron(매일 KST 06:05, vercel.json "5 21 * * *"): username 미전달 →
//   instagram-auto/ 하위 모든 활성 사용자 순회.
// 수동(UI "리서치 → 예약 생성"): username 전달 → 해당 사용자만 1회 실행.

import { put, list } from "@vercel/blob";
import { generateFullAutoAssets } from "./_pipeline.js";
import {
  isDuplicateScheduleTextError,
  saveSchedule,
} from "./_schedule-storage.js";

const PREFIX = "instagram-auto";
const BLOB_FETCH_TIMEOUT_MS = 10000;

async function readConfig(username) {
  try {
    const { blobs } = await list({ prefix: `${PREFIX}/${username}.json` });
    if (!blobs.length) return null;
    const latest = [...blobs].sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))[0];
    const res = await fetch(latest.url, {
      cache: "no-store",
      signal: AbortSignal.timeout(BLOB_FETCH_TIMEOUT_MS),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function writeRun(path, data) {
  await put(path, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

function getNextScheduledAtKst(postTime) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  const kstToday = kstNow.toISOString().slice(0, 10);
  const todaySlot = new Date(`${kstToday}T${postTime}:00+09:00`);
  if (todaySlot.getTime() > now.getTime()) return todaySlot.toISOString();
  const tomorrow = new Date(todaySlot.getTime() + 24 * 60 * 60 * 1000);
  return tomorrow.toISOString();
}

function normalizeScheduledAt(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

function buildAccount(username, config) {
  const keywords = Array.isArray(config.keywords)
    ? config.keywords
    : String(config.keywords || "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);

  return {
    id: String(config.accountId || username).trim(),
    name: String(config.accountName || username).trim(),
    igAccountId: String(config.accountId || "").trim(),
    igAccessToken: String(config.accessToken || "").trim(),
    settings: {
      topics: keywords.length ? keywords.join(",") : "인스타그램 카드뉴스",
      brandName: String(config.brandName || "").trim(),
      tone: String(config.tone || "friendly").trim(),
      slideCount: Number(config.slideCount) || 5,
      captionTemplate: String(config.captionTemplate || "{title}\n\n{body}").trim(),
    },
  };
}

// 한 사용자에 대한 1회 자동화 실행 (수동·cron 공통).
// requestBody는 수동 호출 시 UI가 보내는 추가 정보(scheduledAt 오버라이드 등). cron은 {}.
async function runForUser(username, config, requestBody = {}) {
  const account = buildAccount(username, config);
  if (!account.igAccountId || !account.igAccessToken) {
    throw new Error("Instagram 계정 ID와 액세스 토큰이 필요합니다");
  }

  const scheduledAt = normalizeScheduledAt(
    requestBody.scheduledAt || config.scheduledAt || (config.postTime ? getNextScheduledAtKst(config.postTime) : "")
  );
  if (!scheduledAt) {
    throw new Error("예약 시간 설정이 필요합니다 (config.postTime 또는 scheduledAt)");
  }

  const runId = requestBody.runId || `ig-auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date().toISOString();
  const monitorPath = `instagram-auto-monitor/${username}/${runId}.json`;
  const logs = [];
  const log = (msg, data) => logs.push({ time: new Date().toISOString(), msg, data });

  try {
    log("리서치 시작", { username, scheduledAt });
    const generated = await generateFullAutoAssets(account, process.env);
    log("카드뉴스 생성 완료", {
      topic: generated.topic,
      slideCount: generated.slideCount,
      imageCount: generated.imageUrls.length,
    });

    const schedule = {
      id: `ig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      platform: "instagram",
      auto: true,
      status: "pending",
      text: generated.caption,
      caption: generated.caption,
      images: generated.imageUrls,
      imageUrls: generated.imageUrls,
      userId: account.igAccountId,
      accountId: account.igAccountId,
      accessToken: account.igAccessToken,
      scheduledAt,
      createdAt: startedAt,
      updatedAt: startedAt,
      retryCount: 0,
      retryAt: null,
      lastAttemptAt: null,
      lastError: null,
      runId,
      topic: generated.topic,
      slideCount: generated.slideCount,
      sourceInfo: {
        keywords: Array.isArray(config.keywords)
          ? config.keywords
          : String(config.keywords || "")
              .split(",")
              .map((k) => k.trim())
              .filter(Boolean),
        brandName: config.brandName || "",
        tone: config.tone || "",
        purpose: config.purpose || "",
        postTime: config.postTime || "",
        generatedAt: startedAt,
        researchSummary: generated.researchSummary || "",
        mode: generated.sourceInfo?.mode || "naver-search",
        label: generated.sourceInfo?.label || "네이버 블로그",
        topicLabel: generated.sourceInfo?.topicLabel || generated.topic || "",
        candidateId: generated.sourceInfo?.candidateId || "",
        sourceUrls: Array.isArray(generated.sourceInfo?.sourceUrls) ? generated.sourceInfo.sourceUrls : [],
        bodyPreviews: Array.isArray(generated.sourceInfo?.bodyPreviews) ? generated.sourceInfo.bodyPreviews : [],
        itemsCount: generated.sourceInfo?.itemsCount || 0,
      },
    };

    const saved = await saveSchedule(username, schedule);
    log("예약 저장 완료", { scheduleId: saved.id, scheduledAt: saved.scheduledAt });

    await writeRun(monitorPath, {
      username,
      runId,
      status: "completed",
      phase: "done",
      startedAt,
      updatedAt: new Date().toISOString(),
      scheduledAt: saved.scheduledAt,
      topic: generated.topic,
      slideCount: generated.slideCount,
      text: generated.caption,
      logs,
      scheduleId: saved.id,
      control: {},
    });

    return { ok: true, runId, schedule: saved, generated };
  } catch (err) {
    log("오류", { message: err.message });
    await writeRun(monitorPath, {
      username,
      runId,
      status: "failed",
      phase: "done",
      startedAt,
      updatedAt: new Date().toISOString(),
      error: err.message,
      logs,
      control: {},
    }).catch(() => {});
    // 호출자가 duplicate를 구분할 수 있도록 그대로 throw
    throw err;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const manualUsername = req.query?.username || req.body?.username || null;

  // cron(username 없음) 호출은 CRON_SECRET으로 보호. 수동(username 있음)은 기존대로 통과.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && !manualUsername) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: "Unauthorized" });
  }

  // ── 수동 실행 ──
  if (manualUsername) {
    const storedConfig = await readConfig(manualUsername);
    const requestConfig = req.body?.config || null;
    const config = { ...(storedConfig || {}), ...(requestConfig || {}) };
    if (!config.enabled && !requestConfig) {
      return res.status(200).json({ ok: true, skipped: true, reason: "비활성화됨" });
    }
    try {
      const result = await runForUser(manualUsername, config, req.body || {});
      return res.status(200).json({ ok: true, result });
    } catch (err) {
      if (isDuplicateScheduleTextError(err)) {
        return res.status(409).json({ error: err.message, duplicate: err.duplicate || null });
      }
      return res.status(500).json({ error: err.message });
    }
  }

  // ── cron: 모든 활성 사용자 순회 ──
  const results = [];
  try {
    const { blobs } = await list({ prefix: `${PREFIX}/` });
    console.log(`[ig-auto-research] 설정 파일 ${blobs.length}개 발견`);

    for (const blob of blobs) {
      const username = blob.pathname.replace(`${PREFIX}/`, "").replace(/\.json$/, "");
      let cfg = null;
      try {
        const r = await fetch(blob.url, {
          cache: "no-store",
          signal: AbortSignal.timeout(BLOB_FETCH_TIMEOUT_MS),
        });
        cfg = r.ok ? await r.json() : null;
      } catch {
        continue;
      }
      if (!cfg) continue;

      if (!cfg.enabled) { console.log(`[ig-auto-research:${username}] 비활성 — 스킵`); continue; }
      if (!cfg.accountId || !cfg.accessToken) {
        console.log(`[ig-auto-research:${username}] 계정 정보 없음 — 스킵`);
        results.push({ username, status: "skipped", reason: "계정 정보 없음" });
        continue;
      }

      try {
        const result = await runForUser(username, cfg, {});
        results.push({ username, status: "ok", scheduleId: result.schedule?.id, scheduledAt: result.schedule?.scheduledAt });
      } catch (e) {
        console.error(`[ig-auto-research:${username}] 실패:`, e.message);
        results.push({ username, status: "failed", error: e.message });
      }
    }
    return res.status(200).json({ ok: true, ran: results.length, results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
