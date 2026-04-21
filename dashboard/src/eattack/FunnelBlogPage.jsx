import { useState } from "react";
import { callGemini } from "../utils/gemini";
import { buildFunnelPrompt } from "./funnelPrompts";

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

  // 폼 필드 업데이트
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // 현재 선택된 퍼널 단계 정보
  const selectedStage = FUNNEL_STAGES.find((s) => s.key === form.funnelStage);

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
      .map((s) => (s.heading ? `## ${s.heading}\n\n${s.content}` : s.content))
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
