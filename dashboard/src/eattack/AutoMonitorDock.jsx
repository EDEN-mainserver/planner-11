import { useEffect, useMemo, useState } from "react";
import { getSession } from "../utils/authSession";

const autoRunKey = (u) => `eattack_threads_auto_run_${u}_v1`;
const autoMonitorCacheKey = (u) => `eattack_threads_auto_monitor_${u}_v1`;

function loadAutoRunId(username) {
  try { return localStorage.getItem(autoRunKey(username)) || ""; }
  catch { return ""; }
}

function loadAutoMonitorCache(username) {
  try { return JSON.parse(localStorage.getItem(autoMonitorCacheKey(username))) || null; }
  catch { return null; }
}

function saveAutoMonitorCache(username, data) {
  localStorage.setItem(autoMonitorCacheKey(username), JSON.stringify(data || null));
}

export default function AutoMonitorDock() {
  const [session, setSession] = useState(() => getSession());
  const username = session?.username || "__guest";
  const [monitor, setMonitor] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [canceling, setCanceling] = useState(false);
  const [runId, setRunId] = useState(() => (session?.username ? loadAutoRunId(session.username) : ""));

  useEffect(() => {
    const handleSessionChange = () => setSession(getSession());
    window.addEventListener("eden-session-change", handleSessionChange);
    return () => window.removeEventListener("eden-session-change", handleSessionChange);
  }, []);

  useEffect(() => {
    if (!username || username === "__guest") return;
    const cached = loadAutoMonitorCache(username);
    if (cached?.current) {
      setMonitor(cached.current);
      setHistory(Array.isArray(cached.runs) ? cached.runs : []);
    }
    setRunId(loadAutoRunId(username));
  }, [username]);

  const status = monitor?.status || "idle";
  const statusLabel = useMemo(() => (
    status === "running"
      ? "검수 중"
      : status === "canceling"
        ? "취소 요청"
        : status === "completed"
          ? "완료"
          : status === "skipped"
            ? "스킵"
            : status === "failed"
              ? "실패"
              : "대기"
  ), [status]);

  const sync = (snapshot, runs = null) => {
    setMonitor(snapshot);
    if (Array.isArray(runs)) setHistory(runs);
    saveAutoMonitorCache(username, {
      current: snapshot,
      runs: Array.isArray(runs) ? runs : history,
    });
  };

  const loadMonitor = async (runIdOverride = null) => {
    if (!username || username === "__guest") return null;
    const nextRunId = runIdOverride || runId || loadAutoRunId(username);
    setLoading(true);
    try {
      const url = nextRunId
        ? `/api/threads-auto-monitor?username=${encodeURIComponent(username)}&runId=${encodeURIComponent(nextRunId)}`
        : `/api/threads-auto-monitor?username=${encodeURIComponent(username)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "모니터 조회 실패");
      setRunId(data.current?.runId || nextRunId || "");
      sync(data.current || null, data.runs || []);
      return data;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!username || username === "__guest") return;
    let canceled = false;
    const tick = async () => {
      if (canceled) return;
      const currentRunId = loadAutoRunId(username) || runId;
      if (currentRunId !== runId) setRunId(currentRunId);
      const data = await loadMonitor(currentRunId);
      if (canceled || !data?.current) return;
      const active = data.current.status === "running" || data.current.status === "canceling";
      if (!active) {
        clearInterval(intervalId);
      }
    };
    let intervalId = setInterval(tick, 2500);
    tick();
    return () => {
      canceled = true;
      clearInterval(intervalId);
    };
  }, [username]);

  const onRefresh = () => loadMonitor();
  const onSelectRun = (nextRunId) => loadMonitor(nextRunId);
  const onCancel = async () => {
    const currentRunId = runId || loadAutoRunId(username);
    if (!currentRunId) return;
    setCanceling(true);
    try {
      const res = await fetch("/api/threads-auto-monitor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, runId: currentRunId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "취소 실패");
      if (data?.current) sync(data.current, data.runs || history);
      await loadMonitor(currentRunId);
    } finally {
      setCanceling(false);
    }
  };

  if (!session || username === "__guest") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,320px)]">
      <div className="rounded-2xl border border-violet-200 bg-white/95 backdrop-blur shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-violet-100 bg-violet-50/80">
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
              <p className="text-xs font-bold text-violet-800 truncate">E-Attack 검수 패널</p>
              <p className="text-[10px] text-gray-500 truncate">{monitor?.phase ? `단계: ${monitor.phase}` : "실행 로그와 히스토리를 표시합니다"}</p>
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
          }`}>{statusLabel}</span>
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
            {loading && <div className="text-[11px] text-gray-400">검수 상태 불러오는 중...</div>}
            {!monitor?.logs?.length && !loading && (
              <div className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">실행 로그가 여기에 하나씩 쌓입니다.</div>
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
            <button onClick={onRefresh} className="px-3 py-2 text-[11px] font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100">새로고침</button>
            <button onClick={onCancel} disabled={canceling || !(status === "running" || status === "canceling")} className="px-3 py-2 text-[11px] font-bold text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-40">{canceling ? "취소 중..." : "취소"}</button>
          </div>

          <div className="pt-1 border-t border-gray-100">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-xs font-bold text-violet-800">최근 실행 히스토리</p>
              <span className="text-[10px] text-gray-400">{history.length}건</span>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {history.length === 0 ? (
                <div className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">저장된 실행 기록이 없습니다.</div>
              ) : history.slice(0, 6).map((run) => (
                <button key={run.runId} onClick={() => onSelectRun(run.runId)} className="w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-gray-100 bg-gray-50 hover:bg-violet-50 hover:border-violet-200 transition-all">
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-gray-500">
                      {run.startedAt ? new Date(run.startedAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : run.runId}
                    </p>
                    <p className="text-xs text-gray-700 truncate">{run.summary || run.error || run.skipReason || run.phase || "실행 기록"}</p>
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
                    {run.status === "running" ? "진행" : run.status === "completed" ? "완료" : run.status === "skipped" ? "스킵" : run.status === "failed" ? "실패" : "대기"}
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
