/**
 * 쓰레드 인기글 크롤링 대시보드
 * - Eden Crawl 확장 프로그램 기반 수집
 * - 행 클릭 → 원문 펼치기/접기 + 원본 링크
 * - [AI 분석] 버튼 → 바이럴 분석 (Gemini)
 * - [아이디어 생성] 버튼 → 콘텐츠 아이디어 5개 생성
 */
import { useState, useCallback, useEffect } from "react";
import { callGemini } from "../../utils/gemini";

// ── 브랜드 프로필 ──
const BRAND_KEY = "eattack_brand_profile";
function loadBrand() {
  try { return JSON.parse(localStorage.getItem(BRAND_KEY)) || { name: "", target: "", tone: "" }; }
  catch { return { name: "", target: "", tone: "" }; }
}
function saveBrand(data) { localStorage.setItem(BRAND_KEY, JSON.stringify(data)); }

// ── JSON 파싱 헬퍼 ──
function parseJSON(text) {
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (m) { try { return JSON.parse(m[1] || m[0]); } catch { return null; } }
  return null;
}

// ── 메인 수집 버튼 (확장 프로그램 기반) ──
// 기존 "실시간 수집" 버튼 대체 — Eden Crawl 백그라운드 크롤러 직접 실행
function ExtensionCrawlButton({ keyword, count = 30 }) {
  const [status, setStatus] = useState(null); // null | { msg, done, error }

  useEffect(() => {
    const handler = (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== 'EDEN_CRAWL_STATUS') return;
      setStatus(event.data.payload);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleStart = () => {
    if (!keyword.trim()) return;
    setStatus({ msg: '수집 요청 중...', done: false, error: false });
    window.postMessage({ type: 'EDEN_START_CRAWL', keyword: keyword.trim(), count }, '*');
  };

  const isCrawling = status && !status.done;
  const isDone     = status?.done && !status?.error;
  const isError    = status?.error;

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleStart}
        disabled={!keyword.trim() || isCrawling}
        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          isCrawling
            ? "bg-purple-400 text-white cursor-not-allowed"
            : isDone
            ? "bg-green-500 hover:bg-green-400 text-white"
            : isError
            ? "bg-red-500 hover:bg-red-400 text-white"
            : "bg-purple-600 hover:bg-purple-500 text-white"
        }`}
      >
        {isCrawling
          ? <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          : isDone
          ? <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        }
        {isCrawling ? "수집 중..." : isDone ? "수집 완료!" : "수집"}
      </button>
      {status && (
        <p className={`text-[10px] px-0.5 leading-tight max-w-[160px] truncate ${
          isError ? "text-red-500" : isDone ? "text-green-600" : "text-purple-600"
        }`} title={status.msg}>
          {status.msg}
        </p>
      )}
    </div>
  );
}

// ── 톤 배지 ──
const TONE_MAP = {
  "유머러스": "bg-yellow-100 text-yellow-700",
  "정보성":   "bg-blue-100 text-blue-700",
  "감성적":   "bg-pink-100 text-pink-700",
  "솔직한":   "bg-orange-100 text-orange-700",
  "도발적":   "bg-red-100 text-red-700",
  "공감형":   "bg-green-100 text-green-700",
};
function ToneBadge({ tone }) {
  const cls = TONE_MAP[tone] || "bg-gray-100 text-gray-600";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{tone}</span>;
}

// ── 브랜드 모달 ──
function BrandModal({ onClose }) {
  const [brand, setBrand] = useState(loadBrand);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-800">브랜드 프로필 설정</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-4">브랜드 정보를 입력하면 AI가 더 맞춤화된 콘텐츠 아이디어를 제안합니다.</p>
        <div className="space-y-3">
          {[
            { key: "name",   label: "브랜드명 / 직업",  placeholder: "예: 뷰티 인플루언서, 카페 사장" },
            { key: "target", label: "타겟 고객",         placeholder: "예: 20-30대 여성, 직장인" },
            { key: "tone",   label: "브랜드 톤앤매너",   placeholder: "예: 친근하고 유머러스, 전문적" },
          ].map(f => (
            <div key={f.key}>
              <label className="text-xs font-medium text-gray-600 block mb-1">{f.label}</label>
              <input
                type="text"
                value={brand[f.key]}
                onChange={e => setBrand(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">취소</button>
          <button
            onClick={() => { saveBrand(brand); onClose(); }}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── 메인 컴포넌트 ───────────────────────
export default function ThreadPage({ extensionData = null, onExtensionDataConsumed = null }) {
  const [keyword, setKeyword]               = useState("");
  const [keywordCounts, setKeywordCounts]   = useState({}); // { "마케팅": 30, "숏폼": 30 }
  const [keywordFilter, setKeywordFilter]   = useState(null); // null = 전체
  const [posts, setPosts]   = useState([]);
  const [sortBy, setSortBy] = useState("likes");

  const [expandedRows, setExpandedRows] = useState(new Set());
  const [analysisMap, setAnalysisMap]   = useState({});
  const [ideasMap, setIdeasMap]         = useState({});
  const [filterMin, setFilterMin]       = useState(0);

  // 키워드 입력 변경 시 키워드별 개수 자동 동기화
  const parsedKeywords = keyword.split(',').map(k => k.trim()).filter(Boolean);
  useEffect(() => {
    setKeywordCounts(prev => {
      const next = {};
      parsedKeywords.forEach(k => { next[k] = prev[k] ?? 30; });
      return next;
    });
  }, [keyword]); // eslint-disable-line

  // 수집 시 전송할 키워드 문자열 ("마케팅:20, 숏폼:30")
  const buildKeywordString = () =>
    parsedKeywords.map(k => `${k}:${keywordCounts[k] ?? 30}`).join(', ');

  // 총 수집 개수
  const totalCount = parsedKeywords.reduce((sum, k) => sum + (keywordCounts[k] ?? 30), 0);

  const [showBrandModal, setShowBrandModal] = useState(false);
  const [fromExtension,  setFromExtension]  = useState(false);

  // ── 1. Eden Crawl 확장 프로그램 연동 ──
  // CrawlingPage에서 수신한 extensionData prop이 바뀌면 적용
  useEffect(() => {
    if (!extensionData?.posts?.length) return;
    setKeyword(extensionData.keyword || "");
    setPosts(extensionData.posts);
    setExpandedRows(new Set());
    setAnalysisMap({});
    setIdeasMap({});
    setFilterMin(0);
    setFromExtension(true);
    if (onExtensionDataConsumed) onExtensionDataConsumed();
  }, [extensionData]);

  // ── 2. 원문 펼치기/접기 ──
  const toggleExpand = useCallback((origIdx) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(origIdx) ? next.delete(origIdx) : next.add(origIdx);
      return next;
    });
  }, []);

  // ── 3. AI 바이럴 분석 ──
  const handleAnalyze = useCallback(async (origIdx) => {
    const post = posts[origIdx];
    setAnalysisMap(prev => ({ ...prev, [origIdx]: { loading: true, data: null, error: null } }));
    setIdeasMap(prev => { const n = { ...prev }; delete n[origIdx]; return n; });

    try {
      const res = await callGemini(
        [{ role: "user", content:
`다음 쓰레드 게시물의 바이럴 성공 요인을 심층 분석해주세요.

작성자: ${post.author}
내용: ${post.content}
좋아요: ${post.likes} | 댓글: ${post.comments} | 공유: ${post.shares}

JSON 형식으로만 반환:
{
  "summary": "이 게시물이 바이럴된 이유 한 줄 요약",
  "keywords": ["핵심 키워드1", "키워드2", "키워드3"],
  "tone": "유머러스|정보성|감성적|솔직한|도발적|공감형 중 하나",
  "viral_factors": [
    {"factor": "요인명", "desc": "설명 한 문장"},
    {"factor": "요인명", "desc": "설명 한 문장"},
    {"factor": "요인명", "desc": "설명 한 문장"}
  ],
  "hook": "이 게시물의 첫 문장이 독자를 끌어당기는 방식",
  "meme_elements": ["사용된 밈/문화적 요소 (없으면 빈 배열)"]
}`
        }],
        "당신은 소셜미디어 바이럴 콘텐츠 분석 전문가입니다. JSON 형식으로만 응답하세요."
      );
      const data = parseJSON(res);
      if (!data) throw new Error("분석 파싱 실패");
      setAnalysisMap(prev => ({ ...prev, [origIdx]: { loading: false, data, error: null } }));
    } catch (e) {
      setAnalysisMap(prev => ({
        ...prev,
        [origIdx]: { loading: false, data: null, error: e.message || "분석 실패" },
      }));
    }
  }, [posts]);

  // ── 4. 콘텐츠 아이디어 생성 ──
  const handleGenerateIdeas = useCallback(async (origIdx) => {
    const post = posts[origIdx];
    const analysis = analysisMap[origIdx]?.data;
    if (!analysis) return;
    const brand = loadBrand();
    const brandInfo = brand.name
      ? `브랜드: ${brand.name} / 타겟: ${brand.target || "일반"} / 톤앤매너: ${brand.tone || "자유"}`
      : "브랜드 정보 없음 (일반 마케터 관점)";

    setIdeasMap(prev => ({ ...prev, [origIdx]: { loading: true, data: null, error: null } }));

    try {
      const res = await callGemini(
        [{ role: "user", content:
`다음 바이럴 분석을 바탕으로 콘텐츠 아이디어 5개를 생성해주세요.

원본 게시물: ${post.content}
바이럴 요인: ${JSON.stringify(analysis.viral_factors)}
핵심 키워드: ${analysis.keywords?.join(", ")}
${brandInfo}

JSON 배열 형식으로만 반환:
[
  {
    "title": "아이디어 제목 (20자 내외)",
    "hook": "첫 문장 후킹 멘트 (실제로 쓸 수 있는 문장)",
    "summary": "아이디어 설명 1~2문장",
    "keywords": ["키워드1", "키워드2"],
    "why": "이 아이디어가 바이럴될 이유"
  }
]`
        }],
        "당신은 소셜미디어 콘텐츠 기획 전문가입니다. JSON 형식으로만 응답하세요."
      );
      const data = parseJSON(res);
      if (!Array.isArray(data)) throw new Error("아이디어 파싱 실패");
      setIdeasMap(prev => ({ ...prev, [origIdx]: { loading: false, data, error: null } }));
    } catch (e) {
      setIdeasMap(prev => ({
        ...prev,
        [origIdx]: { loading: false, data: null, error: e.message || "아이디어 생성 실패" },
      }));
    }
  }, [posts, analysisMap]);

  // ── 정렬 + 필터 ──
  const SORT_OPTIONS = [
    { key: "rank",     label: "순서" },
    { key: "likes",    label: "좋아요" },
    { key: "comments", label: "댓글" },
    { key: "shares",   label: "리포스트" },
    { key: "views",    label: "조회수" },
  ];
  const sortField = sortBy === "latest" ? "rank" : sortBy;
  // 키워드 필터 적용 후 정렬
  const uniqueKeywords = [...new Set(posts.map(p => p.keyword).filter(Boolean))];
  const sortedPosts = [...posts]
    .filter(p => (p[sortField] || 0) >= filterMin)
    .filter(p => keywordFilter === null || p.keyword === keywordFilter)
    .sort((a, b) => sortField === "rank" ? a.rank - b.rank : (b[sortField] || 0) - (a[sortField] || 0))
    .map((p, i) => ({ ...p, origIdx: posts.indexOf(p), displayRank: i + 1 }));

  const brand    = loadBrand();
  const hasBrand = brand.name || brand.target || brand.tone;

  return (
    <div className="space-y-5">

      {/* ── 상단 컨트롤 ── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
          </div>
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && keyword.trim() && window.postMessage({ type: 'EDEN_START_CRAWL', keyword: buildKeywordString(), count: totalCount }, '*')}
            placeholder="키워드 입력 (예: 숏폼, AI 마케팅)"
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 shadow-sm"
          />
        </div>

        {/* 키워드별 개수 설정 */}
        {parsedKeywords.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {parsedKeywords.map(kw => (
              <div key={kw} className="flex items-center gap-1 bg-purple-50 border border-purple-200 rounded-lg px-2 py-1">
                <span className="text-xs text-purple-700 font-medium max-w-[80px] truncate">{kw}</span>
                <input
                  type="number"
                  min={5}
                  max={200}
                  value={keywordCounts[kw] ?? 30}
                  onChange={e => setKeywordCounts(prev => ({
                    ...prev,
                    [kw]: Math.min(200, Math.max(5, parseInt(e.target.value) || 30))
                  }))}
                  className="w-12 px-1 py-0.5 border border-purple-300 rounded text-xs text-center font-medium text-purple-800 focus:outline-none focus:border-purple-500 bg-white"
                  title={`"${kw}" 수집 개수 (5~200)`}
                />
                <span className="text-[10px] text-purple-500">개</span>
              </div>
            ))}
            {parsedKeywords.length > 1 && (
              <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1">
                <span className="text-[10px] text-gray-500">합계</span>
                <span className="text-xs font-bold text-gray-700">{totalCount}</span>
                <span className="text-[10px] text-gray-500">개</span>
              </div>
            )}
          </div>
        )}

        {/* 메인 수집 버튼 (확장 프로그램 기반) */}
        <ExtensionCrawlButton keyword={buildKeywordString()} count={totalCount} />

        {/* 브랜드 설정 버튼 */}
        <button
          onClick={() => setShowBrandModal(true)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
            hasBrand
              ? "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100"
              : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
          </svg>
          {hasBrand ? `브랜드: ${brand.name || "설정됨"}` : "브랜드 설정"}
        </button>
      </div>

      {/* ── 확장 프로그램 수신 안내 ── */}
      {fromExtension && posts.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-xl">
          <span className="text-purple-600 text-sm">🧩</span>
          <p className="text-xs text-purple-700 font-medium">
            Eden Crawl 확장 프로그램에서 데이터가 수신됐습니다.
          </p>
          <button
            onClick={() => setFromExtension(false)}
            className="ml-auto text-purple-400 hover:text-purple-600 text-xs"
          >✕</button>
        </div>
      )}

      {/* ── 빈 상태 ── */}
      {posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-5xl mb-4">🧵</span>
          <p className="text-sm font-medium text-gray-500 mb-1">쓰레드 인기글을 실시간으로 수집합니다</p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            키워드를 입력하면 Threads.com에서 실제 게시물을 크롤링하고<br />
            AI가 바이럴 성공 요인을 분석합니다
          </p>
        </div>
      )}

      {/* ── 게시물 목록 ── */}
      {posts.length > 0 && (
        <div className="space-y-4">

          {/* ── 키워드 필터 탭 (멀티키워드인 경우) ── */}
          {uniqueKeywords.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setKeywordFilter(null)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  keywordFilter === null
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                전체 ({posts.length})
              </button>
              {uniqueKeywords.map(kw => (
                <button
                  key={kw}
                  onClick={() => setKeywordFilter(kw)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                    keywordFilter === kw
                      ? "bg-violet-600 text-white shadow-sm"
                      : "bg-violet-50 text-violet-700 hover:bg-violet-100"
                  }`}
                >
                  {kw} ({posts.filter(p => p.keyword === kw).length})
                </button>
              ))}
            </div>
          )}

          {/* ── 필터 + 정렬 바 ── */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm space-y-2">
            {/* 상단: 건수 + 필터 최솟값 */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500 flex-shrink-0">
                <span className="text-purple-600 font-semibold">{sortedPosts.length}</span>
                <span className="text-gray-400">/{posts.length}개</span>
                {keywordFilter
                  ? <>{" "}— <span className="text-violet-600 font-medium">"{keywordFilter}"</span></>
                  : <>{" "}— <span className="text-gray-400">"{keyword}"</span></>
                }
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 flex-shrink-0">최솟값</span>
                <input
                  type="number"
                  min={0}
                  value={filterMin}
                  onChange={e => setFilterMin(Math.max(0, Number(e.target.value) || 0))}
                  className="w-20 px-2 py-1 border border-gray-200 rounded-lg text-xs text-center focus:outline-none focus:border-purple-400"
                  placeholder="0"
                />
                {filterMin > 0 && (
                  <button onClick={() => setFilterMin(0)} className="text-xs text-gray-400 hover:text-gray-600">✕</button>
                )}
              </div>
            </div>
            {/* 하단: 정렬 탭 */}
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-400 mr-1 flex-shrink-0">정렬</span>
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 flex-wrap">
                {SORT_OPTIONS.map(s => (
                  <button
                    key={s.key}
                    onClick={() => setSortBy(s.key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                      sortField === s.key
                        ? "bg-white text-purple-700 shadow-sm font-semibold"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 카드 목록 */}
          <div className="space-y-2">
            {sortedPosts.map(({ origIdx, displayRank, ...post }) => {
              const isExpanded = expandedRows.has(origIdx);
              const aState = analysisMap[origIdx];
              const iState = ideasMap[origIdx];

              return (
                <div
                  key={origIdx}
                  className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all ${
                    isExpanded ? "border-purple-200" : "border-gray-200"
                  }`}
                >
                  {/* ── 요약 행 ── */}
                  <div
                    onClick={() => toggleExpand(origIdx)}
                    className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-all ${
                      isExpanded ? "bg-purple-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex-shrink-0 w-6 text-center text-xs font-mono text-gray-400 mt-0.5">
                      {displayRank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold ${isExpanded ? "text-purple-600" : "text-gray-500"}`}>
                          {post.author}
                        </span>
                        {post.keyword && <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-100 text-violet-700 whitespace-nowrap">{post.keyword}</span>}
                        {aState?.data?.tone && <ToneBadge tone={aState.data.tone} />}
                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{post.time}</span>
                      </div>
                      <p className={`text-sm text-gray-800 ${isExpanded ? "" : "line-clamp-2"}`}>
                        {post.content}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                      <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-right">
                        {[
                          { icon: "❤", label: "좋아요",  val: post.likes    },
                          { icon: "💬", label: "댓글",    val: post.comments },
                          { icon: "🔁", label: "리포스트", val: post.shares  },
                          { icon: "👁", label: "조회수",  val: post.views    },
                          { icon: "↗", label: "공유",    val: post.reposts  },
                        ].map(({ icon, label, val }) => (
                          <div key={label} className="flex flex-col items-end">
                            <span className={`text-xs font-semibold ${
                              sortField === { "❤":"likes","💬":"comments","🔁":"shares","👁":"views","↗":"reposts" }[icon]
                                ? "text-purple-600"
                                : "text-gray-700"
                            }`}>
                              {Number(val || 0).toLocaleString()}
                            </span>
                            <span className="text-[10px] text-gray-400">{label}</span>
                          </div>
                        ))}
                      </div>
                      <svg
                        xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2"
                        className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      >
                        <path d="m6 9 6 6 6-6"/>
                      </svg>
                    </div>
                  </div>

                  {/* ── 펼쳐진 영역 ── */}
                  {isExpanded && (
                    <div className="border-t border-purple-100">

                      {/* 원문 */}
                      <div className="px-5 py-4 bg-white">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-gray-500">원문</p>
                          {post.postUrl && (
                            <a
                              href={post.postUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-500 underline"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                              Threads에서 보기
                            </a>
                          )}
                        </div>
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                          {post.content}
                        </p>
                      </div>

                      {/* 분석 버튼 영역 */}
                      <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
                        {!aState && (
                          <button
                            onClick={e => { e.stopPropagation(); handleAnalyze(origIdx); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                            </svg>
                            AI 바이럴 분석
                          </button>
                        )}
                        {aState?.loading && (
                          <div className="flex items-center gap-1.5 px-4 py-2 bg-purple-50 text-purple-600 text-xs font-semibold rounded-lg">
                            <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            분석 중...
                          </div>
                        )}
                        {aState?.data && !aState.loading && (
                          <button
                            onClick={e => { e.stopPropagation(); handleAnalyze(origIdx); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-600 text-xs font-medium rounded-lg border border-purple-200 hover:bg-purple-100 transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                              <path d="M21 3v5h-5"/>
                            </svg>
                            재분석
                          </button>
                        )}
                        {aState?.error && !aState.loading && (
                          <button
                            onClick={e => { e.stopPropagation(); handleAnalyze(origIdx); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-500 text-xs font-medium rounded-lg border border-red-200 hover:bg-red-100 transition-all"
                          >
                            분석 실패 — 재시도
                          </button>
                        )}
                      </div>

                      {/* 분석 결과 */}
                      {aState?.data && !aState.loading && (
                        <div className="mx-5 mb-5 bg-purple-50 rounded-xl p-4 space-y-3 border border-purple-100">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                            <span className="text-xs font-bold text-purple-800">AI 바이럴 분석 결과</span>
                          </div>

                          <div className="bg-white rounded-lg px-3 py-2 border border-purple-100">
                            <p className="text-xs text-purple-400 font-medium mb-0.5">요약</p>
                            <p className="text-sm text-purple-900 font-medium">{aState.data.summary}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1.5">핵심 키워드</p>
                              <div className="flex flex-wrap gap-1">
                                {aState.data.keywords?.map((k, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">#{k}</span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1.5">톤앤매너</p>
                              {aState.data.tone && <ToneBadge tone={aState.data.tone} />}
                            </div>
                          </div>

                          {aState.data.hook && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">후킹 방식</p>
                              <p className="text-xs text-gray-700 bg-white rounded-lg px-3 py-2 border border-purple-100">
                                {aState.data.hook}
                              </p>
                            </div>
                          )}

                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1.5">바이럴 성공 요인</p>
                            <div className="space-y-1.5">
                              {aState.data.viral_factors?.map((f, i) => (
                                <div key={i} className="flex gap-2 bg-white rounded-lg px-3 py-2 border border-purple-100">
                                  <span className="flex-shrink-0 w-4 h-4 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold mt-0.5">{i + 1}</span>
                                  <div>
                                    <p className="text-xs font-semibold text-gray-700">{f.factor}</p>
                                    <p className="text-xs text-gray-500">{f.desc}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {aState.data.meme_elements?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1.5">밈 / 문화적 요소</p>
                              <div className="flex flex-wrap gap-1">
                                {aState.data.meme_elements.map((m, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded-full font-medium">{m}</span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 아이디어 생성 버튼 */}
                          <div className="pt-1">
                            {!iState && (
                              <button
                                onClick={e => { e.stopPropagation(); handleGenerateIdeas(origIdx); }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-sm font-semibold rounded-xl shadow-md transition-all"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                                </svg>
                                콘텐츠 아이디어 생성하기
                                {hasBrand && (
                                  <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">
                                    {brand.name} 맞춤
                                  </span>
                                )}
                              </button>
                            )}
                            {iState?.loading && (
                              <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-100 text-purple-600 text-sm font-semibold rounded-xl">
                                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                                </svg>
                                아이디어 생성 중...
                              </div>
                            )}
                            {iState?.data && !iState.loading && (
                              <button
                                onClick={e => { e.stopPropagation(); handleGenerateIdeas(origIdx); }}
                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-purple-600 text-xs font-medium rounded-xl border border-purple-200 hover:bg-purple-50 transition-all"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                                  <path d="M21 3v5h-5"/>
                                </svg>
                                아이디어 재생성
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 콘텐츠 아이디어 */}
                      {iState?.data && !iState.loading && (
                        <div className="mx-5 mb-5 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                          <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600">
                              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                            </svg>
                            <span className="text-xs font-bold text-gray-800">AI 콘텐츠 아이디어</span>
                            <span className="text-xs text-gray-400">{iState.data.length}개</span>
                          </div>
                          <div className="p-3 space-y-2">
                            {iState.data.map((idea, i) => (
                              <div
                                key={i}
                                className="border border-gray-200 rounded-xl p-3.5 hover:border-purple-300 hover:bg-purple-50/30 transition-all group cursor-pointer"
                              >
                                <div className="flex items-start gap-2.5">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold group-hover:bg-purple-600 group-hover:text-white transition-all mt-0.5">
                                    {i + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 mb-1.5">{idea.title}</p>
                                    <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2 border border-gray-100">
                                      <p className="text-[10px] text-gray-400 font-medium mb-0.5">첫 문장 (후킹)</p>
                                      <p className="text-sm text-gray-700 italic">&ldquo;{idea.hook}&rdquo;</p>
                                    </div>
                                    <p className="text-xs text-gray-500 mb-2">{idea.summary}</p>
                                    <div className="flex items-center flex-wrap gap-1 mb-1.5">
                                      {idea.keywords?.map((k, j) => (
                                        <span key={j} className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[11px] rounded-full">#{k}</span>
                                      ))}
                                    </div>
                                    {idea.why && (
                                      <p className="text-[11px] text-purple-500 font-medium">💡 {idea.why}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {iState?.error && !iState.loading && (
                        <div className="mx-5 mb-5 p-3 bg-red-50 rounded-lg text-red-500 text-xs">
                          {iState.error}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showBrandModal && <BrandModal onClose={() => setShowBrandModal(false)} />}
    </div>
  );
}
