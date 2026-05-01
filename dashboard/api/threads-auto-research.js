// Threads 자동화 리서치 크론
// 매일 KST 06:00 (UTC 21:00 전날) 실행
// 흐름: 키워드 검색 → 오늘의 주제 선정 → 글 생성 → 예약 등록
//
// vercel.json cron: "0 21 * * *"

import { list, put, del } from "@vercel/blob";

const PREFIX_AUTO   = "threads-auto";
const PREFIX_SCHED  = "threads-schedule";
const PREFIX_TEMPLATE = "threads-template";
const PREFIX_MONITOR = "threads-auto-monitor";
const BLOB_FETCH_TIMEOUT_MS = 10000;
const NAVER_FETCH_TIMEOUT_MS = 15000;
const GEMINI_FETCH_TIMEOUT_MS = 45000;

// ── Blob 읽기/쓰기 유틸 ──
async function readBlob(prefix, username) {
  try {
    const { blobs } = await list({ prefix: `${prefix}/${username}.json` });
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url, {
      cache: "no-store",
      signal: AbortSignal.timeout(BLOB_FETCH_TIMEOUT_MS),
    });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

async function writeBlob(prefix, username, data) {
  const { blobs } = await list({ prefix: `${prefix}/${username}.json` });
  if (blobs.length) await Promise.allSettled(blobs.map((b) => del(b.url)));
  await put(`${prefix}/${username}.json`, JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
  });
}

function monitorPath(username, runId) {
  return `${PREFIX_MONITOR}/${username}/${runId}.json`;
}

async function listMonitorRuns(username) {
  const { blobs } = await list({ prefix: `${PREFIX_MONITOR}/${username}/` });
  return blobs.sort((a, b) => new Date(b.uploadedAt || b.pathname) - new Date(a.uploadedAt || a.pathname));
}

