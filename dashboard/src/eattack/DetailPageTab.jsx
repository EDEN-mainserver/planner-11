/**
 * 상세페이지 만들기 탭
 * 흐름: 제품 정보 입력 → AI 섹션 기획 → 이미지 생성 → MD 다운로드
 */
import { useState } from "react";
import { callGemini, generateImage } from "../utils/gemini";

// ── 상수 ──
const LS_KEY = "eden_detail_page_v1";

const CATEGORY_OPTIONS = [
  "뷰티/스킨케어", "건강식품/다이어트", "의류/패션", "전자기기", "생활용품",
  "식품/음료", "육아/유아용품", "반려동물", "스포츠/레저", "서비스/강의",
];

const DETAIL_SECTIONS = [
  { key: "hook",         title: "후킹 헤드라인",    desc: "강렬한 첫인상 — 헤드라인 + 서브카피" },
  { key: "pain",         title: "공감 섹션",        desc: "고객 페인포인트 3~5개 공감 유도" },
  { key: "solution",     title: "솔루션 소개",      desc: "제품이 문제를 해결하는 방식" },
  { key: "features",    title: "핵심 특장점",      desc: "차별화 포인트 3~5개" },
  { key: "howto",       title: "사용 방법",        desc: "3단계 사용법 안내" },
  { key: "before_after", title: "사용 전/후",      desc: "Before & After 비교 카피" },
  { key: "reviews",     title: "고객 후기",        desc: "설득력 있는 후기 예시 3개" },
  { key: "faq",         title: "자주 묻는 질문",   desc: "Q&A 3~4개" },
  { key: "cta",         title: "최종 CTA",         desc: "구매 전환 유도 카피 + 긴급성 요소" },
];

// 이미지 슬롯 정의
const IMAGE_SLOTS = [
  { key: "hero",       label: "메인 비주얼",      aspect: "1:1",  hint: "제품 단독 촬영, 클린 배경" },
  { key: "lifestyle",  label: "라이프스타일",     aspect: "3:4",  hint: "실제 사용 장면, 감성적 연출" },
  { key: "feature1",   label: "특장점 이미지 1",  aspect: "1:1",  hint: "핵심 성분 또는 기술 시각화" },
  { key: "feature2",   label: "특장점 이미지 2",  aspect: "1:1",  hint: "효능/효과 비주얼" },
  { key: "feature3",   label: "특장점 이미지 3",  aspect: "1:1",  hint: "타겟 고객 공감 이미지" },
];

const SYSTEM_PROMPT = `
당신은 10년차 퍼포먼스 마케터이자 쇼핑몰 상세페이지 전문 카피라이터입니다.
고객 심리, 구매 전환, 설득 카피라이팅에 깊은 전문성을 보유합니다.
AIDA / PAS / FAB 프레임워크를 자유자재로 구사하며, 한국 이커머스 시장에 최적화된 글쓰기를 합니다.
반드시 한국어로 답변하세요.
`.trim();

// 로컬스토리지 저장/로드
function saveDraft(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
}
function loadDraft() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch { return null; }
}

