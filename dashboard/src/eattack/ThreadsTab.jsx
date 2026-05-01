// Threads 자동 게시 탭
// 텍스트(+선택적 이미지) → Threads Graph API → 게시
import { useState, useEffect, useRef } from "react";
import { callGemini } from "../utils/gemini";
import LoginModal from "./LoginModal";
import { getSession } from "../utils/authSession";
import TopicPicker from "./TopicPicker";
import { emitEAttackContext, summarizeText } from "./eattackContext";

// ── 소셜 설정 키/로드/저장 ──
const threadsKey = (u) => `eden_threads_${u}_v1`;

function loadSocial(keyFn, username) {
  try { return JSON.parse(localStorage.getItem(keyFn(username))) || {}; }
  catch { return {}; }
}
function saveSocial(keyFn, username, data) {
  localStorage.setItem(keyFn(username), JSON.stringify(data));
}

const TH_MAX_CHARS = 500;
const THREAD_TEMPLATE_KEY = "eattack_threads_view_template";
const TEMPLATE_OPTIONS_KEY = "eattack_threads_template_options";
const templateSelectionKey = (u) => `eattack_threads_template_selection_${u}_v1`;
const autoRunKey = (u) => `eattack_threads_auto_run_${u}_v1`;
const autoMonitorCacheKey = (u) => `eattack_threads_auto_monitor_${u}_v1`;
const CONVERSATION_FORMATS = [
  {
    key: "expert",
    label: "전문가 설명",
    prompt: "차분한 전문가가 쉽게 풀어주는 말투. 주장 → 이유 → 적용 팁 → 낮은 허들 CTA 흐름.",
  },
  {
    key: "friend",
    label: "친구 조언",
    prompt: "친한 친구가 옆에서 알려주는 말투. 공감 → 솔직한 경험 → 바로 해볼 행동 → 부드러운 CTA 흐름.",
  },
  {
    key: "story",
    label: "경험담",
    prompt: "개인 경험을 들려주는 말투. 상황 묘사 → 깨달음 → 바뀐 관점 → 독자에게 넘기는 CTA 흐름.",
  },
  {
    key: "question",
    label: "질문 유도",
    prompt: "독자에게 질문을 던지며 대화를 여는 말투. 문제 질문 → 선택지/오해 제시 → 관점 제안 → 댓글 CTA 흐름.",
  },
  {
    key: "checklist",
    label: "체크리스트",
    prompt: "짧고 실용적인 체크리스트 말투. 결론 선제시 → 3~5개 포인트 → 바로 적용 CTA 흐름.",
  },
];
const TONE_OPTIONS = [
  { key: "template", label: "템플릿 말투", prompt: "분석된 템플릿의 원래 말투를 최대한 유지" },
  { key: "direct", label: "직설적", prompt: "짧고 단정적인 문장, 군더더기 없는 확신형 말투" },
  { key: "warm", label: "따뜻한 공감", prompt: "독자의 상황을 먼저 받아주고 부담 없이 권하는 말투" },
  { key: "bold", label: "도발적", prompt: "익숙한 믿음을 살짝 뒤집고 강한 주장으로 끌고 가는 말투" },
  { key: "casual", label: "캐주얼", prompt: "친근하고 가벼운 대화체, 과한 전문용어를 줄인 말투" },
];
const FLOW_OPTIONS = [
  { key: "template", label: "템플릿 흐름", prompt: "저장된 템플릿의 흐름을 우선 적용" },
  { key: "problem", label: "문제→해결", prompt: "문제 제기 → 공감 → 해결책 → 바로 할 행동 순서" },
  { key: "value", label: "가치 선제시", prompt: "첫 줄에서 얻을 이득 제시 → 왜 필요한지 → 구성/근거 → CTA 순서" },
  { key: "story", label: "상황→깨달음", prompt: "짧은 상황 묘사 → 시행착오 → 깨달음 → 독자 적용 순서" },
  { key: "contrarian", label: "반전 주장", prompt: "통념 제시 → 반박 → 새로운 관점 → 확인/댓글 CTA 순서" },
];
const CTA_OPTIONS = [
  { key: "template", label: "템플릿 CTA", prompt: "저장된 템플릿의 CTA 방식을 우선 적용" },
  { key: "comment", label: "댓글 유도", prompt: "댓글로 키워드나 의견을 남기게 하는 낮은 허들 CTA" },
  { key: "follow", label: "팔로우 유도", prompt: "비슷한 실전 팁을 계속 보고 싶으면 팔로우하도록 자연스럽게 유도하는 CTA" },
  { key: "save", label: "저장 유도", prompt: "나중에 다시 보도록 저장을 유도하는 실용형 CTA" },
  { key: "dm", label: "DM 유도", prompt: "자료/체크리스트를 받기 위한 DM 또는 키워드 요청 CTA" },
  { key: "soft", label: "부드러운 권유", prompt: "강요 없이 오늘 바로 한 가지를 해보게 하는 CTA" },
];
const DEFAULT_TEMPLATE_OPTIONS = {
  format: CONVERSATION_FORMATS,
  tone: TONE_OPTIONS,
  flow: FLOW_OPTIONS,
  cta: CTA_OPTIONS,
};

// ── 예약 스케줄 서버 API ──
async function fetchSchedules(username) {
  const res = await fetch(`/api/schedule?username=${encodeURIComponent(username)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.schedules || [];
}

async function addSchedule(username, schedule) {
  const res = await fetch("/api/schedule", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, schedule }),
  });
  const data = await res.json().catch(() => ({}));
  return {
    ok: res.ok,
    error: data?.error || "",
    schedule: data?.schedule || null,
    duplicate: data?.duplicate || null,
  };
}

async function removeSchedule(username, id) {
  const res = await fetch("/api/schedule", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, id }),
  });
  return res.ok;
}

async function clearDoneSchedulesServer(username) {
  const res = await fetch("/api/schedule", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  });
  return res.ok;
}

async function updateSchedule(username, id, updates) {
  const res = await fetch("/api/schedule", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, id, updates }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.schedule || null;
}

async function fetchAutoRunDetail(username, runId) {
  const res = await fetch(`/api/threads-auto-monitor?username=${encodeURIComponent(username)}&runId=${encodeURIComponent(runId)}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "실행 로그 조회 실패");
  return data.current || null;
}

function loadThreadTemplate() {
  try { return JSON.parse(localStorage.getItem(THREAD_TEMPLATE_KEY)) || null; }
  catch { return null; }
}
function loadTemplateOptions() {
  try {
    const saved = JSON.parse(localStorage.getItem(TEMPLATE_OPTIONS_KEY)) || {};
    const mergeOptions = (base, custom) => {
      const list = Array.isArray(custom) && custom.length ? custom : [];
      const map = new Map(base.map(option => [option.key, option]));
      list.forEach(option => {
        if (option?.key) map.set(option.key, option);
      });
      return Array.from(map.values());
    };
    return {
      format: mergeOptions(CONVERSATION_FORMATS, saved.format),
      tone: mergeOptions(TONE_OPTIONS, saved.tone),
      flow: mergeOptions(FLOW_OPTIONS, saved.flow),
      cta: mergeOptions(CTA_OPTIONS, saved.cta),
    };
  } catch {
    return DEFAULT_TEMPLATE_OPTIONS;
  }
}
function saveTemplateOptions(data) {
  localStorage.setItem(TEMPLATE_OPTIONS_KEY, JSON.stringify(data));
}
function loadTemplateSelection(username) {
  try {
    return JSON.parse(localStorage.getItem(templateSelectionKey(username))) || {};
  } catch {
    return {};
  }
}
function saveTemplateSelection(username, data) {
  localStorage.setItem(templateSelectionKey(username), JSON.stringify(data));
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

function calcBatchScheduledAt(baseDateKst, postTime, dayOffset, slotIndex, intervalHours) {
  const [hh, mm] = postTime.split(":").map(Number);
  const base = new Date(`${baseDateKst}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+09:00`);
  base.setTime(base.getTime() + dayOffset * 24 * 60 * 60 * 1000 + slotIndex * intervalHours * 60 * 60 * 1000);
  return base.toISOString();
}

async function parseResponsePayload(res) {
  const raw = await res.text();
  try {
    return { data: JSON.parse(raw), raw };
  } catch {
    return { data: null, raw };
  }
}
function loadAutoRunId(username) {
  try {
    return localStorage.getItem(autoRunKey(username)) || "";
  } catch {
    return "";
  }
}
function saveAutoRunId(username, runId) {
  localStorage.setItem(autoRunKey(username), runId || "");
}
function loadAutoMonitorCache(username) {
  try {
    return JSON.parse(localStorage.getItem(autoMonitorCacheKey(username))) || null;
  } catch {
    return null;
  }
}
function saveAutoMonitorCache(username, data) {
  localStorage.setItem(autoMonitorCacheKey(username), JSON.stringify(data || null));
}
function resolveSavedSelection(options, selection = {}) {
  const hasOption = (group, key) => options[group]?.some(option => option.key === key);
  return {
    format: hasOption("format", selection.format) ? selection.format : "expert",
    tone: hasOption("tone", selection.tone) ? selection.tone : "template",
    flow: hasOption("flow", selection.flow) ? selection.flow : "template",
    cta: hasOption("cta", selection.cta) ? selection.cta : "template",
  };
}
function cleanThreadDraft(raw) {
  if (!raw) return "";
  let text = raw
    .replace(/\r/g, "")
    .replace(/```[\s\S]*?```/g, m => m.replace(/```[a-z]*\n?/gi, "").replace(/```/g, ""))
    .trim();

  const lines = text.split("\n");
  const cleaned = [];
  let started = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (started && cleaned[cleaned.length - 1] !== "") cleaned.push("");
      continue;
    }
    if (/^(네|좋아요|물론|알겠습니다)[,!\s]/.test(trimmed)) continue;
    if (/^[-–—]{3,}$/.test(trimmed)) continue;
    if (/^#{1,6}\s*/.test(trimmed)) continue;
    if (/^[ABC]\s*안\s*(\(|:|：)/i.test(trimmed)) {
      if (started) break;
      continue;
    }
    if (/^\d+\s*[).]\s*(안|버전)/.test(trimmed)) {
      if (started) break;
      continue;
    }
    if (/^(선택|원하시면|마음에 드는|아래는|다음은)/.test(trimmed)) continue;
    started = true;
    cleaned.push(line.replace(/^[-*]\s+/, "").trimEnd());
  }

  return cleaned
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, TH_MAX_CHARS);
}

