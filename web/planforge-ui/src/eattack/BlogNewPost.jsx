import { useState } from "react";
import { callGemini } from "../utils/gemini";

// ─── 콘텐츠 타입 정의 ───
const CONTENT_TYPES = [
  {
    key: "pulling",
    label: "풀링 콘텐츠",
    desc: "공감형 유입 콘텐츠",
    funnel: ["노출", "클릭"],
    color: "blue",
    gradient: "from-blue-500 to-cyan-500",
    detail: "독자의 불편함·결핍·고민을 건드려 자연스럽게 유입시키는 콘텐츠입니다. SEO 최적화된 정보형 글로 노출을 극대화합니다.",
    titleHints: ["왜 ~할까?", "~하면 생기는 문제", "~하는 사람들의 공통점", "솔직히 말하는 ~의 현실"],
  },
  {
    key: "key",
    label: "키 콘텐츠",
    desc: "전환 유도 콘텐츠",
    funnel: ["유입", "전환"],
    color: "purple",
    gradient: "from-purple-500 to-violet-500",
    detail: "풀링 콘텐츠로 유입된 독자를 구매·상담·신청으로 전환시키는 콘텐츠입니다. 솔루션 제시와 CTA가 핵심입니다.",
    titleHints: ["~를 해결하는 3가지 방법", "~하고 싶다면 지금 당장", "~의 진짜 해결책", "전문가가 알려주는 ~"],
  },
];

// ─── 퍼널 단계 ───
const FUNNEL_STAGES = ["노출", "클릭", "유입", "전환"];


// HTML 태그 제거
function stripHtml(str) {
  return str.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim();
}

// 블로그 검색 결과에서 키워드 추출 (빈도 기반)
function extractKeywordsFromTitles(titles) {
  const STOP_WORDS = new Set([
    "이", "가", "은", "는", "을", "를", "의", "에", "에서", "로", "으로", "와", "과",
    "도", "만", "이나", "이고", "하고", "하여", "하는", "있는", "없는", "한", "하기",
    "위한", "대한", "통한", "위해", "때문에", "그리고", "하지만", "그러나", "또한",
    "등", "및", "할", "수", "있", "없", "것", "때", "후", "전", "더", "가장",
    "이것", "저것", "어떻게", "무엇", "왜", "어디", "언제", "누가",
  ]);

  const freq = {};
  for (const title of titles) {
    // 한국어 단어 (2글자 이상) 및 영문 단어 추출
    const words = title.match(/[가-힣]{2,}|[A-Za-z]{3,}/g) || [];
    for (const w of words) {
      if (STOP_WORDS.has(w)) continue;
      freq[w] = (freq[w] || 0) + 1;
    }
  }

  return Object.entries(freq)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) => word);
}


