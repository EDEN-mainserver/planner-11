// Instagram 자동화 관련 state(11개) + 핸들러(6개)를 한 훅으로 묶는다.
// 세션 변경 시 자동화 설정/스케줄/모니터를 초기 로드하고, 저장·실행·예약·취소 핸들러를 제공.
//
// 의존: 호출자가 igConfig(계정 인증), 카드 데이터(cards/cardHtmls), 게시 메타(topic/brand/tone/purpose/slideCount)를 전달.
// onValidationError: 입력 검증 실패 시 호출자의 에러 상태로 메시지 라우팅.

import { useCallback, useEffect, useState } from "react";
import { fetchSchedules, addSchedule, removeSchedule } from "../services/pipeline/schedule";
import { collectPostImages } from "../services/pipeline/cardCapture";
import { generateCaption, stripCrawlSources } from "../services/pipeline/caption";

const INITIAL_CONFIG = {
  enabled: true,
  keywords: "",
  postTime: "09:00",
  slideCount: 7,
  captionTemplate: "",
};

const onlyInstagram = (items) =>
  (items || []).filter((item) => String(item.platform || "threads").toLowerCase() === "instagram");

export function useInstagramAuto({
  session,
  igConfig,
  brandName,
  tone,
  purpose,
  slideCount,
  postCaption,
  topic,
  cards,
  cardHtmls,
  plan,
  research,
  captionPrompt,
  onValidationError,
}) {
  const [igAutoCaptionGenerating, setIgAutoCaptionGenerating] = useState(false);
  const [igAutoConfig, setIgAutoConfig] = useState(INITIAL_CONFIG);
  const [igAutoSchedules, setIgAutoSchedules] = useState([]);
  const [igAutoLoading, setIgAutoLoading] = useState(false);
  const [igAutoSaving, setIgAutoSaving] = useState(false);
  const [igAutoRunning, setIgAutoRunning] = useState(false);
  const [igAutoScheduleAt, setIgAutoScheduleAt] = useState("");
  const [igAutoMessage, setIgAutoMessage] = useState("");
  const [igAutoMonitor, setIgAutoMonitor] = useState(null);
  const [igAutoHistory, setIgAutoHistory] = useState([]);
  const [igAutoMonitorLoading, setIgAutoMonitorLoading] = useState(false);

  const loadInstagramAutoMonitor = useCallback(async (runId = null) => {
    if (!session?.username) return null;
    setIgAutoMonitorLoading(true);
    try {
      const base = `/api/instagram-auto-monitor?username=${encodeURIComponent(session.username)}`;
      const url = runId ? `${base}&runId=${encodeURIComponent(runId)}` : base;
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "자동화 모니터 조회 실패");
      setIgAutoMonitor(data.current || null);
      setIgAutoHistory(Array.isArray(data.runs) ? data.runs : []);
      return data;
    } catch (e) {
      setIgAutoMessage(`자동화 로그를 불러오지 못했습니다: ${e.message}`);
      return null;
    } finally {
      setIgAutoMonitorLoading(false);
    }
  }, [session?.username]);

  const loadInstagramSchedules = useCallback(async () => {
    if (!session?.username) return;
    const schedules = await fetchSchedules(session.username);
    setIgAutoSchedules(onlyInstagram(schedules));
  }, [session?.username]);

  useEffect(() => {
    if (!session?.username) return;
    let canceled = false;
    const loadAutoState = async () => {
      setIgAutoLoading(true);
      try {
        const [configRes, schedules] = await Promise.all([
          fetch(`/api/instagram-auto-config?username=${encodeURIComponent(session.username)}`).then((res) => res.json().catch(() => ({}))),
          fetchSchedules(session.username),
        ]);
        if (canceled) return;
        const config = configRes?.config || {};
        setIgAutoConfig({
          enabled: config.enabled ?? true,
          keywords: Array.isArray(config.keywords) ? config.keywords.join(", ") : String(config.keywords || ""),
          postTime: config.postTime || "09:00",
          slideCount: Number(config.slideCount) || 7,
          captionTemplate: config.captionTemplate || "",
        });
        setIgAutoSchedules(onlyInstagram(schedules));
        setIgAutoMessage("");
        await loadInstagramAutoMonitor();
      } catch {
        if (!canceled) setIgAutoMessage("자동화 설정을 불러오지 못했습니다.");
      } finally {
        if (!canceled) setIgAutoLoading(false);
      }
    };
    loadAutoState();
    return () => { canceled = true; };
  }, [session?.username, loadInstagramAutoMonitor]);

  const buildAutoPayload = () => ({
    enabled: Boolean(igAutoConfig.enabled),
    keywords: String(igAutoConfig.keywords || ""),
    postTime: igAutoConfig.postTime || "09:00",
    slideCount: Math.max(3, Math.min(10, Number(igAutoConfig.slideCount) || slideCount || 7)),
    // 저장 직전 sanitize — 크롤한 원문이 들어가 있어도 작성자 핸들/N/M 표식 자동 제거
    captionTemplate: stripCrawlSources(String(igAutoConfig.captionTemplate || postCaption || topic || "")),
    accountId: igConfig.accountId,
    accessToken: igConfig.accessToken,
    brandName,
    tone,
    purpose,
  });

  // 자동화 캡션 템플릿 재생성 — 현재 기획(topic/brand/tone/purpose/cards/plan/research)으로 새 캡션 만들고 출처 strip
  const regenerateAutoCaption = async () => {
    if (!String(topic || "").trim()) {
      onValidationError?.("기획 주제를 먼저 입력해주세요");
      return;
    }
    setIgAutoCaptionGenerating(true);
    setIgAutoMessage("");
    try {
      const raw = await generateCaption({
        topic, brandName, tone, purpose, research, cards, plan, captionPrompt,
      });
      const clean = stripCrawlSources(raw);
      setIgAutoConfig((prev) => ({ ...prev, captionTemplate: clean }));
      setIgAutoMessage("기획 기반 캡션을 새로 생성했습니다. 확인 후 저장하세요.");
    } catch (e) {
      setIgAutoMessage(`캡션 생성 실패: ${e.message}`);
    } finally {
      setIgAutoCaptionGenerating(false);
    }
  };

  const clearAutoCaption = () => {
    setIgAutoConfig((prev) => ({ ...prev, captionTemplate: "" }));
    setIgAutoMessage("캡션 템플릿을 비웠습니다. 저장하면 매 게시마다 기획에서 자동 생성됩니다.");
  };

  const saveInstagramAutoConfig = async () => {
    if (!session?.username) return;
    if (!igConfig.accountId || !igConfig.accessToken) {
      onValidationError?.("Instagram 계정 연동 후 자동화 설정을 저장하세요");
      return;
    }
    setIgAutoSaving(true);
    setIgAutoMessage("");
    try {
      const res = await fetch("/api/instagram-auto-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: session.username, config: buildAutoPayload() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "설정 저장 실패");
      setIgAutoMessage("자동화 설정이 저장되었습니다.");
      await loadInstagramSchedules();
      await loadInstagramAutoMonitor();
    } catch (e) {
      setIgAutoMessage(`자동화 설정 저장 실패: ${e.message}`);
    } finally {
      setIgAutoSaving(false);
    }
  };

  const runInstagramAutoResearch = async () => {
    if (!session?.username) return;
    if (!igConfig.accountId || !igConfig.accessToken) {
      onValidationError?.("Instagram 계정 연동 후 자동화를 실행하세요");
      return;
    }
    setIgAutoRunning(true);
    setIgAutoMessage("");
    try {
      const res = await fetch("/api/instagram-auto-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: session.username,
          config: buildAutoPayload(),
          scheduledAt: igAutoScheduleAt ? new Date(igAutoScheduleAt).toISOString() : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "자동화 실행 실패");
      setIgAutoMessage("리서치와 예약 생성이 완료되었습니다.");
      setIgAutoScheduleAt("");
      await loadInstagramSchedules();
      await loadInstagramAutoMonitor(data?.result?.runId || null);
    } catch (e) {
      setIgAutoMessage(`자동화 실행 실패: ${e.message}`);
    } finally {
      setIgAutoRunning(false);
    }
  };

  const scheduleCurrentInstagramCarousel = async () => {
    if (!session?.username) return;
    if (!igConfig.accountId || !igConfig.accessToken) {
      onValidationError?.("Instagram 계정 연동 후 예약을 생성하세요");
      return;
    }
    if (!igAutoScheduleAt) {
      onValidationError?.("예약 시간을 선택하세요");
      return;
    }
    setIgAutoRunning(true);
    onValidationError?.("");
    try {
      const scheduledAt = new Date(igAutoScheduleAt).toISOString();
      if (new Date(scheduledAt) <= new Date()) {
        throw new Error("예약 시간은 현재보다 미래여야 합니다");
      }
      const rawImages = await collectPostImages({ cards, cardHtmls });
      if (!rawImages.length) throw new Error("예약할 이미지를 만들 수 없습니다");
      const prepRes = await fetch("/api/instagram-prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: rawImages }),
      });
      const prepData = await prepRes.json().catch(() => ({}));
      if (!prepRes.ok) throw new Error(prepData.error || "예약 이미지 준비 실패");
      const imageUrls = Array.isArray(prepData.imageUrls) ? prepData.imageUrls : [];
      if (!imageUrls.length) throw new Error("예약 이미지 URL을 준비하지 못했습니다");

      const schedule = {
        id: `ig-manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        platform: "instagram",
        auto: false,
        status: "pending",
        text: postCaption || topic,
        caption: postCaption || topic,
        images: imageUrls,
        imageUrls,
        userId: igConfig.accountId,
        accountId: igConfig.accountId,
        accessToken: igConfig.accessToken,
        scheduledAt,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        retryCount: 0,
        retryAt: null,
        lastAttemptAt: null,
        lastError: null,
        topic,
        slideCount: imageUrls.length,
      };
      const result = await addSchedule(session.username, schedule);
      if (!result.ok) throw new Error(result.error || "예약 저장 실패");
      setIgAutoMessage(`예약이 생성되었습니다: ${new Date(scheduledAt).toLocaleString("ko-KR")}`);
      setIgAutoScheduleAt("");
      await loadInstagramSchedules();
      await loadInstagramAutoMonitor();
    } catch (e) {
      setIgAutoMessage(`예약 생성 실패: ${e.message}`);
    } finally {
      setIgAutoRunning(false);
    }
  };

  const cancelInstagramSchedule = async (id) => {
    if (!session?.username) return;
    const ok = await removeSchedule(session.username, id);
    if (ok) {
      setIgAutoSchedules((prev) => prev.filter((item) => item.id !== id));
      setIgAutoMessage("예약이 취소되었습니다.");
    }
  };

  return {
    igAutoConfig,
    setIgAutoConfig,
    igAutoSchedules,
    igAutoLoading,
    igAutoSaving,
    igAutoRunning,
    igAutoScheduleAt,
    setIgAutoScheduleAt,
    igAutoMessage,
    igAutoMonitor,
    igAutoHistory,
    igAutoMonitorLoading,
    loadInstagramAutoMonitor,
    loadInstagramSchedules,
    saveInstagramAutoConfig,
    runInstagramAutoResearch,
    scheduleCurrentInstagramCarousel,
    cancelInstagramSchedule,
    regenerateAutoCaption,
    clearAutoCaption,
    igAutoCaptionGenerating,
  };
}
