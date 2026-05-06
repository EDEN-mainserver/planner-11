import { useState, useEffect, useRef } from "react";
import { callGemini } from "../utils/gemini";

// ─── 글 유형 정의 ───
const POST_TYPES = [
  {
    key: "info",
    label: "정보공유형",
    desc: "유용한 정보·팁·노하우 공유",
    gradient: "from-blue-500 to-cyan-500",
    color: "blue",
    hint: "마케터라면 알아야 할 X가지 방법",
    prompt: "마케팅/비즈니스에 도움이 되는 실용적인 정보와 노하우를 공유하는 글. 구체적인 수치·예시 포함, 독자가 바로 적용할 수 있는 팁 위주.",
    topics: [
      "성과를 2배 올린 마케팅 자동화 방법",
      "소상공인이 모르면 손해인 정부 지원 총정리",
      "광고비 절반 줄이고 매출 높인 비결",
      "SNS 팔로워 1000명 만드는 현실적인 방법",
    ],
  },
  {
    key: "case",
    label: "사례형",
    desc: "실제 경험·성공/실패 사례 공유",
    gradient: "from-emerald-500 to-teal-500",
    color: "emerald",
    hint: "실제로 해봤더니: 000 결과가 나왔습니다",
    prompt: "실제 비즈니스 현장에서 겪은 경험·사례를 솔직하게 공유하는 글. 성공과 실패 모두 포함, 숫자로 증명하는 결과 중심.",
    topics: [
      "블로그 6개월 운영하고 나서 솔직한 후기",
      "광고 100만원 썼을 때 실제 결과",
      "직원 없이 월매출 1000만원 달성한 과정",
      "첫 사업 실패하고 배운 3가지 교훈",
    ],
  },
  {
    key: "insight",
    label: "인사이트형",
    desc: "업계 트렌드·날카로운 관점 제시",
    gradient: "from-violet-500 to-purple-600",
    color: "violet",
    hint: "앞으로 마케팅이 이렇게 바뀐다",
    prompt: "마케팅·비즈니스 트렌드와 관련된 날카로운 인사이트를 제시하는 글. 다수의 의견에 반하는 관점이나 새로운 시각 환영, 근거 있는 주장.",
    topics: [
      "AI 시대에 살아남는 마케터의 조건",
      "요즘 바이럴 마케팅이 잘 안되는 이유",
      "대기업이 못하는 것, 소상공인이 할 수 있는 것",
      "콘텐츠 마케팅, 진짜 효과 있는 걸까요?",
    ],
  },
  {
    key: "question",
    label: "질문형",
    desc: "커뮤니티에 질문·의견 수렴",
    gradient: "from-orange-500 to-amber-500",
    color: "orange",
    hint: "혹시 이런 경험 있으신 분 계세요?",
    prompt: "아이보스 커뮤니티 회원들에게 실질적인 질문을 던지거나 의견을 구하는 글. 구체적인 상황 설명 후 핵심 질문 1~2개로 마무리.",
    topics: [
      "인스타 광고 vs 카카오 광고, 뭐가 더 효율적인가요?",
      "마케팅 에이전시 쓰는 게 나을까요, 직접 할까요?",
      "신규 고객 유입이 갑자기 줄었을 때 어떻게 하셨나요?",
      "직원 채용 vs 외주 프리랜서, 어떤 선택 하셨나요?",
    ],
  },
];

// ─── 플랫폼 정의 ───
const REF_PLATFORMS = [
  { key: "iboss",    label: "아이보스", icon: "B",  color: "emerald" },
  { key: "threads",  label: "쓰레드",   icon: "🧵", color: "purple" },
  { key: "x",        label: "X",        icon: "𝕏",  color: "gray" },
  { key: "linkedin", label: "LinkedIn", icon: "in", color: "blue" },
];