// ─── 메인 컴포넌트 ───
export default function BlogNewPost({ onBack, onGenerate }) {
  const [contentType, setContentType] = useState("pulling");
  const [serviceDesc, setServiceDesc] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [topic, setTopic] = useState("");
  const [keywords, setKeywords] = useState([]);
  const [selectedKeywords, setSelectedKeywords] = useState([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [isLoadingKeywords, setIsLoadingKeywords] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState("");
  const [error, setError] = useState("");
  const [naverKeywords, setNaverKeywords] = useState([]);
  const [isNaverLoading, setIsNaverLoading] = useState(false);
  const [naverStatus, setNaverStatus] = useState(""); // 'ok' | 'fallback' | 'error'
  const [trendScores, setTrendScores] = useState({}); // { 키워드: 점수(0~100) }
  const [isLoadingTrends, setIsLoadingTrends] = useState(false);

  const selectedType = CONTENT_TYPES.find((t) => t.key === contentType);
  const canGenerate = serviceDesc.trim().length > 0 && selectedKeywords.length > 0;

  // ─── 네이버 데이터랩 기반 키워드 리서치 ───
  // ① AI로 후보 키워드 생성 → ② DataLab으로 실제 검색량 검증 → ③ 점수순 정렬
  const handleNaverKeywords = async () => {
    if (!serviceDesc.trim()) {
      setError("서비스/상품 설명을 먼저 입력해 주세요.");
      return;
    }
    setError("");
    setIsNaverLoading(true);
    setNaverStatus("");
    setNaverKeywords([]);
    setTrendScores({});

    try {
      // Step 1: AI로 후보 키워드 15개 생성
      const prompt = `"${serviceDesc}" 서비스/상품을 네이버에서 검색할 때 실제로 사용할 법한 키워드 15개를 추천해줘.
타겟: ${targetAudience || "잠재 고객"}
조건: 2~6글자, 검색량 높을 것, 한국어 위주
JSON 배열만 반환: ["키워드1", "키워드2", ...]`;

      const result = await callGemini(
        [{ role: "user", content: prompt }],
        "네이버 SEO 전문가로서 실제 검색량이 높은 키워드를 추천합니다."
      );
      const arrMatch = result.match(/\[[\s\S]*?\]/);
      if (!arrMatch) throw new Error("키워드 생성 실패");
      const candidates = JSON.parse(arrMatch[0]).filter((v) => typeof v === "string").slice(0, 15);

      // Step 2: DataLab으로 실제 검색량 점수 조회
      const resp = await fetch('/api/naver-datalab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: candidates }),
      });
      const data = await resp.json();

      if (data.error === 'NAVER_NOT_CONFIGURED') {
        // DataLab 미설정 시 → AI 후보만 표시
        setNaverKeywords(candidates);
        setNaverStatus("fallback");
        return;
      }

      if (!resp.ok) throw new Error(data.error);

      // Step 3: 점수순 정렬된 키워드 + 점수맵 저장
      const scoreMap = {};
      const sorted = (data.results || []).map(({ keyword, score }) => {
        scoreMap[keyword] = score;
        return keyword;
      });

      // 점수 0인 키워드도 포함 (검색량 낮아도 후보로 제공)
      const finalList = sorted.length > 0 ? sorted : candidates;
      setNaverKeywords(finalList);
      setTrendScores(scoreMap);
      setNaverStatus("ok");

    } catch (e) {
      setError("키워드 리서치 중 오류가 발생했습니다: " + e.message);
      setNaverStatus("error");
    } finally {
      setIsNaverLoading(false);
    }
  };

  // ─── 데이터랩 검색량 트렌드 조회 ───
  const fetchTrendScores = async (kwList) => {
    if (!kwList || kwList.length === 0) return;
    setIsLoadingTrends(true);
    try {
      const resp = await fetch('/api/naver-datalab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keywords: kwList }),
      });
      const data = await resp.json();
      if (data.error === 'NAVER_NOT_CONFIGURED') return;
      if (!resp.ok) throw new Error(data.error);

      const scoreMap = {};
      for (const { keyword, score } of (data.results || [])) {
        scoreMap[keyword] = score;
      }
      setTrendScores((prev) => ({ ...prev, ...scoreMap }));
    } catch {
      // 트렌드 조회 실패 시 무시 (선택 기능)
    } finally {
      setIsLoadingTrends(false);
    }
  };

  // ─── AI 키워드 추천 (분류형) ───
  const handleAIKeywords = async () => {
    if (!serviceDesc.trim()) {
      setError("서비스/상품 설명을 먼저 입력해 주세요.");
      return;
    }
    setError("");
    setIsLoadingKeywords(true);
    try {
      const prompt = `다음 서비스/상품에 대한 네이버 블로그 SEO 최적화 키워드를 추천해줘.

서비스/상품: ${serviceDesc}
타겟 고객: ${targetAudience || "미입력"}
콘텐츠 목적: ${contentType === "pulling" ? "공감형 유입 (노출·클릭 극대화)" : "전환 유도 (유입→전환 최적화)"}

다음 JSON 형식으로 정확히 반환해. 설명 없이 JSON만:
{
  "primary": ["핵심 키워드 4개"],
  "long_tail": ["롱테일 키워드 6개"],
  "pain_point": ["고통 포인트 키워드 4개"]
}`;

      const result = await callGemini(
        [{ role: "user", content: prompt }],
        "당신은 네이버 블로그 SEO 전문가입니다. 검색량이 높고 경쟁도가 적절한 키워드를 추천합니다."
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("키워드 파싱 실패");
      const data = JSON.parse(jsonMatch[0]);
      const all = [
        ...(data.primary || []).map((k) => ({ keyword: k, type: "primary" })),
        ...(data.long_tail || []).map((k) => ({ keyword: k, type: "long_tail" })),
        ...(data.pain_point || []).map((k) => ({ keyword: k, type: "pain_point" })),
      ];
      setKeywords(all);
      // 검색량 트렌드 자동 조회
      fetchTrendScores(all.map((k) => k.keyword));
    } catch (e) {
      setError("키워드 추천 중 오류가 발생했습니다: " + e.message);
    } finally {
      setIsLoadingKeywords(false);
    }
  };

  // ─── 키워드 토글 ───
  const toggleKeyword = (kw) => {
    setSelectedKeywords((prev) =>
      prev.includes(kw) ? prev.filter((k) => k !== kw) : [...prev, kw]
    );
  };

  // ─── 키워드 직접 추가 ───
  const addManualKeyword = () => {
    const kw = keywordInput.trim();
    if (!kw) return;
    if (!keywords.find((k) => k.keyword === kw)) {
      setKeywords((prev) => [...prev, { keyword: kw, type: "manual" }]);
    }
    if (!selectedKeywords.includes(kw)) {
      setSelectedKeywords((prev) => [...prev, kw]);
    }
    setKeywordInput("");
  };

  // ─── 블로그 글 생성 ───
  const handleGenerate = async () => {
    if (!canGenerate) return;
    setError("");
    setIsGenerating(true);

    try {
      setGeneratingStep("주제 분석 중...");
      const typeInfo = contentType === "pulling"
        ? "공감형 유입 콘텐츠 (독자 고통/결핍 공감 → 정보 제공 → 자연스러운 서비스 언급)"
        : "전환 유도 콘텐츠 (유입 독자에게 솔루션 제시 → 서비스 가치 증명 → 강력한 CTA)";

      const systemPrompt = `당신은 퍼널 마케팅 전문 블로그 작가입니다.
콘텐츠 타입: ${typeInfo}
퍼널 목표: ${selectedType.funnel.join(" → ")} 전환 극대화
글쓰기 원칙:
- 독자의 관점에서 공감하며 시작
- 정보는 구체적이고 실용적으로
- 자연스러운 서비스 언급 (광고처럼 보이지 않게)
- 네이버 블로그 SEO에 최적화된 구조`;

      const prompt = `다음 정보를 바탕으로 네이버 블로그 글을 작성해주세요.

[서비스/상품 정보]
${serviceDesc}

[타겟 독자]
${targetAudience || "서비스와 관련된 잠재 고객"}

[선택된 키워드]
${selectedKeywords.join(", ")}

[글 주제/각도]
${topic || "키워드와 서비스에 맞는 최적의 주제로 작성"}

[콘텐츠 타입]
${typeInfo}

다음 JSON 형식으로 반환해. 마크다운 코드블록 없이 JSON만:
{
  "title": "SEO 최적화된 제목 (키워드 포함, 30자 내외)",
  "sections": [
    {
      "heading": "도입부",
      "content": "독자의 공감을 이끄는 도입 문단 (3-4문장, 헤딩 없음)"
    },
    {
      "heading": "소제목 1",
      "content": "본문 내용 (4-6문장)"
    },
    {
      "heading": "소제목 2",
      "content": "본문 내용 (4-6문장)"
    },
    {
      "heading": "소제목 3",
      "content": "본문 내용 (4-6문장)"
    },
    {
      "heading": "${contentType === "key" ? "지금 바로 시작하세요" : "마무리"}",
      "content": "${contentType === "key" ? "강력한 CTA와 함께 마무리 (3-4문장)" : "정보 요약과 자연스러운 다음 행동 유도 (3-4문장)"}"
    }
  ]
}`;

      setGeneratingStep("글 생성 중...");
      const result = await callGemini(
        [{ role: "user", content: prompt }],
        systemPrompt
      );

      setGeneratingStep("결과 처리 중...");
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("글 생성 결과를 파싱할 수 없습니다.");
      const postData = JSON.parse(jsonMatch[0]);

      if (postData.sections?.[0]?.heading === "도입부") {
        postData.sections[0].heading = "";
      }

      onGenerate({
        ...postData,
        contentType,
        funnelStages: selectedType.funnel,
        keywords: selectedKeywords,
        serviceDesc,
        status: "draft",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      setError("글 생성 중 오류가 발생했습니다: " + e.message);
    } finally {
      setIsGenerating(false);
      setGeneratingStep("");
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white h-full">
      {/* 헤더 */}
      <header className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">전문 퍼널 블로그 글 작성</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">AI가 퍼널 구조에 맞춘 전환 최적화 글을 작성합니다</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-32 sm:pb-12 pt-5 sm:pt-6 space-y-6 sm:space-y-8">

        {/* ─── 퍼널 시각화 ─── */}
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">블로그 마케팅 퍼널</p>
          <div className="flex items-center gap-1 sm:gap-2">
            {FUNNEL_STAGES.map((stage, idx) => {
              const isActive = selectedType.funnel.includes(stage);
              return (
                <div key={stage} className="flex items-center gap-1 sm:gap-2 flex-1">
                  <div className={`flex-1 rounded-lg py-2 text-center text-xs sm:text-sm font-semibold transition-all ${
                    isActive
                      ? contentType === "pulling"
                        ? "bg-blue-500 text-white shadow-sm"
                        : "bg-purple-500 text-white shadow-sm"
                      : "bg-white border border-gray-200 text-gray-300"
                  }`}>
                    {stage}
                  </div>
                  {idx < FUNNEL_STAGES.length - 1 && (
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 flex-shrink-0">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── 콘텐츠 타입 선택 ─── */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">콘텐츠 타입 선택</h2>
            <p className="text-xs text-gray-400 mt-0.5">퍼널 단계에 맞는 콘텐츠를 선택하세요</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {CONTENT_TYPES.map((type) => (
              <button
                key={type.key}
                type="button"
                onClick={() => setContentType(type.key)}
                className={`text-left rounded-xl border p-4 transition-all ${
                  contentType === type.key
                    ? type.key === "pulling"
                      ? "border-blue-300 bg-blue-50 ring-1 ring-blue-200"
                      : "border-purple-300 bg-purple-50 ring-1 ring-purple-200"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${
                    contentType === type.key
                      ? type.key === "pulling" ? "text-blue-700" : "text-purple-700"
                      : "text-gray-800"
                  }`}>
                    {type.label}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    contentType === type.key
                      ? type.key === "pulling"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-purple-100 text-purple-600"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {type.funnel.join("→")}
                  </span>
                </div>
                <p className={`text-xs leading-relaxed ${
                  contentType === type.key ? "text-gray-600" : "text-gray-400"
                }`}>
                  {type.detail}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* ─── 서비스/상품 정보 ─── */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">서비스 · 상품 정보</h2>
            <p className="text-xs text-gray-400 mt-0.5">AI가 키워드와 글을 생성할 기반 정보입니다</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                서비스/상품 설명 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={serviceDesc}
                onChange={(e) => setServiceDesc(e.target.value)}
                placeholder="예: 1인 기업가와 소상공인을 위한 AI 마케팅 자동화 솔루션. SNS 콘텐츠를 AI가 자동으로 기획·작성·배포합니다."
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none min-h-[100px] focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                타겟 독자 <span className="text-gray-300 font-normal">(선택)</span>
              </label>
              <input
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="예: 하루에 콘텐츠 만드는 데 2시간 이상 쓰는 소상공인"
                className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-3 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all"
              />
            </div>
          </div>
        </div>

        {/* ─── 키워드 리서치 ─── */}
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">키워드 리서치</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                글에 사용할 키워드를 선택하세요 <span className="text-red-400">*</span>
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* 네이버 연관검색 버튼 */}
              <button
                type="button"
                onClick={handleNaverKeywords}
                disabled={isNaverLoading || !serviceDesc.trim()}
                className={`h-8 px-3 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-all ${
                  !serviceDesc.trim()
                    ? "border-gray-200 text-gray-300 cursor-not-allowed"
                    : "border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
                }`}
              >
                {isNaverLoading ? (
                  <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <span className="font-bold text-green-600">N</span>
                )}
                네이버 연관검색
              </button>

              {/* AI 키워드 추천 버튼 */}
              <button
                type="button"
                onClick={handleAIKeywords}
                disabled={isLoadingKeywords || !serviceDesc.trim()}
                className={`h-8 px-3 text-xs font-medium rounded-lg border flex items-center gap-1.5 transition-all ${
                  !serviceDesc.trim()
                    ? "border-gray-200 text-gray-300 cursor-not-allowed"
                    : "border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100"
                }`}
              >
                {isLoadingKeywords ? (
                  <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                  </svg>
                )}
                AI 키워드 추천
              </button>
            </div>
          </div>

          {/* 네이버 키워드 결과 */}
          {naverKeywords.length > 0 && (
            <div className={`rounded-xl border p-3.5 space-y-2.5 ${
              naverStatus === "ok"
                ? "border-green-200 bg-green-50/50"
                : "border-yellow-200 bg-yellow-50/50"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-green-600 text-xs">N</span>
                  <span className={`text-xs font-semibold ${
                    naverStatus === "ok" ? "text-green-700" : "text-yellow-700"
                  }`}>
                    {naverStatus === "ok"
                      ? "네이버 검색량 기반 키워드 (높은 순)"
                      : "AI 기반 키워드 추천 (데이터랩 미연동)"}
                  </span>
                </div>
                {isLoadingTrends && (
                  <div className="flex items-center gap-1 text-[10px] text-green-500">
                    <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    검색량 분석 중...
                  </div>
                )}
                {!isLoadingTrends && Object.keys(trendScores).length > 0 && (
                  <span className="text-[10px] text-green-500 font-medium">검색량 반영됨</span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {/* 검색량 점수 높은 순 정렬 */}
                {[...naverKeywords]
                  .sort((a, b) => (trendScores[b] || 0) - (trendScores[a] || 0))
                  .map((kw) => {
                    const score = trendScores[kw];
                    const isSelected = selectedKeywords.includes(kw);
                    return (
                      <button
                        key={kw}
                        type="button"
                        onClick={() => toggleKeyword(kw)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border ${
                          isSelected
                            ? "bg-green-600 text-white border-green-600"
                            : naverStatus === "ok"
                              ? "bg-white text-green-700 border-green-200 hover:bg-green-100"
                              : "bg-white text-yellow-700 border-yellow-200 hover:bg-yellow-100"
                        }`}
                      >
                        {kw}
                        {score !== undefined && (
                          <span className={`text-[10px] font-bold rounded-full px-1 ${
                            isSelected
                              ? "bg-white/20 text-white"
                              : score >= 70 ? "text-red-500"
                              : score >= 40 ? "text-orange-500"
                              : "text-gray-400"
                          }`}>
                            {score}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>
              {Object.keys(trendScores).length > 0 && (
                <div className="flex items-center gap-3 pt-1 border-t border-green-100">
                  <span className="text-[10px] text-gray-400">검색량 지수:</span>
                  <span className="text-[10px] font-semibold text-red-500">70+ 높음</span>
                  <span className="text-[10px] font-semibold text-orange-500">40~69 보통</span>
                  <span className="text-[10px] font-semibold text-gray-400">~39 낮음</span>
                </div>
              )}
            </div>
          )}

          {/* AI 분류형 키워드 결과 */}
          {keywords.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 space-y-3">
              {[
                { type: "primary", label: "핵심 키워드", color: "text-purple-600" },
                { type: "long_tail", label: "롱테일 키워드", color: "text-blue-600" },
                { type: "pain_point", label: "페인포인트 키워드", color: "text-orange-600" },
              ].map(({ type, label, color }) => {
                const typeKeywords = keywords.filter((k) => k.type === type);
                if (typeKeywords.length === 0) return null;
                return (
                  <div key={type} className="space-y-1.5">
                    <span className={`text-xs font-semibold ${color}`}>{label}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {[...typeKeywords]
                        .sort((a, b) => (trendScores[b.keyword] || 0) - (trendScores[a.keyword] || 0))
                        .map(({ keyword: kw }) => {
                          const score = trendScores[kw];
                          const isSelected = selectedKeywords.includes(kw);
                          return (
                            <button
                              key={kw}
                              type="button"
                              onClick={() => toggleKeyword(kw)}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all border ${
                                isSelected
                                  ? "bg-purple-600 text-white border-purple-600"
                                  : "bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:text-purple-700"
                              }`}
                            >
                              {kw}
                              {score !== undefined && (
                                <span className={`text-[10px] font-bold ${
                                  isSelected ? "text-white/70"
                                  : score >= 70 ? "text-red-500"
                                  : score >= 40 ? "text-orange-500"
                                  : "text-gray-300"
                                }`}>
                                  {score}
                                </span>
                              )}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 선택된 키워드 요약 */}
          {selectedKeywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-3 bg-purple-50 rounded-xl border border-purple-100">
              <span className="text-xs font-semibold text-purple-600 w-full mb-1">
                선택된 키워드 ({selectedKeywords.length}개)
              </span>
              {selectedKeywords.map((kw) => (
                <span key={kw} className="inline-flex items-center gap-1 rounded-full bg-purple-600 text-white text-xs px-3 py-1 font-medium">
                  {kw}
                  <button type="button" onClick={() => toggleKeyword(kw)} className="ml-0.5 opacity-70 hover:opacity-100">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                    </svg>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 직접 입력 */}
          <div className="flex gap-2">
            <input
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addManualKeyword())}
              placeholder="직접 키워드 추가..."
              className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all"
            />
            <button
              type="button"
              onClick={addManualKeyword}
              className="h-10 px-4 text-sm font-medium rounded-xl border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
            >
              추가
            </button>
          </div>
        </div>

        {/* ─── 글 주제/각도 ─── */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              글 주제 · 각도 <span className="text-gray-300 text-sm font-normal">(선택)</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">비워두면 AI가 최적의 주제를 자동 선택합니다</p>
          </div>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={selectedType.titleHints.map((h, i) => `예시 ${i + 1}: ${h}`).join("\n")}
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none min-h-[90px] focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all"
          />
          <div className="flex flex-wrap gap-1.5">
            {selectedType.titleHints.map((hint) => (
              <button
                key={hint}
                type="button"
                onClick={() => setTopic(hint)}
                className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200 transition-colors"
              >
                {hint}
              </button>
            ))}
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500 mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* 글 생성 버튼 (데스크톱) */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className={`hidden sm:inline-flex items-center justify-center gap-2.5 text-sm font-semibold rounded-xl h-12 px-8 transition-all w-full ${
            canGenerate && !isGenerating
              ? contentType === "pulling"
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
                : "bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-200"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {generatingStep || "생성 중..."}
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              </svg>
              {selectedType.label} 글 생성 시작
            </>
          )}
        </button>
      </div>

      {/* 모바일 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-sm border-t border-gray-200 sm:hidden z-50">
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className={`inline-flex items-center justify-center gap-2.5 whitespace-nowrap font-semibold rounded-xl w-full h-12 text-sm transition-all ${
            canGenerate && !isGenerating
              ? contentType === "pulling"
                ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                : "bg-purple-600 hover:bg-purple-700 text-white shadow-sm"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {generatingStep || "생성 중..."}
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              </svg>
              {selectedType.label} 글 생성 시작
            </>
          )}
        </button>
      </div>
    </div>
  );
}
