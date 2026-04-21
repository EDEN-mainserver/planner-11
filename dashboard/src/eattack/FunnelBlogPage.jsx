import { useState, useEffect } from "react";
import { callGemini } from "../utils/gemini";
import { buildFunnelPrompt } from "./funnelPrompts";

// ─── 레퍼런스 라이브러리 (localStorage) ───
const REF_STORAGE_KEY = "funnel_ref_styles";

function loadRefs() {
  try { return JSON.parse(localStorage.getItem(REF_STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function saveRefs(refs) {
  localStorage.setItem(REF_STORAGE_KEY, JSON.stringify(refs));
}
function nameFromUrl(url) {
  try {
    const u = new URL(url);
    // 네이버 블로그 → "네이버@아이디"
    const naverMatch = u.hostname.includes("naver") && u.pathname.match(/\/([^/?#]+)/);
    if (naverMatch) return `네이버 @${naverMatch[1]}`;
    // 그 외 → 도메인 + 첫 경로
    const path = u.pathname.replace(/\/$/, "").split("/").slice(1, 2).join("");
    return (u.hostname.replace("www.", "") + (path ? `/${path}` : "")).slice(0, 30);
  } catch { return url.slice(0, 30); }
}

// ─── 퍼널 단계 설정 ───
const FUNNEL_STAGES = [
  {
    key: "TOFU",
    label: "TOFU",
    sublabel: "인식",
    description: "아직 모르는 잠재고객에게 문제 인식 유도",
    color: "from-sky-400 to-blue-500",
    badge: "bg-sky-100 text-sky-700",
    border: "border-sky-300",
    ring: "ring-sky-400",
  },
  {
    key: "MOFU",
    label: "MOFU",
    sublabel: "관심",
    description: "비교 중인 고객에게 차별점 설득",
    color: "from-amber-400 to-orange-500",
    badge: "bg-amber-100 text-amber-700",
    border: "border-amber-300",
    ring: "ring-amber-400",
  },
  {
    key: "BOFU",
    label: "BOFU",
    sublabel: "구매결정",
    description: "망설이는 고객의 마지막 장벽 제거",
    color: "from-emerald-400 to-green-600",
    badge: "bg-emerald-100 text-emerald-700",
    border: "border-emerald-300",
    ring: "ring-emerald-400",
  },
];

// 전환 목표 옵션
const CONVERSION_GOALS = ["구매", "신청", "문의"];

// 블로그 플랫폼 옵션
const PLATFORMS = [
  { key: "naver", label: "네이버 블로그" },
  { key: "tistory", label: "티스토리" },
  { key: "brunch", label: "브런치" },
];

// ─── URL에서 텍스트 크롤링 ───
async function fetchRefFromUrl(rawUrl) {
  const url = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;

  // 네이버 블로그 — RSS 기반 크롤러 사용
  const naverMatch = url.match(/blog\.naver\.com\/([^/?#]+)/);
  if (naverMatch) {
    const blogId = naverMatch[1];
    const res = await fetch(`/api/naver-blog-crawl?blogId=${encodeURIComponent(blogId)}`);
    if (!res.ok) throw new Error((await res.json()).error || `오류 ${res.status}`);
    const data = await res.json();
    // 최근 글 최대 3개 본문 합치기
    const combined = (data.posts || [])
      .slice(0, 3)
      .map((p) => `[${p.title}]\n${p.content}`)
      .join('\n\n');
    if (!combined.trim()) throw new Error('글 내용을 가져오지 못했습니다.');
    return combined;
  }

  // 그 외 URL — 범용 크롤러
  const res = await fetch(`/api/crawl-url?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error((await res.json()).error || `오류 ${res.status}`);
  const data = await res.json();
  if (!data.text?.trim()) throw new Error('페이지에서 텍스트를 추출하지 못했습니다.');
  return data.text;
}

// ─── 초기 폼 상태 ───
const INITIAL_FORM = {
  productName: "",
  benefit1: "",
  benefit2: "",
  benefit3: "",
  target: "",
  conversionGoal: "구매",
  funnelStage: "TOFU",
  platform: "naver",
  refBlog: "",
};

// 마크다운 기호 제거 (AI가 무시하고 넣는 경우 대비)
function stripMarkdown(text) {
  if (!text) return text;
  return text
    .replace(/^#{1,6}\s+/gm, '')   // ## 제목
    .replace(/\*\*(.+?)\*\*/g, '$1') // **볼드**
    .replace(/\*(.+?)\*/g, '$1')    // *이탤릭*
    .replace(/^>\s+/gm, '')         // > 인용
    .replace(/^---+$/gm, '')        // ---
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // `코드`
    .trim();
}

// ─── 뒤로가기 버튼 ───
function BackButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15 18-6-6 6-6"/>
      </svg>
    </button>
  );
}

// ─── 퍼널 단계 선택 카드 ───
function FunnelStageCard({ stage, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left w-full
        ${selected
          ? `${stage.border} ring-2 ${stage.ring} bg-white shadow-md`
          : "border-gray-200 bg-white hover:border-gray-300"
        }`}
    >
      {/* 단계 뱃지 */}
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold mb-2 ${stage.badge}`}>
        <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${stage.color}`} />
        {stage.label} · {stage.sublabel}
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{stage.description}</p>
      {selected && (
        <div className={`absolute top-3 right-3 w-4 h-4 rounded-full bg-gradient-to-r ${stage.color} flex items-center justify-center`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
        </div>
      )}
    </button>
  );
}

// ─── 결과 섹션 렌더러 ───
function ResultSection({ section, index }) {
  return (
    <div className="mb-5">
      {section.heading && (
        <h4 className="font-semibold text-gray-800 text-sm mb-2 flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs flex items-center justify-center font-bold flex-shrink-0">
            {index + 1}
          </span>
          {section.heading}
        </h4>
      )}
      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap pl-7">
        {section.content}
      </p>
    </div>
  );
}

// ─── 메인 FunnelBlogPage ───
export default function FunnelBlogPage({ onBack }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { title, sections, cta, keywords }
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState(null);
  const [refs, setRefs] = useState(loadRefs);               // 저장된 레퍼런스 목록
  const [selectedRefId, setSelectedRefId] = useState(null); // 드롭다운 선택값
  const [editingRef, setEditingRef] = useState(null);        // 편집 중인 ref 로컬 복사본
  const [saveFlash, setSaveFlash] = useState(false);         // 저장 완료 애니메이션
  const [showUrlInput, setShowUrlInput] = useState(false);   // URL 입력 토글
  const [showPasteInput, setShowPasteInput] = useState(false); // 직접 붙여넣기 토글
  const [pasteText, setPasteText] = useState("");             // 붙여넣기 텍스트
  const [pasteName, setPasteName] = useState("");             // 붙여넣기 이름

  // 폼 필드 업데이트
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // refs 상태가 바뀌면 localStorage 동기화
  useEffect(() => { saveRefs(refs); }, [refs]);

  // 드롭다운에서 레퍼런스 선택
  const handleSelectRef = (id) => {
    if (!id) {
      setSelectedRefId(null);
      setEditingRef(null);
      setField("refBlog", "");
      return;
    }
    const ref = refs.find((r) => r.id === id);
    if (!ref) return;
    setSelectedRefId(id);
    setEditingRef({ ...ref });      // 편집용 로컬 복사본
    setField("refBlog", ref.text);
  };

  // 편집 필드 업데이트 (로컬만 — 저장 전까지 반영 안 됨)
  const setEditField = (key, val) => setEditingRef((prev) => ({ ...prev, [key]: val }));

  // 편집 내용 저장
  const handleSaveEdit = () => {
    if (!editingRef) return;
    setRefs((prev) => prev.map((r) => r.id === editingRef.id ? { ...editingRef } : r));
    setField("refBlog", editingRef.text);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1800);
  };

  // 레퍼런스 삭제
  const handleDeleteRef = () => {
    if (!selectedRefId) return;
    if (!window.confirm("이 레퍼런스를 삭제할까요?")) return;
    setRefs((prev) => prev.filter((r) => r.id !== selectedRefId));
    setSelectedRefId(null);
    setEditingRef(null);
    setField("refBlog", "");
  };

  // 현재 선택된 퍼널 단계 정보
  const selectedStage = FUNNEL_STAGES.find((s) => s.key === form.funnelStage);

  // ─── 직접 붙여넣기 저장 ───
  const handleSavePaste = () => {
    if (!pasteText.trim()) return;
    const newRef = {
      id: Date.now().toString(),
      name: pasteName.trim() || `직접입력 ${new Date().toLocaleDateString("ko-KR")}`,
      url: "",
      text: pasteText.trim(),
      savedAt: new Date().toISOString(),
    };
    setRefs((prev) => {
      const updated = [newRef, ...prev];
      saveRefs(updated);
      return updated;
    });
    setSelectedRefId(newRef.id);
    setEditingRef({ ...newRef });
    setField("refBlog", newRef.text);
    setPasteText("");
    setPasteName("");
    setShowPasteInput(false);
  };

  // ─── URL 크롤링 + 자동 저장 ───
  const handleFetchUrl = async () => {
    if (!urlInput.trim()) return;
    setUrlError(null);
    setUrlLoading(true);
    try {
      const rawUrl = urlInput.trim();
      const text = await fetchRefFromUrl(rawUrl);

      // localStorage에 저장
      const newRef = {
        id: Date.now().toString(),
        name: nameFromUrl(rawUrl),
        url: rawUrl,
        text,
        savedAt: new Date().toISOString(),
      };
      setRefs((prev) => {
        const updated = [newRef, ...prev];
        saveRefs(updated);
        return updated;
      });
      setSelectedRefId(newRef.id);
      setEditingRef({ ...newRef });
      setField("refBlog", text);
      setUrlInput("");
      setShowUrlInput(false);
    } catch (err) {
      setUrlError(err.message);
    } finally {
      setUrlLoading(false);
    }
  };

  // ─── AI 생성 ───
  const handleGenerate = async () => {
    const benefits = [form.benefit1, form.benefit2, form.benefit3].filter(Boolean);
    if (!form.productName || benefits.length === 0 || !form.target) {
      setError("상품명, 핵심 혜택(최소 1개), 타겟 고객을 입력해주세요.");
      return;
    }

    setError(null);
    setLoading(true);
    setResult(null);

    const prompt = buildFunnelPrompt(form.funnelStage, {
      productName: form.productName,
      benefits,
      target: form.target,
      conversionGoal: form.conversionGoal,
      platform: form.platform,
      refBlog: form.refBlog,
    });

    try {
      const raw = await callGemini(
        [{ role: "user", content: prompt }],
        "당신은 전문 퍼널 마케팅 블로그 작가입니다. 반드시 JSON 형식으로만 응답하세요."
      );

      // 코드블록 제거 후 JSON 파싱
      let clean = raw.trim();
      if (clean.startsWith("```")) {
        const lines = clean.split("\n");
        clean = lines.slice(1, lines[lines.length - 1].trim() === "```" ? -1 : undefined).join("\n");
      }
      const start = clean.indexOf("{");
      const end = clean.lastIndexOf("}");
      const parsed = JSON.parse(clean.slice(start, end + 1));
      // 마크다운 기호 후처리 (AI가 무시하고 넣는 경우 대비)
      parsed.title = stripMarkdown(parsed.title);
      parsed.cta = stripMarkdown(parsed.cta);
      parsed.sections = (parsed.sections || []).map((s) => ({
        heading: s.heading ? stripMarkdown(s.heading) : null,
        content: stripMarkdown(s.content),
      }));
      setResult(parsed);
    } catch (err) {
      setError(`생성 실패: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── 전체 글 복사 ───
  const handleCopy = () => {
    if (!result) return;
    const sections = result.sections
      .map((s) => (s.heading ? `${s.heading}\n\n${s.content}` : s.content))
      .join("\n\n");
    const fullText = `${result.title}\n\n${sections}\n\n${result.cta}`;
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ─── 재생성 ───
  const handleRegenerate = () => {
    setResult(null);
    handleGenerate();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-8">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <BackButton onClick={onBack} />
          <div>
            <h2 className="text-lg font-bold text-gray-900">전문 퍼널 블로그 글 셋팅</h2>
            <p className="text-sm text-gray-400">AI가 구매 전환을 유도하는 퍼널 구조의 블로그 글을 자동 생성합니다</p>
          </div>
        </div>

        {/* ════ 입력 폼 ════ */}
        {!result && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 space-y-6">

            {/* 상품/서비스명 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                상품 / 서비스명 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.productName}
                onChange={(e) => setField("productName", e.target.value)}
                placeholder="예: 온라인 마케팅 자동화 솔루션"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              />
            </div>

            {/* 핵심 혜택 3가지 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                핵심 혜택 <span className="text-gray-400 font-normal">(최대 3가지)</span>
                <span className="text-red-400 ml-1">*</span>
              </label>
              <div className="space-y-2">
                {[
                  { key: "benefit1", placeholder: "예: 하루 10분으로 콘텐츠 제작 완료" },
                  { key: "benefit2", placeholder: "예: 전환율 평균 3배 향상" },
                  { key: "benefit3", placeholder: "예: 비전문가도 즉시 사용 가능" },
                ].map((b, i) => (
                  <div key={b.key} className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-500 text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <input
                      type="text"
                      value={form[b.key]}
                      onChange={(e) => setField(b.key, e.target.value)}
                      placeholder={b.placeholder}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* 타겟 고객 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                타겟 고객 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.target}
                onChange={(e) => setField("target", e.target.value)}
                placeholder="예: 30대 직장인 여성, 소규모 쇼핑몰 운영자"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              />
            </div>

            {/* 전환 목표 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">전환 목표</label>
              <div className="flex gap-2">
                {CONVERSION_GOALS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => setField("conversionGoal", goal)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all
                      ${form.conversionGoal === goal
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>

            {/* 퍼널 단계 선택 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3">퍼널 단계</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {FUNNEL_STAGES.map((stage) => (
                  <FunnelStageCard
                    key={stage.key}
                    stage={stage}
                    selected={form.funnelStage === stage.key}
                    onClick={() => setField("funnelStage", stage.key)}
                  />
                ))}
              </div>
            </div>

            {/* 블로그 플랫폼 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">블로그 플랫폼</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setField("platform", p.key)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all
                      ${form.platform === p.key
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 레퍼런스 블로그 글 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700">
                  레퍼런스 블로그 글
                  <span className="ml-2 text-xs font-normal text-gray-400">선택사항 — 말투·흐름을 AI가 참고합니다</span>
                </label>
                <div className="flex items-center gap-2">
                  {/* 직접 붙여넣기 토글 */}
                  <button
                    type="button"
                    onClick={() => { setShowPasteInput((v) => !v); setShowUrlInput(false); }}
                    className="inline-flex items-center gap-1 text-xs text-violet-500 hover:text-violet-700 font-medium transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {showPasteInput ? <path d="M18 6 6 18M6 6l12 12"/> : <><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/></>}
                    </svg>
                    {showPasteInput ? "닫기" : "직접 입력"}
                  </button>
                  {/* URL로 새로 추가 토글 */}
                  <button
                    type="button"
                    onClick={() => { setShowUrlInput((v) => !v); setUrlError(null); setShowPasteInput(false); }}
                    className="inline-flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700 font-medium transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {showUrlInput ? <path d="M18 6 6 18M6 6l12 12"/> : <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>}
                    </svg>
                    {showUrlInput ? "닫기" : "URL로 추가"}
                  </button>
                </div>
              </div>

              {/* URL 입력 (토글) */}
              {showUrlInput && (
                <div className="mb-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">블로그 URL을 입력하면 말투·흐름을 자동 분석해서 저장합니다</p>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => { setUrlInput(e.target.value); setUrlError(null); }}
                      onKeyDown={(e) => e.key === "Enter" && handleFetchUrl()}
                      placeholder="https://blog.naver.com/아이디"
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={handleFetchUrl}
                      disabled={!urlInput.trim() || urlLoading}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 flex-shrink-0
                        ${!urlInput.trim() || urlLoading
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-gray-900 text-white hover:bg-gray-700"
                        }`}
                    >
                      {urlLoading
                        ? <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                        : null}
                      {urlLoading ? "분석 중..." : "불러오기"}
                    </button>
                  </div>
                  {urlError && <p className="text-xs text-red-500 mt-1.5">{urlError}</p>}
                </div>
              )}

              {/* 드롭다운 선택 */}
              <div className="flex gap-2 items-center mb-3">
                <div className="relative flex-1">
                  <select
                    value={selectedRefId || ""}
                    onChange={(e) => handleSelectRef(e.target.value || null)}
                    className="w-full appearance-none border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition pr-9 text-gray-700"
                  >
                    <option value="">— 저장된 레퍼런스 선택 —</option>
                    {refs.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m6 9 6 6 6-6"/>
                  </svg>
                </div>
                {selectedRefId && (
                  <button
                    type="button"
                    onClick={handleDeleteRef}
                    className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition-all"
                    title="삭제"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* 편집 패널 — 선택된 경우 */}
              {editingRef && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {/* 이름 편집 */}
                  <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 flex-shrink-0">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
                    </svg>
                    <input
                      type="text"
                      value={editingRef.name}
                      onChange={(e) => setEditField("name", e.target.value)}
                      className="flex-1 text-sm font-medium text-gray-700 bg-transparent focus:outline-none"
                      placeholder="레퍼런스 이름"
                    />
                    {editingRef.url && (
                      <a href={editingRef.url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-600 transition-colors truncate max-w-[160px]"
                      >
                        {editingRef.url.replace(/^https?:\/\//, "").slice(0, 30)}
                      </a>
                    )}
                  </div>

                  {/* 본문 편집 */}
                  <div className="relative">
                    <textarea
                      value={editingRef.text}
                      onChange={(e) => {
                        setEditField("text", e.target.value);
                        setField("refBlog", e.target.value); // 실시간 반영
                      }}
                      rows={8}
                      className="w-full px-4 py-3 text-sm text-gray-600 leading-relaxed resize-none focus:outline-none"
                      placeholder="레퍼런스 텍스트를 직접 편집할 수 있습니다"
                    />
                    <span className="absolute bottom-2 right-3 text-xs text-gray-300 pointer-events-none">
                      {editingRef.text.length.toLocaleString()}자
                    </span>
                  </div>

                  {/* 저장 버튼 */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-t border-gray-200">
                    <span className={`text-xs transition-all duration-300 ${saveFlash ? "text-emerald-500" : "text-gray-400"}`}>
                      {saveFlash ? "✓ 저장됨" : "수정 후 저장하세요"}
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="px-4 py-1.5 bg-gray-900 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      저장
                    </button>
                  </div>
                </div>
              )}

              {/* 레퍼런스 없을 때 안내 */}
              {!editingRef && refs.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-3">
                  URL로 추가하면 다음에도 선택해서 재사용할 수 있습니다
                </p>
              )}
            </div>

            {/* 에러 */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            {/* 생성 버튼 */}
            <button
              onClick={handleGenerate}
              disabled={loading}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all
                ${loading
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : `bg-gradient-to-r ${selectedStage?.color || "from-blue-500 to-cyan-600"} text-white hover:opacity-90 active:scale-[0.98] shadow-md`
                }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  AI가 글을 작성 중입니다...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a10 10 0 1 0 10 10"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/>
                  </svg>
                  AI 블로그 글 생성하기
                </span>
              )}
            </button>
          </div>
        )}

        {/* ════ 결과 출력 ════ */}
        {result && (
          <div className="space-y-4">

            {/* 결과 헤더 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${selectedStage?.badge}`}>
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${selectedStage?.color}`} />
                  {selectedStage?.label} · {selectedStage?.sublabel}
                </span>
                <span className="text-sm text-gray-400">{PLATFORMS.find((p) => p.key === form.platform)?.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* 재생성 */}
                <button
                  onClick={handleRegenerate}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-300 hover:text-gray-700 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
                  </svg>
                  재생성
                </button>
                {/* 설정으로 돌아가기 */}
                <button
                  onClick={() => setResult(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs font-medium hover:border-gray-300 hover:text-gray-700 transition-all"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                  설정 수정
                </button>
              </div>
            </div>

            {/* 에러 (재생성 중) */}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* 로딩 오버레이 (재생성 중) */}
            {loading && (
              <div className="bg-white rounded-2xl border border-gray-200 p-10 flex flex-col items-center justify-center gap-3">
                <svg className="animate-spin w-8 h-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                <p className="text-sm text-gray-500">AI가 글을 다시 작성 중입니다...</p>
              </div>
            )}

            {/* 결과 카드 */}
            {!loading && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">

                {/* 제목 */}
                <div className="mb-6 pb-5 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">제목 (SEO 최적화)</p>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 leading-snug">{result.title}</h3>
                </div>

                {/* 본문 섹션 */}
                <div className="mb-6 pb-5 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">본문</p>
                  {result.sections?.map((section, i) => (
                    <ResultSection key={i} section={section} index={i} />
                  ))}
                </div>

                {/* CTA */}
                <div className="mb-6 pb-5 border-b border-gray-100">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">CTA</p>
                  <div className={`bg-gradient-to-r ${selectedStage?.color} rounded-xl p-4`}>
                    <p className="text-white font-semibold text-sm">{result.cta}</p>
                  </div>
                </div>

                {/* 키워드 */}
                {result.keywords?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">추천 키워드</p>
                    <div className="flex flex-wrap gap-2">
                      {result.keywords.map((kw, i) => (
                        <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">
                          #{kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 복사 버튼 */}
            {!loading && (
              <button
                onClick={handleCopy}
                className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2
                  ${copied
                    ? "bg-green-500 text-white"
                    : "bg-gray-900 text-white hover:bg-gray-800 active:scale-[0.98]"
                  }`}
              >
                {copied ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5"/>
                    </svg>
                    복사 완료!
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
                    </svg>
                    전체 글 복사
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
