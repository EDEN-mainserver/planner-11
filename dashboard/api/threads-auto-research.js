// Threads 자동화 리서치 크론
// 매일 KST 06:00 (UTC 21:00 전날) 실행
// 흐름: 키워드 검색 → 오늘의 주제 선정 → 글 생성 → 예약 등록
//
// vercel.json cron: "0 21 * * *"

import { list, put } from "@vercel/blob";
import { fetchPostContent } from "./naver.js";

// 네이버 후보의 상위 2개 아이템에 대해 본문 크롤 → item.body에 부착.
// 실패한 아이템은 body 미부착, prompt는 fallback으로 description만 사용.
async function enrichCandidateWithBodies(candidate, sourceChoice) {
  if (sourceChoice !== "naver" || !Array.isArray(candidate?.items) || candidate.items.length === 0) return;
  const targets = candidate.items.slice(0, 2);
  const bodies = await Promise.all(targets.map(async (item) => {
    const url = item?.originallink || item?.link;
    if (!url) return "";
    try {
      const body = await fetchPostContent(url);
      return String(body || "").slice(0, 1200);
    } catch {
      return "";
    }
  }));
  targets.forEach((item, i) => {
    if (bodies[i]) item.body = bodies[i];
  });
}
import {
  isDuplicateScheduleTextError,
  readAllSchedules,
  saveSchedule,
} from "./_schedule-storage.js";

const PREFIX_AUTO   = "threads-auto";
const PREFIX_TEMPLATE = "threads-template";
const PREFIX_MONITOR = "threads-auto-monitor";
const BLOB_FETCH_TIMEOUT_MS = 10000;
const NAVER_FETCH_TIMEOUT_MS = 15000;
const GEMINI_FETCH_TIMEOUT_MS = 45000;
const RECENT_HISTORY_LIMIT = 10;
const RECENT_HISTORY_DAYS = 14;
const MAX_REPEAT_RETRIES = 3;
const LEGACY_THEME_SIMILARITY_THRESHOLD = 0.56;
const MIN_TOKEN_LENGTH = 2;
const KOREAN_STOPWORDS = new Set([
  "그리고", "하지만", "그러나", "그래서", "정말", "진짜", "이건", "저는", "우리는", "때문에",
  "위해서", "대한", "에서", "으로", "에게", "하면", "하는", "합니다", "있습니다", "있어요",
  "하는데", "같은", "최근", "오늘", "내일", "지금", "바로", "가장", "이런", "그런",
]);
const ENGLISH_STOPWORDS = new Set([
  "about", "after", "before", "being", "could", "every", "from", "have", "into", "just",
  "more", "most", "only", "over", "than", "that", "their", "there", "these", "this",
  "with", "would", "your", "today", "latest", "using",
]);
const TOPIC_FAMILY_STOPWORDS = new Set([
  "ai", "app", "blog", "chatgpt", "claude", "code", "coding", "develop", "developer",
  "development", "gemini", "no", "nocode", "post", "service", "tool", "tools", "update",
  "video", "workflow", "automation", "자동화", "앱", "개발", "개발자", "코딩", "프로그램",
  "서비스", "툴", "도구", "업데이트", "사용법", "후기",
]);
const MAX_SEARCH_TERMS = 12;

// ── Blob 읽기/쓰기 유틸 ──
async function readBlob(prefix, username) {
  try {
    const { blobs } = await list({ prefix: `${prefix}/${username}.json` });
    if (!blobs.length) return null;
    const latest = [...blobs].sort((a, b) => new Date(b.uploadedAt || 0) - new Date(a.uploadedAt || 0))[0];
    const res = await fetch(latest.url, {
      cache: "no-store",
      signal: AbortSignal.timeout(BLOB_FETCH_TIMEOUT_MS),
    });
    return res.ok ? await res.json() : null;
  } catch { return null; }
}