export default function IbossNewPost({ onBack, onGenerate, referencePost = null }) {
  const [postType, setPostType] = useState("info");
  const [topic, setTopic] = useState(referencePost ? referencePost.title : "");
  const [extraInfo, setExtraInfo] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState("");
  const [error, setError] = useState("");

  // ── 참고 패널 상태 ──
  const [showRefPanel, setShowRefPanel] = useState(false);
  const [showNaverPanel, setShowNaverPanel] = useState(false);
  const [refPlatform, setRefPlatform] = useState("iboss");
  const [refKeyword, setRefKeyword] = useState("");
  const [refLoading, setRefLoading] = useState(false);
  const [refStatus, setRefStatus] = useState("");
  const [ibossPosts, setIbossPosts] = useState([]);
  const [platformPosts, setPlatformPosts] = useState([]); // threads/x/linkedin
  const [ibossMonth, setIbossMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  const refTimeoutRef = useRef(null);

  const selectedType = POST_TYPES.find((t) => t.key === postType);

  // ── 결과 수신 리스너 (전 플랫폼) ──
  useEffect(() => {
    const handler = (event) => {
      if (event.source !== window) return;
      const { type, payload } = event.data || {};

      if (type === "EDEN_IBOSS_LIST") {
        if (refTimeoutRef.current) clearTimeout(refTimeoutRef.current);
        const posts = (payload?.posts || []).slice(0, 10).map((p, i) => ({ ...p, rank: i + 1 }));
        setIbossPosts(posts);
        setRefLoading(false);
        setRefStatus("");
      }
      if (type === "EDEN_THREADS_RESULTS") {
        if (refTimeoutRef.current) clearTimeout(refTimeoutRef.current);
        const posts = (payload?.posts || []).slice(0, 10).map((p, i) => ({ ...p, rank: i + 1 }));
        setPlatformPosts(posts);
        setRefLoading(false);
        setRefStatus(posts.length > 0 ? "" : "결과가 없습니다.");
      }
      if (type === "EDEN_CRAWL_STATUS") {
        if (payload?.done) { setRefLoading(false); setRefStatus(payload.error ? "수집 오류: " + payload.msg : ""); }
        else setRefStatus(payload?.msg || "");
      }
      if (type === "EDEN_X_RESULTS") {
        if (refTimeoutRef.current) clearTimeout(refTimeoutRef.current);
        const posts = (payload?.posts || []).slice(0, 10).map((p, i) => ({ ...p, rank: i + 1 }));
        setPlatformPosts(posts);
        setRefLoading(false);
        setRefStatus(posts.length > 0 ? "" : "결과가 없습니다.");
      }
      if (type === "EDEN_X_STATUS") {
        if (payload?.done) { setRefLoading(false); setRefStatus(payload.error ? "수집 오류: " + payload.msg : ""); }
        else setRefStatus(payload?.msg || "");
      }
      if (type === "EDEN_LINKEDIN_RESULTS") {
        if (refTimeoutRef.current) clearTimeout(refTimeoutRef.current);
        const posts = (payload?.posts || []).slice(0, 10).map((p, i) => ({ ...p, rank: i + 1 }));
        setPlatformPosts(posts);
        setRefLoading(false);
        setRefStatus(posts.length > 0 ? "" : "결과가 없습니다.");
      }
      if (type === "EDEN_LINKEDIN_STATUS") {
        if (payload?.done) { setRefLoading(false); setRefStatus(payload.error ? "수집 오류: " + payload.msg : ""); }
        else setRefStatus(payload?.msg || "");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // 플랫폼 변경 시 결과 초기화
  useEffect(() => {
    setPlatformPosts([]);
    setRefStatus("");
    setRefLoading(false);
    if (refTimeoutRef.current) clearTimeout(refTimeoutRef.current);
  }, [refPlatform]);

  const handleRefLoad = () => {
    if (refTimeoutRef.current) clearTimeout(refTimeoutRef.current);
    setRefLoading(true);
    setRefStatus("");

    if (refPlatform === "iboss") {
      setIbossPosts([]);
      window.postMessage({ type: "EDEN_GET_IBOSS_LIST", month: ibossMonth }, "*");
    } else if (refPlatform === "threads") {
      if (!refKeyword.trim()) { setRefLoading(false); setRefStatus("키워드를 입력하세요"); return; }
      setPlatformPosts([]);
      window.postMessage({ type: "EDEN_START_CRAWL", keyword: refKeyword.trim(), count: 20 }, "*");
    } else if (refPlatform === "x") {
      if (!refKeyword.trim()) { setRefLoading(false); setRefStatus("키워드를 입력하세요"); return; }
      setPlatformPosts([]);
      window.postMessage({ type: "EDEN_START_X_CRAWL", keyword: refKeyword.trim(), count: 20 }, "*");
    } else if (refPlatform === "linkedin") {
      if (!refKeyword.trim()) { setRefLoading(false); setRefStatus("키워드를 입력하세요"); return; }
      setPlatformPosts([]);
      window.postMessage({ type: "EDEN_START_LINKEDIN_CRAWL", keyword: refKeyword.trim(), count: 20 }, "*");
    }

    refTimeoutRef.current = setTimeout(() => {
      setRefLoading(false);
      setRefStatus("수집 시간 초과 — Eden Crawl 확장 프로그램이 설치·로그인되어 있는지 확인해주세요.");
    }, 30000);
  };

  const handleRefStop = () => {
    if (refTimeoutRef.current) clearTimeout(refTimeoutRef.current);
    if (refPlatform === "threads") window.postMessage({ type: "EDEN_STOP_CRAWL" }, "*");
    else if (refPlatform === "x") window.postMessage({ type: "EDEN_STOP_X_CRAWL" }, "*");
    else if (refPlatform === "linkedin") window.postMessage({ type: "EDEN_STOP_LINKEDIN_CRAWL" }, "*");
    setRefLoading(false);
    setRefStatus("수집 중단됨");
  };

  // 현재 플랫폼 결과 목록
  const currentRefPosts = refPlatform === "iboss" ? ibossPosts : platformPosts;

  // 인기글 클릭 → 주제로 설정
  const handleRefPostClick = (post) => {
    const title = post.title || post.text?.slice(0, 80) || "";
    setTopic(title);
  };

  // 네이버 시장조사 링크
  const naverLinks = topic.trim()
    ? [
        { label: "블로그", icon: "📝", url: `https://search.naver.com/search.naver?where=blog&query=${encodeURIComponent(topic)}` },
        { label: "뉴스", icon: "📰", url: `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(topic)}` },
        { label: "카페", icon: "☕", url: `https://search.naver.com/search.naver?where=cafeblog&query=${encodeURIComponent(topic)}` },
        { label: "쇼핑", icon: "🛒", url: `https://search.naver.com/search.naver?where=shopping&query=${encodeURIComponent(topic)}` },
        { label: "DataLab", icon: "📊", url: `https://datalab.naver.com/keyword/trendSearch.naver?keyword=${encodeURIComponent(topic)}` },
      ]
    : [];

  // ── 월 옵션 ──
  const monthOptions = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const val = d.toISOString().slice(0, 7).replace("-", "");
    monthOptions.push({ val, label: `${d.getFullYear()}년 ${d.getMonth() + 1}월` });
  }

  // ── 글 생성 ──
  const handleGenerate = async () => {
    if (!topic.trim()) { setError("글 주제를 입력해주세요."); return; }
    setError("");
    setIsGenerating(true);

    try {
      setGeneratingStep("💡 제목 생성 중...");

      const titlePrompt = `아이보스(i-boss.co.kr) 마케팅 커뮤니티에 올릴 "${selectedType.label}" 글의 제목을 3개 만들어줘.

주제: ${topic}
추가 정보: ${extraInfo || "없음"}
유형 설명: ${selectedType.prompt}

조건:
- 아이보스 커뮤니티 특성: 마케터, 소상공인, 창업자 타겟
- 클릭하고 싶게 만드는 제목
- 과장 없이 현실적인 톤
- 20~35자 사이

JSON 배열만 반환: ["제목1", "제목2", "제목3"]`;

      const titleResult = await callGemini(
        [{ role: "user", content: titlePrompt }],
        "아이보스 마케팅 커뮤니티 전문 에디터. 실용적이고 신뢰감 있는 글을 작성합니다."
      );

      const titleMatch = titleResult.match(/\[[\s\S]*?\]/);
      const titles = titleMatch ? JSON.parse(titleMatch[0]) : [topic];
      const bestTitle = titles[0] || topic;

      setGeneratingStep("✍️ 본문 작성 중...");

      const referenceSection = referencePost?.content_raw
        ? `\n\n[레퍼런스 원문 — 아래 글의 구조·톤·길이를 참고해서 새 글을 써줘]\n제목: ${referencePost.title}\n본문:\n${referencePost.content_raw.slice(0, 1500)}`
        : "";

      const contentPrompt = `아이보스(i-boss.co.kr) 마케팅 커뮤니티에 올릴 글을 작성해줘.

제목: ${bestTitle}
유형: ${selectedType.label} — ${selectedType.desc}
주제: ${topic}
추가 정보: ${extraInfo || "없음"}
유형 지침: ${selectedType.prompt}${referenceSection}

작성 규칙:
1. 아이보스 커뮤니티 특성: 마케터·소상공인·창업자가 읽는 곳. 전문적이되 딱딱하지 않게.
2. 첫 문단: 독자를 바로 끌어당기는 훅 (공감, 충격, 질문)
3. 본문: 소제목 없이 자연스러운 단락 구성, 각 단락 3~5문장
4. 구체적인 예시, 수치, 경험담 포함
5. 마무리: 댓글/공감 유도 또는 핵심 메시지로 마무리
6. 전체 길이: 600~900자
7. 줄바꿈으로 단락 구분 (\\n\\n 사용)
${referencePost ? "8. 레퍼런스 원문을 직접 복사하지 말고, 구조와 흐름만 참고해서 완전히 새로운 글로 써줘." : ""}

제목 포함하지 말고 본문만 작성해줘.`;

      const contentResult = await callGemini(
        [{ role: "user", content: contentPrompt }],
        "아이보스 마케팅 커뮤니티 전문 에디터. 실용적이고 신뢰감 있는 글을 작성합니다."
      );

      setGeneratingStep("📋 마무리 중...");

      onGenerate({
        id: `iboss_${Date.now()}`,
        title: bestTitle,
        altTitles: titles.slice(1),
        content: contentResult.trim(),
        postType,
        topic,
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

  const canGenerate = topic.trim().length > 0;

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
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">아이보스 글 작성</h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">마케팅 커뮤니티 최적화 글을 AI가 자동 생성합니다</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-32 sm:pb-12 pt-5 sm:pt-6 space-y-7">

        {/* ── 레퍼런스 포스트 배너 ── */}
        {referencePost && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">레퍼런스 글 기반 재구성</span>
            </div>
            <p className="text-sm font-semibold text-gray-800 truncate">{referencePost.title}</p>
            {referencePost.content_raw ? (
              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                {referencePost.content_raw.slice(0, 120)}...
              </p>
            ) : (
              <p className="text-xs text-amber-600">본문 없이 제목만 참고해서 생성됩니다.</p>
            )}
          </div>
        )}

        {/* ── 글 유형 선택 ── */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">글 유형 선택</h2>
            <p className="text-xs text-gray-400 mt-0.5">어떤 방식으로 쓸지 선택하세요</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {POST_TYPES.map((type) => (
              <button
                key={type.key}
                type="button"
                onClick={() => setPostType(type.key)}
                className={`text-left rounded-xl border p-3.5 transition-all ${
                  postType === type.key
                    ? "border-gray-900 bg-gray-900 ring-1 ring-gray-800"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold mb-2 bg-gradient-to-r ${type.gradient} text-white`}>
                  {type.label}
                </div>
                <p className={`text-xs leading-snug ${postType === type.key ? "text-gray-300" : "text-gray-500"}`}>
                  {type.desc}
                </p>
                <p className={`text-[11px] mt-1.5 leading-snug font-medium ${postType === type.key ? "text-gray-400" : "text-gray-400"}`}>
                  예: {type.hint}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* ── 글 주제 입력 ── */}
        <div className="space-y-3">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              글 주제 <span className="text-red-400">*</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">쓰고 싶은 주제나 핵심 내용을 입력하세요</p>
          </div>

          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={`예: ${selectedType.hint}`}
            rows={3}
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-all"
          />

          {/* 빠른 주제 선택 */}
          <div className="flex flex-wrap gap-1.5">
            {selectedType.topics.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTopic(t)}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs transition-colors ${
                  topic === t
                    ? "bg-gray-900 text-white border-gray-900"
                    : "border-gray-200 bg-white text-gray-500 hover:border-emerald-200 hover:text-emerald-700"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* ── 도구 버튼 행 ── */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => { setShowRefPanel(!showRefPanel); setShowNaverPanel(false); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                showRefPanel
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
              </svg>
              인기글 참고
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showRefPanel ? "rotate-180" : ""}`}>
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>

            <button
              type="button"
              onClick={() => { setShowNaverPanel(!showNaverPanel); setShowRefPanel(false); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
                showNaverPanel
                  ? "bg-green-600 text-white border-green-600"
                  : "border-green-200 text-green-700 bg-green-50 hover:bg-green-100"
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
              네이버 시장조사
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${showNaverPanel ? "rotate-180" : ""}`}>
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>
          </div>

          {/* ── 인기글 참고 패널 ── */}
          {showRefPanel && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4 space-y-3">
              {/* 플랫폼 탭 */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {REF_PLATFORMS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setRefPlatform(p.key)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      refPlatform === p.key
                        ? "bg-gray-900 text-white border-gray-900"
                        : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                    }`}
                  >
                    <span className="font-bold">{p.icon}</span>
                    {p.label}
                  </button>
                ))}
              </div>

              {/* 아이보스: 월 선택 */}
              {refPlatform === "iboss" && (
                <div className="flex items-center gap-2">
                  <select
                    value={ibossMonth}
                    onChange={(e) => setIbossMonth(e.target.value)}
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                  >
                    {monthOptions.map(({ val, label }) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleRefLoad}
                    disabled={refLoading}
                    className="h-9 px-3 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    {refLoading ? <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> : null}
                    {refLoading ? "수집 중..." : "불러오기"}
                  </button>
                </div>
              )}

              {/* 쓰레드/X/링크드인: 키워드 입력 */}
              {refPlatform !== "iboss" && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={refKeyword}
                    onChange={(e) => setRefKeyword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !refLoading && handleRefLoad()}
                    placeholder={`키워드 입력 (예: ${topic.slice(0, 15) || "마케팅"})`}
                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-emerald-300"
                  />
                  {refLoading ? (
                    <button
                      type="button"
                      onClick={handleRefStop}
                      className="h-9 px-3 text-xs font-semibold rounded-lg bg-red-500 text-white hover:bg-red-600 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                      중단
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleRefLoad}
                      className="h-9 px-3 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 flex items-center gap-1.5 transition-colors whitespace-nowrap"
                    >
                      수집
                    </button>
                  )}
                </div>
              )}

              {/* 상태 메시지 */}
              {refStatus && (
                <p className={`text-xs px-1 ${refStatus.includes("오류") || refStatus.includes("초과") ? "text-red-500" : "text-emerald-600"}`}>
                  {refStatus}
                </p>
              )}

              {/* 결과 목록 */}
              {currentRefPosts.length > 0 && (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-emerald-700 px-1">클릭해서 주제로 활용</p>
                  {currentRefPosts.map((post, idx) => {
                    const title = post.title || post.text?.slice(0, 80) || "";
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleRefPostClick(post)}
                        className="w-full text-left flex items-center gap-2.5 px-3 py-2 bg-white rounded-lg border border-gray-100 hover:border-emerald-200 hover:bg-emerald-50 transition-all group"
                      >
                        <span className="text-[11px] font-bold text-emerald-400 w-4 flex-shrink-0">{post.rank}</span>
                        <span className="text-xs text-gray-700 flex-1 truncate group-hover:text-emerald-800">{title}</span>
                        {post.views > 0 && (
                          <span className="text-[10px] text-gray-400 flex-shrink-0">조회 {post.views.toLocaleString()}</span>
                        )}
                        {post.likes > 0 && (
                          <span className="text-[10px] text-gray-400 flex-shrink-0">♥ {post.likes}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── 네이버 시장조사 패널 ── */}
          {showNaverPanel && (
            <div className="rounded-xl border border-green-100 bg-green-50/40 p-4 space-y-3">
              <p className="text-xs font-semibold text-green-700">주제로 네이버 검색 — 클릭해서 새 탭으로 열기</p>
              {topic.trim() ? (
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: "블로그", icon: "📝", where: "blog" },
                    { label: "뉴스", icon: "📰", where: "news" },
                    { label: "카페", icon: "☕", where: "cafeblog" },
                    { label: "쇼핑", icon: "🛒", where: "shopping" },
                  ].map(({ label, icon, where }) => (
                    <a
                      key={where}
                      href={`https://search.naver.com/search.naver?where=${where}&query=${encodeURIComponent(topic)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:border-green-300 hover:text-green-700 transition-all"
                    >
                      <span>{icon}</span>
                      {label}
                    </a>
                  ))}
                  <a
                    href={`https://datalab.naver.com/keyword/trendSearch.naver?keyword=${encodeURIComponent(topic)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:border-green-300 hover:text-green-700 transition-all"
                  >
                    <span>📊</span>
                    DataLab 트렌드
                  </a>
                  <a
                    href={`https://search.naver.com/search.naver?query=${encodeURIComponent(topic)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                    </svg>
                    통합 검색
                  </a>
                </div>
              ) : (
                <p className="text-xs text-gray-400">주제를 먼저 입력하면 검색 링크가 생성됩니다.</p>
              )}
            </div>
          )}
        </div>

        {/* ── 추가 정보 (선택) ── */}
        <div className="space-y-2">
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">
              추가 정보 <span className="text-gray-300 text-sm font-normal">(선택)</span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">구체적인 수치, 본인 경험, 특별히 강조하고 싶은 내용</p>
          </div>
          <textarea
            value={extraInfo}
            onChange={(e) => setExtraInfo(e.target.value)}
            placeholder="예: 실제로 6개월 동안 테스트한 결과, 전환율이 2.3배 향상됐습니다. 주요 채널은 인스타그램과 카카오였고..."
            rows={3}
            className="w-full rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-3 text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 transition-all"
          />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* 생성 버튼 (데스크톱) */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!canGenerate || isGenerating}
          className={`hidden sm:inline-flex items-center justify-center gap-2.5 text-sm font-semibold rounded-xl h-12 px-8 transition-all w-full ${
            canGenerate && !isGenerating
              ? "bg-gray-900 hover:bg-gray-800 text-white"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              {generatingStep || "생성 중..."}
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              </svg>
              {selectedType.label} 글 생성
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
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {isGenerating ? (generatingStep || "생성 중...") : `${selectedType.label} 글 생성`}
        </button>
      </div>
    </div>
  );
}