function AutoMonitorDock({
  monitor,
  history,
  loading,
  canceling,
  autoRunning,
  onRefresh,
  onCancel,
  onSelectRun,
}) {
  const status = monitor?.status || "idle";
  const statusLabel = status === "running"
    ? "검수 중"
    : status === "canceling"
      ? "취소 요청"
      : status === "completed"
        ? "완료"
        : status === "skipped"
          ? "스킵"
          : status === "failed"
            ? "실패"
            : "대기";

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,380px)]">
      <div className="rounded-2xl border border-violet-200 bg-white/95 backdrop-blur shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-3 py-3 border-b border-violet-100 bg-violet-50/80">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="7" width="18" height="11" rx="2" />
                <path d="M12 3v4" />
                <path d="M9 11h.01" />
                <path d="M15 11h.01" />
                <path d="M8 18h8" />
                <path d="M6 7l-2-2" />
                <path d="M18 7l2-2" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-violet-800 truncate">AI 검수 패널</p>
              <p className="text-[10px] text-gray-500 truncate">
                {monitor?.phase ? `단계: ${monitor.phase}` : "실행 로그와 히스토리를 표시합니다"}
              </p>
            </div>
          </div>
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap ${
            status === "running"
              ? "bg-violet-50 text-violet-700 border-violet-200"
              : status === "canceling"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : status === "completed"
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                  : status === "skipped"
                    ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                    : status === "failed"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-gray-50 text-gray-500 border-gray-200"
          }`}>
            {statusLabel}
          </span>
        </div>

        <div className="p-3 space-y-3 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold shrink-0">
              {status === "running" || status === "canceling" ? "AI" : "P"}
            </div>
            <div className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm flex-1 min-w-0">
              <span className="text-xs text-gray-400 truncate">
                {status === "running" ? "생각 중" : status === "canceling" ? "취소 처리 중" : "기록 대기"}
              </span>
              {(status === "running" || status === "canceling") && (
                <>
                  <div className="w-1.5 h-1.5 bg-purple-300 rounded-full animate-bounce ml-0.5" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 bg-purple-300 rounded-full animate-bounce ml-0.5" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 bg-purple-300 rounded-full animate-bounce ml-0.5" style={{ animationDelay: "300ms" }} />
                </>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {loading && (
              <div className="text-[11px] text-gray-400">검수 상태 불러오는 중...</div>
            )}
            {!monitor?.logs?.length && !loading && (
              <div className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                실행 로그가 여기에 하나씩 쌓입니다.
              </div>
            )}
            {monitor?.logs?.slice(-12).map((entry, idx) => {
              const time = entry?.time ? new Date(entry.time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "";
              const level = entry?.phase || entry?.level || "log";
              return (
                <div key={`${entry?.time || idx}-${idx}`} className="flex gap-2 items-start rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    level === "generating" || level === "reviewing"
                      ? "bg-violet-400"
                      : level === "searching"
                        ? "bg-blue-400"
                        : level === "scheduling"
                          ? "bg-emerald-400"
                          : level === "failed"
                            ? "bg-red-400"
                            : "bg-amber-400"
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span className="font-mono">{time || "now"}</span>
                      <span className="font-semibold uppercase">{level}</span>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed">{entry?.msg || ""}</p>
                    {entry?.detail && (
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5 break-all">
                        {typeof entry.detail === "object" ? JSON.stringify(entry.detail) : String(entry.detail)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {monitor?.text && (
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold text-gray-700">최종 본문 ({monitor.text.length}자)</p>
                {monitor?.scheduledAt && (
                  <span className="text-[10px] text-gray-400">
                    {new Date(monitor.scheduledAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              <pre className="whitespace-pre-wrap text-gray-800 bg-white border border-gray-200 rounded-lg p-2 leading-relaxed text-[11px] max-h-40 overflow-y-auto">{monitor.text}</pre>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="px-3 py-2 text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100"
            >
              새로고침
            </button>
            <button
              onClick={onCancel}
              disabled={canceling || !(status === "running" || status === "canceling" || autoRunning)}
              className="px-3 py-2 text-[11px] font-bold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40"
            >
              {canceling ? "취소 중..." : "취소"}
            </button>
          </div>

          <div className="pt-1 border-t border-gray-100">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-bold text-violet-800">최근 실행 히스토리</p>
              <span className="text-[10px] text-gray-400">{history.length}건</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {history.length === 0 ? (
                <div className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                  저장된 실행 기록이 없습니다.
                </div>
              ) : history.slice(0, 6).map((run) => (
                <button
                  key={run.runId}
                  onClick={() => onSelectRun(run.runId)}
                  className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 hover:bg-violet-50 hover:border-violet-200 transition-all"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-gray-500">
                      {run.startedAt ? new Date(run.startedAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : run.runId}
                    </p>
                    <p className="text-xs text-gray-700 truncate">
                      {run.summary || run.error || run.skipReason || run.phase || "실행 기록"}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full border ${
                    run.status === "running"
                      ? "bg-violet-50 text-violet-700 border-violet-200"
                      : run.status === "completed"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : run.status === "skipped"
                          ? "bg-yellow-50 text-yellow-700 border-yellow-200"
                          : run.status === "failed"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-gray-50 text-gray-500 border-gray-200"
                  }`}>
                    {run.status === "running"
                      ? "진행"
                      : run.status === "completed"
                        ? "완료"
                        : run.status === "skipped"
                          ? "스킵"
                          : run.status === "failed"
                            ? "실패"
                            : "대기"}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ThreadsTab() {
  const [session] = useState(() => getSession());
  const username = session?.username || "__guest";
  const [templateOptions, setTemplateOptions] = useState(loadTemplateOptions);
  const [savedTemplateSelection] = useState(() => (
    resolveSavedSelection(loadTemplateOptions(), loadTemplateSelection(username))
  ));

  // 설정
  const [config, setConfig] = useState(
    () => loadSocial(threadsKey, username)
  );
  const [accessToken, setAccessToken] = useState(config.accessToken || "");
  const [userId, setUserId] = useState(config.userId || "");

  // 게시 내용
  const [text, setText] = useState("");
  const [aiTopic, setAiTopic] = useState("");

  // 상태
  const [posting, setPosting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [templating, setTemplating] = useState(false);
  const [templateFormat, setTemplateFormat] = useState(savedTemplateSelection.format || "expert");
  const [templateTone, setTemplateTone] = useState(savedTemplateSelection.tone || "template");
  const [templateFlow, setTemplateFlow] = useState(savedTemplateSelection.flow || "template");
  const [templateCta, setTemplateCta] = useState(savedTemplateSelection.cta || "template");
  const [showOptionEditor, setShowOptionEditor] = useState(false);
  const [fetchingId, setFetchingId] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showTopicPicker, setShowTopicPicker] = useState(false);

  // 예약 게시
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [scheduledPosts, setScheduledPosts] = useState([]);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [bulkResult, setBulkResult] = useState(null); // { success, fail }
  const [scheduleView, setScheduleView] = useState("pending"); // "pending" | "all"
  const [expandedScheduleId, setExpandedScheduleId] = useState("");
  const [editingScheduleId, setEditingScheduleId] = useState("");
  const [editingScheduleText, setEditingScheduleText] = useState("");
  const [editingScheduleTime, setEditingScheduleTime] = useState("");
  const [scheduleUpdating, setScheduleUpdating] = useState(false);
  const [scheduleSourceOpenId, setScheduleSourceOpenId] = useState("");
  const [scheduleSourceLoadingId, setScheduleSourceLoadingId] = useState("");
  const [scheduleSourceMap, setScheduleSourceMap] = useState({});

  // 풀 자동화 설정
  const [showAutoPanel, setShowAutoPanel] = useState(false);
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [autoKeywords, setAutoKeywords] = useState("AI,클로드코드,ChatGPT");
  const [autoPostTime, setAutoPostTime] = useState("09:00");
  const [autoFormat, setAutoFormat] = useState("expert");
  const [autoTone, setAutoTone] = useState("template");
  const [autoFlow, setAutoFlow] = useState("template");
  const [autoCta, setAutoCta] = useState("comment");
  const [autoSourceMode, setAutoSourceMode] = useState("random");
  const [autoBatchDays, setAutoBatchDays] = useState(3);
  const [autoBatchPostsPerDay, setAutoBatchPostsPerDay] = useState(2);
  const [autoBatchIntervalHours, setAutoBatchIntervalHours] = useState(4);
  const [autoSaving, setAutoSaving] = useState(false);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoBatchRunning, setAutoBatchRunning] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [autoLastUpdated, setAutoLastUpdated] = useState(null);
  const [autoRunResult, setAutoRunResult] = useState(null); // { logs, text, scheduledAt, skipped, skipReason, error }
  const [autoRunId, setAutoRunId] = useState("");
  const [autoMonitor, setAutoMonitor] = useState(null);
  const [autoHistory, setAutoHistory] = useState([]);
  const [autoMonitorLoading, setAutoMonitorLoading] = useState(false);
  const [autoCanceling, setAutoCanceling] = useState(false);
  const autoPollRef = useRef(null);

  useEffect(() => {
    emitEAttackContext({
      page: "ThreadsTab",
      section: "이미지 > Threads",
      tab: "threads",
      step: autoEnabled ? "auto" : scheduleEnabled ? "schedule" : showAutoPanel ? "auto-panel" : "post",
      mode: templateFormat,
      status: autoRunning ? "자동화 실행 중" : posting ? "게시 중" : scheduleEnabled ? "예약" : "대기",
      summary: [
        `주제 ${summarizeText(aiTopic || text || "미입력", 80)}`,
        `말투 ${templateTone}`,
        `흐름 ${templateFlow}`,
        `CTA ${templateCta}`,
        `자동화 ${autoEnabled ? "활성" : "비활성"}`,
        `예약 ${scheduleEnabled ? "켜짐" : "꺼짐"}`,
        autoSourceMode ? `소스 ${autoSourceMode}` : "",
      ].filter(Boolean).join(" · "),
    });
  }, [aiTopic, text, templateTone, templateFlow, templateCta, autoEnabled, scheduleEnabled, autoSourceMode, autoRunning, posting, showAutoPanel, templateFormat]);

  useEffect(() => {
    if (loadThreadTemplate()) return;
    fetch("/api/threads-template")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.data) {
          localStorage.setItem(THREAD_TEMPLATE_KEY, JSON.stringify(data.data));
        }
      })
      .catch(() => {});
  }, []);

  const addLog = (level, msg, detail = null) => {
    const entry = { time: new Date().toLocaleTimeString("ko-KR"), level, msg, detail };
    setLogs(prev => [...prev.slice(-49), entry]);
  };

  const syncAutoMonitorState = (snapshot, runs = null, nextRunId = null) => {
    if (nextRunId !== null) {
      setAutoRunId(nextRunId);
      saveAutoRunId(username, nextRunId);
    }
    setAutoMonitor(snapshot);
    const nextRuns = Array.isArray(runs) ? runs : (autoHistory || []);
    if (Array.isArray(runs)) setAutoHistory(runs);
    saveAutoMonitorCache(username, {
      current: snapshot,
      runs: nextRuns,
    });
    setAutoRunResult(snapshot ? {
      logs: snapshot.logs?.map((l) => l.msg || l) || [],
      text: snapshot.text || "",
      scheduledAt: snapshot.scheduledAt || null,
      skipped: snapshot.status === "skipped",
      skipReason: snapshot.skipReason || null,
      error: snapshot.error || null,
    } : null);
    const active = snapshot && (snapshot.status === "running" || snapshot.status === "canceling");
    setAutoRunning(active);
  };

  const loadAutoMonitor = async (runIdOverride = null) => {
    const runId = runIdOverride || autoRunId || loadAutoRunId(username);
    setAutoMonitorLoading(true);
    try {
      const url = runId
        ? `/api/threads-auto-monitor?username=${encodeURIComponent(username)}&runId=${encodeURIComponent(runId)}`
        : `/api/threads-auto-monitor?username=${encodeURIComponent(username)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "모니터 조회 실패");
      syncAutoMonitorState(data.current || null, data.runs || [], data.current?.runId || runId || "");
      return data;
    } catch (e) {
      addLog("error", `자동화 모니터 조회 실패: ${e.message}`);
      return null;
    } finally {
      setAutoMonitorLoading(false);
    }
  };

  const openScheduleSource = async (schedule) => {
    const nextId = scheduleSourceOpenId === schedule.id ? "" : schedule.id;
    setExpandedScheduleId(schedule.id);
    setScheduleSourceOpenId(nextId);
    if (!nextId || scheduleSourceMap[schedule.id] || !schedule.runId) return;

    setScheduleSourceLoadingId(schedule.id);
    try {
      const detail = await fetchAutoRunDetail(username, schedule.runId);
      setScheduleSourceMap((prev) => ({ ...prev, [schedule.id]: detail }));
    } catch (e) {
      setScheduleSourceMap((prev) => ({
        ...prev,
        [schedule.id]: { error: e.message, logs: [] },
      }));
    } finally {
      setScheduleSourceLoadingId("");
    }
  };

  const getEffectiveSourceInfo = (schedule) => (
    schedule?.sourceInfo || scheduleSourceMap[schedule?.id]?.sourceInfo || null
  );

  const updateTemplateOption = (group, key, field, value) => {
    setTemplateOptions(prev => ({
      ...prev,
      [group]: prev[group].map(option => (
        option.key === key ? { ...option, [field]: value } : option
      )),
    }));
  };

  const addTemplateOption = (group) => {
    const key = `custom_${group}_${Date.now()}`;
    setTemplateOptions(prev => ({
      ...prev,
      [group]: [
        ...prev[group],
        { key, label: "새 옵션", prompt: "이 옵션이 적용할 말투와 흐름을 입력하세요." },
      ],
    }));
  };

  const deleteTemplateOption = (group, key) => {
    setTemplateOptions(prev => {
      if (prev[group].length <= 1) return prev;
      return { ...prev, [group]: prev[group].filter(option => option.key !== key) };
    });
    if (group === "format" && templateFormat === key) setTemplateFormat(templateOptions.format.find(o => o.key !== key)?.key || "expert");
    if (group === "tone" && templateTone === key) setTemplateTone(templateOptions.tone.find(o => o.key !== key)?.key || "template");
    if (group === "flow" && templateFlow === key) setTemplateFlow(templateOptions.flow.find(o => o.key !== key)?.key || "template");
    if (group === "cta" && templateCta === key) setTemplateCta(templateOptions.cta.find(o => o.key !== key)?.key || "template");
  };

  const handleSaveTemplateOptions = () => {
    saveTemplateOptions(templateOptions);
    addLog("info", "템플릿 재구성 옵션 저장됨");
  };

  const handleSaveTemplateSelection = () => {
    saveTemplateOptions(templateOptions);
    saveTemplateSelection(username, {
      format: templateFormat,
      tone: templateTone,
      flow: templateFlow,
      cta: templateCta,
    });
    addLog("info", "계정별 템플릿 선택 옵션 저장됨");
  };

  if (!session) {
    return <LoginModal onLogin={() => window.location.reload()} />;
  }

  // 토큰으로 userId 자동 조회
  const handleFetchUserId = async () => {
    if (!accessToken.trim()) {
      addLog("error", "액세스 토큰을 먼저 입력하세요");
      return;
    }
    setFetchingId(true);
    addLog("info", "Threads 사용자 ID 조회 중...");
    try {
      const res = await fetch(
        `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken.trim()}`
      );
      const data = await res.json();
      if (!res.ok || !data.id) {
        throw new Error(data.error?.message || `조회 실패 (${res.status})`);
      }
      const newUserId = data.id;
      const newConfig = { accessToken: accessToken.trim(), userId: newUserId };
      setUserId(newUserId);
      setConfig(newConfig);
      saveSocial(threadsKey, session.username, newConfig);
      addLog("info", `조회 성공: @${data.username} → ${newUserId}`);
    } catch (e) {
      addLog("error", `조회 실패: ${e.message}`);
    } finally {
      setFetchingId(false);
    }
  };

  // 토큰/userId 저장
  const handleSaveConfig = () => {
    const newConfig = { accessToken: accessToken.trim(), userId: userId.trim() };
    setConfig(newConfig);
    saveSocial(threadsKey, session.username, newConfig);
    addLog("info", "설정 저장됨");
  };

  // AI 글 생성
  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) {
      addLog("error", "주제를 입력하세요");
      return;
    }
    setGenerating(true);
    addLog("info", `AI 글 생성 중: "${aiTopic}"`);
    try {
      const result = await callGemini(
        [
          {
            role: "user",
            content: `주제: "${aiTopic}"\n\nThreads(인스타그램의 텍스트 SNS)에 올릴 게시글 최종안 1개만 작성해줘.\n\n규칙:\n- 안내문, 설명, 제목, A안/B안, 버전명 금지\n- 바로 게시할 본문만 출력\n- 최대 500자 이내\n- 줄바꿈을 활용한 읽기 쉬운 구조\n- 한 줄에 10~25자\n- 해시태그 2~4개 (마지막에)\n- 자연스럽고 공감 가는 톤\n- 마크다운, 따옴표 없이 순수 텍스트만`,
          },
        ],
        "SNS 콘텐츠 전문가. 설명 없이 Threads에 바로 게시할 최종 본문 1개만 작성합니다."
      );
      setText(cleanThreadDraft(result));
      addLog("info", "AI 글 생성 완료");
    } catch (e) {
      addLog("error", `AI 생성 실패: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleTemplateRewrite = async () => {
    const savedTemplate = loadThreadTemplate();
    const template = savedTemplate?.data;
    const format = templateOptions.format.find(f => f.key === templateFormat) || templateOptions.format[0];
    const tone = templateOptions.tone.find(o => o.key === templateTone) || templateOptions.tone[0];
    const flow = templateOptions.flow.find(o => o.key === templateFlow) || templateOptions.flow[0];
    const cta = templateOptions.cta.find(o => o.key === templateCta) || templateOptions.cta[0];
    const topicSource = aiTopic.trim();
    const draftSource = text.trim();
    const source = topicSource || draftSource;
    const sourceKind = topicSource ? "topic" : "draft";
    const formatRules = {
      expert: "전문가처럼 근거를 짧게 붙이되, 설명문이 아니라 게시글 말투로 쓴다.",
      friend: "친구가 옆에서 알려주듯이 반말/존댓말을 섞지 말고 부드러운 대화체로 쓴다. 과한 권위 표현을 줄인다.",
      story: "내가 겪은 짧은 상황에서 시작해 깨달음으로 넘어간다.",
      question: "첫 문장 또는 둘째 문장에 독자가 답하고 싶어지는 질문을 넣는다.",
      checklist: "본문 중간을 3~5개의 짧은 항목처럼 읽히게 쓴다.",
    };
    const toneRules = {
      template: "분석 템플릿의 말투를 유지한다.",
      direct: "짧고 단정적인 문장으로 쓴다.",
      warm: "독자를 먼저 이해해주는 표현을 넣는다.",
      bold: "익숙한 생각을 강하게 뒤집는 문장을 넣는다.",
      casual: "친구에게 알려주듯 가볍고 쉬운 표현을 쓴다. '마법', '신세계', 과장 광고 표현은 피한다.",
    };
    const flowRules = {
      template: "분석 템플릿의 흐름을 따른다.",
      problem: "문제 제기 → 공감 → 해결책 → 바로 할 행동 순서로 쓴다.",
      value: "얻을 이득 → 필요한 이유 → 구성/근거 → CTA 순서로 쓴다.",
      story: "상황 → 시행착오 → 깨달음 → 독자 적용 순서로 쓴다.",
      contrarian: "통념/오해 제시 → 반박 → 새로운 관점 → 바로 적용할 방법 → CTA 순서로 쓴다. 첫 문장은 반드시 반전 주장으로 시작한다.",
    };
    const ctaRules = {
      template: "분석 템플릿의 CTA를 따른다.",
      comment: "마지막 문장에서 댓글을 남기게 한다.",
      follow: "마지막 문장에서 비슷한 팁을 더 보려면 팔로우하라고 자연스럽게 말한다.",
      save: "마지막 문장에서 저장을 유도한다.",
      dm: "마지막 문장에서 DM 또는 키워드 요청을 유도한다.",
      soft: "마지막 문장에서 부담 없는 실행을 권한다.",
    };

    if (!template) {
      addLog("error", "먼저 인기글 수집 화면에서 조회수 템플릿 역설계를 실행하세요");
      return;
    }
    if (!source) {
      addLog("error", "재구성할 주제나 초안을 입력하세요");
      return;
    }

    setTemplating(true);
    addLog("info", "조회수 템플릿 기반 재구성 중...");

    try {
      const result = await callGemini(
        [
          {
            role: "user",
            content:
`다음 주제/초안을 Threads 게시글로 재구성해주세요.

입력 소스 유형: ${sourceKind === "topic" ? "주제" : "초안"}
입력 소스:
${source}

조회수 기반 분석 템플릿:
${JSON.stringify(template, null, 2)}

요구사항:
- 최종안 1개만 작성
- 안내문, 설명, 제목, A안/B안, 버전명 금지
- 바로 게시할 본문만 출력
- 분석된 템플릿은 참고하되, 아래 선택 옵션을 최우선으로 반영
- 이미 있던 이전 결과 문장은 그대로 남기지 말고 완전히 새 글로 재구성
- 입력 소스가 주제인 경우, 기존 초안 문장보다 주제에 맞는 새 문장을 우선 생성
- 대화 포맷: ${format.label}
- 말투/흐름 지시: ${format.prompt}
- 세부 말투: ${tone.label} — ${tone.prompt}
- 세부 흐름: ${flow.label} — ${flow.prompt}
- CTA 방식: ${cta.label} — ${cta.prompt}

선택 옵션 강제 규칙:
- 대화 포맷 강제: ${formatRules[format.key] || format.prompt}
- 말투 강제: ${toneRules[tone.key] || tone.prompt}
- 흐름 강제: ${flowRules[flow.key] || flow.prompt}
- CTA 강제: ${ctaRules[cta.key] || cta.prompt}
- 첫 문장은 선택한 흐름에 맞는 카피라이팅으로 재작성
- 선택한 흐름과 충돌하는 일반적인 공감/해결책 구조로 되돌아가지 말 것
- 선택한 CTA와 다른 CTA로 마무리하지 말 것
- 최대 500자 이내
- 줄바꿈을 활용해 Threads에서 읽기 쉽게 구성
- 해시태그는 필요할 때만 1~3개
- 마크다운 없이 게시글 본문만 반환`,
          },
        ],
        `당신은 조회수 높은 Threads 글의 구조를 새 주제에 적용하는 카피라이터입니다. 설명 없이 최종 게시 본문 1개만 작성하세요. 선택된 대화 포맷(${format.label}), 말투(${tone.label}), 흐름(${flow.label}), CTA(${cta.label})를 우선 반영하세요. 이전 결과를 이어붙이지 말고 완전히 새 본문으로 작성하세요.`
      );
      setText(cleanThreadDraft(result));
      addLog("info", "템플릿 기반 재구성 완료");
    } catch (e) {
      addLog("error", `템플릿 재구성 실패: ${e.message}`);
    } finally {
      setTemplating(false);
    }
  };

  // Threads 게시
  const handlePost = async () => {
    if (!accessToken.trim() || !userId.trim()) {
      addLog("error", "액세스 토큰과 사용자 ID를 입력하세요");
      return;
    }
    if (!text.trim()) {
      addLog("error", "게시할 텍스트를 입력하세요");
      return;
    }
    setPosting(true);
    setResult(null);
    addLog("info", "Threads 게시 시작...");
    addLog("info", `텍스트 길이: ${text.length}자`);

    try {
      const res = await fetch("/api/threads-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId.trim(),
          accessToken: accessToken.trim(),
          text: text.trim(),
          images: [],
        }),
      });
      const data = await res.json();

      if (data.logs?.length) {
        data.logs.forEach(l => addLog("info", `[서버] ${l.msg}`, l.data));
      }
      addLog(res.ok ? "info" : "error", `서버 응답 [${res.status}]`, res.ok ? undefined : data);

      if (!res.ok) throw new Error(data.error || "게시 실패");

      addLog("info", `게시 성공! mediaId: ${data.mediaId}`);
      setResult({ status: "success", mediaId: data.mediaId });
    } catch (e) {
      addLog("error", `오류: ${e.message}`);
      setResult({ status: "error", message: e.message });
    } finally {
      setPosting(false);
    }
  };

  // 서버에서 예약 목록 로드 (마운트 시 + 60초마다 갱신)
  useEffect(() => {
    const load = () =>
      fetchSchedules(username).then(setScheduledPosts).catch(() => {});
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [username]);

  // 풀 자동화 설정 로드
  useEffect(() => {
    if (!username || username === "__guest") return;
    const cached = loadAutoMonitorCache(username);
    if (cached?.current) {
      setAutoRunId(cached.current.runId || "");
      setAutoMonitor(cached.current);
      setAutoHistory(Array.isArray(cached.runs) ? cached.runs : []);
      setAutoRunResult({
        logs: cached.current.logs?.map((l) => l.msg || l) || [],
        text: cached.current.text || "",
        scheduledAt: cached.current.scheduledAt || null,
        skipped: cached.current.status === "skipped",
        skipReason: cached.current.skipReason || null,
        error: cached.current.error || null,
      });
      setAutoRunning(cached.current.status === "running" || cached.current.status === "canceling");
    }
    const storedRunId = loadAutoRunId(username);
    if (!autoRunId && storedRunId) {
      setAutoRunId(storedRunId);
    }
    loadAutoMonitor(storedRunId || cached?.current?.runId || null);
    setAutoLoading(true);
    fetch(`/api/threads-auto-config?username=${encodeURIComponent(username)}`)
      .then(r => r.json())
      .then(data => {
        const cfg = data?.config;
        if (!cfg) return;
        setAutoEnabled(cfg.enabled ?? false);
        setAutoKeywords((cfg.keywords || []).join(","));
        setAutoPostTime(cfg.postTime || "09:00");
        setAutoFormat(cfg.format || "expert");
        setAutoTone(cfg.tone || "template");
        setAutoFlow(cfg.flow || "template");
        setAutoCta(cfg.cta || "comment");
        setAutoSourceMode(cfg.sourceMode || "random");
        setAutoBatchDays(cfg.batchDays || 3);
        setAutoBatchPostsPerDay(cfg.batchPostsPerDay || 2);
        setAutoBatchIntervalHours(cfg.batchIntervalHours || 4);
        setAutoLastUpdated(cfg.updatedAt || null);
      })
      .catch(() => {})
      .finally(() => setAutoLoading(false));
  }, [username]);

  useEffect(() => {
    if (!username || username === "__guest") return;
    const runId = autoRunId || loadAutoRunId(username);
    if (!runId) return;
    let canceled = false;
    const tick = async () => {
      if (canceled) return;
      const data = await loadAutoMonitor(runId);
      if (canceled || !data?.current) return;
      const status = data.current.status;
      if (status !== "running" && status !== "canceling") {
        clearInterval(autoPollRef.current);
        autoPollRef.current = null;
      }
    };
    tick();
    autoPollRef.current = setInterval(tick, 2500);
    return () => {
      canceled = true;
      if (autoPollRef.current) {
        clearInterval(autoPollRef.current);
        autoPollRef.current = null;
      }
    };
  }, [username, autoRunId]);

  // 자동화 설정 저장
  const handleSaveAutoConfig = async () => {
    if (!userId.trim() || !accessToken.trim()) {
      addLog("error", "인증 설정에서 액세스 토큰과 사용자 ID를 먼저 저장하세요");
      return;
    }
    const keywords = autoKeywords.split(",").map(k => k.trim()).filter(Boolean);
    if (!keywords.length) {
      addLog("error", "키워드를 하나 이상 입력하세요");
      return;
    }
    setAutoSaving(true);
    try {
      const res = await fetch("/api/threads-auto-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          config: {
            enabled: autoEnabled,
            keywords,
            postTime: autoPostTime,
            format: autoFormat,
            tone: autoTone,
            flow: autoFlow,
            cta: autoCta,
            sourceMode: autoSourceMode,
            batchDays: Number(autoBatchDays) || 1,
            batchPostsPerDay: Number(autoBatchPostsPerDay) || 1,
            batchIntervalHours: Number(autoBatchIntervalHours) || 4,
            userId: userId.trim(),
            accessToken: accessToken.trim(),
          },
        }),
      });
      if (!res.ok) throw new Error("저장 실패");
      setAutoLastUpdated(new Date().toISOString());
      addLog("info", `풀 자동화 설정 저장 완료 (${autoEnabled ? "활성" : "비활성"})`);
    } catch (e) {
      addLog("error", `자동화 설정 저장 실패: ${e.message}`);
    } finally {
      setAutoSaving(false);
    }
  };

  // 자동화 즉시 실행 (테스트) — 현재 UI 설정을 먼저 저장한 뒤 실행
  const handleRunAutoNow = async () => {
    if (!userId.trim() || !accessToken.trim()) {
      addLog("error", "인증 설정에서 액세스 토큰과 사용자 ID를 먼저 저장하세요");
      return;
    }
    const keywords = autoKeywords.split(",").map(k => k.trim()).filter(Boolean);
    if (!keywords.length) {
      addLog("error", "키워드를 하나 이상 입력하세요");
      return;
    }

    setAutoRunning(true);
    setAutoRunResult(null);
    const runId = `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    setAutoRunId(runId);
    saveAutoRunId(username, runId);
    syncAutoMonitorState({
      username,
      runId,
      status: "running",
      phase: "starting",
      logs: [],
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, autoHistory, runId);
    addLog("info", "현재 설정 저장 후 자동화 실행 중...");

    try {
      const currentConfig = {
        enabled: true,
        keywords,
        postTime: autoPostTime,
        format: autoFormat,
        tone: autoTone,
        flow: autoFlow,
        cta: autoCta,
        sourceMode: autoSourceMode,
        batchDays: Number(autoBatchDays) || 1,
        batchPostsPerDay: Number(autoBatchPostsPerDay) || 1,
        batchIntervalHours: Number(autoBatchIntervalHours) || 4,
        userId: userId.trim(),
        accessToken: accessToken.trim(),
      };

      // 1) 현재 UI 설정을 먼저 서버에 저장
      const saveRes = await fetch("/api/threads-auto-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          config: currentConfig,
        }),
      });
      if (!saveRes.ok) throw new Error("설정 저장 실패");
      setAutoLastUpdated(new Date().toISOString());

      // 2) 자동화 실행
      const res = await fetch("/api/threads-auto-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          runId,
          config: currentConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "실행 실패");

      addLog("info", "실행 요청 전송 완료");
      if (data?.result?.logs?.length) {
        data.result.logs.forEach((l) => addLog("info", `  ↳ ${typeof l === "string" ? l : l?.msg || JSON.stringify(l)}`));
      }

      await loadAutoMonitor(runId);

      fetchSchedules(username).then(setScheduledPosts).catch(() => {});
    } catch (e) {
      addLog("error", `자동화 실행 실패: ${e.message}`);
      syncAutoMonitorState({
        username,
        runId,
        status: "failed",
        phase: "done",
        error: e.message,
        logs: [{ time: new Date().toISOString(), msg: e.message }],
        updatedAt: new Date().toISOString(),
      }, autoHistory, runId);
      setAutoRunResult({ logs: [], error: e.message });
    } finally {
      setAutoRunning(false);
    }
  };

  const handleGenerateAutoBatch = async () => {
    if (!userId.trim() || !accessToken.trim()) {
      addLog("error", "인증 설정에서 액세스 토큰과 사용자 ID를 먼저 저장하세요");
      return;
    }
    const keywords = autoKeywords.split(",").map(k => k.trim()).filter(Boolean);
    if (!keywords.length) {
      addLog("error", "키워드를 하나 이상 입력하세요");
      return;
    }

    const days = Math.max(1, Math.min(14, Number(autoBatchDays) || 1));
    const postsPerDay = Math.max(1, Math.min(6, Number(autoBatchPostsPerDay) || 1));
    const intervalHours = Math.max(1, Math.min(12, Number(autoBatchIntervalHours) || 4));
    const totalPosts = days * postsPerDay;
    if (totalPosts > 20) {
      addLog("error", "한 번에 최대 20개까지만 선생성할 수 있습니다");
      return;
    }

    setAutoBatchRunning(true);
    addLog("info", `${days}일 x 하루 ${postsPerDay}개 예약 생성 시작 (${intervalHours}시간 간격)`);

    try {
      const currentConfig = {
        enabled: autoEnabled,
        keywords,
        postTime: autoPostTime,
        format: autoFormat,
        tone: autoTone,
        flow: autoFlow,
        cta: autoCta,
        sourceMode: autoSourceMode,
        batchDays: days,
        batchPostsPerDay: postsPerDay,
        batchIntervalHours: intervalHours,
        userId: userId.trim(),
        accessToken: accessToken.trim(),
      };

      const saveRes = await fetch("/api/threads-auto-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          config: currentConfig,
        }),
      });
      if (!saveRes.ok) throw new Error("설정 저장 실패");
      setAutoLastUpdated(new Date().toISOString());

      const runId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const baseDateKst = getBatchStartDateKst(autoPostTime);
      let successCount = 0;
      let failCount = 0;

      for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
        for (let slotIndex = 0; slotIndex < postsPerDay; slotIndex += 1) {
          const order = dayIndex * postsPerDay + slotIndex + 1;
          const scheduledAt = calcBatchScheduledAt(baseDateKst, autoPostTime, dayIndex, slotIndex, intervalHours);
          const slotRunId = `${runId}_d${dayIndex + 1}_s${slotIndex + 1}`;

          addLog("info", `${order}/${totalPosts} 슬롯 생성 시작 → ${new Date(scheduledAt).toLocaleString("ko-KR")}`);

          const res = await fetch("/api/threads-auto-research", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              username,
              runId: slotRunId,
              config: currentConfig,
              options: {
                scheduledAt,
                allowExistingPendingAuto: true,
                scheduleMeta: { dayIndex: dayIndex + 1, slotIndex: slotIndex + 1 },
              },
            }),
          });

          const { data, raw } = await parseResponsePayload(res);
          if (!res.ok) {
            failCount += 1;
            const message = data?.error || raw.replace(/<[^>]*>/g, "").trim().slice(0, 180) || `HTTP ${res.status}`;
            addLog("error", `${order}/${totalPosts} 슬롯 실패: ${message}`);
            continue;
          }

          const result = data?.result;
          if (result?.skipped) {
            failCount += 1;
            addLog("info", `${order}/${totalPosts} 슬롯 스킵: ${result.skipReason}`);
          } else {
            successCount += 1;
            addLog("info", `${order}/${totalPosts} 슬롯 예약 완료`);
          }
        }
      }

      addLog("info", `일괄 예약 생성 완료: 성공 ${successCount}개 · 실패 ${failCount}개`);

      fetchSchedules(username).then(setScheduledPosts).catch(() => {});
    } catch (e) {
      addLog("error", `일괄 예약 생성 실패: ${e.message}`);
    } finally {
      setAutoBatchRunning(false);
    }
  };

  const handleCancelAutoRun = async () => {
    const currentRunId = autoRunId || loadAutoRunId(username);
    if (!currentRunId) return;
    setAutoCanceling(true);
    try {
      const res = await fetch("/api/threads-auto-monitor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, runId: currentRunId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "취소 실패");
      if (data?.current) {
        syncAutoMonitorState(data.current, data.runs || autoHistory, data.current.runId || currentRunId);
      }
      addLog("info", "자동화 취소 요청 전송됨");
      await loadAutoMonitor(currentRunId);
    } catch (e) {
      addLog("error", `자동화 취소 실패: ${e.message}`);
    } finally {
      setAutoCanceling(false);
    }
  };

  // 예약 등록
  const handleSchedule = async () => {
    if (!accessToken.trim() || !userId.trim()) {
      addLog("error", "액세스 토큰과 사용자 ID를 입력하세요");
      return;
    }
    if (!text.trim()) {
      addLog("error", "게시할 텍스트를 입력하세요");
      return;
    }
    if (!scheduledAt) {
      addLog("error", "예약 시간을 선택하세요");
      return;
    }
    const scheduledAtISO = new Date(scheduledAt).toISOString();
    if (new Date(scheduledAtISO) <= new Date()) {
      addLog("error", "예약 시간은 현재보다 미래여야 합니다");
      return;
    }
    setScheduleSaving(true);
    const newPost = {
      id: Date.now().toString(),
      text: text.trim(),
      userId: userId.trim(),
      accessToken: accessToken.trim(),
      scheduledAt: scheduledAtISO,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
    const result = await addSchedule(username, newPost);
    setScheduleSaving(false);
    if (!result.ok) { addLog("error", result.error || "예약 저장 실패"); return; }
    setScheduledPosts((prev) => [...prev, newPost]);
    addLog("info", `예약 완료: ${new Date(scheduledAtISO).toLocaleString("ko-KR")}`);
    setScheduleEnabled(false);
    setScheduledAt("");
  };

  // 예약 취소
  const cancelSchedule = async (id) => {
    const ok = await removeSchedule(username, id);
    if (ok) {
      setScheduledPosts((prev) => prev.filter((p) => p.id !== id));
      addLog("info", "예약 취소됨");
    }
  };

  // 완료/실패 항목 서버에서 삭제
  const clearDoneSchedules = async () => {
    const ok = await clearDoneSchedulesServer(username);
    if (ok) setScheduledPosts((prev) => prev.filter((p) => p.status === "pending"));
  };

  const openScheduleEditor = (post) => {
    setExpandedScheduleId(post.id);
    setEditingScheduleId(post.id);
    setEditingScheduleText(post.text || "");
    setEditingScheduleTime((post.scheduledAt || "").slice(0, 16));
  };

  const closeScheduleEditor = () => {
    setEditingScheduleId("");
    setEditingScheduleText("");
    setEditingScheduleTime("");
  };

  const handleUpdateSchedule = async (post) => {
    if (!editingScheduleText.trim()) {
      addLog("error", "예약 글 본문이 비어 있습니다");
      return;
    }
    if (editingScheduleText.trim().length > TH_MAX_CHARS) {
      addLog("error", `예약 글은 ${TH_MAX_CHARS}자 이하여야 합니다`);
      return;
    }
    if (!editingScheduleTime) {
      addLog("error", "예약 시간을 입력하세요");
      return;
    }
    const nextScheduledAt = new Date(editingScheduleTime).toISOString();
    if (Number.isNaN(new Date(nextScheduledAt).getTime())) {
      addLog("error", "예약 시간 형식이 올바르지 않습니다");
      return;
    }
    setScheduleUpdating(true);
    try {
      const updated = await updateSchedule(username, post.id, {
        text: editingScheduleText.trim(),
        scheduledAt: nextScheduledAt,
      });
      if (!updated) throw new Error("예약 수정 실패");
      setScheduledPosts((prev) => prev.map((item) => (item.id === post.id ? updated : item)));
      addLog("info", `예약 수정 완료: ${new Date(updated.scheduledAt).toLocaleString("ko-KR")}`);
      closeScheduleEditor();
    } catch (e) {
      addLog("error", e.message || "예약 수정 실패");
    } finally {
      setScheduleUpdating(false);
    }
  };

  // CSV 일괄 업로드
  // CSV 형식: datetime,text  (헤더 포함)
  // datetime: YYYY-MM-DD HH:MM 또는 YYYY-MM-DDTHH:MM
  const handleBulkImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!accessToken.trim() || !userId.trim()) {
      addLog("error", "액세스 토큰과 사용자 ID를 먼저 입력·저장하세요");
      return;
    }

    const raw = await file.text();
    const lines = raw.split(/\r?\n/).filter((l) => l.trim());
    // 첫 줄이 헤더면 제거
    const dataLines = lines[0].toLowerCase().includes("datetime") ? lines.slice(1) : lines;

    const parsed = [];
    const errors = [];
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;
      // datetime 컬럼은 콤마 이전, text는 나머지 (텍스트 안에 콤마 허용)
      const commaIdx = line.indexOf(",");
      if (commaIdx === -1) { errors.push(`줄 ${i + 2}: 콤마 없음`); continue; }
      const dtRaw = line.slice(0, commaIdx).trim().replace(" ", "T");
      const textRaw = line.slice(commaIdx + 1).trim().replace(/^"|"$/g, "").replace(/""/g, '"');
      const dt = new Date(dtRaw);
      if (isNaN(dt.getTime())) { errors.push(`줄 ${i + 2}: 날짜 형식 오류 (${dtRaw})`); continue; }
      if (!textRaw) { errors.push(`줄 ${i + 2}: 텍스트 없음`); continue; }
      parsed.push({
        id: `${Date.now()}_${i}`,
        text: textRaw.slice(0, 500),
        userId: userId.trim(),
        accessToken: accessToken.trim(),
        scheduledAt: dt.toISOString(),
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    }

    if (!parsed.length) {
      addLog("error", `파싱된 항목 없음. 오류: ${errors.slice(0, 3).join(" / ")}`);
      setBulkResult({ success: 0, fail: errors.length, errors: errors.slice(0, 5) });
      return;
    }

    setBulkImporting(true);
    addLog("info", `CSV 파싱 완료: ${parsed.length}개 업로드 중...`);

    // 서버에 10개씩 묶어서 순차 저장 (rate limit 방지)
    let success = 0;
    let fail = errors.length;
    for (const post of parsed) {
      const result = await addSchedule(username, post);
      if (result.ok) {
        success++;
        setScheduledPosts((prev) => [...prev, post]);
      } else {
        fail++;
        addLog("error", `${new Date(post.scheduledAt).toLocaleString("ko-KR")} 예약 실패: ${result.error || "중복 또는 저장 오류"}`);
      }
    }

    setBulkImporting(false);
    setBulkResult({ success, fail });
    addLog("info", `일괄 예약 완료: 성공 ${success}개, 실패 ${fail}개`);
    if (errors.length) addLog("error", `파싱 오류: ${errors.slice(0, 3).join(" / ")}`);
  };

  const charLeft = TH_MAX_CHARS - text.length;

  return (
    <div className="p-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center shadow-sm flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 192 192" fill="white">
            <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.141-23.82 1.372-39.134 15.265-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.204 17.11 97.013 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 7.026 10.015 15.86 12.853 26.162l16.147-4.308c-3.44-12.68-8.853-23.606-16.219-32.668C147.036 10.208 125.202.195 97.07 0h-.113C68.882.195 47.292 10.24 32.788 29.813 19.882 47.192 13.223 71.245 13.008 96.02v.04c.215 24.775 6.874 48.829 19.78 66.207 14.504 19.574 36.094 29.619 64.199 29.813h.113c25.316-.177 43.063-6.807 57.756-21.488 19.08-19.073 18.496-43.016 12.209-57.81-4.567-10.638-13.349-19.274-25.528-24.794z"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">Threads 자동 게시</p>
          <p className="text-xs text-gray-400">텍스트 게시물을 자동으로 Threads에 올립니다</p>
        </div>
      </div>

      {/* 인증 설정 */}
      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">인증 설정</p>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">액세스 토큰</label>
          <input
            type="password"
            value={accessToken}
            onChange={e => setAccessToken(e.target.value)}
            placeholder="Threads 장기 액세스 토큰 (60일)"
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">사용자 ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="숫자 ID (자동 조회 가능)"
              className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 font-mono"
            />
            <button
              onClick={handleFetchUserId}
              disabled={fetchingId || !accessToken.trim()}
              className="px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap"
            >
              {fetchingId ? "조회 중..." : "토큰으로 자동 조회"}
            </button>
          </div>
        </div>

        <button
          onClick={handleSaveConfig}
          className="w-full py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
        >
          설정 저장 (로컬)
        </button>
      </div>

      {/* 게시 내용 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">게시 내용</p>
          <span className={`text-xs font-mono ${charLeft < 0 ? "text-red-500" : charLeft < 50 ? "text-amber-500" : "text-gray-400"}`}>
            {charLeft}자 남음
          </span>
        </div>

        {/* AI 생성 */}
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={aiTopic}
            onChange={e => setAiTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !generating && handleAiGenerate()}
            placeholder="주제 입력 후 AI 생성 (예: 퇴근 후 루틴)"
            className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-pink-200"
          />
          <button
            onClick={handleAiGenerate}
            disabled={generating || !aiTopic.trim()}
            className="px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
          >
            {generating ? "생성 중..." : "AI로 생성"}
          </button>
          <button
            onClick={() => setShowTopicPicker(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-violet-200 text-violet-600 bg-violet-50 hover:bg-violet-100 transition-all whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            인기글에서 가져오기
          </button>
          <select
            value={templateFormat}
            onChange={e => setTemplateFormat(e.target.value)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-amber-200 text-amber-700 bg-white hover:bg-amber-50 transition-all focus:outline-none focus:ring-2 focus:ring-amber-100"
            title="템플릿 재구성에 적용할 대화 말투와 흐름"
          >
            {templateOptions.format.map(format => (
              <option key={format.key} value={format.key}>{format.label}</option>
            ))}
          </select>
          <select
            value={templateTone}
            onChange={e => setTemplateTone(e.target.value)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-amber-200 text-amber-700 bg-white hover:bg-amber-50 transition-all focus:outline-none focus:ring-2 focus:ring-amber-100"
            title="재구성할 말투"
          >
            {templateOptions.tone.map(option => (
              <option key={option.key} value={option.key}>말투: {option.label}</option>
            ))}
          </select>
          <select
            value={templateFlow}
            onChange={e => setTemplateFlow(e.target.value)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-amber-200 text-amber-700 bg-white hover:bg-amber-50 transition-all focus:outline-none focus:ring-2 focus:ring-amber-100"
            title="재구성할 글 흐름"
          >
            {templateOptions.flow.map(option => (
              <option key={option.key} value={option.key}>흐름: {option.label}</option>
            ))}
          </select>
          <select
            value={templateCta}
            onChange={e => setTemplateCta(e.target.value)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-amber-200 text-amber-700 bg-white hover:bg-amber-50 transition-all focus:outline-none focus:ring-2 focus:ring-amber-100"
            title="재구성할 CTA 방식"
          >
            {templateOptions.cta.map(option => (
              <option key={option.key} value={option.key}>CTA: {option.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowOptionEditor(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-gray-200 text-gray-600 bg-white hover:bg-gray-50 transition-all whitespace-nowrap"
          >
            옵션 편집
          </button>
          <button
            onClick={handleTemplateRewrite}
            disabled={templating || (!aiTopic.trim() && !text.trim())}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            title="조회수 템플릿 역설계 결과를 적용해 말투, 첫 문장, CTA까지 재구성합니다"
          >
            {templating ? (
              <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5Z"/>
                <path d="M8 7h8M8 11h8M8 15h5"/>
              </svg>
            )}
            {templating ? "재구성 중..." : "템플릿으로 재구성"}
          </button>
          <button
            onClick={handleSaveTemplateSelection}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-all whitespace-nowrap"
            title="현재 선택한 대화 포맷, 말투, 흐름, CTA를 이 계정의 기본 브랜딩 옵션으로 저장합니다"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z"/>
              <path d="M17 21v-8H7v8"/>
              <path d="M7 3v5h8"/>
            </svg>
            옵션 저장
          </button>
        </div>

        {showOptionEditor && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-amber-800">템플릿 재구성 옵션 편집</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setTemplateOptions(loadTemplateOptions())}
                  className="px-2.5 py-1 text-[11px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  되돌리기
                </button>
                <button
                  onClick={handleSaveTemplateOptions}
                  className="px-2.5 py-1 text-[11px] font-semibold text-emerald-700 bg-white border border-emerald-200 rounded-lg hover:bg-emerald-50"
                >
                  저장
                </button>
              </div>
            </div>
            {[
              { key: "format", title: "대화 포맷" },
              { key: "tone", title: "말투" },
              { key: "flow", title: "흐름" },
              { key: "cta", title: "CTA" },
            ].map(group => (
              <div key={group.key} className="bg-white border border-amber-100 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold text-gray-700">{group.title}</p>
                  <button
                    onClick={() => addTemplateOption(group.key)}
                    className="px-2 py-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100"
                  >
                    추가
                  </button>
                </div>
                <div className="space-y-2">
                  {templateOptions[group.key].map(option => (
                    <div key={option.key} className="grid grid-cols-[120px_1fr_auto] gap-2 items-start">
                      <input
                        value={option.label}
                        onChange={e => updateTemplateOption(group.key, option.key, "label", e.target.value)}
                        className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-100"
                      />
                      <textarea
                        value={option.prompt}
                        onChange={e => updateTemplateOption(group.key, option.key, "prompt", e.target.value)}
                        rows={2}
                        className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-amber-100"
                      />
                      <button
                        onClick={() => deleteTemplateOption(group.key, option.key)}
                        disabled={templateOptions[group.key].length <= 1}
                        className="px-2 py-1.5 text-[10px] font-semibold text-red-500 bg-red-50 border border-red-100 rounded-lg hover:bg-red-100 disabled:opacity-40"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {showTopicPicker && (
          <TopicPicker
            onSelect={v => {
              setAiTopic(typeof v === "string" ? v : v.text || v.title || "");
              setShowTopicPicker(false);
            }}
            onClose={() => setShowTopicPicker(false)}
          />
        )}

        <textarea
          value={text}
          onChange={e => setText(e.target.value.slice(0, TH_MAX_CHARS))}
          placeholder="Threads에 게시할 텍스트를 입력하거나 AI로 생성하세요 (최대 500자)"
          rows={8}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none leading-relaxed"
        />
      </div>

      {/* 게시 버튼 */}
      <button
        onClick={handlePost}
        disabled={posting || !text.trim() || !accessToken.trim() || !userId.trim() || charLeft < 0}
        className="w-full py-3 text-sm font-bold text-white bg-gray-900 rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-all"
      >
        {posting ? "게시 중..." : "Threads에 게시하기"}
      </button>

      {/* 예약 게시 */}
      <div className="space-y-2">
        <button
          onClick={() => setScheduleEnabled(v => !v)}
          className={`w-full py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5
            ${scheduleEnabled
              ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {scheduleEnabled ? "예약 취소" : "예약 게시"}
        </button>

        {scheduleEnabled && (
          <div className="flex gap-2 items-center p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex-1 space-y-1">
              <label className="text-[11px] font-bold text-amber-800">예약 날짜/시간</label>
              <input
                type="datetime-local"
                value={scheduledAt}
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-amber-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-200"
              />
            </div>
            <button
              onClick={handleSchedule}
              disabled={!scheduledAt || !text.trim() || scheduleSaving}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-40 rounded-xl transition-all whitespace-nowrap self-end"
            >
              {scheduleSaving ? "저장 중..." : "예약하기"}
            </button>
          </div>
        )}

        {/* CSV 일괄 업로드 */}
        <div className="space-y-2">
          <button
            onClick={() => { setShowBulkImport(v => !v); setBulkResult(null); }}
            className="w-full py-2.5 text-xs font-bold rounded-xl border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            CSV 일괄 업로드 (1년치 예약)
          </button>

          {showBulkImport && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2.5">
              <div>
                <p className="text-[11px] font-bold text-gray-700 mb-1">CSV 형식</p>
                <pre className="text-[10px] text-gray-500 bg-white border border-gray-200 rounded-lg p-2 leading-relaxed font-mono">{`datetime,text
2026-05-01 09:00,오늘의 첫 게시글입니다.
2026-05-01 18:00,"콤마가 있는 텍스트도 따옴표로 처리됩니다."
2026-05-02 09:00,두 번째 날 아침 게시글`}</pre>
                <p className="text-[10px] text-gray-400 mt-1">datetime 형식: YYYY-MM-DD HH:MM · 500자 초과 시 자동 잘림 · 같은 시간 중복 예약 가능</p>
              </div>
              <label className={`flex items-center justify-center gap-2 w-full py-2.5 text-xs font-bold rounded-xl cursor-pointer transition-all
                ${bulkImporting
                  ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                  : "bg-gray-900 text-white hover:bg-gray-700"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                {bulkImporting ? "업로드 중..." : "CSV 파일 선택"}
                <input type="file" accept=".csv,text/csv" className="hidden" disabled={bulkImporting} onChange={handleBulkImport} />
              </label>
              {bulkResult && (
                <div className={`px-3 py-2 rounded-lg text-[11px] font-medium ${bulkResult.fail === 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                  성공 {bulkResult.success}개 예약됨
                  {bulkResult.fail > 0 && ` · 실패/오류 ${bulkResult.fail}개`}
                  {bulkResult.errors?.length > 0 && (
                    <div className="mt-1 text-[10px] text-red-500">{bulkResult.errors.join(" / ")}</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 풀 자동화 설정 */}
      <div className="space-y-2">
        <button
          onClick={() => setShowAutoPanel(v => !v)}
          className={`w-full py-2.5 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5
            ${showAutoPanel
              ? "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100"
              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
          </svg>
          풀 자동화 설정 (매일 리서치 → 생성 → 예약)
          {autoEnabled && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold">ON</span>}
        </button>

        {showAutoPanel && (
          <div className="p-4 bg-violet-50 border border-violet-200 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-violet-800">풀 자동화 파이프라인</p>
              <div className="flex items-center gap-2">
                {autoLastUpdated && (
                  <span className="text-[10px] text-violet-400">
                    {new Date(autoLastUpdated).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })} 저장됨
                  </span>
                )}
                <div
                  onClick={() => setAutoEnabled(v => !v)}
                  className={`w-9 h-5 rounded-full relative transition-colors cursor-pointer ${autoEnabled ? "bg-violet-600" : "bg-gray-300"}`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${autoEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                </div>
                <span className="text-[11px] font-semibold text-violet-700">{autoEnabled ? "활성" : "비활성"}</span>
              </div>
            </div>

            <div className="text-[11px] text-violet-600 bg-violet-100 rounded-lg px-3 py-2 leading-relaxed">
              매일 KST 06:00 · 네이버/Threads 소스를 섞어 키워드 기반 주제 선정 → Gemini 글 생성 → 지정 시간 예약 자동 등록
            </div>

            {/* 키워드 */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-violet-700">리서치 키워드 (쉼표로 구분)</label>
              <input
                type="text"
                value={autoKeywords}
                onChange={e => setAutoKeywords(e.target.value)}
                placeholder="AI,클로드코드,ChatGPT,생성형AI"
                className="w-full px-3 py-2 text-xs border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
              <p className="text-[10px] text-violet-400">각 키워드로 네이버 블로그 5개씩 검색, 최신 AI 이슈를 자동 수집합니다</p>
            </div>

            {/* 게시 시간 */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-violet-700">매일 자동 게시 시간 (KST)</label>
              <input
                type="time"
                value={autoPostTime}
                onChange={e => setAutoPostTime(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-violet-700">주제 소스</label>
              <select
                value={autoSourceMode}
                onChange={e => setAutoSourceMode(e.target.value)}
                className="w-full px-2.5 py-2 text-xs border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
              >
                <option value="random">랜덤 혼합 (추천)</option>
                <option value="naver">네이버 블로그</option>
                <option value="threads">Threads 인기글</option>
              </select>
            </div>

            {/* 글 스타일 */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-violet-700">포맷</label>
                <select
                  value={autoFormat}
                  onChange={e => setAutoFormat(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                >
                  {CONVERSATION_FORMATS.map(f => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-violet-700">말투</label>
                <select
                  value={autoTone}
                  onChange={e => setAutoTone(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                >
                  {TONE_OPTIONS.map(o => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-violet-700">흐름</label>
                <select
                  value={autoFlow}
                  onChange={e => setAutoFlow(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                >
                  {FLOW_OPTIONS.map(o => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-violet-700">CTA</label>
                <select
                  value={autoCta}
                  onChange={e => setAutoCta(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                >
                  {CTA_OPTIONS.map(o => (
                    <option key={o.key} value={o.key}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {autoLoading && (
              <p className="text-[11px] text-violet-400 text-center">설정 불러오는 중...</p>
            )}

            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={handleSaveAutoConfig}
                  disabled={autoSaving || autoRunning || autoBatchRunning}
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl transition-all"
                >
                  {autoSaving ? "저장 중..." : "설정 저장"}
                </button>
                <button
                  onClick={handleRunAutoNow}
                  disabled={autoRunning || autoSaving || autoBatchRunning}
                  className="px-4 py-2.5 text-xs font-bold text-violet-700 bg-white border border-violet-300 hover:bg-violet-50 disabled:opacity-40 rounded-xl transition-all whitespace-nowrap"
                  title="현재 설정을 저장하고 즉시 실행 (실제 크론은 매일 KST 06:00 자동 실행)"
                >
                  {autoRunning ? "실행 중..." : "지금 실행"}
                </button>
              </div>

              <div className="rounded-xl border border-violet-200 bg-white/80 px-3 py-3 space-y-3">
                <p className="text-[11px] font-bold text-violet-700">여러 개 미리 예약 생성</p>
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-violet-600">선생성 일수</label>
                    <input
                      type="number"
                      min="1"
                      max="14"
                      value={autoBatchDays}
                      onChange={e => setAutoBatchDays(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-violet-600">하루 업로드 수</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={autoBatchPostsPerDay}
                      onChange={e => setAutoBatchPostsPerDay(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-violet-600">간격(시간)</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={autoBatchIntervalHours}
                      onChange={e => setAutoBatchIntervalHours(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                    />
                  </div>
                </div>
                <button
                  onClick={handleGenerateAutoBatch}
                  disabled={autoBatchRunning || autoSaving}
                  className="w-full py-2.5 text-xs font-bold text-violet-700 bg-violet-100 border border-violet-300 hover:bg-violet-200 disabled:opacity-40 rounded-xl transition-all"
                >
                  {autoBatchRunning
                    ? "여러 예약 생성 중..."
                    : `${Number(autoBatchDays) || 1}일 x ${Number(autoBatchPostsPerDay) || 1}개 미리 생성`}
                </button>
                <p className="text-[10px] text-violet-400 leading-relaxed">
                  첫 슬롯은 기본 게시 시간부터 시작하고, 같은 날 추가 슬롯은 입력한 시간 간격으로 예약됩니다. 한 번에 최대 20개까지 생성합니다.
                </p>
              </div>

              <div className="text-[11px] text-violet-500 bg-white border border-violet-100 rounded-xl px-3 py-2 leading-relaxed">
                자동화는 오른쪽 하단의 로봇 패널에서 계속 추적됩니다. 창을 넘겨도 상태와 히스토리가 유지됩니다.
              </div>
            </div>

            {/* 예약 발행 일정 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-violet-800">예약 발행 일정</p>
                  {scheduledPosts.length > 0 && (
                    <span className="text-[11px] text-violet-400">
                      대기 {scheduledPosts.filter(p => p.status === "pending").length} · 완료 {scheduledPosts.filter(p => p.status === "posted").length} · 실패 {scheduledPosts.filter(p => p.status === "failed").length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex rounded-lg border border-violet-200 overflow-hidden text-[11px] font-semibold">
                    {["pending", "all"].map((v) => (
                      <button key={v} onClick={() => setScheduleView(v)}
                        className={`px-2.5 py-1 transition-colors ${scheduleView === v ? "bg-violet-600 text-white" : "bg-white text-violet-500 hover:bg-violet-50"}`}>
                        {v === "pending" ? "대기중" : "전체"}
                      </button>
                    ))}
                  </div>
                  {scheduledPosts.some(p => p.status !== "pending") && (
                    <button onClick={clearDoneSchedules} className="text-[11px] text-violet-300 hover:text-red-500">
                      완료 삭제
                    </button>
                  )}
                </div>
              </div>
              {scheduledPosts.length === 0 ? (
                <div className="text-center py-4 text-[11px] text-violet-300 bg-white rounded-xl border border-violet-100">
                  예약된 콘텐츠가 없습니다
                </div>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto pr-0.5">
                  {scheduledPosts
                    .filter(p => scheduleView === "all" || p.status === "pending")
                    .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                    .map(p => (
                    <div key={p.id} className={`rounded-xl border text-xs ${
                      p.status === "pending" ? "bg-amber-50 border-amber-200" : p.status === "posted" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                    }`}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0
                          ${p.status === "pending" ? "bg-amber-400 animate-pulse" : p.status === "posted" ? "bg-emerald-500" : "bg-red-400"}`} />
                        <span className="text-gray-500 flex-shrink-0 font-mono text-[11px]">
                          {new Date(p.scheduledAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <button
                          onClick={() => setExpandedScheduleId(expandedScheduleId === p.id ? "" : p.id)}
                          className="flex-1 text-left text-gray-700 truncate hover:text-gray-900"
                          title="본문 보기"
                        >
                          {p.text.slice(0, 30)}{p.text.length > 30 ? "..." : ""}
                        </button>
                        <span className={`flex-shrink-0 font-semibold text-[11px]
                          ${p.status === "pending" ? "text-amber-600" : p.status === "posted" ? "text-emerald-600" : "text-red-500"}`}>
                          {p.status === "pending" ? "대기" : p.status === "posted" ? "완료" : "실패"}
                        </span>
                        <button
                          onClick={() => setExpandedScheduleId(expandedScheduleId === p.id ? "" : p.id)}
                          className="text-[11px] font-semibold text-gray-400 hover:text-violet-600 flex-shrink-0"
                        >
                          {expandedScheduleId === p.id ? "닫기" : "보기"}
                        </button>
                        <button
                          onClick={() => openScheduleSource(p)}
                          className="text-[11px] font-semibold text-sky-600 hover:text-sky-700 flex-shrink-0"
                        >
                          {scheduleSourceOpenId === p.id ? "출처닫기" : "출처"}
                        </button>
                        {p.status === "pending" && (
                          <>
                            <button
                              onClick={() => openScheduleEditor(p)}
                              className="text-[11px] font-semibold text-violet-500 hover:text-violet-700 flex-shrink-0"
                            >
                              수정
                            </button>
                            <button onClick={() => cancelSchedule(p.id)} className="text-gray-300 hover:text-red-500 flex-shrink-0">
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </>
                        )}
                      </div>
                      {expandedScheduleId === p.id && (
                        <div className="border-t border-white/70 px-3 py-3 space-y-3">
                          {editingScheduleId === p.id ? (
                            <>
                              <textarea
                                value={editingScheduleText}
                                onChange={(e) => setEditingScheduleText(e.target.value)}
                                rows={7}
                                className="w-full px-3 py-2 text-xs border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                              />
                              <div className="flex items-center justify-between gap-3">
                                <input
                                  type="datetime-local"
                                  value={editingScheduleTime}
                                  onChange={(e) => setEditingScheduleTime(e.target.value)}
                                  className="px-3 py-2 text-xs border border-violet-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                                />
                                <span className={`text-[11px] font-mono ${editingScheduleText.length > TH_MAX_CHARS ? "text-red-500" : "text-gray-400"}`}>
                                  {editingScheduleText.length}/{TH_MAX_CHARS}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleUpdateSchedule(p)}
                                  disabled={scheduleUpdating}
                                  className="px-3 py-2 text-[11px] font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl"
                                >
                                  {scheduleUpdating ? "저장 중..." : "수정 저장"}
                                </button>
                                <button
                                  onClick={closeScheduleEditor}
                                  disabled={scheduleUpdating}
                                  className="px-3 py-2 text-[11px] font-bold text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 rounded-xl"
                                >
                                  취소
                                </button>
                              </div>
                            </>
                          ) : (
                            <div className="space-y-2">
                              <pre className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-gray-700 bg-white rounded-xl border border-white/80 px-3 py-3">
                                {p.text}
                              </pre>
                              {scheduleSourceOpenId === p.id && (
                                <div className="rounded-xl border border-sky-100 bg-sky-50/70 px-3 py-3 space-y-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div>
                                      <p className="text-[11px] font-bold text-sky-800">생성 출처 / 수집 정보</p>
                                      <p className="text-[10px] text-sky-600">
                                        {getEffectiveSourceInfo(p)?.label || (p.auto ? "기존 예약: 출처 추적 도입 전 생성분" : "수동 예약")}
                                      </p>
                                    </div>
                                    {p.runId && (
                                      <span className="text-[10px] font-mono text-sky-500">{p.runId}</span>
                                    )}
                                  </div>

                                  {getEffectiveSourceInfo(p) ? (
                                    <>
                                      <div className="flex flex-wrap gap-2 text-[10px] font-semibold">
                                        <span className={`px-2 py-1 rounded-full border ${
                                          getEffectiveSourceInfo(p)?.provenance?.dataBacked
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : "bg-red-50 text-red-600 border-red-200"
                                        }`}>
                                          {getEffectiveSourceInfo(p)?.provenance?.dataBacked ? "데이터 기반 재구성" : "근거 없는 일반 생성"}
                                        </span>
                                        {getEffectiveSourceInfo(p)?.provenance?.strategy && (
                                          <span className="px-2 py-1 rounded-full border bg-white text-sky-700 border-sky-200">
                                            {getEffectiveSourceInfo(p).provenance.strategy === "pattern-reconstruction"
                                              ? "잘된 Threads 구조 재구성"
                                              : "외부 리서치 재구성"}
                                          </span>
                                        )}
                                        <span className="px-2 py-1 rounded-full border bg-white text-sky-700 border-sky-200">
                                          근거 {Number(getEffectiveSourceInfo(p)?.provenance?.evidenceCount || getEffectiveSourceInfo(p)?.items?.length || 0)}건
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 gap-2 text-[11px]">
                                        <div className="rounded-lg border border-sky-100 bg-white px-2.5 py-2">
                                          <span className="block text-[10px] text-sky-500">소스 선택</span>
                                          <span className="font-semibold text-sky-900">{getEffectiveSourceInfo(p).label || getEffectiveSourceInfo(p).choice || "-"}</span>
                                        </div>
                                        <div className="rounded-lg border border-sky-100 bg-white px-2.5 py-2">
                                          <span className="block text-[10px] text-sky-500">키워드</span>
                                          <span className="font-semibold text-sky-900">{(getEffectiveSourceInfo(p).keywords || []).join(", ") || "-"}</span>
                                        </div>
                                      </div>

                                      {Array.isArray(getEffectiveSourceInfo(p).items) && getEffectiveSourceInfo(p).items.length > 0 && (
                                        <div className="space-y-2">
                                          <p className="text-[10px] font-bold text-sky-700">실제 가져온 정보</p>
                                          <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                            {getEffectiveSourceInfo(p).items.slice(0, 8).map((item, idx) => (
                                              <div key={`${p.id}-source-${idx}`} className="rounded-lg border border-sky-100 bg-white px-2.5 py-2 text-[11px] text-gray-700">
                                                {item.keyword && (
                                                  <p className="text-[10px] font-mono text-sky-500 mb-1">{item.keyword}</p>
                                                )}
                                                {item.author && (
                                                  <p className="text-[10px] font-mono text-sky-500 mb-1">
                                                    @{item.author} · 조회 {Number(item.views || 0).toLocaleString()} · 좋아요 {Number(item.likes || 0).toLocaleString()} · 댓글 {Number(item.comments || 0).toLocaleString()}
                                                  </p>
                                                )}
                                                <p className="font-semibold text-gray-800">{item.title || item.content || "-"}</p>
                                                {item.description && (
                                                  <p className="mt-1 text-gray-500 leading-relaxed">{item.description}</p>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="text-[11px] text-gray-500 bg-white border border-sky-100 rounded-lg px-3 py-2">
                                      이 예약은 출처 추적 기능을 넣기 전에 만들어진 기존 예약이거나, 수동으로 등록된 예약입니다.
                                    </div>
                                  )}

                                  <div className="space-y-2">
                                    <p className="text-[10px] font-bold text-sky-700">생성 로그</p>
                                    {scheduleSourceLoadingId === p.id ? (
                                      <div className="text-[11px] text-sky-600 bg-white border border-sky-100 rounded-lg px-3 py-2">
                                        실행 로그 불러오는 중...
                                      </div>
                                    ) : scheduleSourceMap[p.id]?.error ? (
                                      <div className="text-[11px] text-red-500 bg-white border border-red-100 rounded-lg px-3 py-2">
                                        {scheduleSourceMap[p.id].error}
                                      </div>
                                    ) : Array.isArray(scheduleSourceMap[p.id]?.logs) && scheduleSourceMap[p.id].logs.length > 0 ? (
                                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                                        {scheduleSourceMap[p.id].logs.map((entry, idx) => (
                                          <div key={`${p.id}-log-${idx}`} className="rounded-lg border border-sky-100 bg-white px-2.5 py-2">
                                            <div className="flex items-center gap-2 text-[10px] text-gray-400">
                                              <span className="font-mono">
                                                {entry?.time ? new Date(entry.time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "now"}
                                              </span>
                                              <span className="font-semibold uppercase">{entry?.phase || entry?.level || "log"}</span>
                                            </div>
                                            <p className="mt-1 text-[11px] text-gray-700 leading-relaxed">{entry?.msg || ""}</p>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className="text-[11px] text-gray-500 bg-white border border-sky-100 rounded-lg px-3 py-2">
                                        실행 로그가 없거나, 이 예약은 수동으로 만들어졌습니다.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              <p className="text-[11px] text-gray-400">
                                예약 시간: {new Date(p.scheduledAt).toLocaleString("ko-KR")}
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 결과 */}
      {result && (
        <div className={`px-4 py-3 rounded-xl text-xs font-medium ${
          result.status === "success"
            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
            : "bg-red-50 border border-red-200 text-red-600"
        }`}>
          {result.status === "success"
            ? `게시 성공! mediaId: ${result.mediaId}`
            : `오류: ${result.message}`}
        </div>
      )}

      {/* 실행 로그 패널 */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900">
            <span className="text-[11px] font-bold text-gray-300 font-mono">실행 로그</span>
            <button
              onClick={() => setLogs([])}
              className="text-[10px] text-gray-500 hover:text-gray-300"
            >
              지우기
            </button>
          </div>
          <div className="bg-gray-950 p-3 max-h-52 overflow-y-auto space-y-1 font-mono">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2 text-[11px] leading-relaxed">
                <span className="text-gray-600 flex-shrink-0">{log.time}</span>
                <span className={`flex-shrink-0 font-bold ${
                  log.level === "error" ? "text-red-400" : "text-emerald-400"
                }`}>
                  {log.level === "error" ? "ERR" : "LOG"}
                </span>
                <span className={log.level === "error" ? "text-red-300" : "text-gray-200"}>
                  {log.msg}
                </span>
                {log.detail && (
                  <span className="text-gray-500 truncate">
                    {typeof log.detail === "object"
                      ? JSON.stringify(log.detail)
                      : String(log.detail)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 토큰 발급 안내 */}
      <details className="group">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none">
          Threads 토큰 발급 방법 (최초 1회)
        </summary>
        <div className="mt-2 p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-600 space-y-1.5 leading-relaxed">
          <p><strong>1.</strong> developers.facebook.com/apps → 앱 생성 → Use Case: Threads 선택</p>
          <p><strong>2.</strong> Redirect URI 설정: <code className="bg-gray-200 px-1 rounded">https://planforge-ui.vercel.app/auth/</code></p>
          <p><strong>3.</strong> Authorization URL로 Threads 로그인 → code 획득</p>
          <p><strong>4.</strong> code → 단기 토큰 교환 → 장기 토큰(60일) 교환</p>
          <p><strong>5.</strong> 위 토큰 입력 → "자동 조회" 클릭 → 완료</p>
        </div>
      </details>
    </div>
  );
}
