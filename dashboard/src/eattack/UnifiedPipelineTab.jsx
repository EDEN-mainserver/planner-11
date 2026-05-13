// 통합 카드뉴스 파이프라인
// 크롤링/리서치 → 기획 → 이미지 생성 → 카드 조립 → 배포
import { useEffect, useState, useCallback } from "react";
import LoginModal from "./LoginModal";
import { getSession, clearSession } from "../utils/authSession";
import { emitEAttackContext, summarizeText } from "./eattackContext";
import { runResearch } from "../services/pipeline/research";
import { incrementUsage } from "../services/subscription";
import { runPlanning } from "../services/pipeline/planning";
import { generateOneImage, analyzeDesignToTemplate } from "../services/pipeline/imageGen";
import { fetchSchedules, addSchedule, removeSchedule } from "../services/pipeline/schedule";
import { normalizeInstagramConfig } from "../services/pipeline/instagram";
import { loadSocial, saveSocial } from "../services/pipeline/socialStorage";
import { buildHtmlFromTemplate, buildHtmlCardNews, buildPremiumTemplate } from "../services/pipeline/cardNews";
import { collectPostImages } from "../services/pipeline/cardCapture";
import { postToThreadsAPI } from "../services/pipeline/threadsPost";
import {
  loadCaptionPrompt,
  persistCaptionPrompt as persistCaptionPromptToStorage,
  generateCaption,
} from "../services/pipeline/caption";
import { FONTS, FONT_LABELS, FONT_CSS } from "./pipeline/fonts";
import SetupStep from "./pipeline/steps/SetupStep";
import ResearchStep from "./pipeline/steps/ResearchStep";
import PlanningStep from "./pipeline/steps/PlanningStep";
import ImagesStep from "./pipeline/steps/ImagesStep";
import AssemblyStep from "./pipeline/steps/AssemblyStep";
import DeployStep from "./pipeline/steps/DeployStep";

// ── 상수 ──
const BATCH_SIZE = 3;
// 사용자별 IG 설정 키 (username 기반)
const igKey = (username) => `eden_ig_${username}_v1`;
const TONE_OPTS = [
  { v: "professional", l: "전문적" },
  { v: "friendly", l: "친근한" },
  { v: "emotional", l: "감성적" },
  { v: "bold", l: "강렬한" },
  { v: "luxury", l: "고급스러운" },
];
const PURPOSE_OPTS = [
  { v: "promo", l: "제품 홍보" },
  { v: "info", l: "정보 제공" },
  { v: "branding", l: "브랜딩" },
  { v: "event", l: "이벤트" },
  { v: "review", l: "고객 후기" },
];
const threadsKey = (u) => `eden_threads_${u}_v1`;


