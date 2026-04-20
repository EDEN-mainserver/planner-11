// 콘텐츠 파이프라인 — 주제 리서치 → 기획 → AI 이미지 → 에디토리얼 HTML 카드뉴스
import { useState } from "react";
import { callGemini } from "../utils/gemini";

// ── 상수 ──
const TONE_OPTS = [
  { v: "professional", l: "전문적" },
  { v: "friendly",     l: "친근한" },
  { v: "emotional",    l: "감성적" },
  { v: "bold",         l: "강렬한" },
  { v: "luxury",       l: "고급스러운" },
];
const PURPOSE_OPTS = [
  { v: "promo",    l: "제품 홍보" },
  { v: "info",     l: "정보 제공" },
  { v: "branding", l: "브랜딩" },
  { v: "event",    l: "이벤트" },
  { v: "review",   l: "고객 후기" },
];
const STEP_LABELS = ["주제 입력", "리서치", "기획", "이미지", "카드뉴스"];
const BATCH_SIZE = 3;

// ── API 유틸 ──
async function runResearch(topic) {
  let articlesText = "(네이버 검색 결과 없음)";
  try {
    const res = await fetch(
      `/api/naver-search?query=${encodeURIComponent(topic)}&display=10&sort=sim`
    );
    if (res.ok) {
      const data = await res.json();
      const items = (data.items || []).slice(0, 8);
      if (items.length > 0) {
        articlesText = items
          .map(
            (a, i) =>
              `[${i + 1}] ${a.title?.replace(/<[^>]+>/g, "")} — ${a.description?.replace(/<[^>]+>/g, "")}`
          )
          .join("\n");
      }
    }
  } catch (_) {}

  return callGemini(
    [
      {
        role: "user",
        content: `주제: "${topic}"\n\n검색 결과:\n${articlesText}\n\n카드뉴스 제작을 위한 리서치 보고서를 작성해줘. 핵심 메시지 5-7가지, 통계/수치, 독자 인사이트 중심으로. 마크다운 형식.`,
      },
    ],
    "콘텐츠 리서처. 카드뉴스 제작을 위한 핵심 정보를 추출·요약합니다."
  );
}

async function runPlanning(topic, research, slideCount, tone, purpose, brandName) {
  const raw = await callGemini(
    [
      {
        role: "user",
        content: `주제: "${topic}" | 브랜드: ${brandName || "브랜드"} | 톤: ${tone} | 목적: ${purpose}
리서치 요약:
${research}

${slideCount}장 카드뉴스 기획서를 JSON으로 작성해줘:
{
  "type": "나열형|스토리텔링형|집중형|문답형",
  "slides": [
    {
      "num": 1,
      "part": "표지|본문|마무리",
      "headline": "제목(15자이내)",
      "body": "본문(40자이내, 표지/마무리 생략가능)",
      "imagePrompt": "영어로 이미지 설명, 사실적 사진 스타일, no text, no watermark"
    }
  ]
}
JSON만 반환.`,
      },
    ],
    "카드뉴스 기획 전문가. JSON만 반환합니다."
  );
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("기획서 파싱 실패 — 다시 시도해주세요");
  return JSON.parse(match[0]);
}

async function generateOneImage(prompt) {
  const res = await fetch("/api/image-generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: `${prompt}, no text, no watermark, photorealistic, high quality`,
      aspectRatio: "3:4",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || err.message || `이미지 API 오류 ${res.status}`);
  }
  return (await res.json()).imageUrl;
}

