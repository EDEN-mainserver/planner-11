// Threads 풀 자동화 — state 14개 + 핸들러 5개 + 초기 로드/폴링 useEffect를 묶은 훅.
// 호출자 의무: userId/accessToken (인증) + addLog (로그) + onSchedulesRefresh (예약 목록 새로고침 콜백).
// 백엔드 API는 services/threads/auto.js로 격리되어 있어 엔드포인트 변경 시 본 훅 수정 불필요.

import { useEffect, useRef, useState } from "react";
import {
  loadAutoRunId,
  saveAutoRunId,
  loadAutoMonitorCache,
  saveAutoMonitorCache,
} from "../services/threads/autoRun";
import { getBatchStartDateKst, calcBatchScheduledAt } from "../services/threads/batch";
import { parseResponsePayload } from "../services/threads/helpers";
import {
  fetchAutoConfig,
  saveAutoConfig,
  runAutoResearch,
  fetchAutoMonitor,
  cancelAutoRun,
} from "../services/threads/auto";

const POLL_INTERVAL_MS = 2500;
const MAX_BATCH_TOTAL = 20;

function buildConfigPayload({
  enabled,
  keywords,
  postTime,
  format,
  tone,
  flow,
  cta,
  sourceMode,
  batchDays,
  batchPostsPerDay,
  batchIntervalHours,
  userId,
  accessToken,
}) {
  return {
    enabled,
    keywords,
    postTime,
    format,
    tone,
    flow,
    cta,
    sourceMode,
    batchDays: Number(batchDays) || 1,
    batchPostsPerDay: Number(batchPostsPerDay) || 1,
    batchIntervalHours: Number(batchIntervalHours) || 4,
    userId: userId.trim(),
    accessToken: accessToken.trim(),
  };
}

