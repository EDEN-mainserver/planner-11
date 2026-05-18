// 통합 카드뉴스 파이프라인
// 크롤링/리서치 → 기획 → 이미지 생성 → 카드 조립 → 배포
import { useEffect, useRef, useState } from "react";
import LoginModal from "./LoginModal";
import { getSession, clearSession } from "../utils/authSession";
import { emitEAttackContext, summarizeText } from "./eattackContext";
import { runResearch } from "../services/pipeline/research";
import { incrementUsage } from "../services/subscription";
import { runPlanning } from "../services/pipeline/planning";
import { generateOneImage, analyzeDesignToTemplate } from "../services/pipeline/imageGen";
import { normalizeInstagramConfig } from "../services/pipeline/instagram";
import { loadSocial, saveSocial, loadLocalText, saveLocalText } from "../services/pipeline/socialStorage";
import { useInstagramAuto } from "../hooks/useInstagramAuto";
import { buildHtmlFromTemplate, buildPremiumTemplate, buildHighestTemplate } from "../services/pipeline/cardNews";
import { collectPostImages } from "../services/pipeline/cardCapture";
import { postToThreadsAPI } from "../services/pipeline/threadsPost";
import {
  loadCaptionPrompt,
  persistCaptionPrompt as persistCaptionPromptToStorage,
  generateCaption,
} from "../services/pipeline/caption";
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
const planningPromptKey = (u) => `eden_planning_prompt_${u}_v1`;


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
  const [tone, setTone] = useState("professional");
  const [purpose, setPurpose] = useState("info");
  const [slideCount, setSlideCount] = useState(7);

  // 결과물
  const [research, setResearch] = useState("");
  const [plan, setPlan] = useState(null);
  const [images, setImages] = useState([]); // AI 생성 배경 이미지 (HIGHEST 전용)
  const [imgProg, setImgProg] = useState({ done: 0, total: 0 });
  const [cards, setCards] = useState([]); // 편집 가능한 카드 데이터
  const [htmlContent, setHtmlContent] = useState("");
  const [cardHtmls, setCardHtmls] = useState([]); // 카드별 개별 HTML (미리보기용)
  const [previewIdx, setPreviewIdx] = useState(0); // 현재 미리보기 중인 카드 인덱스

  // 템플릿 모드 (프리미엄 인스타 템플릿 vs 기존 AI 이미지)
  const [templateId, setTemplateId] = useState("premium"); // "premium" | "highest"

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
  // 배포 단계 진입 시 자동 캡션 생성을 한 번만 트리거하기 위한 가드
  const autoCaptionFiredRef = useRef(false);

  // 기획 단계 추가 지시사항 — 사용자가 직접 입력하는 프롬프트, 기본 프롬프트 끝에 append
  const [planningPrompt, setPlanningPrompt] = useState(() =>
    loadLocalText(planningPromptKey(getSession()?.username || "__guest")) || ""
  );
  const [planningPromptSaving, setPlanningPromptSaving] = useState(false);

  useEffect(() => {
    emitEAttackContext({
      page: "UnifiedPipelineTab",
      section: "이미지 > 통합 파이프라인",
      tab: "unified",
      step,
      mode: benchmarkTemplate ? "벤치마킹" : templateId === "highest" ? "HIGHEST" : "프리미엄",
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
  }, [step, running, templateId, benchmarkTemplate, topic, brandName, tone, purpose, slideCount, cards.length, thPosting]);

  // 로그인 핸들러
  const handleLogin = (s) => {
    setSession(s);
    setIgConfig(normalizeInstagramConfig(loadSocial(igKey, s.username)));
    setThConfig(loadSocial(threadsKey, s.username));
    setCaptionPrompt(loadCaptionPrompt(s.username));
    setPlanningPrompt(loadLocalText(planningPromptKey(s.username)) || "");
  };

  const handleLogout = () => {
    clearSession();
    setSession(null);
  };

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
      imageUrl: imageList?.[i] || null,
      color1,
      color2,
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

  // 기본 기획 — 사용자 추가 지시 없이
  const startPlanning = () =>
    run(async () => {
      setStep("planning");
      const p = await runPlanning(topic, research, slideCount, tone, purpose, brandName);
      setPlan(p);
    });

  // 사용자가 입력한 추가 지시사항을 포함해 재기획
  const startPlanningWithCustom = () =>
    run(async () => {
      setStep("planning");
      const p = await runPlanning(topic, research, slideCount, tone, purpose, brandName, planningPrompt);
      setPlan(p);
    });

  // 추가 지시사항을 localStorage에 저장
  const persistPlanningPrompt = () => {
    setPlanningPromptSaving(true);
    try {
      const next = String(planningPrompt || "").trim();
      saveLocalText(planningPromptKey(session?.username || "__guest"), next);
      setPlanningPrompt(next);
    } finally {
      setPlanningPromptSaving(false);
    }
  };

  // HIGHEST 전용 자동 이미지 생성 — slide별 imagePrompt를 batch 호출.
  // 모든 슬라이드 완료 후 step="images" 화면에서 사용자가 결과 확인 → "카드 조립 →" 클릭.
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
    const imgList = imageList || [];
    const assembled = buildCards(plan, imgList);
    setCards(assembled);
    const { html, cardHtmls: nextCardHtmls } = renderCards(assembled);
    setHtmlContent(html);
    setCardHtmls(nextCardHtmls);
    setPreviewIdx(0);
    setStep("assembly");
  };

  // 현재 선택된 템플릿(벤치마킹/HIGHEST/프리미엄)으로 카드 배열을 HTML + cardHtmls로 빌드.
  const renderCards = (cardList) => {
    if (benchmarkTemplate) {
      return {
        html: buildHtmlFromTemplate(cardList, benchmarkTemplate, topic, brandName),
        cardHtmls: [],
      };
    }
    if (templateId === "highest") {
      return {
        html: buildHighestTemplate(topic, cardList, brandName, color1),
        cardHtmls: buildHighestTemplate._lastCardHtmls || [],
      };
    }
    return {
      html: buildPremiumTemplate(topic, cardList, brandName, color1),
      cardHtmls: buildPremiumTemplate._lastCardHtmls || [],
    };
  };

  // 기획 단계에서 사용자가 슬라이드를 직접 편집 (headline / body / imagePrompt)
  const updateSlide = (idx, field, value) => {
    setPlan((prev) => {
      if (!prev?.slides) return prev;
      return {
        ...prev,
        slides: prev.slides.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
      };
    });
  };

  const updateCard = (idx, field, value) => {
    setCards((prev) => {
      const next = prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c));
      const { html, cardHtmls: nextCardHtmls } = renderCards(next);
      setHtmlContent(html);
      setCardHtmls(nextCardHtmls);
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
    if (!topic?.trim()) {
      setError("캡션을 만들 주제를 먼저 입력해주세요");
      return;
    }
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

  // 배포 단계 진입 시 캡션이 비어있으면 한 번 자동 생성. 버튼 클릭은 기존대로 재생성.
  useEffect(() => {
    if (step !== "deploy") {
      autoCaptionFiredRef.current = false;
      return;
    }
    if (autoCaptionFiredRef.current) return;
    if (captionGenerating) return;
    if (!topic?.trim()) return;
    if (postCaption?.trim()) return;
    if (cards.length === 0) return;
    autoCaptionFiredRef.current = true;
    generateCaptionFromPrompt();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, topic, postCaption, captionGenerating, cards.length]);

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
      // 1. Gemini Vision으로 디자인 분석
      const template = await analyzeDesignToTemplate(benchmarkImg.base64, benchmarkImg.mime);
      setBenchmarkTemplate(template);
      // 2. 템플릿 + 슬라이드 데이터로 카드 배열 생성
      const assembled = buildCards(plan, []);
      setCards(assembled);
      // 3. HTML 빌드
      const html = buildHtmlFromTemplate(assembled, template, topic, brandName);
      setHtmlContent(html);
      setStep("assembly");
    });

  const postToThreads = async () => {
    if (!thConfig.userId || !thConfig.accessToken) {
      setError("스레드 사용자 ID와 액세스 토큰을 입력해주세요");
      return;
    }
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
    setImgProg({ done: 0, total: 0 });
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

  const instagramAuto = useInstagramAuto({
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
    onValidationError: setError,
  });

  // ══ STEP: setup ══
  if (step === "setup")
    return (
      <SetupStep
        session={session}
        onLogout={handleLogout}
        step={step}
        onStepClick={setStep}
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
        templateId={templateId}
        setTemplateId={setTemplateId}
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
        onStepClick={setStep}
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
        onStepClick={setStep}
        running={running}
        plan={plan}
        topic={topic}
        error={error}
        benchmarkImg={benchmarkImg}
        setBenchmarkImg={setBenchmarkImg}
        handleBenchmarkFile={handleBenchmarkFile}
        templateId={templateId}
        startPlanning={startPlanning}
        startBenchmarkImages={startBenchmarkImages}
        startImages={startImages}
        startAssembly={startAssembly}
        updateSlide={updateSlide}
        planningPrompt={planningPrompt}
        setPlanningPrompt={setPlanningPrompt}
        planningPromptSaving={planningPromptSaving}
        persistPlanningPrompt={persistPlanningPrompt}
        startPlanningWithCustom={startPlanningWithCustom}
      />
    );

  // ══ STEP: images ══
  if (step === "images")
    return (
      <ImagesStep
        session={session}
        onLogout={handleLogout}
        step={step}
        onStepClick={setStep}
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
        onStepClick={setStep}
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
        onStepClick={setStep}
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
        {...instagramAuto}
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