function monitorPath(username, runId) {
  return `${PREFIX_MONITOR}/${username}/${runId}.json`;
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

function stripHtml(value) {
  return String(value || "").replace(/<[^>]+>/g, " ");
}

function cleanWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeComparableText(value) {
  return cleanWhitespace(stripHtml(value))
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeComparableText(value) {
  return normalizeComparableText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => {
      if (!token || token.length < MIN_TOKEN_LENGTH) return false;
      return !KOREAN_STOPWORDS.has(token) && !ENGLISH_STOPWORDS.has(token);
    });
}

function normalizeSearchKeyword(value) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[.!?'"‘’“”,:;()[\]{}|/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandKeywordVariants(keyword) {
  const base = normalizeSearchKeyword(keyword);
  if (!base) return [];

  const lower = base.toLowerCase();
  const variants = new Set([base]);

  if (/claude|클로드/i.test(base)) {
    [
      "Claude Code",
      "claude code",
      "클로드 코드",
      "클로드코드",
      "Anthropic",
      "앤트로픽",
      "AI 코딩",
      "코딩 자동화",
      "개발 자동화",
      "비전공자 개발",
    ].forEach((term) => variants.add(term));
  }

  if (/chatgpt|gpt|챗gpt|챗지피티/i.test(base)) {
    [
      "ChatGPT",
      "GPT",
      "생성형 AI",
      "프롬프트",
      "업무 자동화",
      "AI 활용",
      "생산성",
    ].forEach((term) => variants.add(term));
  }

  if (/ai|인공지능|생성형/i.test(base)) {
    [
      "인공지능",
      "생성형 AI",
      "AI 활용",
      "AI 자동화",
      "업무 자동화",
      "툴 후기",
    ].forEach((term) => variants.add(term));
  }

  if (/앱|app|서비스|프로덕트/i.test(base)) {
    [
      "앱 개발",
      "노코드 앱",
      "AI 앱",
      "서비스 기획",
      "프로덕트",
      "MVP",
    ].forEach((term) => variants.add(term));
  }

  if (/코드|code|coding|개발/i.test(base)) {
    [
      "코딩",
      "개발자",
      "비전공자",
      "개발 입문",
      "코드 자동화",
      "생산성 도구",
    ].forEach((term) => variants.add(term));
  }

  if (/자동화|workflow|work flow|workflow|노코드/i.test(lower)) {
    [
      "업무 자동화",
      "노코드",
      "워크플로우",
      "생산성",
      "자동화 툴",
    ].forEach((term) => variants.add(term));
  }

  const baseSegments = base.split(/[,\s/]+/).map((part) => part.trim()).filter(Boolean);
  if (baseSegments.length >= 2) {
    variants.add(baseSegments.join(" "));
    variants.add(baseSegments[0]);
    variants.add(baseSegments[baseSegments.length - 1]);
  }

  return [...variants].filter(Boolean).slice(0, 8);
}

function expandSearchTerms(keywords) {
  const terms = [];
  for (const keyword of keywords || []) {
    const expanded = expandKeywordVariants(keyword);
    for (const term of expanded) {
      terms.push(term);
      if (terms.length >= MAX_SEARCH_TERMS) break;
    }
    if (terms.length >= MAX_SEARCH_TERMS) break;
  }
  return uniqueTokens(terms).slice(0, MAX_SEARCH_TERMS);
}

function canonicalizeSourceUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${host}${pathname}`.toLowerCase();
  } catch {
    return raw
      .replace(/^https?:\/\//i, "")
      .split("?")[0]
      .split("#")[0]
      .replace(/\/+$/, "")
      .toLowerCase();
  }
}

function buildSourcePathFingerprint(urls) {
  const tokens = uniqueTokens(
    (Array.isArray(urls) ? urls : [])
      .map((url) => canonicalizeSourceUrl(url))
      .filter(Boolean)
  ).slice(0, 12);
  return tokens.join("|");
}

function shuffleArray(values) {
  const next = [...values];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function uniqueTokens(tokens) {
  return [...new Set(tokens)];
}

function jaccardSimilarity(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function buildTopicFingerprint(value) {
  const tokens = uniqueTokens(tokenizeComparableText(value)).slice(0, 12);
  return tokens.join("-");
}

function buildTopicFamilyFingerprint(value) {
  const tokens = uniqueTokens(
    tokenizeComparableText(value).filter((token) => !TOPIC_FAMILY_STOPWORDS.has(token))
  ).slice(0, 8);
  if (tokens.length) return tokens.join("-");
  return buildTopicFingerprint(value);
}

function buildEvidenceFingerprint(parts) {
  const tokens = uniqueTokens(
    parts.flatMap((part) => tokenizeComparableText(part))
  ).slice(0, 20);
  return tokens.join("-");
}

function summarizeTopicFromText(value) {
  const cleaned = cleanWhitespace(value)
    .replace(/\n+/g, " ")
    .replace(/[#@][^\s#@]+/g, "")
    .trim();
  if (!cleaned) return "";
  const firstSentence = cleaned.split(/[.!?\n]/).find(Boolean) || cleaned;
  return firstSentence.slice(0, 80).trim();
}

function isLegacyAutoSchedule(schedule) {
  return Boolean(
    schedule?.auto === true &&
    !schedule?.sourceInfo?.topicFingerprint &&
    !schedule?.sourceInfo?.evidenceFingerprint
  );
}

function buildBodyFingerprint(value) {
  return normalizeComparableText(value).slice(0, 180);
}

function buildLegacyThemeFingerprint(value) {
  const source = cleanWhitespace(String(value || ""))
    .replace(/\n+/g, " ")
    .slice(0, 220);
  const lead = summarizeTopicFromText(source);
  const tokens = uniqueTokens(tokenizeComparableText(`${source} ${lead}`)).slice(0, 16);
  return tokens.join("-");
}

function historyTimestamp(schedule) {
  const raw = schedule?.postedAt || schedule?.scheduledAt || schedule?.createdAt || "";
  const time = Date.parse(raw);
  return Number.isFinite(time) ? time : 0;
}

function extractHistoryEntry(schedule) {
  const sourceInfo = schedule?.sourceInfo || {};
  return {
    id: schedule?.id || "",
    runId: schedule?.runId || "",
    status: schedule?.status || "",
    scheduledAt: schedule?.scheduledAt || null,
    postedAt: schedule?.postedAt || null,
    topicLabel: sourceInfo.topicLabel || "",
    topicFingerprint: sourceInfo.topicFingerprint || "",
    topicFamilyFingerprint: sourceInfo.topicFamilyFingerprint || "",
    evidenceFingerprint: sourceInfo.evidenceFingerprint || "",
    sourcePathFingerprint: sourceInfo.sourcePathFingerprint || "",
    candidateId: sourceInfo.candidateId || sourceInfo.candidateHash || "",
    bodyFingerprint: buildBodyFingerprint(schedule?.text || ""),
    legacyThemeFingerprint: buildLegacyThemeFingerprint(schedule?.text || ""),
    legacy: isLegacyAutoSchedule(schedule),
    timestamp: historyTimestamp(schedule),
  };
}

function selectRecentHistory(schedules) {
  const cutoff = Date.now() - RECENT_HISTORY_DAYS * 24 * 60 * 60 * 1000;
  return schedules
    .filter((schedule) => schedule?.auto === true)
    .filter((schedule) => schedule?.status === "pending" || schedule?.status === "posted")
    .map(extractHistoryEntry)
    .filter((entry) => entry.timestamp >= cutoff)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, RECENT_HISTORY_LIMIT);
}

function createRepeatMatch(history, reason) {
  return {
    id: history.id || "",
    runId: history.runId || "",
    status: history.status || "",
    scheduledAt: history.scheduledAt || null,
    postedAt: history.postedAt || null,
    topicLabel: history.topicLabel || "",
    topicFingerprint: history.topicFingerprint || "",
    topicFamilyFingerprint: history.topicFamilyFingerprint || "",
    evidenceFingerprint: history.evidenceFingerprint || "",
    sourcePathFingerprint: history.sourcePathFingerprint || "",
    candidateId: history.candidateId || "",
    legacyThemeFingerprint: history.legacyThemeFingerprint || "",
    legacy: Boolean(history.legacy),
    reason,
  };
}

function findStrongRepeat(history, fingerprint) {
  if (!fingerprint?.topicFingerprint && !fingerprint?.topicFamilyFingerprint && !fingerprint?.evidenceFingerprint && !fingerprint?.sourcePathFingerprint) return null;
  return history.find((entry) => {
    if (entry.legacy) return false;
    if (entry.candidateId && fingerprint.candidateId && entry.candidateId === fingerprint.candidateId) {
      return true;
    }
    if (entry.sourcePathFingerprint && fingerprint.sourcePathFingerprint && entry.sourcePathFingerprint === fingerprint.sourcePathFingerprint) {
      return true;
    }
    if (entry.topicFamilyFingerprint && fingerprint.topicFamilyFingerprint && entry.topicFamilyFingerprint === fingerprint.topicFamilyFingerprint) {
      return true;
    }
    return (
      entry.topicFingerprint === fingerprint.topicFingerprint &&
      entry.evidenceFingerprint === fingerprint.evidenceFingerprint
    );
  }) || null;
}

function findLegacyBodyRepeat(history, bodyText) {
  const bodyFingerprint = buildBodyFingerprint(bodyText);
  const legacyThemeFingerprint = buildLegacyThemeFingerprint(bodyText);
  if (!bodyFingerprint && !legacyThemeFingerprint) return null;

  const exactMatch = history.find((entry) => entry.legacy && entry.bodyFingerprint && entry.bodyFingerprint === bodyFingerprint) || null;
  if (exactMatch) return exactMatch;

  if (!legacyThemeFingerprint) return null;
  const currentTokens = legacyThemeFingerprint.split("-").filter(Boolean);
  if (!currentTokens.length) return null;

  return history.find((entry) => {
    if (!entry.legacy || !entry.legacyThemeFingerprint) return false;
    const entryTokens = entry.legacyThemeFingerprint.split("-").filter(Boolean);
    if (!entryTokens.length) return false;
    return jaccardSimilarity(currentTokens, entryTokens) >= LEGACY_THEME_SIMILARITY_THRESHOLD;
  }) || null;
}

function buildRepeatCheckBase(history) {
  return {
    comparedRecentCount: history.length,
    recentWindowDays: RECENT_HISTORY_DAYS,
    recentWindowLimit: RECENT_HISTORY_LIMIT,
    maxRetries: MAX_REPEAT_RETRIES,
  };
}

function buildTopicFamilyStats(history) {
  const counts = new Map();
  for (const entry of history) {
    if (entry.topicFamilyFingerprint) {
      counts.set(entry.topicFamilyFingerprint, (counts.get(entry.topicFamilyFingerprint) || 0) + 1);
    }
  }
  return counts;
}

function selectBestCandidate(candidates, history) {
  const familyCounts = buildTopicFamilyStats(history);
  const scored = candidates
    .map((candidate) => {
      const familyCount = familyCounts.get(candidate.topicFamilyFingerprint) || 0;
      const exactRepeat = history.some((entry) => !entry.legacy && entry.candidateId && entry.candidateId === candidate.candidateId);
      return {
        ...candidate,
        familyCount,
        exactRepeat,
      };
    })
    .sort((a, b) => {
      if (a.exactRepeat !== b.exactRepeat) return a.exactRepeat ? 1 : -1;
      if (a.familyCount !== b.familyCount) return a.familyCount - b.familyCount;
      if ((a.score || 0) !== (b.score || 0)) return (b.score || 0) - (a.score || 0);
      return String(a.candidateId || "").localeCompare(String(b.candidateId || ""));
    });

  const fresh = scored.find((candidate) => candidate.familyCount === 0 && !candidate.exactRepeat) || null;
  return fresh || scored[0] || null;
}

function buildRepeatCheckResult(history, status, attempts, match = null, extra = {}) {
  return {
    ...buildRepeatCheckBase(history),
    status,
    attempts,
    passed: status === "passed" || status === "reselected",
    match,
    ...extra,
  };
}

function clusterItems(items, createSeed, shouldMerge, mergeItems, finalize) {
  const clusters = [];
  for (const item of items) {
    const seed = createSeed(item);
    const target = clusters.find((cluster) => shouldMerge(cluster, seed));
    if (target) {
      target.items.push(item);
      mergeItems(target, seed);
    } else {
      clusters.push({ ...seed, items: [item] });
    }
  }
  return clusters.map((cluster, index) => finalize(cluster, index)).filter(Boolean);
}

function buildNaverCandidates(allArticles) {
  const groupedArticles = new Map();

  for (const article of allArticles) {
    const title = cleanWhitespace(article.title);
    const description = cleanWhitespace(article.description);
    const sourceUrls = [article.originallink, article.link].filter(Boolean);
    const sourcePathFingerprint = buildSourcePathFingerprint(sourceUrls);
    const fallbackFingerprint = buildEvidenceFingerprint([title, description]);
    const dedupeKey = sourcePathFingerprint || fallbackFingerprint;
    const prev = groupedArticles.get(dedupeKey);
    const nextKeywords = uniqueTokens([...(prev?.keywords || []), article.keyword].filter(Boolean));
    groupedArticles.set(dedupeKey, {
      ...(prev || article),
      title,
      description,
      keywords: nextKeywords,
      topicLabel: title || summarizeTopicFromText(description) || `리서치 후보 ${groupedArticles.size + 1}`,
      tokens: uniqueTokens(tokenizeComparableText(`${nextKeywords.join(" ")} ${title} ${description}`)),
      sourceUrls: uniqueTokens([...(prev?.sourceUrls || []), ...sourceUrls]),
      sourcePathFingerprint,
      similarityText: `${nextKeywords.join(" ")} ${title} ${description}`.trim(),
    });
  }

  const articles = [...groupedArticles.values()];

  return clusterItems(
    articles,
    (article) => ({
      topicLabel: article.topicLabel,
      tokens: article.tokens,
      keyword: Array.isArray(article.keywords) ? article.keywords.join(", ") : article.keyword,
      representative: article,
    }),
    (cluster, article) => (
      cluster.topicLabel === article.topicLabel ||
      jaccardSimilarity(cluster.tokens, article.tokens) >= 0.58
    ),
    (cluster, article) => {
      cluster.tokens = uniqueTokens([...cluster.tokens, ...article.tokens]).slice(0, 24);
      if ((article.representative?.description?.length || 0) > (cluster.representative?.description?.length || 0)) {
        cluster.representative = article.representative;
        cluster.topicLabel = article.topicLabel;
      }
    },
    (cluster, index) => {
      const items = cluster.items.map((item) => ({
        keyword: item.keywords?.join(", ") || item.keyword || "",
        title: item.title,
        description: item.description,
        link: item.link || "",
        originallink: item.originallink || "",
        sourceUrls: Array.isArray(item.sourceUrls) ? item.sourceUrls : [],
      }));
      const topicLabel = cluster.topicLabel || `리서치 후보 ${index + 1}`;
      const topicFingerprint = buildTopicFingerprint(topicLabel || cluster.tokens.join(" "));
      const topicFamilyFingerprint = buildTopicFamilyFingerprint(`${topicLabel} ${cluster.tokens.join(" ")}`);
      const sourceUrls = items.flatMap((item) => [item.originallink, item.link]).filter(Boolean);
      const sourcePathFingerprint = buildSourcePathFingerprint(sourceUrls);
      const evidenceFingerprint = buildEvidenceFingerprint(
        items.flatMap((item) => [item.keyword, item.title, item.description, item.originallink, item.link])
      );
      const candidateId = `naver-${index + 1}-${hashString(`${topicFingerprint}|${evidenceFingerprint}`)}`;
      return {
        candidateId,
        topicLabel,
        topicFingerprint,
        topicFamilyFingerprint,
        evidenceFingerprint,
        sourceUrls,
        sourcePathFingerprint,
        summary: items
          .slice(0, 3)
          .map((item, itemIndex) => `[${itemIndex + 1}] (${item.keyword}) ${item.title} | ${item.description}`)
          .join("\n"),
        items,
        score: items.length,
      };
    }
  ).sort((a, b) => b.score - a.score);
}

function buildThreadsCandidates(posts) {
  const rankedPosts = posts
    .filter((post) => cleanWhitespace(post?.content))
    .sort((a, b) => ((b.views || 0) + (b.likes || 0) + (b.comments || 0)) - ((a.views || 0) + (a.likes || 0) + (a.comments || 0)))
    .slice(0, 12)
    .map((post, index) => {
      const content = cleanWhitespace(String(post.content || "").slice(0, 280));
      const topicLabel = summarizeTopicFromText(content) || `Threads 후보 ${index + 1}`;
      const tokens = uniqueTokens(tokenizeComparableText(content));
      return {
        ...post,
        content,
        topicLabel,
        tokens,
      };
    });

  return clusterItems(
    rankedPosts,
    (post) => ({
      topicLabel: post.topicLabel,
      tokens: post.tokens,
      representative: post,
    }),
    (cluster, post) => (
      cluster.topicLabel === post.topicLabel ||
      jaccardSimilarity(cluster.tokens, post.tokens) >= 0.5
    ),
    (cluster, post) => {
      cluster.tokens = uniqueTokens([...cluster.tokens, ...post.tokens]).slice(0, 24);
      const clusterScore = (cluster.representative?.views || 0) + (cluster.representative?.likes || 0);
      const nextScore = (post.representative?.views || 0) + (post.representative?.likes || 0);
      if (nextScore > clusterScore) {
        cluster.representative = post.representative;
        cluster.topicLabel = post.topicLabel;
      }
    },
    (cluster, index) => {
      const items = cluster.items.map((item) => ({
        author: item.author || "unknown",
        views: Number(item.views || 0),
        likes: Number(item.likes || 0),
        comments: Number(item.comments || 0),
        content: item.content,
        link: item.link || "",
      }));
      const topicLabel = cluster.topicLabel || `Threads 후보 ${index + 1}`;
      const topicFingerprint = buildTopicFingerprint(topicLabel || cluster.tokens.join(" "));
      const topicFamilyFingerprint = buildTopicFamilyFingerprint(`${topicLabel} ${cluster.tokens.join(" ")}`);
      const sourceUrls = items.map((item) => item.link).filter(Boolean);
      const sourcePathFingerprint = buildSourcePathFingerprint(sourceUrls);
      const evidenceFingerprint = buildEvidenceFingerprint(items.map((item) => item.content));
      const candidateId = `threads-${index + 1}-${hashString(`${topicFingerprint}|${evidenceFingerprint}`)}`;
      return {
        candidateId,
        topicLabel,
        topicFingerprint,
        topicFamilyFingerprint,
        evidenceFingerprint,
        sourceUrls,
        sourcePathFingerprint,
        summary: items
          .slice(0, 3)
          .map((item, itemIndex) => `[${itemIndex + 1}] @${item.author} | 조회 ${item.views.toLocaleString()} | 좋아요 ${item.likes.toLocaleString()} | 댓글 ${item.comments.toLocaleString()} | ${item.content}`)
          .join("\n"),
        items,
        score: items.reduce((sum, item) => sum + item.views + item.likes + item.comments, 0),
      };
    }
  ).sort((a, b) => b.score - a.score);
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
      link: item.link || "",
      originallink: item.originallink || "",
    }));
  } catch { return []; }
}

// ── Gemini API 직접 호출 ──
async function callGemini(prompt, env) {
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash-lite"];
  const errors = [];
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
      if (!res.ok) {
        const raw = await res.text();
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
        const message = parsed?.error?.message || raw.slice(0, 200) || `HTTP ${res.status}`;
        errors.push(`${model}: ${message}`);
        if (res.status !== 429 && res.status !== 503) break;
        continue;
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      if (text) return text;
      errors.push(`${model}: empty response`);
    } catch (err) {
      errors.push(`${model}: ${err.message}`);
      continue;
    }
  }

  if (env.ANTHROPIC_API_KEY) {
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        signal: AbortSignal.timeout(GEMINI_FETCH_TIMEOUT_MS),
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const text = data.content?.[0]?.text || "";
        if (text) return text;
      } else {
        const raw = await resp.text();
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
        const message = parsed?.error?.message || raw.slice(0, 200) || `HTTP ${resp.status}`;
        errors.push(`claude-sonnet-4-6: ${message}`);
      }
    } catch (err) {
      errors.push(`claude-sonnet-4-6: ${err.message}`);
    }
  }

  throw new Error(`Gemini/Claude 생성 실패: ${errors.join(" | ")}`);
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
- 첫 문장은 반드시 훅이어야 함
- 첫 문장이 설명문, 요약문, 안내문, 사족이면 다시 써야 함
- 훅은 단정형, 반전형, 숫자형, 질문형, 충격형 중 하나여야 함
- 마지막 줄은 완결된 문장이나 자연스러운 CTA로 끝낼 것
- 해시태그가 있다면 1~4개만 자연스럽게 유지
- 원문이 괜찮으면 내용은 유지하고 표현만 다듬어도 됨
- 부족하면 더 자연스럽고 완결된 본문으로 재작성
- CTA가 약하면 더 직접적이고 짧게 보강
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

function buildTemplatePlaybook(templateData) {
  if (!templateData || typeof templateData !== "object") return null;

  const focus = templateData.focus_analysis || {};
  const recommended = templateData.recommended_master_template || {};
  const templates = Array.isArray(templateData.post_templates) ? templateData.post_templates.slice(0, 4) : [];

  return {
    summary: String(templateData.summary || "").trim(),
    hook_rule: String(focus.hook_copywriting || recommended.example_hook || "").trim(),
    flow_rule: String(focus.flow || "").trim(),
    tone_rule: String(focus.tone || "").trim(),
    cta_rule: String(focus.cta || recommended.cta_rule || "").trim(),
    anti_patterns: Array.isArray(templateData.anti_patterns) ? templateData.anti_patterns.slice(0, 4) : [],
    winning_patterns: Array.isArray(templateData.winning_patterns)
      ? templateData.winning_patterns.slice(0, 4).map((item) => ({
          pattern: String(item?.pattern || "").trim(),
          why_it_works: String(item?.why_it_works || "").trim(),
          use_when: String(item?.use_when || "").trim(),
        }))
      : [],
    top_templates: templates.map((tpl) => ({
      structure_name: String(tpl?.structure_name || "").trim(),
      hook_type: String(tpl?.hook_type || tpl?.opening_type || "").trim(),
      opening_example: String(tpl?.opening_example || tpl?.example_hook || "").trim(),
      copy_formula: String(tpl?.copy_formula || "").trim(),
      best_for: String(tpl?.best_for || "").trim(),
    })),
  };
}

function buildSourceInfo(config, sourceMode, sourceChoice, sourceLabel, sourceSummary, sourceItems) {
  const strategy = sourceChoice === "threads" ? "pattern-reconstruction" : "article-research";
  return {
    mode: sourceMode,
    choice: sourceChoice,
    label: sourceLabel,
    summary: sourceSummary,
    keywords: Array.isArray(config.keywords) ? config.keywords : [],
    items: sourceItems,
    format: config.format || "expert",
    tone: config.tone || "template",
    flow: config.flow || "template",
    cta: config.cta || "comment",
    provenance: {
      dataBacked: Array.isArray(sourceItems) && sourceItems.length > 0,
      strategy,
      evidenceType: sourceChoice === "threads" ? "high-performing-threads" : "naver-blog-search",
      evidenceCount: Array.isArray(sourceItems) ? sourceItems.length : 0,
      reconstructionTarget: sourceChoice === "threads" ? "잘된 Threads 구조 재구성" : "외부 리서치 기반 재구성",
      generatedWithoutEvidence: !Array.isArray(sourceItems) || sourceItems.length === 0,
    },
  };
}

function buildSourceInfoWithCandidate(config, sourceMode, sourceChoice, sourceLabel, candidate, repeatCheck, searchTerms = []) {
  const sourceInfo = buildSourceInfo(
    config,
    sourceMode,
    sourceChoice,
    sourceLabel,
    candidate?.summary || "",
    candidate?.items || []
  );
  return {
    ...sourceInfo,
    topicLabel: candidate?.topicLabel || "",
    topicFingerprint: candidate?.topicFingerprint || "",
    topicFamilyFingerprint: candidate?.topicFamilyFingerprint || "",
    evidenceFingerprint: candidate?.evidenceFingerprint || "",
    sourcePathFingerprint: candidate?.sourcePathFingerprint || "",
    sourceUrls: Array.isArray(candidate?.sourceUrls) ? candidate.sourceUrls : [],
    candidateId: candidate?.candidateId || "",
    candidateHash: candidate?.candidateId || "",
    searchTerms: Array.isArray(searchTerms) ? searchTerms : [],
    // 본문 크롤된 항목들의 미리보기 (UI 출처 본문 보기용)
    bodyPreviews: (candidate?.items || [])
      .filter((item) => item?.body)
      .slice(0, 2)
      .map((item) => ({
        url: item?.originallink || item?.link || "",
        title: item?.title || "",
        preview: String(item.body || "").slice(0, 300),
      })),
    provenance: {
      ...sourceInfo.provenance,
      repeatCheck,
    },
  };
}

function buildCandidatePrompt(sourceChoice, config, candidate, templateData = null) {
  const evidenceText = candidate.items
    .slice(0, 3)
    .map((item) => {
      if (sourceChoice === "threads") {
        return `@${item.author} | 조회 ${Number(item.views || 0).toLocaleString()} | 좋아요 ${Number(item.likes || 0).toLocaleString()} | ${item.content}`;
      }
      const head = `(${item.keyword}) ${item.title} | ${item.description}`;
      return item.body ? `${head}\n  본문 발췌: ${item.body}` : head;
    })
    .join("\n");

  const sourceIntro = sourceChoice === "threads"
    ? `아래는 최근 Threads 인기글을 유사 메시지끼리 묶어 정리한 단일 후보야.
${templateData ? `\n[Threads 역설계 템플릿]\n${JSON.stringify(buildTemplatePlaybook(templateData), null, 2)}\n` : ""}`
    : "아래는 네이버 검색 결과를 중복 기사군으로 정리한 단일 후보야.";

  return `너는 Threads(인스타그램 텍스트 SNS) 콘텐츠 전문가야.
${sourceIntro}
최근 사용한 논점/근거와 겹치지 않는 후보를 서버가 이미 골랐어. 아래 후보를 바탕으로 최종 게시글만 작성해.

[선택 후보]
candidateId: ${candidate.candidateId}
topicLabel: ${candidate.topicLabel}
topicFingerprint: ${candidate.topicFingerprint}
topicFamilyFingerprint: ${candidate.topicFamilyFingerprint}
evidenceFingerprint: ${candidate.evidenceFingerprint}
evidence: ${evidenceText}

[작성 규칙]
- 포맷: ${FORMAT_RULES[config.format] || FORMAT_RULES.expert}
- 말투: ${TONE_RULES[config.tone] || TONE_RULES.template}
- 흐름: ${FLOW_RULES[config.flow] || FLOW_RULES.template}
- CTA: ${CTA_RULES[config.cta] || CTA_RULES.comment}
- 최소 220자 이상, 최대 500자 이내
- 줄바꿈 활용, 한 줄 10~25자
- 해시태그 2~4개 (마지막에)
- 마지막 문장은 완결된 문장이나 자연스러운 CTA로 닫을 것
- 첫 문장은 반드시 훅이어야 함
- 첫 문장은 평범한 설명문, 요약문, 안내문으로 시작하지 말 것
- 훅은 반전, 숫자, 충격, 질문, 단정 중 하나로 만든다
- 템플릿이 있으면 그 분석을 그대로 설명하지 말고, 실제 게시글 문장으로 바꿔서 쓸 것
- 후보의 핵심 논점과 근거를 바탕으로 재구성하되 복붙하지 말 것
- 안내문, 제목, 설명 없이 JSON만 반환

반환 형식:
{
  "candidateId": "${candidate.candidateId}",
  "topicLabel": "이번 글의 핵심 주제 한 줄",
  "topicFingerprint": "${candidate.topicFingerprint}",
  "topicFamilyFingerprint": "${candidate.topicFamilyFingerprint}",
  "evidenceFingerprint": "${candidate.evidenceFingerprint}",
  "postText": "최종 Threads 게시글 본문"
}`;
}

function parseGeneratedCandidatePayload(raw, candidates) {
  const parsed = parseJSONBlock(raw);
  if (!parsed || typeof parsed !== "object") return null;
  const candidateId = String(parsed.candidateId || "").trim();
  const candidate = candidates.find((item) => item.candidateId === candidateId) || null;
  if (!candidate) return null;
  return {
    candidate,
    topicLabel: String(parsed.topicLabel || candidate.topicLabel || "").trim() || candidate.topicLabel,
    topicFingerprint: String(parsed.topicFingerprint || candidate.topicFingerprint || "").trim() || candidate.topicFingerprint,
    topicFamilyFingerprint: String(parsed.topicFamilyFingerprint || candidate.topicFamilyFingerprint || "").trim() || candidate.topicFamilyFingerprint,
    evidenceFingerprint: String(parsed.evidenceFingerprint || candidate.evidenceFingerprint || "").trim() || candidate.evidenceFingerprint,
    postText: String(parsed.postText || parsed.text || "").trim(),
  };
}

function cleanGeneratedThreadText(raw) {
  return String(raw || "")
    .replace(/\r/g, "")
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-z]*\n?/gi, "").replace(/```/g, ""))
    .trim()
    .replace(/^(네|좋아요|물론|알겠습니다)[,!\s].*/m, "")
    .replace(/^#{1,6}\s*.*/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 500);
}

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
    const schedules = await readAllSchedules(username);
    const repeatHistory = selectRecentHistory(schedules);
    await updateMonitorRun(username, runId, {
      repeatHistory: repeatHistory.map((entry) => ({
        id: entry.id,
        runId: entry.runId,
        status: entry.status,
        scheduledAt: entry.scheduledAt,
        postedAt: entry.postedAt,
        topicLabel: entry.topicLabel,
        topicFingerprint: entry.topicFingerprint,
        topicFamilyFingerprint: entry.topicFamilyFingerprint,
      evidenceFingerprint: entry.evidenceFingerprint,
      sourcePathFingerprint: entry.sourcePathFingerprint,
      candidateId: entry.candidateId,
      legacy: entry.legacy,
    })),
    });
    await log(`최근 자동 이력 ${repeatHistory.length}건 비교 준비`, { count: repeatHistory.length }, "starting");

    await setPhase("loading_template", "템플릿/소스 준비 중");
    const threadTemplate = await readLatestThreadTemplate();
    const threadTemplatePosts = Array.isArray(threadTemplate?.posts) ? threadTemplate.posts : [];
    const hasThreadsTemplate = threadTemplatePosts.length > 0;
    const sourceMode = config.sourceMode || "random";
    const preferredSource = sourceMode === "random"
      ? (hasThreadsTemplate ? (Math.random() < 0.5 ? "threads" : "naver") : "naver")
      : sourceMode;
    const sourceChoice = preferredSource === "threads" && !hasThreadsTemplate ? "naver" : preferredSource;
    await setPhase("selecting_source", `주제 소스 선택: ${sourceChoice}`);
    await log(`주제 소스 선택: ${sourceChoice}${sourceMode !== sourceChoice ? ` (설정: ${sourceMode})` : ""}`, null, "selecting");
    if (sourceMode === "threads" && !hasThreadsTemplate) {
      await log("Threads 소스가 선택됐지만 최신 템플릿에 posts가 없어 네이버로 전환", {
        hasThreadsTemplate,
        templateHasData: Boolean(threadTemplate?.data),
      }, "selecting");
    }

    let sourceLabel;
    let rawCandidates = [];
    let templateData = null;

    if (sourceChoice === "threads" && hasThreadsTemplate) {
      const posts = threadTemplatePosts;
      templateData = threadTemplate?.data || {
        keyword: threadTemplate?.keyword || "",
        postsCount: posts.length,
        savedAt: threadTemplate?.savedAt || null,
      };
      sourceLabel = "Threads 인기글 역설계";
      rawCandidates = buildThreadsCandidates(posts);
    } else {
      sourceLabel = "네이버 블로그";
      await setPhase("searching", "네이버 블로그 리서치 중");
      const searchTerms = shuffleArray(expandSearchTerms(config.keywords));
      await log(`키워드 검색 시작: ${config.keywords.join(", ")}`, { searchTerms }, "searching");
      const allArticles = [];
      for (const kw of searchTerms) {
        await guardCancel();
        const results = await searchNaver(kw, env);
        allArticles.push(...results.map((r) => ({ ...r, keyword: kw })));
      }
      if (!allArticles.length) throw new Error("검색 결과 없음 (네이버 API 키 확인 필요)");
      await log(`검색 결과: ${allArticles.length}건`, { count: allArticles.length }, "searching");
      for (const [i, a] of allArticles.slice(0, 8).entries()) {
        await log(`  [${i + 1}] (${a.keyword}) ${a.title.slice(0, 40)}`);
      }
      rawCandidates = buildNaverCandidates(allArticles);
      config.searchTerms = searchTerms;
    }

    if (!rawCandidates.length) throw new Error("후보를 구성하지 못했습니다");
    await log(`후보 군집화 완료: ${rawCandidates.length}개`, { count: rawCandidates.length }, sourceChoice === "threads" ? "selecting" : "searching");

    const initialFilteredCandidates = rawCandidates.filter((candidate) => !findStrongRepeat(repeatHistory, candidate));
    const recentlyBlocked = rawCandidates.length - initialFilteredCandidates.length;
    if (recentlyBlocked > 0) {
      await log(`최근 논점/근거 중복 후보 ${recentlyBlocked}개 제외`, { blocked: recentlyBlocked }, "selecting");
    }
    if (!initialFilteredCandidates.length) {
      const repeatCheck = buildRepeatCheckResult(
        repeatHistory,
        "skipped",
        0,
        null,
        { reason: "최근 예약/게시와 논점 중복으로 대체 후보 없음", filteredBeforeGeneration: rawCandidates.length }
      );
      await updateMonitorRun(username, runId, {
        status: "skipped",
        phase: "done",
        skipReason: repeatCheck.reason,
        sourceLabel,
        sourceInfo: {
          mode: sourceMode,
          choice: sourceChoice,
          label: sourceLabel,
          provenance: { repeatCheck },
        },
        summary: "반복 회피 후보 없음",
      });
      return { skipped: true, skipReason: repeatCheck.reason, logs };
    }

    await guardCancel();
    await setPhase("generating", `Gemini 글 생성 중 (${sourceLabel})`);
    let text = "";
    let selectedCandidate = null;
    let generationMeta = null;
    let finalRepeatCheck = null;
    let remainingCandidates = [...initialFilteredCandidates];
    const attemptedCandidateIds = [];

    for (let attempt = 1; attempt <= MAX_REPEAT_RETRIES && remainingCandidates.length > 0; attempt += 1) {
      await guardCancel();
      const nextCandidate = selectBestCandidate(remainingCandidates, repeatHistory);
      if (!nextCandidate) {
        await log("새로운 주제군 후보가 없어 생성 중단", null, "generating");
        break;
      }
      // 네이버 후보면 상위 2건 본문 크롤 (시간 ~3~6초). 실패 항목은 description만 사용.
      if (sourceChoice === "naver") {
        await enrichCandidateWithBodies(nextCandidate, sourceChoice);
        const bodiesCount = (nextCandidate.items || []).filter((it) => it?.body).length;
        await log(`본문 크롤 완료: ${bodiesCount}/2건`, { bodiesCount }, "generating");
      }
      const prompt = buildCandidatePrompt(sourceChoice, config, nextCandidate, templateData);
      await log(`후보 선택형 생성 시도 ${attempt}/${MAX_REPEAT_RETRIES} (${remainingCandidates.length}개 후보)`, {
        attempt,
        remainingCandidates: remainingCandidates.length,
        candidateId: nextCandidate.candidateId,
        topicFamilyFingerprint: nextCandidate.topicFamilyFingerprint,
        sourcePathFingerprint: nextCandidate.sourcePathFingerprint,
      }, "generating");
      const raw = await callGemini(prompt, env);
      const parsed = parseGeneratedCandidatePayload(raw, [nextCandidate]);
      if (!parsed) {
        await log(`생성 결과 파싱 실패 - 다음 후보군 재시도`, null, "generating");
        remainingCandidates = remainingCandidates.filter((candidate) => candidate.candidateId !== nextCandidate.candidateId);
        continue;
      }

      attemptedCandidateIds.push(parsed.candidate.candidateId);
      let candidateText = cleanGeneratedThreadText(parsed.postText);
      if (!candidateText) {
        await log(`선택 후보 ${parsed.candidate.candidateId} 본문 비어 있음 - 재시도`, null, "generating");
        remainingCandidates = remainingCandidates.filter((candidate) => candidate.candidateId !== parsed.candidate.candidateId);
        continue;
      }
      await log(`글 생성 완료 (${candidateText.length}자)`, { length: candidateText.length, candidateId: parsed.candidate.candidateId }, "generating");

      generationMeta = {
        candidateId: parsed.candidate.candidateId,
        topicLabel: parsed.topicLabel || parsed.candidate.topicLabel,
        topicFingerprint: parsed.candidate.topicFingerprint,
        topicFamilyFingerprint: parsed.candidate.topicFamilyFingerprint,
        evidenceFingerprint: parsed.candidate.evidenceFingerprint,
        sourcePathFingerprint: parsed.candidate.sourcePathFingerprint,
      };
      const strongRepeat = findStrongRepeat(repeatHistory, generationMeta);
      const legacyBodyRepeat = findLegacyBodyRepeat(repeatHistory, candidateText);
      if (strongRepeat || legacyBodyRepeat) {
        const match = createRepeatMatch(strongRepeat || legacyBodyRepeat, strongRepeat ? "topic+evidence" : "legacy-body");
        await log(`반복 감지로 후보 재선택: ${generationMeta.topicLabel || parsed.candidate.topicLabel}`, match, "generating");
        finalRepeatCheck = buildRepeatCheckResult(
          repeatHistory,
          attempt === 1 ? "reselected" : "reselected",
          attempt,
          match,
          { attemptedCandidateIds: [...attemptedCandidateIds] }
        );
        remainingCandidates = remainingCandidates.filter((candidate) => candidate.candidateId !== parsed.candidate.candidateId);
        continue;
      }

      text = candidateText;
      selectedCandidate = parsed.candidate;
      finalRepeatCheck = buildRepeatCheckResult(
        repeatHistory,
        attempt > 1 || recentlyBlocked > 0 ? "reselected" : "passed",
        attempt,
        null,
        {
          attemptedCandidateIds: [...attemptedCandidateIds],
          filteredBeforeGeneration: recentlyBlocked,
        }
      );
      break;
    }

    if (!text || !selectedCandidate) {
      const repeatCheck = finalRepeatCheck || buildRepeatCheckResult(
        repeatHistory,
        "skipped",
        Math.min(MAX_REPEAT_RETRIES, attemptedCandidateIds.length),
        null,
        {
          attemptedCandidateIds,
          reason: "최근 예약/게시와 논점 중복으로 대체 후보 없음",
          filteredBeforeGeneration: recentlyBlocked,
        }
      );
      if (!repeatCheck.reason) {
        repeatCheck.reason = "최근 예약/게시와 논점 중복으로 대체 후보 없음";
      }
      await log(repeatCheck.reason, { attemptedCandidateIds }, "generating");
      await updateMonitorRun(username, runId, {
        status: "skipped",
        phase: "done",
        skipReason: repeatCheck.reason,
        sourceLabel,
        sourceInfo: {
          mode: sourceMode,
          choice: sourceChoice,
          label: sourceLabel,
          provenance: { repeatCheck },
        },
        summary: "반복 회피 실패로 스킵",
      });
      return { skipped: true, skipReason: repeatCheck.reason, logs };
    }

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
첫 문장은 반드시 훅으로 다시 써야 해.
설명문, 안내문, 요약문으로 시작하면 안 돼.
설명 없이 최종 본문만 출력.