export function useThreadsAuto({ session, userId, accessToken, addLog, onSchedulesRefresh }) {
  const username = session?.username || "__guest";

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
  const [autoRunResult, setAutoRunResult] = useState(null);
  const [autoRunId, setAutoRunId] = useState("");
  const [autoMonitor, setAutoMonitor] = useState(null);
  const [autoHistory, setAutoHistory] = useState([]);
  const [autoMonitorLoading, setAutoMonitorLoading] = useState(false);
  const [autoCanceling, setAutoCanceling] = useState(false);
  const autoPollRef = useRef(null);

  // 모니터 스냅샷 1건을 상태에 반영하고 캐시·실행여부를 동기화.
  const syncAutoMonitorState = (snapshot, runs = null, nextRunId = null) => {
    if (nextRunId !== null) {
      setAutoRunId(nextRunId);
      saveAutoRunId(username, nextRunId);
    }
    setAutoMonitor(snapshot);
    const nextRuns = Array.isArray(runs) ? runs : (autoHistory || []);
    if (Array.isArray(runs)) setAutoHistory(runs);
    saveAutoMonitorCache(username, { current: snapshot, runs: nextRuns });
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
      const data = await fetchAutoMonitor(username, runId);
      syncAutoMonitorState(data.current || null, data.runs || [], data.current?.runId || runId || "");
      return data;
    } catch (e) {
      addLog?.("error", `자동화 모니터 조회 실패: ${e.message}`);
      return null;
    } finally {
      setAutoMonitorLoading(false);
    }
  };

  // 마운트 시 자동화 캐시·설정 로드
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
    if (!autoRunId && storedRunId) setAutoRunId(storedRunId);
    loadAutoMonitor(storedRunId || cached?.current?.runId || null);

    setAutoLoading(true);
    fetchAutoConfig(username)
      .then((cfg) => {
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
  }, [username]); // eslint-disable-line react-hooks/exhaustive-deps

  // 실행 중인 run 폴링 (2.5초)
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
    autoPollRef.current = setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      canceled = true;
      if (autoPollRef.current) {
        clearInterval(autoPollRef.current);
        autoPollRef.current = null;
      }
    };
  }, [username, autoRunId]); // eslint-disable-line react-hooks/exhaustive-deps

  const validateInputs = () => {
    if (!userId.trim() || !accessToken.trim()) {
      addLog?.("error", "인증 설정에서 액세스 토큰과 사용자 ID를 먼저 저장하세요");
      return null;
    }
    const keywords = autoKeywords.split(",").map((k) => k.trim()).filter(Boolean);
    if (!keywords.length) {
      addLog?.("error", "키워드를 하나 이상 입력하세요");
      return null;
    }
    return keywords;
  };

  const currentConfig = (keywords, overrides = {}) =>
    buildConfigPayload({
      enabled: autoEnabled,
      keywords,
      postTime: autoPostTime,
      format: autoFormat,
      tone: autoTone,
      flow: autoFlow,
      cta: autoCta,
      sourceMode: autoSourceMode,
      batchDays: autoBatchDays,
      batchPostsPerDay: autoBatchPostsPerDay,
      batchIntervalHours: autoBatchIntervalHours,
      userId,
      accessToken,
      ...overrides,
    });

  const handleSaveAutoConfig = async () => {
    const keywords = validateInputs();
    if (!keywords) return;
    setAutoSaving(true);
    try {
      await saveAutoConfig(username, currentConfig(keywords));
      setAutoLastUpdated(new Date().toISOString());
      addLog?.("info", `풀 자동화 설정 저장 완료 (${autoEnabled ? "활성" : "비활성"})`);
    } catch (e) {
      addLog?.("error", `자동화 설정 저장 실패: ${e.message}`);
    } finally {
      setAutoSaving(false);
    }
  };

  const handleRunAutoNow = async () => {
    const keywords = validateInputs();
    if (!keywords) return;

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
    addLog?.("info", "현재 설정 저장 후 자동화 실행 중...");

    try {
      const cfg = currentConfig(keywords, { enabled: true });
      await saveAutoConfig(username, cfg);
      setAutoLastUpdated(new Date().toISOString());

      const res = await runAutoResearch(username, runId, cfg);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "실행 실패");

      addLog?.("info", "실행 요청 전송 완료");
      if (data?.result?.logs?.length) {
        data.result.logs.forEach((l) =>
          addLog?.("info", `  ↳ ${typeof l === "string" ? l : l?.msg || JSON.stringify(l)}`)
        );
      }

      await loadAutoMonitor(runId);
      onSchedulesRefresh?.();
    } catch (e) {
      addLog?.("error", `자동화 실행 실패: ${e.message}`);
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
    const keywords = validateInputs();
    if (!keywords) return;

    const days = Math.max(1, Math.min(14, Number(autoBatchDays) || 1));
    const postsPerDay = Math.max(1, Math.min(6, Number(autoBatchPostsPerDay) || 1));
    const intervalHours = Math.max(1, Math.min(12, Number(autoBatchIntervalHours) || 4));
    const totalPosts = days * postsPerDay;
    if (totalPosts > MAX_BATCH_TOTAL) {
      addLog?.("error", `한 번에 최대 ${MAX_BATCH_TOTAL}개까지만 선생성할 수 있습니다`);
      return;
    }

    setAutoBatchRunning(true);
    addLog?.("info", `${days}일 x 하루 ${postsPerDay}개 예약 생성 시작 (${intervalHours}시간 간격)`);

    try {
      const cfg = currentConfig(keywords, {
        batchDays: days,
        batchPostsPerDay: postsPerDay,
        batchIntervalHours: intervalHours,
      });

      await saveAutoConfig(username, cfg);
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

          addLog?.("info", `${order}/${totalPosts} 슬롯 생성 시작 → ${new Date(scheduledAt).toLocaleString("ko-KR")}`);

          const res = await runAutoResearch(username, slotRunId, cfg, {
            scheduledAt,
            allowExistingPendingAuto: true,
            scheduleMeta: { dayIndex: dayIndex + 1, slotIndex: slotIndex + 1 },
          });

          const { data, raw } = await parseResponsePayload(res);
          if (!res.ok) {
            failCount += 1;
            const message = data?.error || raw.replace(/<[^>]*>/g, "").trim().slice(0, 180) || `HTTP ${res.status}`;
            addLog?.("error", `${order}/${totalPosts} 슬롯 실패: ${message}`);
            continue;
          }

          const result = data?.result;
          if (result?.skipped) {
            failCount += 1;
            addLog?.("info", `${order}/${totalPosts} 슬롯 스킵: ${result.skipReason}`);
          } else {
            successCount += 1;
            addLog?.("info", `${order}/${totalPosts} 슬롯 예약 완료`);
          }
        }
      }

      addLog?.("info", `일괄 예약 생성 완료: 성공 ${successCount}개 · 실패 ${failCount}개`);
      onSchedulesRefresh?.();
    } catch (e) {
      addLog?.("error", `일괄 예약 생성 실패: ${e.message}`);
    } finally {
      setAutoBatchRunning(false);
    }
  };

  const handleCancelAutoRun = async () => {
    const currentRunId = autoRunId || loadAutoRunId(username);
    if (!currentRunId) return;
    setAutoCanceling(true);
    try {
      const data = await cancelAutoRun(username, currentRunId);
      if (data?.current) {
        syncAutoMonitorState(data.current, data.runs || autoHistory, data.current.runId || currentRunId);
      }
      addLog?.("info", "자동화 취소 요청 전송됨");
      await loadAutoMonitor(currentRunId);
    } catch (e) {
      addLog?.("error", `자동화 취소 실패: ${e.message}`);
    } finally {
      setAutoCanceling(false);
    }
  };

  return {
    // state
    showAutoPanel, setShowAutoPanel,
    autoEnabled, setAutoEnabled,
    autoKeywords, setAutoKeywords,
    autoPostTime, setAutoPostTime,
    autoFormat, setAutoFormat,
    autoTone, setAutoTone,
    autoFlow, setAutoFlow,
    autoCta, setAutoCta,
    autoSourceMode, setAutoSourceMode,
    autoBatchDays, setAutoBatchDays,
    autoBatchPostsPerDay, setAutoBatchPostsPerDay,
    autoBatchIntervalHours, setAutoBatchIntervalHours,
    autoSaving,
    autoRunning,
    autoBatchRunning,
    autoLoading,
    autoLastUpdated,
    autoRunResult,
    autoRunId,
    autoMonitor,
    autoHistory,
    autoMonitorLoading,
    autoCanceling,
    // handlers
    syncAutoMonitorState,
    loadAutoMonitor,
    handleSaveAutoConfig,
    handleRunAutoNow,
    handleGenerateAutoBatch,
    handleCancelAutoRun,
  };
}