async function readMonitorRun(username, runId) {
  try {
    const { blobs } = await list({ prefix: monitorPath(username, runId) });
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url, {
      cache: "no-store",
      signal: AbortSignal.timeout(BLOB_FETCH_TIMEOUT_MS),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function writeMonitorRun(username, runId, data) {
  await put(monitorPath(username, runId), JSON.stringify(data), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

async function appendMonitorLog(username, runId, entry) {
  const current = (await readMonitorRun(username, runId)) || {
    username,
    runId,
    status: "running",
    phase: "starting",
    logs: [],
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  current.logs = [...(current.logs || []), entry].slice(-120);
  current.updatedAt = new Date().toISOString();
  if (!current.startedAt) current.startedAt = current.updatedAt;
  await writeMonitorRun(username, runId, current);
}

async function updateMonitorRun(username, runId, patch) {
  const current = (await readMonitorRun(username, runId)) || {
    username,
    runId,
    logs: [],
    startedAt: new Date().toISOString(),
  };
  const next = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeMonitorRun(username, runId, next);
  return next;
}

async function isRunCanceled(username, runId) {
  const run = await readMonitorRun(username, runId);
  return Boolean(run?.control?.canceled);
}

async function readLatestThreadTemplate() {
  try {
    const { blobs } = await list({ prefix: `${PREFIX_TEMPLATE}/latest.json` });
    if (!blobs.length) return null;
    const res = await fetch(blobs[0].url, {
      cache: "no-store",
      signal: AbortSignal.timeout(BLOB_FETCH_TIMEOUT_MS),
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// ── 네이버 검색 ──
async function searchNaver(query, env) {
  try {
    const url = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(query)}&display=5&sort=date`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(NAVER_FETCH_TIMEOUT_MS),
      headers: {
        "X-Naver-Client-Id":     env.NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET,
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map((item) => ({
      title:       item.title.replace(/<[^>]+>/g, ""),
      description: item.description.replace(/<[^>]+>/g, ""),
    }));
  } catch { return []; }
}

// ── Gemini API 직접 호출 ──
async function callGemini(prompt, env) {
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash-lite"];
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: "POST",
        signal: AbortSignal.timeout(GEMINI_FETCH_TIMEOUT_MS),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.75, maxOutputTokens: 2048 },
        }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text) return text;
    } catch { continue; }
  }
  throw new Error("Gemini 모든 모델 실패");
}

function parseJSONBlock(text) {
  const match = String(text || "").match(/```json\s*([\s\S]*?)```/) || String(text || "").match(/(\{[\s\S]*\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1] || match[0]);
  } catch {
    return null;
  }
}

async function reviewThreadText(text, context, env) {
  const prompt =
`너는 Threads 게시글의 최종 검수 편집자야.
아래 본문을 검토해서, 끊김/미완성/중복/설명문/불필요한 안내문이 있으면 바로 고쳐서 최종 게시글로 바꿔줘.

[검토 대상]
${text}

[작성 맥락]
- 소스: ${context.sourceLabel}
- 포맷: ${context.formatRule}
- 말투: ${context.toneRule}
- 흐름: ${context.flowRule}
- CTA: ${context.ctaRule}

[검토 기준]
- 본문이 중간에서 끊기면 안 됨
- 마지막이 불완전한 조각처럼 끝나면 안 됨
- 최소 220자 이상, 최대 500자 이내
- 한 문단 또는 2~5줄 구조로 읽히게 정리
- 마지막 줄은 완결된 문장이나 자연스러운 CTA로 끝낼 것
- 해시태그가 있다면 1~4개만 자연스럽게 유지
- 원문이 괜찮으면 내용은 유지하고 표현만 다듬어도 됨
- 부족하면 더 자연스럽고 완결된 본문으로 재작성
- 설명 없이 JSON만 반환

반환 형식:
{
  "approved": true,
  "issues": ["없음"],
  "revised_text": "최종 게시글"
}`;

  const raw = await callGemini(prompt, env);
  const data = parseJSONBlock(raw);
  if (!data) return { approved: false, issues: ["검수 파싱 실패"], revisedText: text };

  const revisedText = String(data.revised_text || text || "").trim().slice(0, 500);
  return {
    approved: Boolean(data.approved),
    issues: Array.isArray(data.issues) ? data.issues : [],
    revisedText,
  };
}

// ── 예약 시간 계산 (KST 기준) ──
// postTime: "HH:MM" (KST)
// 크론이 UTC 21:00 (KST 익일 06:00)에 실행되므로 KST 날짜 = UTC날짜 + 1일
function calcScheduledAt(postTime) {
  const [hh, mm] = postTime.split(":").map(Number);
  // KST 기준 오늘 = UTC 기준 내일 (크론이 UTC 21:00에 실행되기 때문)
  const utcNow = new Date();
  const kstNow = new Date(utcNow.getTime() + 9 * 3600 * 1000);
  const kstDate = kstNow.toISOString().slice(0, 10); // "YYYY-MM-DD"
  // postTime을 KST로 해석해 UTC로 변환
  const kstScheduled = new Date(`${kstDate}T${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}:00+09:00`);
  return kstScheduled.toISOString();
}

function calcBatchScheduledAt(baseDateKst, postTime, dayOffset, slotIndex, intervalHours) {
  const [hh, mm] = postTime.split(":").map(Number);
  const base = new Date(`${baseDateKst}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+09:00`);
  base.setTime(base.getTime() + dayOffset * 24 * 60 * 60 * 1000 + slotIndex * intervalHours * 60 * 60 * 1000);
  return base.toISOString();
}

function getBatchStartDateKst(postTime) {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 3600 * 1000);
  const kstToday = kstNow.toISOString().slice(0, 10);
  const todayFirstSlot = new Date(`${kstToday}T${postTime}:00+09:00`);
  if (todayFirstSlot.getTime() > now.getTime()) return kstToday;

  const tomorrow = new Date(todayFirstSlot.getTime() + 24 * 60 * 60 * 1000);
  return new Date(tomorrow.getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

// ── 중복 예약 체크 ──
function alreadyScheduledToday(schedules, postTime) {
  const target = calcScheduledAt(postTime);
  const targetDate = target.slice(0, 10); // YYYY-MM-DD
  return schedules.some((s) =>
    s.status === "pending" &&
    s.auto === true &&
    s.scheduledAt.slice(0, 10) === targetDate
  );
}

// ── 포맷 규칙 맵 ──
const FORMAT_RULES = {
  expert:    "전문가가 쉽게 풀어주는 말투. 주장 → 이유 → 적용 팁 → 낮은 허들 CTA 흐름.",
  friend:    "친한 친구가 옆에서 알려주는 말투. 공감 → 솔직한 경험 → 바로 해볼 행동 순서.",
  story:     "개인 경험을 들려주는 말투. 상황 묘사 → 깨달음 → 독자에게 넘기는 CTA 흐름.",
  question:  "독자에게 질문을 던지며 대화를 여는 말투. 문제 질문 → 선택지 → 관점 제안 → 댓글 CTA.",
  checklist: "짧고 실용적인 체크리스트 말투. 결론 선제시 → 3~5개 포인트 → 바로 적용 CTA.",
};
const TONE_RULES = {
  template: "자연스럽고 공감 가는 톤",
  direct:   "짧고 단정적인 문장, 군더더기 없는 확신형 말투",
  warm:     "독자의 상황을 먼저 받아주고 부담 없이 권하는 말투",
  bold:     "익숙한 믿음을 살짝 뒤집고 강한 주장으로 끌고 가는 말투",
  casual:   "친근하고 가벼운 대화체, 과한 전문용어를 줄인 말투",
};
const FLOW_RULES = {
  template:    "자연스러운 흐름",
  problem:     "문제 제기 → 공감 → 해결책 → 바로 할 행동",
  value:       "얻을 이득 선제시 → 필요한 이유 → 근거 → CTA",
  story:       "상황 묘사 → 시행착오 → 깨달음 → 독자 적용",
  contrarian:  "통념 제시 → 반박 → 새로운 관점 → 바로 적용",
};
const CTA_RULES = {
  template: "자연스러운 마무리",
  comment:  "댓글로 키워드나 의견을 남기게 하는 낮은 허들 CTA",
  follow:   "비슷한 팁을 계속 보고 싶으면 팔로우하도록 자연스럽게 유도",
  save:     "나중에 다시 보도록 저장을 유도",
  dm:       "자료/체크리스트를 받기 위한 DM 또는 키워드 요청 CTA",
  soft:     "강요 없이 오늘 바로 한 가지를 해보게 하는 CTA",
};

// ── 단일 계정 자동화 실행 ──
async function runForAccount(username, config, env, runId, options = {}) {
  const logs = [];
  const scheduledAtOverride = options.scheduledAt || null;
  const allowExistingPendingAuto = options.allowExistingPendingAuto === true;
  const scheduleMeta = options.scheduleMeta || null;
  const setPhase = async (phase, summary = null, extra = {}) => {
    await updateMonitorRun(username, runId, {
      phase,
      summary: summary || undefined,
      ...extra,
    });
  };
  const log = async (msg, detail = null, phase = null) => {
    logs.push(msg);
    console.log(`[auto-research:${username}] ${msg}`);
    await appendMonitorLog(username, runId, {
      time: new Date().toISOString(),
      msg,
      detail,
      phase: phase || undefined,
    });
  };

  const guardCancel = async () => {
    if (await isRunCanceled(username, runId)) {
      await updateMonitorRun(username, runId, {
        status: "canceled",
        phase: "canceled",
        error: "사용자가 취소했습니다",
      });
      throw new Error("사용자가 취소했습니다");
    }
  };

  await updateMonitorRun(username, runId, {
    username,
    runId,
    status: "running",
    phase: "starting",
    summary: "자동화 시작",
    logs: [],
    startedAt: new Date().toISOString(),
  });

  try {
    await setPhase("loading_template", "템플릿/소스 준비 중");
    const threadTemplate = await readLatestThreadTemplate();
    const sourceMode = config.sourceMode || "random";
    const preferredSource = sourceMode === "random"
      ? (threadTemplate?.data ? (Math.random() < 0.5 ? "threads" : "naver") : "naver")
      : sourceMode;
    const sourceChoice = preferredSource === "threads" && !threadTemplate?.data ? "naver" : preferredSource;
    await setPhase("selecting_source", `주제 소스 선택: ${sourceChoice}`);
    await log(`주제 소스 선택: ${sourceChoice}${sourceMode !== sourceChoice ? ` (설정: ${sourceMode})` : ""}`, null, "selecting");

    let prompt;
    let sourceLabel;
    let sourceSummary = "";

    if (sourceChoice === "threads" && threadTemplate?.data) {
      const posts = Array.isArray(threadTemplate.posts) ? threadTemplate.posts : [];
      const topPosts = posts
        .filter((p) => (p.views || 0) > 0 || (p.likes || 0) > 0 || (p.comments || 0) > 0)
        .sort((a, b) => (b.views || 0) - (a.views || 0))
        .slice(0, 8);
      const templateData = threadTemplate.data;
      sourceLabel = "Threads 인기글 역설계";
      sourceSummary = topPosts.length
        ? topPosts.map((p, i) => `[${i + 1}] @${p.author || "unknown"} | 조회 ${Number(p.views || 0).toLocaleString()} | 좋아요 ${Number(p.likes || 0).toLocaleString()} | 댓글 ${Number(p.comments || 0).toLocaleString()} | ${p.content}`).join("\n")
        : JSON.stringify(templateData, null, 2);
      prompt =
`너는 Threads(인스타그램 텍스트 SNS) 콘텐츠 전문가야.
아래는 최근 Threads 인기글을 조회수 기반으로 역설계한 결과와 포스트 요약이야.
이 구조를 참고해서 오늘 반응이 좋을 주제 1개를 고르고, Threads 게시글 최종안 1개를 작성해줘.

[Threads 역설계 템플릿]
${JSON.stringify(templateData, null, 2)}

[Threads 포스트 요약]
${sourceSummary}

[작성 규칙]
- 포맷: ${FORMAT_RULES[config.format] || FORMAT_RULES.expert}
- 말투: ${TONE_RULES[config.tone] || TONE_RULES.template}
- 흐름: ${FLOW_RULES[config.flow] || FLOW_RULES.template}
- CTA: ${CTA_RULES[config.cta] || CTA_RULES.comment}
- 최소 220자 이상, 최대 500자 이내
- 최대 500자 이내
- 줄바꿈 활용, 한 줄 10~25자
- 해시태그 2~4개 (마지막에)
- 마지막 문장은 완결된 문장이나 자연스러운 CTA로 닫을 것
- 안내문, 제목, 설명 없이 게시글 본문만 출력
- 마크다운 없이 순수 텍스트만`;
    } else {
      sourceLabel = "네이버 블로그";
      await setPhase("searching", "네이버 블로그 리서치 중");
      await log(`키워드 검색 시작: ${config.keywords.join(", ")}`, null, "searching");
      const allArticles = [];
      for (const kw of config.keywords) {
        await guardCancel();
        const results = await searchNaver(kw, env);
        allArticles.push(...results.map((r) => ({ ...r, keyword: kw })));
      }
      if (!allArticles.length) throw new Error("검색 결과 없음 (네이버 API 키 확인 필요)");
      await log(`검색 결과: ${allArticles.length}건`, { count: allArticles.length }, "searching");
      for (const [i, a] of allArticles.slice(0, 8).entries()) {
        await log(`  [${i + 1}] (${a.keyword}) ${a.title.slice(0, 40)}`);
      }

      const articlesText = allArticles.slice(0, 10).map((a, i) =>
        `[${i + 1}] 키워드: ${a.keyword} | 제목: ${a.title} | 요약: ${a.description}`
      ).join("\n");
      prompt =
`너는 Threads(인스타그램 텍스트 SNS) 콘텐츠 전문가야.
아래 최신 AI 관련 기사/포스트 목록에서 오늘 가장 반응이 좋을 주제 1개를 선택해,
Threads 게시글 최종안 1개를 바로 작성해줘.

[최신 기사 목록]
${articlesText}

[작성 규칙]
- 포맷: ${FORMAT_RULES[config.format] || FORMAT_RULES.expert}
- 말투: ${TONE_RULES[config.tone] || TONE_RULES.template}
- 흐름: ${FLOW_RULES[config.flow] || FLOW_RULES.template}
- CTA: ${CTA_RULES[config.cta] || CTA_RULES.comment}
- 최소 220자 이상, 최대 500자 이내
- 최대 500자 이내
- 줄바꿈 활용, 한 줄 10~25자
- 해시태그 2~4개 (마지막에)
- 마지막 문장은 완결된 문장이나 자연스러운 CTA로 닫을 것
- 안내문, 제목, 설명 없이 게시글 본문만 출력
- 마크다운 없이 순수 텍스트만`;
    }

    await guardCancel();
    await setPhase("generating", `Gemini 글 생성 중 (${sourceLabel})`);
    await log(`Gemini 글 생성 중... (${sourceLabel})`, null, "generating");
    const raw = await callGemini(prompt, env);

    // 3. 텍스트 정리 (cleanThreadDraft 서버 버전)
    let text = raw
      .replace(/\r/g, "")
      .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-z]*\n?/gi, "").replace(/```/g, ""))
      .trim()
      .replace(/^(네|좋아요|물론|알겠습니다)[,!\s].*/m, "")
      .replace(/^#{1,6}\s*.*/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 500);

    if (!text) throw new Error("생성된 텍스트 없음");
    await log(`글 생성 완료 (${text.length}자)`, { length: text.length }, "generating");

    await guardCancel();
    await setPhase("reviewing", "AI 검토 및 본문 보강 중");
    const review = await reviewThreadText(text, {
      sourceLabel,
      formatRule: FORMAT_RULES[config.format] || FORMAT_RULES.expert,
      toneRule: TONE_RULES[config.tone] || TONE_RULES.template,
      flowRule: FLOW_RULES[config.flow] || FLOW_RULES.template,
      ctaRule: CTA_RULES[config.cta] || CTA_RULES.comment,
    }, env);

    if (!review.approved || (review.revisedText && review.revisedText !== text)) {
      await log(`AI 검토 반영: ${review.issues?.join(", ") || "수정"}`, review.issues, "reviewing");
      text = review.revisedText || text;
    } else {
      await log("AI 검토 통과", null, "reviewing");
    }

    text = text
      .replace(/\n{3,}/g, "\n\n")
      .trim()
      .slice(0, 500);

    if (text.length < 220) {
      await log(`AI 검토 후 본문이 짧음 (${text.length}자) — 보강 생성`, { length: text.length }, "reviewing");
      const repairRaw = await callGemini(
        `아래 Threads 본문을 220~500자 범위의 완결된 게시글로 다시 써줘.
중간에 끊기면 안 되고, 마지막 문장과 CTA가 자연스럽게 닫혀야 해.
설명 없이 최종 본문만 출력.

[원문]
${text}
`,
        env
      );
      const repaired = repairRaw
        .replace(/\r/g, "")
        .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-z]*\n?/gi, "").replace(/```/g, ""))
        .trim()
        .replace(/^(네|좋아요|물론|알겠습니다)[,!\s].*/m, "")
        .replace(/^#{1,6}\s*.*/gm, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
        .slice(0, 500);
      if (repaired.length >= text.length) {
        text = repaired;
        await log(`보강 생성 완료 (${text.length}자)`, { length: text.length }, "reviewing");
      }
    }

    await guardCancel();
    await setPhase("scheduling", "예약 등록 처리 중");
    // 4. 예약 등록 (중복 방지 — pending 자동 예약이 하나라도 있으면 스킵)
    const schedules = (await readBlob(PREFIX_SCHED, username)) || [];
    const pendingAuto = schedules.find(s => s.auto === true && s.status === "pending");
    if (pendingAuto && !allowExistingPendingAuto) {
      const pendingTime = new Date(pendingAuto.scheduledAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
      await log(`대기 중인 자동 예약 있음 (${pendingTime}) — 스킵`, null, "scheduling");
      await updateMonitorRun(username, runId, {
        status: "skipped",
        phase: "done",
        skipReason: `기존 예약 대기 중: ${pendingTime}`,
        text,
        sourceLabel,
      });
      return { skipped: true, skipReason: `기존 예약 대기 중: ${pendingTime}`, logs };
    }

    const scheduledAt = scheduledAtOverride || calcScheduledAt(config.postTime);
    const scheduleIdSuffix = scheduleMeta
      ? `d${scheduleMeta.dayIndex}_s${scheduleMeta.slotIndex}`
      : Math.random().toString(36).slice(2, 8);
    const newPost = {
      id:          `auto_${Date.now()}_${scheduleIdSuffix}`,
      text,
      userId:      config.userId,
      accessToken: config.accessToken,
      scheduledAt,
      status:      "pending",
      createdAt:   new Date().toISOString(),
      auto:        true,
      autoBatch:   Boolean(scheduleMeta),
      batchDay:    scheduleMeta?.dayIndex ?? null,
      batchSlot:   scheduleMeta?.slotIndex ?? null,
    };
    schedules.push(newPost);
    await writeBlob(PREFIX_SCHED, username, schedules);
    await log(`예약 완료: ${scheduledAt} (KST ${config.postTime})`, { scheduledAt }, "scheduling");
    await log(`본문 길이: ${text.length}자`, { length: text.length }, "scheduling");
    await updateMonitorRun(username, runId, {
      status: "completed",
      phase: "done",
      scheduledAt,
      text,
      sourceLabel,
      summary: `예약 완료 (${text.length}자)`,
    });

    return { scheduledAt, text, logs };
  } catch (error) {
    const current = await readMonitorRun(username, runId);
    if (current?.status !== "canceled") {
      await updateMonitorRun(username, runId, {
        status: "failed",
        phase: "done",
        summary: `실패: ${error.message}`,
        error: error.message,
      });
    }
    throw error;
  }
}

export const config = { maxDuration: 120, memory: 512 };

export default async function handler(req, res) {
  const manualUsername = req.query?.username || req.body?.username || null;
  const manualRunId = req.query?.runId || req.body?.runId || null;
  const batchOptions = req.method === "POST" ? (req.body?.batch || null) : null;

  // CRON_SECRET 검증
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && !manualUsername) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const env = process.env;
  const results = [];

  try {
    if (manualUsername) {
      const cfg = await readBlob(PREFIX_AUTO, manualUsername);
      if (!cfg) return res.status(404).json({ error: "설정을 찾을 수 없습니다" });
      const runId = manualRunId || `manual_${Date.now()}`;

      if (batchOptions) {
        const days = Math.max(1, Math.min(14, Number(batchOptions.days) || 1));
        const postsPerDay = Math.max(1, Math.min(6, Number(batchOptions.postsPerDay) || 1));
        const intervalHours = Math.max(1, Math.min(12, Number(batchOptions.intervalHours) || 4));
        const totalPosts = days * postsPerDay;
        if (totalPosts > 20) {
          return res.status(400).json({ error: "한 번에 최대 20개까지만 예약 생성할 수 있습니다" });
        }

        const baseDateKst = getBatchStartDateKst(cfg.postTime);
        const batchResults = [];
        for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
          for (let slotIndex = 0; slotIndex < postsPerDay; slotIndex += 1) {
            const slotRunId = `${runId}_d${dayIndex + 1}_s${slotIndex + 1}`;
            const scheduledAt = calcBatchScheduledAt(baseDateKst, cfg.postTime, dayIndex, slotIndex, intervalHours);
            const result = await runForAccount(manualUsername, cfg, env, slotRunId, {
              scheduledAt,
              allowExistingPendingAuto: true,
              scheduleMeta: { dayIndex: dayIndex + 1, slotIndex: slotIndex + 1 },
            });
            batchResults.push({ runId: slotRunId, scheduledAt, ...result });
          }
        }

        return res.status(200).json({
          ok: true,
          mode: "manual-batch",
          username: manualUsername,
          runId,
          batch: { days, postsPerDay, intervalHours, totalPosts, baseDateKst },
          results: batchResults,
        });
      }

      const result = await runForAccount(manualUsername, cfg, env, runId);
      return res.status(200).json({
        ok: true,
        mode: "manual",
        username: manualUsername,
        runId,
        result,
      });
    }

    // 모든 사용자의 자동화 설정 파일 조회
    const { blobs } = await list({ prefix: `${PREFIX_AUTO}/` });
    console.log(`[auto-research] 설정 파일 ${blobs.length}개 발견`);

    for (const blob of blobs) {
      const username = blob.pathname.replace(`${PREFIX_AUTO}/`, "").replace(/\.json$/, "");
      let cfg;
      try {
        const res2 = await fetch(blob.url, { cache: "no-store" });
        cfg = res2.ok ? await res2.json() : null;
      } catch { continue; }

      if (!cfg?.enabled) { console.log(`[auto-research:${username}] 비활성 — 스킵`); continue; }
      if (!cfg.keywords?.length) { console.log(`[auto-research:${username}] 키워드 없음 — 스킵`); continue; }
      if (!cfg.userId || !cfg.accessToken) { console.log(`[auto-research:${username}] 계정 정보 없음 — 스킵`); continue; }

      try {
        const runId = `cron_${Date.now()}_${username}`;
        const result = await runForAccount(username, cfg, env, runId);
        results.push({ username, status: "ok", ...result });
      } catch (e) {
        console.error(`[auto-research:${username}] 실패:`, e.message);
        results.push({ username, status: "failed", error: e.message });
      }
    }

    return res.status(200).json({ ok: true, ran: results.length, results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