// HTML 카드뉴스를 코드로 직접 빌드 (Gemini 의존 없음 → 구조 보장)
function buildHtmlCardNews(topic, plan, images, brandName, color) {
  const slides = plan.slides;
  const brand = brandName || "브랜드";

  const escHtml = (s) =>
    String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const cards = slides
    .map((slide, i) => {
      const isDark = i % 2 === 0;
      const bg = isDark ? "#0A0A0A" : "#FAFAFA";
      const tc = isDark ? "#ffffff" : "#0A0A0A";
      const img = images[i];
      const isCover = slide.part === "표지";
      const isClosing = slide.part === "마무리";

      const imgBlock = img
        ? `<div class="img-wrap">
            <img src="${img}" alt="${escHtml(slide.headline)}" />
            <div class="img-ov"></div>
          </div>`
        : `<div class="img-placeholder" style="background:linear-gradient(135deg,${color}cc,${color}55)"></div>`;

      return `
  <div class="card" style="background:${bg};color:${tc}">
    ${isClosing ? "" : imgBlock}
    ${isClosing
      ? `<div class="card-inner closing" style="background:linear-gradient(160deg,${color},${color}88)">
          <p class="num" style="color:rgba(255,255,255,0.5)">${i + 1} / ${slides.length}</p>
          <h2 class="headline" style="color:#fff">${escHtml(slide.headline)}</h2>
          ${slide.body ? `<p class="body" style="color:rgba(255,255,255,0.85)">${escHtml(slide.body)}</p>` : ""}
          <p class="brand-name" style="color:#fff">${escHtml(brand)}</p>
        </div>`
      : `<div class="card-inner ${isCover ? "cover" : "content"}">
          <p class="num" style="color:${isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)"}">${i + 1} / ${slides.length}</p>
          <h2 class="headline" style="color:${isCover ? "#fff" : tc}">${escHtml(slide.headline)}</h2>
          ${slide.body ? `<p class="body" style="color:${isCover ? "rgba(255,255,255,0.9)" : isDark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.7)"}">${escHtml(slide.body)}</p>` : ""}
          ${i === slides.length - 1 ? `<p class="brand-name" style="color:${color}">${escHtml(brand)}</p>` : ""}
        </div>`
    }
  </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>${escHtml(topic)} — 카드뉴스</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    background: #111;
    padding: 20px;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    font-family: system-ui, -apple-system, sans-serif;
  }
  .card {
    width: 1080px;
    height: 1350px;
    position: relative;
    overflow: hidden;
    flex-shrink: 0;
    border-radius: 4px;
  }
  .img-wrap {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 58%;
  }
  .img-wrap img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .img-ov {
    position: absolute;
    bottom: 0; left: 0; right: 0;
    height: 70%;
    background: linear-gradient(transparent, rgba(0,0,0,0.75));
  }
  .img-placeholder {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
  }
  .card-inner {
    position: absolute;
    left: 0; right: 0; bottom: 0;
    padding: 56px 60px;
    z-index: 10;
  }
  .card-inner.cover {
    top: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .card-inner.content {
    top: auto;
  }
  .card-inner.closing {
    top: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
  }
  .num {
    font-size: 28px;
    margin-bottom: 24px;
    letter-spacing: 0.05em;
  }
  .headline {
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 72px;
    font-weight: 700;
    line-height: 1.15;
    margin-bottom: 28px;
    word-break: keep-all;
  }
  .body {
    font-size: 40px;
    line-height: 1.7;
    word-break: keep-all;
    margin-bottom: 20px;
  }
  .brand-name {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: 0.08em;
    margin-top: 20px;
  }
</style>
</head>
<body>
${cards}
</body>
</html>`;
}

// ── 공통 UI ──
function Spinner({ label, sub, gradient = "from-pink-500 to-rose-500" }) {
  return (
    <div className="flex flex-col items-center py-16 gap-4">
      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg animate-pulse`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
        </svg>
      </div>
      <p className="text-sm font-semibold text-gray-700">{label}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function ErrorBox({ msg, onRetry }) {
  return (
    <div className="space-y-3">
      <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{msg}</div>
      {onRetry && (
        <button onClick={onRetry} className="w-full py-2.5 bg-pink-500 text-white text-sm font-bold rounded-xl hover:bg-pink-600 transition-all">
          다시 시도
        </button>
      )}
    </div>
  );
}

// ── 메인 컴포넌트 ──
export default function ContentPipelineTab() {
  const [step,       setStep]       = useState(0);
  const [running,    setRunning]    = useState(false);
  const [error,      setError]      = useState("");

  // Setup 입력값
  const [topic,      setTopic]      = useState("");
  const [brandName,  setBrandName]  = useState("");
  const [color,      setColor]      = useState("#7c3aed");
  const [tone,       setTone]       = useState("professional");
  const [purpose,    setPurpose]    = useState("info");
  const [slideCount, setSlideCount] = useState(7);

  // 결과물
  const [research,   setResearch]   = useState("");
  const [plan,       setPlan]       = useState(null);
  const [images,     setImages]     = useState([]);
  const [imgProg,    setImgProg]    = useState({ done: 0, total: 0 });
  const [htmlContent,setHtmlContent]= useState("");

  const run = async (fn) => {
    setRunning(true);
    setError("");
    try { await fn(); }
    catch (e) { setError(e.message || "알 수 없는 오류"); }
    finally { setRunning(false); }
  };

  // ── 단계 핸들러 ──
  const startResearch = () => run(async () => {
    setStep(1);
    const summary = await runResearch(topic);
    setResearch(summary);
  });

  const startPlanning = () => run(async () => {
    setStep(2);
    const p = await runPlanning(topic, research, slideCount, tone, purpose, brandName);
    setPlan(p);
  });

  const startImages = () => run(async () => {
    setStep(3);
    const slides = plan.slides;
    const results = new Array(slides.length).fill(null);
    setImages([...results]);
    setImgProg({ done: 0, total: slides.length });

    for (let i = 0; i < slides.length; i += BATCH_SIZE) {
      const batch = slides.slice(i, Math.min(i + BATCH_SIZE, slides.length));
      const settled = await Promise.allSettled(
        batch.map((s) => generateOneImage(s.imagePrompt))
      );
      settled.forEach((r, j) => {
        results[i + j] = r.status === "fulfilled" ? r.value : null;
      });
      setImages([...results]);
      setImgProg({ done: Math.min(i + BATCH_SIZE, slides.length), total: slides.length });
    }
  });

  const startHtml = () => run(async () => {
    setStep(4);
    const html = buildHtmlCardNews(topic, plan, images, brandName, color);
    setHtmlContent(html);
  });

  const downloadHtml = () => {
    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${topic.slice(0, 20)}-카드뉴스.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStep(0); setTopic(""); setResearch(""); setPlan(null);
    setImages([]); setHtmlContent(""); setError("");
  };

  // ── 스텝 인디케이터 ──
  function StepBar() {
    return (
      <div className="flex items-center">
        {STEP_LABELS.map((label, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className={`flex flex-col items-center gap-1 flex-shrink-0 transition-opacity ${i <= step ? "opacity-100" : "opacity-30"}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all
                ${i < step ? "bg-pink-500 border-pink-500 text-white" : i === step ? "border-pink-500 text-pink-600 bg-pink-50" : "border-gray-300 text-gray-400 bg-white"}`}>
                {i < step ? "✓" : i + 1}
              </div>
              <span className={`text-[9px] font-medium whitespace-nowrap hidden sm:block ${i === step ? "text-pink-600" : "text-gray-400"}`}>{label}</span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-5 sm:mb-3 transition-colors ${i < step ? "bg-pink-400" : "bg-gray-200"}`} />
            )}
          </div>
        ))}
      </div>
    );
  }

  // ══ STEP 0: 주제 입력 ══
  if (step === 0) return (
    <div className="p-6 space-y-5">
      <StepBar />

      <div className="bg-gradient-to-r from-violet-50 to-pink-50 border border-violet-200 rounded-xl px-4 py-3">
        <p className="text-xs font-bold text-violet-700 mb-0.5">🚀 콘텐츠 파이프라인</p>
        <p className="text-[11px] text-violet-600">주제 하나로 리서치 → 기획 → 이미지 → 에디토리얼 카드뉴스까지 자동 생성</p>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1.5">주제 입력 *</label>
        <textarea rows={2}
          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-pink-400 resize-none leading-relaxed"
          placeholder="예: 봄철 피부 관리법, AI 트렌드 2025, 제주도 여행 코스"
          value={topic} onChange={e => setTopic(e.target.value.slice(0, 80))} />
        <p className="text-[11px] text-gray-400 text-right mt-0.5">{topic.length}/80</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1.5">브랜드명</label>
          <input type="text" placeholder="브랜드명 (선택)"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-pink-400"
            value={brandName} onChange={e => setBrandName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-bold text-gray-700 block mb-1.5">포인트 컬러</label>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex-shrink-0 shadow-sm border border-gray-200" style={{ background: color }} />
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              className="flex-1 h-9 rounded-lg cursor-pointer border border-gray-200 bg-white p-0.5" />
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1.5">톤 / 분위기</label>
        <div className="flex flex-wrap gap-2">
          {TONE_OPTS.map(o => (
            <button key={o.v} onClick={() => setTone(o.v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all
                ${tone === o.v ? "border-pink-400 bg-pink-50 text-pink-700" : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"}`}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1.5">콘텐츠 목적</label>
        <div className="flex flex-wrap gap-2">
          {PURPOSE_OPTS.map(o => (
            <button key={o.v} onClick={() => setPurpose(o.v)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all
                ${purpose === o.v ? "border-pink-400 bg-pink-50 text-pink-700" : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"}`}>
              {o.l}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-gray-700 block mb-1.5">슬라이드 수</label>
        <div className="flex gap-2">
          {[5, 6, 7, 8, 10].map(n => (
            <button key={n} onClick={() => setSlideCount(n)}
              className={`w-9 h-9 rounded-xl text-sm font-bold border-2 transition-all
                ${slideCount === n ? "border-pink-400 bg-pink-50 text-pink-700" : "border-gray-200 text-gray-600 bg-white hover:border-gray-300"}`}>
              {n}
            </button>
          ))}
        </div>
      </div>

      <button onClick={startResearch} disabled={!topic.trim()}
        className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        리서치 시작
      </button>
    </div>
  );

  // ══ STEP 1: 리서치 ══
  if (step === 1) return (
    <div className="p-6 space-y-4">
      <StepBar />
      {running
        ? <Spinner label={`"${topic}" 리서치 중...`} sub="네이버 검색 + AI 분석" gradient="from-blue-500 to-cyan-600" />
        : research
          ? <>
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <p className="text-xs font-bold text-blue-700 mb-2">📋 리서치 보고서</p>
                <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto pr-1">{research}</div>
              </div>
              {error && <ErrorBox msg={error} />}
              <div className="flex gap-2">
                <button onClick={startResearch}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all">
                  다시 리서치
                </button>
                <button onClick={startPlanning}
                  className="flex-[2] py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-bold rounded-xl hover:from-pink-600 hover:to-rose-600 transition-all">
                  기획 시작 →
                </button>
              </div>
            </>
          : error && <ErrorBox msg={error} onRetry={startResearch} />
      }
    </div>
  );

  // ══ STEP 2: 기획 ══
  if (step === 2) return (
    <div className="p-6 space-y-4">
      <StepBar />
      {running
        ? <Spinner label="카드뉴스 기획 중..." gradient="from-purple-500 to-violet-600" />
        : plan
          ? <>
              <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-center justify-between">
                <p className="text-xs font-bold text-purple-700">📋 {plan.type} · {plan.slides?.length}장</p>
                <span className="text-[10px] text-purple-500">{topic}</span>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {plan.slides?.map((s, i) => (
                  <div key={i} className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-xs
                    ${s.part === "표지" ? "border-pink-200 bg-pink-50" : s.part === "마무리" ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5
                      ${s.part === "표지" ? "bg-pink-200 text-pink-700" : s.part === "마무리" ? "bg-emerald-200 text-emerald-700" : "bg-gray-200 text-gray-600"}`}>
                      {s.num}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-gray-800 truncate">{s.headline}</p>
                      {s.body && <p className="text-gray-500 mt-0.5 line-clamp-1">{s.body}</p>}
                      <p className="text-gray-300 mt-0.5 line-clamp-1 italic text-[10px]">{s.imagePrompt}</p>
                    </div>
                  </div>
                ))}
              </div>
              {error && <ErrorBox msg={error} />}
              <div className="flex gap-2">
                <button onClick={startPlanning}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all">
                  다시 기획
                </button>
                <button onClick={() => { setImages([]); startImages(); }}
                  className="flex-[2] py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-bold rounded-xl hover:from-pink-600 hover:to-rose-600 transition-all">
                  이미지 생성 →
                </button>
              </div>
              <button onClick={startHtml}
                className="w-full py-2 border border-dashed border-gray-300 text-xs text-gray-400 rounded-xl hover:bg-gray-50 transition-all">
                이미지 건너뛰고 HTML 바로 생성
              </button>
            </>
          : error && <ErrorBox msg={error} onRetry={startPlanning} />
      }
    </div>
  );

  // ══ STEP 3: 이미지 생성 ══
  if (step === 3) return (
    <div className="p-6 space-y-4">
      <StepBar />

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-700">
          {running
            ? `이미지 생성 중... ${imgProg.done}/${imgProg.total}`
            : `완료 ${images.filter(Boolean).length}/${plan.slides.length}장`}
        </p>
        {running && (
          <div className="w-28 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-pink-500 rounded-full transition-all"
              style={{ width: `${(imgProg.done / imgProg.total) * 100}%` }} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {plan.slides.map((s, i) => {
          const isDone = i < imgProg.done;
          const isCurrent = running && !isDone && i >= imgProg.done && i < imgProg.done + BATCH_SIZE;
          return (
            <div key={i} className="relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
              style={{ aspectRatio: "4/5" }}>
              {images[i] ? (
                <img src={images[i]} alt={s.headline} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full flex flex-col items-center justify-center gap-1 transition-colors
                  ${isCurrent ? "bg-pink-50 animate-pulse" : isDone && !images[i] ? "bg-red-50" : "bg-gray-50"}`}>
                  {isCurrent ? (
                    <svg className="animate-spin text-pink-400" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  ) : isDone && !images[i] ? (
                    <span className="text-[10px] text-red-400 text-center px-1">생성 실패</span>
                  ) : (
                    <span className="text-xs text-gray-300 font-bold">{s.num}</span>
                  )}
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1">
                <p className="text-[9px] text-white truncate">{s.headline}</p>
              </div>
            </div>
          );
        })}
      </div>

      {error && <ErrorBox msg={error} />}

      {!running && (
        <div className="flex gap-2">
          <button onClick={() => { setImages([]); startImages(); }}
            className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all">
            다시 생성
          </button>
          <button onClick={startHtml}
            className="flex-[2] py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-bold rounded-xl hover:from-pink-600 hover:to-rose-600 transition-all">
            HTML 카드뉴스 생성 →
          </button>
        </div>
      )}
    </div>
  );

  // ══ STEP 4: HTML 카드뉴스 ══
  if (step === 4) return (
    <div className="p-6 space-y-4">
      <StepBar />
      {running
        ? <Spinner label="에디토리얼 카드뉴스 생성 중..." sub="HTML + CSS 완성 중" gradient="from-pink-500 to-rose-500" />
        : htmlContent
          ? <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-gray-800">카드뉴스 완성!</p>
                  <p className="text-xs text-gray-400">{plan.slides.length}장 · {topic}</p>
                </div>
                <button onClick={downloadHtml}
                  className="flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-lg hover:bg-gray-700 transition-all shadow-sm">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  HTML 다운로드
                </button>
              </div>

              {/* 미리보기 — 카드 1장(1080×1350) 기준 scale 축소 */}
              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="px-3 py-2 bg-gray-800 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  </div>
                  <p className="text-[11px] text-gray-400 ml-1">에디토리얼 카드뉴스 미리보기 (1080×1350 축소)</p>
                </div>
                <div className="bg-gray-900" style={{ position: "relative", width: "100%", height: "370px", overflow: "hidden" }}>
                  <iframe
                    srcDoc={htmlContent}
                    style={{
                      border: "none",
                      width: "1080px",
                      height: "1350px",
                      display: "block",
                      transformOrigin: "top left",
                      transform: "scale(0.3)",
                      pointerEvents: "none",
                    }}
                    title="카드뉴스 미리보기"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>

              {error && <ErrorBox msg={error} />}

              <div className="flex gap-2">
                <button onClick={startHtml}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all">
                  다시 생성
                </button>
                <button onClick={reset}
                  className="flex-1 py-2.5 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-700 transition-all">
                  새 콘텐츠 만들기
                </button>
              </div>
            </>
          : error && <ErrorBox msg={error} onRetry={startHtml} />
      }
    </div>
  );

  return null;
}