// 섹션별 프롬프트 빌더
function buildSectionPrompt(sectionKey, info) {
  const base = `
## 제품 정보
- 제품/서비스명: ${info.productName}
- 카테고리: ${info.category}
- 핵심 소구점(USP): ${info.usp}
- 타겟 고객: ${info.target}
- 가격대: ${info.price || "미입력"}
- 추가 정보: ${info.extra || "없음"}
`;

  const guides = {
    hook: `
위 제품의 **후킹 헤드라인 섹션**을 작성하세요.

출력 형식:
### 메인 헤드라인
(10~20자, 임팩트 있게, 숫자·감정·금지 등 후킹 요소 포함)

### 서브 카피 1
### 서브 카피 2
### 서브 카피 3

💡 카피 전략 한 줄 설명:
`,
    pain: `
위 제품 타겟 고객의 **페인포인트 공감 섹션**을 작성하세요. PAS 구조 활용.

출력 형식:
### 섹션 제목 (공감을 유도하는 질문형)

**Pain Point 1:** (구체적인 상황 묘사, 1~2줄)
**Pain Point 2:** (구체적인 상황 묘사, 1~2줄)
**Pain Point 3:** (구체적인 상황 묘사, 1~2줄)
**Pain Point 4:** (선택, 1~2줄)
**Pain Point 5:** (선택, 1~2줄)

> 공감 마무리 문장 (독자가 "맞아!" 하게 만드는 한 줄)
`,
    solution: `
위 제품이 고객 문제를 **어떻게 해결하는지** 솔루션 소개 섹션을 작성하세요.

출력 형식:
### 섹션 제목 (해결사로서의 포지셔닝)

**핵심 솔루션:** (2~3줄, 제품의 차별화된 해결 메커니즘)

**왜 이 제품인가:**
- 이유 1
- 이유 2
- 이유 3

> 한 줄 임팩트 메시지:
`,
    features: `
위 제품의 **핵심 특장점 섹션**을 FAB(Feature-Advantage-Benefit) 구조로 작성하세요.

출력 형식:
### 섹션 제목

**특장점 1 제목** (아이콘 이모지 포함)
- Feature: (기능/특징)
- Advantage: (경쟁 대비 장점)
- Benefit: (고객이 얻는 실질적 혜택)

**특장점 2 제목** ... (동일 구조, 총 3~5개)
`,
    howto: `
위 제품의 **사용 방법 섹션**을 3단계로 작성하세요.

출력 형식:
### 섹션 제목 (간단함을 강조)

**STEP 1.** 제목
설명 (1~2줄)

**STEP 2.** 제목
설명 (1~2줄)

**STEP 3.** 제목
설명 (1~2줄)

> 마무리 한 줄 (쉬움을 재확인)
`,
    before_after: `
위 제품의 **사용 전/후 비교 섹션**을 작성하세요.

출력 형식:
### 섹션 제목

| Before (사용 전) | After (사용 후) |
|---|---|
| 문제 상황 1 | 개선 결과 1 |
| 문제 상황 2 | 개선 결과 2 |
| 문제 상황 3 | 개선 결과 3 |

> 변화를 강조하는 한 줄 카피:
`,
    reviews: `
위 제품의 **고객 후기 섹션**을 작성하세요.

출력 형식:
### 섹션 제목 (숫자 포함: "OOO명이 선택한")

**후기 1** — [닉네임, 나이/직업]
⭐⭐⭐⭐⭐
"(구체적 상황 + 구체적 결과가 담긴 후기, 2~3줄)"

**후기 2** — [닉네임] (동일 형식)

**후기 3** — [닉네임] (동일 형식)

> 후기 섹션 마무리 통계/수치:
`,
    faq: `
위 제품의 **자주 묻는 질문(FAQ) 섹션**을 작성하세요.

출력 형식:
### 자주 묻는 질문

**Q1.** (구매 전 가장 궁금해할 것)
**A1.** (명확하고 안심을 주는 답변)

**Q2.** (배송/환불 관련)
**A2.**

**Q3.** (사용 방법/효과 관련)
**A3.**

**Q4.** (선택, 경쟁 제품 비교 관련)
**A4.**
`,
    cta: `
위 제품의 **최종 CTA 섹션**을 작성하세요.

출력 형식:
### 메인 CTA 헤드라인 (지금 당장 사야 하는 이유)

**긴급성/희소성 요소:**
(한정 수량, 기간 한정, 특가 등)

**구매 버튼 카피:**
(클릭을 유도하는 버튼 텍스트 3가지 옵션)

**구매 후 안심 요소:**
- 안심 요소 1 (환불정책 등)
- 안심 요소 2
- 안심 요소 3

> 마지막 설득 한 줄:
`,
  };

  return `${base}\n---\n${guides[sectionKey]}`.trim();
}