[원문]
${text}
`,
        env
      );
      const repaired = repairRaw
        ? cleanGeneratedThreadText(repairRaw)
        : "";
      if (repaired.length >= text.length) {
        text = repaired;
        await log(`보강 생성 완료 (${text.length}자)`, { length: text.length }, "reviewing");
      }
    }

    const postReviewRepeat = findStrongRepeat(repeatHistory, {
      candidateId: selectedCandidate.candidateId,
      topicFingerprint: selectedCandidate.topicFingerprint,
      topicFamilyFingerprint: selectedCandidate.topicFamilyFingerprint,
      evidenceFingerprint: selectedCandidate.evidenceFingerprint,
    });
    const postReviewLegacy = findLegacyBodyRepeat(repeatHistory, text);
    if (postReviewRepeat || postReviewLegacy) {
      const match = createRepeatMatch(postReviewRepeat || postReviewLegacy, postReviewRepeat ? "topic+evidence" : "legacy-body");
      const repeatCheck = buildRepeatCheckResult(repeatHistory, "skipped", finalRepeatCheck?.attempts || 1, match, {
        reason: "최근 예약/게시와 논점 중복으로 대체 후보 없음",
        attemptedCandidateIds: finalRepeatCheck?.attemptedCandidateIds || [selectedCandidate.candidateId],
      });
      await log(`검토 후 반복 재확인으로 스킵`, match, "reviewing");
      await updateMonitorRun(username, runId, {
        status: "skipped",
        phase: "done",
        skipReason: repeatCheck.reason,
        text,
        sourceLabel,
        sourceInfo: buildSourceInfoWithCandidate(config, sourceMode, sourceChoice, sourceLabel, selectedCandidate, repeatCheck, config.searchTerms || []),
        summary: "검토 후 반복 감지로 스킵",
      });
      return { skipped: true, skipReason: repeatCheck.reason, logs };
    }

    await guardCancel();
    await setPhase("scheduling", "예약 등록 처리 중");
    // 4. 예약 등록 (중복 방지 — pending 자동 예약이 하나라도 있으면 스킵)
    const schedulesBeforeSave = await readAllSchedules(username);
    const pendingAuto = schedulesBeforeSave.find(s => s.auto === true && s.status === "pending");
    if (pendingAuto && !allowExistingPendingAuto) {
      const pendingTime = new Date(pendingAuto.scheduledAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
      await log(`대기 중인 자동 예약 있음 (${pendingTime}) — 스킵`, null, "scheduling");
      await updateMonitorRun(username, runId, {
        status: "skipped",
        phase: "done",
        skipReason: `기존 예약 대기 중: ${pendingTime}`,
        text,
        sourceLabel,
        sourceInfo: buildSourceInfoWithCandidate(
          config,
          sourceMode,
          sourceChoice,
          sourceLabel,
          selectedCandidate,
          finalRepeatCheck || buildRepeatCheckResult(repeatHistory, "passed", 1),
          config.searchTerms || []
        ),
      });
      return { skipped: true, skipReason: `기존 예약 대기 중: ${pendingTime}`, logs };
    }

    const scheduledAt = scheduledAtOverride || calcScheduledAt(config.postTime);
    const scheduleIdSuffix = scheduleMeta
      ? `d${scheduleMeta.dayIndex}_s${scheduleMeta.slotIndex}`
      : Math.random().toString(36).slice(2, 8);
    const sourceInfo = buildSourceInfoWithCandidate(
      config,
      sourceMode,
      sourceChoice,
      sourceLabel,
      selectedCandidate,
      finalRepeatCheck || buildRepeatCheckResult(repeatHistory, "passed", 1),
      config.searchTerms || []
    );

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
      runId,
      sourceInfo,
    };
    try {
      await saveSchedule(username, newPost);
    } catch (error) {
      if (isDuplicateScheduleTextError(error)) {
        await log("같은 본문 예약이 이미 있어 이번 슬롯은 스킵", null, "scheduling");
        await updateMonitorRun(username, runId, {
          status: "skipped",
          phase: "done",
          skipReason: error.message,
          scheduledAt,
          text,
          sourceLabel,
          sourceInfo,
        });
        return { skipped: true, skipReason: error.message, logs };
      }
      throw error;
    }
    await log(`예약 완료: ${scheduledAt} (KST ${config.postTime})`, { scheduledAt }, "scheduling");
    await log(`본문 길이: ${text.length}자`, { length: text.length }, "scheduling");
    await updateMonitorRun(username, runId, {
      status: "completed",
      phase: "done",
      scheduledAt,
      text,
      sourceLabel,
      sourceInfo,
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
  const PROCESS_ENV = globalThis.process?.env || {};
  const manualUsername = req.query?.username || req.body?.username || null;
  const manualRunId = req.query?.runId || req.body?.runId || null;
  const batchOptions = req.method === "POST" ? (req.body?.batch || null) : null;
  const inlineConfig = req.method === "POST" ? (req.body?.config || null) : null;
  const runOptions = req.method === "POST" ? (req.body?.options || null) : null;

  // CRON_SECRET 검증
  const cronSecret = PROCESS_ENV.CRON_SECRET;
  if (cronSecret && !manualUsername) {
    const auth = req.headers["authorization"] || "";
    if (auth !== `Bearer ${cronSecret}`) return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const env = PROCESS_ENV;
  const results = [];

  try {
    if (manualUsername) {
      const cfg = inlineConfig || await readBlob(PREFIX_AUTO, manualUsername);
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

      const result = await runForAccount(manualUsername, cfg, env, runId, runOptions || {});
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