// ── 메인 컴포넌트 ──
export default function UnifiedPipelineTab() {
  // 세션 (로그인)
  const [session, setSession] = useState(() => getSession());

  // 파이프라인 단계 상태
  const [step, setStep] = useState("setup");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const [showTopicPicker, setShowTopicPicker] = useState(false);

  // 설정값
  const [topic, setTopic] = useState("");
  const [brandName, setBrandName] = useState("");
  const [color1, setColor1] = useState("#7c3aed");
  const [color2, setColor2] = useState("#ec4899");
  const [font, setFont] = useState("sans");
  const [tone, setTone] = useState("professional");
  const [purpose, setPurpose] = useState("info");
  const [slideCount, setSlideCount] = useState(7);

  // 결과물
  const [research, setResearch] = useState("");
  const [plan, setPlan] = useState(null);
  const [images, setImages] = useState([]);
  const [imgProg, setImgProg] = useState({ done: 0, total: 0 });
  const [cards, setCards] = useState([]); // 편집 가능한 카드 데이터
  const [htmlContent, setHtmlContent] = useState("");
  const [cardHtmls, setCardHtmls] = useState([]); // 카드별 개별 HTML (미리보기용)
  const [previewIdx, setPreviewIdx] = useState(0); // 현재 미리보기 중인 카드 인덱스

  // 템플릿 모드 (프리미엄 인스타 템플릿 vs 기존 AI 이미지)
  const [useTemplate, setUseTemplate] = useState(true);

  // 벤치마킹 디자인
  const [benchmarkImg, setBenchmarkImg] = useState(null); // { dataUrl, mime, base64 }
  const [benchmarkTemplate, setBenchmarkTemplate] = useState(null); // Gemini 추출 HTML 템플릿

  // 소셜 설정 (사용자별 로드)
  const [igConfig, setIgConfig]   = useState(() => normalizeInstagramConfig(loadSocial(igKey, getSession()?.username || "__guest")));
  const [thConfig, setThConfig]   = useState(() => loadSocial(threadsKey, getSession()?.username || "__guest"));
  const [igPosting, setIgPosting] = useState(false);
  const [igResult,  setIgResult]  = useState(null);
  const [igLogs,    setIgLogs]    = useState([]);
  const [thPosting, setThPosting] = useState(false);
  const [thResult, setThResult]   = useState(null);
  const [postCaption, setPostCaption] = useState("");
  const [captionPrompt, setCaptionPrompt] = useState(() =>
    loadCaptionPrompt(getSession()?.username)
  );
  const [captionSaving, setCaptionSaving] = useState(false);
  const [captionGenerating, setCaptionGenerating] = useState(false);
  const [igAutoConfig, setIgAutoConfig] = useState({
    enabled: true,
    keywords: "",
    postTime: "09:00",
    slideCount: 7,
    captionTemplate: "",
  });
  const [igAutoSchedules, setIgAutoSchedules] = useState([]);
  const [igAutoLoading, setIgAutoLoading] = useState(false);
  const [igAutoSaving, setIgAutoSaving] = useState(false);
  const [igAutoRunning, setIgAutoRunning] = useState(false);
  const [igAutoScheduleAt, setIgAutoScheduleAt] = useState("");
  const [igAutoMessage, setIgAutoMessage] = useState("");
  const [igAutoMonitor, setIgAutoMonitor] = useState(null);
  const [igAutoHistory, setIgAutoHistory] = useState([]);
  const [igAutoMonitorLoading, setIgAutoMonitorLoading] = useState(false);

  useEffect(() => {
    emitEAttackContext({
      page: "UnifiedPipelineTab",
      section: "이미지 > 통합 파이프라인",
      tab: "unified",
      step,
      mode: useTemplate ? "템플릿" : "AI 이미지",
      status: running ? "실행 중" : step,
      summary: [
        `주제 ${summarizeText(topic || "미입력", 60)}`,
        `브랜드 ${summarizeText(brandName || "미입력", 40)}`,
        `톤 ${tone}`,
        `목적 ${purpose}`,
        `슬라이드 ${slideCount}장`,
        `카드 ${cards.length}개`,
        thPosting ? "Threads 게시 중" : "",
      ].filter(Boolean).join(" · "),
    });
  }, [step, running, useTemplate, topic, brandName, tone, purpose, slideCount, cards.length, thPosting]);

  // 로그인 핸들러
  const handleLogin = (s) => {
    setSession(s);
    setIgConfig(normalizeInstagramConfig(loadSocial(igKey, s.username)));
    setThConfig(loadSocial(threadsKey, s.username));
    setCaptionPrompt(loadCaptionPrompt(s.username));
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

  const loadInstagramAutoMonitor = useCallback(async (runId = null) => {
    if (!session?.username) return null;
    setIgAutoMonitorLoading(true);
    try {
      const url = runId
        ? `/api/instagram-auto-monitor?username=${encodeURIComponent(session.username)}&runId=${encodeURIComponent(runId)}`
        : `/api/instagram-auto-monitor?username=${encodeURIComponent(session.username)}`;
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
        setIgAutoSchedules(schedules.filter((item) => String(item.platform || "threads").toLowerCase() === "instagram"));
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

  // 로그인 안 된 경우 모달 표시
  if (!session) {
    return <LoginModal onLogin={handleLogin} />;
  }

  const run = async (fn) => {
    setRunning(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message || "알 수 없는 오류");
    } finally {
      setRunning(false);
    }
  };

  // ── plan → 편집가능 cards 배열 변환 ──
  function buildCards(planData, imageList) {
    return planData.slides.map((slide, i) => ({
      num: slide.num,
      part: slide.part,
      headline: slide.headline,
      body: slide.body || "",
      imagePrompt: slide.imagePrompt,
      imageUrl: imageList[i] || null,
      color1,
      color2,
      font,
    }));
  }

  // ── 단계 핸들러 ──
  const startResearch = () =>
    run(async () => {
      // quota 확인 + 1회 차감 (INTERNAL_USERS는 서버에서 무제한 처리)
      if (session?.username) {
        await incrementUsage(session.username);
      }
      setStep("research");
      const summary = await runResearch(topic);
      setResearch(summary);
    });

  const startPlanning = () =>
    run(async () => {
      setStep("planning");
      const p = await runPlanning(topic, research, slideCount, tone, purpose, brandName);
      setPlan(p);
    });

  const startImages = () =>
    run(async () => {
      setStep("images");
      const slides = plan.slides;
      const results = new Array(slides.length).fill(null);
      setImages([...results]);
      setImgProg({ done: 0, total: slides.length });

      for (let i = 0; i < slides.length; i += BATCH_SIZE) {
        const batch = slides.slice(i, Math.min(i + BATCH_SIZE, slides.length));
        const settled = await Promise.allSettled(batch.map((s) => generateOneImage(s.imagePrompt)));
        settled.forEach((r, j) => {
          results[i + j] = r.status === "fulfilled" ? r.value : null;
        });
        setImages([...results]);
        setImgProg({ done: Math.min(i + BATCH_SIZE, slides.length), total: slides.length });
      }
    });

  const startAssembly = (imageList) => {
    const imgList = imageList || images;
    const assembled = buildCards(plan, imgList);
    setCards(assembled);
    const html = useTemplate && !benchmarkTemplate
      ? buildPremiumTemplate(topic, assembled, brandName, color1)
      : benchmarkTemplate
        ? buildHtmlFromTemplate(assembled, benchmarkTemplate, topic, brandName)
        : buildHtmlCardNews(topic, assembled, brandName, color1, color2, font);
    setHtmlContent(html);
    setCardHtmls(buildPremiumTemplate._lastCardHtmls || []);
    setPreviewIdx(0);
    setStep("assembly");
  };

  const updateCard = (idx, field, value) => {
    setCards((prev) => {
      const next = prev.map((c, i) =>
        i === idx ? { ...c, [field]: value } : c
      );
      // 템플릿 모드 분기
      const html = useTemplate && !benchmarkTemplate
        ? buildPremiumTemplate(topic, next, brandName, color1)
        : benchmarkTemplate
          ? buildHtmlFromTemplate(next, benchmarkTemplate, topic, brandName)
          : buildHtmlCardNews(topic, next, brandName, color1, color2, font);
      setHtmlContent(html);
      setCardHtmls(buildPremiumTemplate._lastCardHtmls || []);
      return next;
    });
  };

  const persistCaptionPrompt = async () => {
    setCaptionSaving(true);
    try {
      const nextPrompt = persistCaptionPromptToStorage(session?.username, captionPrompt);
      setCaptionPrompt(nextPrompt);
    } finally {
      setCaptionSaving(false);
    }
  };

  const generateCaptionFromPrompt = async () => {
    setCaptionGenerating(true);
    setError("");
    try {
      await persistCaptionPrompt();
      const caption = await generateCaption({
        topic, brandName, tone, purpose, research, cards, plan, captionPrompt,
      });
      setPostCaption(caption);
    } catch (e) {
      setError(e.message || "캡션 생성 실패");
    } finally {
      setCaptionGenerating(false);
    }
  };

  // 벤치마킹 이미지 업로드
  const handleBenchmarkFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("이미지 크기는 5MB 이하로 첨부해주세요");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (match) setBenchmarkImg({ dataUrl, mime: match[1], base64: match[2] });
    };
    reader.readAsDataURL(file);
  };

  // 벤치마킹 디자인으로 카드 생성
  const startBenchmarkImages = () =>
    run(async () => {
      setStep("images");
      setImgProg({ done: 0, total: plan.slides.length });
      // 1. Gemini Vision으로 디자인 분석
      const template = await analyzeDesignToTemplate(benchmarkImg.base64, benchmarkImg.mime);
      setBenchmarkTemplate(template);
      // 2. 템플릿 + 슬라이드 데이터로 카드 배열 생성
      const assembled = buildCards(plan, []);
      setCards(assembled);
      // 3. HTML 빌드
      const html = buildHtmlFromTemplate(assembled, template, topic, brandName);
      setHtmlContent(html);
      setImgProg({ done: plan.slides.length, total: plan.slides.length });
      setStep("assembly");
    });

  const postToThreads = async () => {
    setThPosting(true);
    setThResult(null);
    setError("");
    try {
      const result = await postToThreadsAPI({
        thConfig,
        cards,
        cardHtmls,
        caption: postCaption || topic,
      });
      setThResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setThPosting(false);
    }
  };

  const reset = () => {
    setStep("setup");
    setTopic("");
    setResearch("");
    setPlan(null);
    setImages([]);
    setCards([]);
    setHtmlContent("");
    setError("");
    setIgResult(null);
  };

  const postToInstagram = async () => {
    setIgPosting(true);
    setIgResult(null);
    setError("");
    setIgLogs([]);
    const log = (msg) => setIgLogs((p) => [...p, `[${new Date().toLocaleTimeString("ko-KR")}] ${msg}`]);

    try {
      log(`계정: @${igConfig.username || igConfig.accountId}`);

      const images = await collectPostImages({ cards, cardHtmls, logFn: log });
      if (images.length === 0) {
        throw new Error("게시할 이미지가 없습니다. 카드를 먼저 조립해주세요.");
      }

      log(`instagram-post API 호출 (이미지 ${images.length}장)`);
      const res = await fetch("/api/instagram-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: igConfig.accountId,
          accessToken: igConfig.accessToken,
          images,
          caption: postCaption || topic,
        }),
      });
      const data = await res.json();
      log(`instagram-post 응답: ${res.status} / ${JSON.stringify(data).slice(0, 120)}`);
      if (!res.ok) throw new Error(data.error || "게시 실패");
      log(`게시 완료! permalink: ${data.permalink}`);
      setIgResult({ ok: true, permalink: data.permalink });
    } catch (e) {
      log(`오류: ${e.message}`);
      setError(e.message);
    } finally {
      setIgPosting(false);
    }
  };

  const loadInstagramSchedules = async () => {
    if (!session?.username) return;
    const schedules = await fetchSchedules(session.username);
    setIgAutoSchedules(schedules.filter((item) => String(item.platform || "threads").toLowerCase() === "instagram"));
  };

  const saveInstagramAutoConfig = async () => {
    if (!session?.username) return;
    if (!igConfig.accountId || !igConfig.accessToken) {
      setError("Instagram 계정 연동 후 자동화 설정을 저장하세요");
      return;
    }

    setIgAutoSaving(true);
    setIgAutoMessage("");
    try {
      const payload = {
        enabled: Boolean(igAutoConfig.enabled),
        keywords: String(igAutoConfig.keywords || ""),
        postTime: igAutoConfig.postTime || "09:00",
        slideCount: Math.max(3, Math.min(10, Number(igAutoConfig.slideCount) || slideCount || 7)),
        captionTemplate: String(igAutoConfig.captionTemplate || postCaption || topic || ""),
        accountId: igConfig.accountId,
        accessToken: igConfig.accessToken,
        brandName,
        tone,
        purpose,
      };
      const res = await fetch("/api/instagram-auto-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: session.username, config: payload }),
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
      setError("Instagram 계정 연동 후 자동화를 실행하세요");
      return;
    }
    setIgAutoRunning(true);
    setIgAutoMessage("");
    try {
      const payload = {
        enabled: Boolean(igAutoConfig.enabled),
        keywords: String(igAutoConfig.keywords || ""),
        postTime: igAutoConfig.postTime || "09:00",
        slideCount: Math.max(3, Math.min(10, Number(igAutoConfig.slideCount) || slideCount || 7)),
        captionTemplate: String(igAutoConfig.captionTemplate || postCaption || topic || ""),
        accountId: igConfig.accountId,
        accessToken: igConfig.accessToken,
        brandName,
        tone,
        purpose,
      };
      const res = await fetch("/api/instagram-auto-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: session.username,
          config: payload,
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
      setError("Instagram 계정 연동 후 예약을 생성하세요");
      return;
    }
    if (!igAutoScheduleAt) {
      setError("예약 시간을 선택하세요");
      return;
    }

    setIgAutoRunning(true);
    setError("");
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

  // ══ STEP: setup ══
  if (step === "setup")
    return (
      <SetupStep
        session={session}
        onLogout={handleLogout}
        step={step}
        topic={topic}
        setTopic={setTopic}
        showTopicPicker={showTopicPicker}
        setShowTopicPicker={setShowTopicPicker}
        brandName={brandName}
        setBrandName={setBrandName}
        color1={color1}
        setColor1={setColor1}
        color2={color2}
        setColor2={setColor2}
        useTemplate={useTemplate}
        setUseTemplate={setUseTemplate}
        font={font}
        setFont={setFont}
        tone={tone}
        setTone={setTone}
        purpose={purpose}
        setPurpose={setPurpose}
        slideCount={slideCount}
        setSlideCount={setSlideCount}
        toneOpts={TONE_OPTS}
        purposeOpts={PURPOSE_OPTS}
        startResearch={startResearch}
        error={error}
      />
    );

  // ══ STEP: research ══
  if (step === "research")
    return (
      <ResearchStep
        session={session}
        onLogout={handleLogout}
        step={step}
        running={running}
        topic={topic}
        research={research}
        error={error}
        startResearch={startResearch}
        startPlanning={startPlanning}
      />
    );

  // ══ STEP: planning ══
  if (step === "planning")
    return (
      <PlanningStep
        session={session}
        onLogout={handleLogout}
        step={step}
        running={running}
        plan={plan}
        topic={topic}
        error={error}
        benchmarkImg={benchmarkImg}
        setBenchmarkImg={setBenchmarkImg}
        handleBenchmarkFile={handleBenchmarkFile}
        useTemplate={useTemplate}
        setImages={setImages}
        startPlanning={startPlanning}
        startBenchmarkImages={startBenchmarkImages}
        startImages={startImages}
        startAssembly={startAssembly}
      />
    );

  // ══ STEP: images ══
  if (step === "images")
    return (
      <ImagesStep
        session={session}
        onLogout={handleLogout}
        step={step}
        running={running}
        imgProg={imgProg}
        images={images}
        plan={plan}
        error={error}
        batchSize={BATCH_SIZE}
        setImages={setImages}
        setStep={setStep}
        startImages={startImages}
        startAssembly={startAssembly}
      />
    );

  // ══ STEP: assembly ══
  if (step === "assembly")
    return (
      <AssemblyStep
        session={session}
        onLogout={handleLogout}
        step={step}
        cards={cards}
        color1={color1}
        color2={color2}
        cardHtmls={cardHtmls}
        htmlContent={htmlContent}
        previewIdx={previewIdx}
        setPreviewIdx={setPreviewIdx}
        topic={topic}
        error={error}
        updateCard={updateCard}
        setStep={setStep}
      />
    );

  // ══ STEP: deploy ══
  if (step === "deploy")
    return (
      <DeployStep
        session={session}
        onLogout={handleLogout}
        step={step}
        cards={cards}
        topic={topic}
        error={error}
        igConfig={igConfig}
        setIgConfig={setIgConfig}
        saveIgConfig={(next) => saveSocial(igKey, session.username, next)}
        setError={setError}
        igPosting={igPosting}
        postCaption={postCaption}
        setPostCaption={setPostCaption}
        captionPrompt={captionPrompt}
        setCaptionPrompt={setCaptionPrompt}
        captionSaving={captionSaving}
        captionGenerating={captionGenerating}
        generateCaptionFromPrompt={generateCaptionFromPrompt}
        persistCaptionPrompt={persistCaptionPrompt}
        postToInstagram={postToInstagram}
        igResult={igResult}
        igLogs={igLogs}
        setIgLogs={setIgLogs}
        igAutoConfig={igAutoConfig}
        setIgAutoConfig={setIgAutoConfig}
        igAutoLoading={igAutoLoading}
        igAutoSaving={igAutoSaving}
        igAutoRunning={igAutoRunning}
        igAutoSchedules={igAutoSchedules}
        igAutoScheduleAt={igAutoScheduleAt}
        setIgAutoScheduleAt={setIgAutoScheduleAt}
        igAutoMessage={igAutoMessage}
        igAutoMonitor={igAutoMonitor}
        igAutoHistory={igAutoHistory}
        igAutoMonitorLoading={igAutoMonitorLoading}
        saveInstagramAutoConfig={saveInstagramAutoConfig}
        runInstagramAutoResearch={runInstagramAutoResearch}
        scheduleCurrentInstagramCarousel={scheduleCurrentInstagramCarousel}
        loadInstagramAutoMonitor={loadInstagramAutoMonitor}
        loadInstagramSchedules={loadInstagramSchedules}
        cancelInstagramSchedule={cancelInstagramSchedule}
        thConfig={thConfig}
        thPosting={thPosting}
        thResult={thResult}
        postToThreads={postToThreads}
        setStep={setStep}
        reset={reset}
      />
    );

  return null;
}