// 이미지 프롬프트 빌더
function buildImagePrompt(slotKey, info) {
  const cat = info.category || "product";
  const name = info.productName;
  const target = info.target;

  const prompts = {
    hero: `Professional product photography of ${name}, ${cat} product, clean white background, studio lighting, high-end commercial shot, no text, no watermark, photorealistic`,
    lifestyle: `Lifestyle photography showing ${target} using ${name}, ${cat}, natural light, warm aesthetic, Korean style, editorial look, no text, no watermark, photorealistic`,
    feature1: `Close-up macro shot of ${name} key ingredient or technology, ${cat}, clean composition, soft lighting, no text, no watermark, photorealistic`,
    feature2: `Before and after visual concept for ${name}, split composition showing transformation, ${cat}, clean modern design, no text, no watermark, photorealistic`,
    feature3: `Portrait of Korean ${target} looking satisfied and confident, lifestyle context, warm tones, natural expression, no text, no watermark, photorealistic`,
  };
  return prompts[slotKey] || `${name} product photo, photorealistic, no text`;
}

// ── 메인 컴포넌트 ──
export default function DetailPageTab() {
  const [step, setStep] = useState("input");

  const [info, setInfo] = useState({
    productName: "", category: "", usp: "", target: "", price: "", extra: "",
  });

  const [sectionProgress, setSectionProgress] = useState(0);
  const [error, setError] = useState("");

  const [sections, setSections] = useState([]);
  const [activeSection, setActiveSection] = useState(null);

  // 이미지 상태: { [slotKey]: { url, loading, error } }
  const [images, setImages] = useState({});

  function setField(key, val) {
    setInfo(prev => ({ ...prev, [key]: val }));
  }

  function setImageState(key, patch) {
    setImages(prev => ({ ...prev, [key]: { ...(prev[key] || {}), ...patch } }));
  }

  // ── 텍스트 섹션 생성 ──
  async function handleGenerate() {
    if (!info.productName.trim() || !info.usp.trim() || !info.target.trim()) return;
    setError("");
    setStep("generating");
    setSectionProgress(0);

    const results = [];
    try {
      for (let i = 0; i < DETAIL_SECTIONS.length; i++) {
        setSectionProgress(i);
        const sec = DETAIL_SECTIONS[i];
        const prompt = buildSectionPrompt(sec.key, info);
        const content = await callGemini([{ role: "user", content: prompt }], SYSTEM_PROMPT);
        results.push({ key: sec.key, title: sec.title, content });
      }
      setSections(results);
      setImages({});
      saveDraft({ info, sections: results });
      setActiveSection(results[0]?.key || null);
      setStep("result");
    } catch (e) {
      setError(e.message);
      setStep("input");
    }
  }

  // ── 이미지 단건 생성 ──
  async function handleGenerateImage(slotKey) {
    setImageState(slotKey, { loading: true, error: null });
    try {
      const slot = IMAGE_SLOTS.find(s => s.key === slotKey);
      const prompt = buildImagePrompt(slotKey, info);
      const url = await generateImage(prompt, slot.aspect);
      setImageState(slotKey, { url, loading: false, error: null });
    } catch (e) {
      setImageState(slotKey, { loading: false, error: e.message });
    }
  }

  // ── 전체 이미지 생성 ──
  async function handleGenerateAllImages() {
    for (const slot of IMAGE_SLOTS) {
      await handleGenerateImage(slot.key);
    }
  }

  // 이미지 다운로드
  function downloadImage(url, label) {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${info.productName}_${label}_${Date.now()}.png`;
    a.click();
  }

  function updateSection(key, newContent) {
    setSections(prev => {
      const next = prev.map(s => s.key === key ? { ...s, content: newContent } : s);
      saveDraft({ info, sections: next });
      return next;
    });
  }

  function handleDownload() {
    const md = sections.map(s => `# ${s.title}\n\n${s.content}`).join("\n\n---\n\n");
    const full = `# 상세페이지 기획안 — ${info.productName}\n\n${md}`;
    const blob = new Blob([full], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `상세페이지_${info.productName}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function handleCopy() {
    const md = sections.map(s => `# ${s.title}\n\n${s.content}`).join("\n\n---\n\n");
    navigator.clipboard.writeText(md);
    alert("클립보드에 복사되었습니다.");
  }

  function handleLoadDraft() {
    const draft = loadDraft();
    if (!draft) return;
    setInfo(draft.info || info);
    setSections(draft.sections || []);
    setImages({});
    setActiveSection(draft.sections?.[0]?.key || null);
    setStep("result");
  }

  const draft = loadDraft();
  const canGenerate = info.productName.trim() && info.usp.trim() && info.target.trim();
  const currentSection = sections.find(s => s.key === activeSection);
  const anyImageLoading = IMAGE_SLOTS.some(s => images[s.key]?.loading);

  return (
    <div className="p-6 max-w-3xl mx-auto">

      {/* ── Step: input ── */}
      {step === "input" && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
              </svg>
            </div>
            <div>
              <h4 className="text-base font-bold text-gray-800">상세페이지 만들기</h4>
              <p className="text-xs text-gray-400">제품 정보 입력 → 9개 섹션 카피 + 5장 이미지 자동 생성</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              제품/서비스명 <span className="text-orange-500">*</span>
            </label>
            <input type="text" value={info.productName}
              onChange={e => setField("productName", e.target.value)}
              placeholder="예: 다크서클 집중 개선 아이크림"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">카테고리</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map(cat => (
                <button key={cat} onClick={() => setField("category", cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    info.category === cat ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              핵심 소구점 (USP) <span className="text-orange-500">*</span>
              <span className="ml-1 text-xs font-normal text-gray-400">경쟁 제품과 다른 차별화 포인트</span>
            </label>
            <textarea value={info.usp} onChange={e => setField("usp", e.target.value)} rows={3}
              placeholder={"예:\n- 레티놀 0.1% + 나이아신아마이드 5% 고농도 복합 처방\n- 무향·무색소 민감성 피부 전용\n- 피부과 임상 완료 (8주 사용 후 다크서클 42% 개선)"}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              타겟 고객 <span className="text-orange-500">*</span>
            </label>
            <input type="text" value={info.target} onChange={e => setField("target", e.target.value)}
              placeholder="예: 30대 직장여성, 수면 부족으로 다크서클 고민, 자연주의 뷰티 관심"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">가격대</label>
              <input type="text" value={info.price} onChange={e => setField("price", e.target.value)}
                placeholder="예: 39,000원"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">추가 정보</label>
              <input type="text" value={info.extra} onChange={e => setField("extra", e.target.value)}
                placeholder="예: 비건 인증, 제주 원료"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
              />
            </div>
          </div>

          {/* 생성 미리보기 */}
          <div className="p-4 rounded-xl bg-orange-50 border border-orange-100">
            <p className="text-xs font-semibold text-orange-700 mb-2">생성 항목</p>
            <div className="flex flex-wrap gap-1.5">
              {DETAIL_SECTIONS.map((sec, i) => (
                <span key={sec.key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-white border border-orange-200 text-orange-600">
                  <span className="font-bold">{i + 1}</span> {sec.title}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-white border border-amber-300 text-amber-700 font-medium">
                + 이미지 5장 (별도 생성)
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleGenerate} disabled={!canGenerate}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              상세페이지 기획 시작
            </button>
            {draft && (
              <button onClick={handleLoadDraft}
                className="px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-500 hover:bg-gray-50 transition-all"
              >
                이전 초안
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Step: generating ── */}
      {step === "generating" && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-5 shadow-lg animate-pulse">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">상세페이지 기획 중...</p>
          <p className="text-xs text-gray-500 mt-2">
            섹션 {sectionProgress + 1} / {DETAIL_SECTIONS.length}:{" "}
            <span className="font-medium text-orange-500">{DETAIL_SECTIONS[sectionProgress]?.title}</span> 작성 중
          </p>
          <div className="mt-5 w-48 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-400 to-amber-400 rounded-full transition-all duration-500"
              style={{ width: `${((sectionProgress + 1) / DETAIL_SECTIONS.length) * 100}%` }}
            />
          </div>
          <div className="mt-4 flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-2 h-2 rounded-full bg-orange-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      )}

      {/* ── Step: result ── */}
      {step === "result" && (
        <div className="space-y-6">

          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-base font-bold text-gray-800">상세페이지 기획안</h4>
              <p className="text-xs text-gray-400">{info.productName}</p>
            </div>
            <button onClick={() => { setStep("input"); setError(""); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              다시 만들기
            </button>
          </div>

          {/* ── 이미지 생성 섹션 ── */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-amber-100">
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                </svg>
                <span className="text-sm font-bold text-amber-800">상세페이지 이미지 생성</span>
                <span className="text-xs text-amber-600">— Imagen AI · {IMAGE_SLOTS.length}장</span>
              </div>
              <button
                onClick={handleGenerateAllImages}
                disabled={anyImageLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {anyImageLoading ? (
                  <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                )}
                전체 생성
              </button>
            </div>

            <div className="p-4 grid grid-cols-5 gap-3">
              {IMAGE_SLOTS.map(slot => {
                const img = images[slot.key];
                return (
                  <div key={slot.key} className="flex flex-col gap-1.5">
                    {/* 이미지 박스 */}
                    <div
                      className="relative rounded-lg overflow-hidden bg-white border border-amber-200"
                      style={{ aspectRatio: slot.aspect === "3:4" ? "3/4" : "1/1" }}
                    >
                      {img?.url ? (
                        <>
                          <img src={img.url} alt={slot.label} className="w-full h-full object-cover" />
                          <button
                            onClick={() => downloadImage(img.url, slot.label)}
                            className="absolute bottom-1 right-1 w-6 h-6 rounded-md bg-black/60 flex items-center justify-center hover:bg-black/80 transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                          </button>
                        </>
                      ) : img?.loading ? (
                        <div className="w-full h-full flex items-center justify-center bg-amber-50">
                          <svg className="animate-spin text-amber-400" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                          </svg>
                        </div>
                      ) : img?.error ? (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-red-50 p-1">
                          <span className="text-[9px] text-red-400 text-center leading-tight">{img.error.slice(0, 40)}</span>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-gray-50">
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5">
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* 라벨 + 생성 버튼 */}
                    <p className="text-[10px] text-amber-700 font-medium text-center leading-tight">{slot.label}</p>
                    <button
                      onClick={() => handleGenerateImage(slot.key)}
                      disabled={img?.loading || anyImageLoading}
                      className="w-full py-1 rounded-md text-[10px] font-semibold border border-amber-300 text-amber-700 bg-white hover:bg-amber-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {img?.url ? "재생성" : "생성"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 텍스트 섹션 탭 ── */}
          <div>
            <p className="text-xs font-semibold text-gray-500 mb-2">섹션 카피 ({sections.length}개)</p>
            <div className="flex gap-1.5 flex-wrap">
              {sections.map((sec, i) => (
                <button key={sec.key} onClick={() => setActiveSection(sec.key)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeSection === sec.key
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span className={`text-[10px] ${activeSection === sec.key ? "text-orange-200" : "text-gray-400"}`}>{i + 1}</span>
                  {sec.title}
                </button>
              ))}
            </div>
          </div>

          {/* 섹션 편집기 */}
          {currentSection && (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-orange-50 border-b border-orange-100">
                <span className="w-5 h-5 rounded-md bg-orange-100 flex items-center justify-center text-[10px] font-bold text-orange-600">
                  {sections.findIndex(s => s.key === activeSection) + 1}
                </span>
                <span className="text-sm font-semibold text-gray-700">{currentSection.title}</span>
                <span className="text-xs text-gray-400">— {DETAIL_SECTIONS.find(s => s.key === activeSection)?.desc}</span>
              </div>
              <textarea
                value={currentSection.content}
                onChange={e => updateSection(activeSection, e.target.value)}
                rows={Math.max(8, currentSection.content.split("\n").length + 2)}
                className="w-full px-4 py-3 text-sm text-gray-700 leading-relaxed focus:outline-none resize-y"
              />
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex gap-3">
            <button onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold shadow-md hover:shadow-lg transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              MD 다운로드
            </button>
            <button onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              전체 복사
            </button>
            <button onClick={handleGenerate}
              className="flex items-center gap-2 px-4 py-3 rounded-xl border border-orange-200 text-sm text-orange-600 hover:bg-orange-50 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
              </svg>
              재생성
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
