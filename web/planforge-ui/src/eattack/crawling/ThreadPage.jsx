/**
 * 쓰레드 AI 트렌드 분석 대시보드
 * - 행 클릭 → 원문 펼치기/접기
 * - [AI 분석] 버튼 → 바이럴 분석 실행
 * - [아이디어 생성] 버튼 → 콘텐츠 아이디어 5개 생성
 * - 브랜드 프로필: localStorage 저장
 */
import { useState, useCallback } from "react";
import { callGemini } from "../../utils/gemini";

// ─── 브랜드 프로필 ───
const BRAND_KEY = "eattack_brand_profile";
function loadBrand() {
  try { return JSON.parse(localStorage.getItem(BRAND_KEY)) || { name: "", target: "", tone: "" }; }
  catch { return { name: "", target: "", tone: "" }; }
}
function saveBrand(data) { localStorage.setItem(BRAND_KEY, JSON.stringify(data)); }

// ─── JSON 파싱 헬퍼 ───
function parseJSON(text) {
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (m) { try { return JSON.parse(m[1] || m[0]); } catch { return null; } }
  return null;
}

// ─── 톤 색상 ───
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

// ─── 브랜드 모달 ───
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
                type="text" value={brand[f.key]}
                onChange={e => setBrand(p => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">취소</button>
          <button onClick={() => { saveBrand(brand); onClose(); }} className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-500 rounded-xl">저장</button>
        </div>
      </div>
    </div>
  );
}

// ─── 메인 ───
export default function ThreadPage() {
  const [keyword, setKeyword]           = useState("");
  const [posts, setPosts]               = useState([]);
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectError, setCollectError] = useState("");
  const [sortBy, setSortBy]             = useState("likes");

  // 원문 펼침 (여러 개 동시 가능)
  const [expandedRows, setExpandedRows] = useState(new Set());

  // 분석 (게시물별 개별 저장)
  const [analysisMap, setAnalysisMap]   = useState({}); // { origIdx: { loading, data, error } }

  // 아이디어 (게시물별)
  const [ideasMap, setIdeasMap]         = useState({}); // { origIdx: { loading, data, error } }

  const [showBrandModal, setShowBrandModal] = useState(false);

  // ── 1. 트렌드 수집 ──
  const handleCollect = useCallback(async () => {
    if (!keyword.trim()) return;
    setCollectLoading(true);
    setCollectError("");
    setPosts([]);
    setExpandedRows(new Set());
    setAnalysisMap({});
    setIdeasMap({});

    try {
      const res = await callGemini(
        [{ role: "user", content:
`쓰레드(Threads SNS)에서 "${keyword}" 키워드로 검색했을 때 나올 법한 인기 게시물 10개를 생성해주세요.
실제 쓰레드 사용자들이 쓰는 것처럼 자연스럽고 현실적으로 작성해주세요. 한국어로 작성하세요.

JSON 배열 형식으로만 반환:
[
  {
    "rank": 1,
    "author": "@유저명",
    "content": "게시물 본문 (3~5문장, 이모지 포함, 실제 바이럴될 만한 내용)",
    "likes": 숫자,
    "comments": 숫자,
    "shares": 숫자,
    "time": "N시간 전 또는 N일 전",
    "tone": "유머러스|정보성|감성적|솔직한|도발적|공감형 중 하나"
  }
]`
        }],
        "당신은 소셜미디어 트렌드 분석 전문가입니다. JSON 형식으로만 응답하세요."
      );
      const data = parseJSON(res);
      if (!Array.isArray(data)) throw new Error("데이터 파싱 실패");
      setPosts(data);
    } catch (e) {
      setCollectError(e.message || "인기글 수집에 실패했습니다.");
    } finally {
      setCollectLoading(false);
    }
  }, [keyword]);

  // ── 2. 원문 펼치기/접기 (행 클릭) ──
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
      setAnalysisMap(prev => ({ ...prev, [origIdx]: { loading: false, data: null, error: e.message || "분석 실패" } }));
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
      setIdeasMap(prev => ({ ...prev, [origIdx]: { loading: false, data: null, error: e.message || "아이디어 생성 실패" } }));
    }
  }, [posts, analysisMap]);

  // ── 정렬 ──
  const sortedPosts = [...posts]
    .sort((a, b) => sortBy === "likes" ? b.likes - a.likes : b.rank - a.rank)
    .map((p, i) => ({ ...p, origIdx: posts.indexOf(p), displayRank: i + 1 }));

  const brand = loadBrand();
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
            type="text" value={keyword}
            onChange={e => setKeyword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !collectLoading && keyword.trim() && handleCollect()}
            placeholder="키워드 입력 (예: AI 마케팅, 자기계발)"
            disabled={collectLoading}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 disabled:opacity-50 shadow-sm"
          />
        </div>
        <button
          onClick={handleCollect}
          disabled={collectLoading || !keyword.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg shadow-sm transition-all"
        >
          {collectLoading
            ? <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            : <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          }
          {collectLoading ? "수집 중..." : "트렌드 수집"}
        </button>
        <button
          onClick={() => setShowBrandModal(true)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
            hasBrand ? "bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100" : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          {hasBrand ? `브랜드: ${brand.name || "설정됨"}` : "브랜드 설정"}
        </button>
      </div>

      {/* ── 에러 ── */}
      {collectError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
          {collectError}
          <button onClick={handleCollect} className="ml-auto text-red-500 underline text-xs">재시도</button>
        </div>
      )}

      {/* ── 로딩 ── */}
      {collectLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <svg className="animate-spin w-8 h-8 text-purple-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-gray-600 text-sm font-medium">"{keyword}" 트렌드 수집 중...</p>
          <p className="text-gray-400 text-xs mt-1">AI가 인기 게시물 10개를 분석하고 있습니다</p>
        </div>
      )}

      {/* ── 빈 상태 ── */}
      {!collectLoading && posts.length === 0 && !collectError && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-5xl mb-4">🧵</span>
          <p className="text-sm font-medium text-gray-500 mb-1">쓰레드 트렌드를 분석해보세요</p>
          <p className="text-xs text-gray-400 text-center max-w-xs">키워드를 입력하면 AI가 인기 게시물을 수집하고<br/>바이럴 성공 요인을 분석합니다</p>
        </div>
      )}

      {/* ── 인기글 목록 ── */}
      {!collectLoading && posts.length > 0 && (
        <div className="space-y-4">

          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              <span className="text-purple-600 font-semibold">{posts.length}</span>개 인기글 —{" "}
              <span className="text-gray-400">"{keyword}"</span>
              <span className="ml-2 text-gray-400">· 행 클릭 시 원문 펼침</span>
            </p>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {[{ key: "likes", label: "좋아요 순" }, { key: "latest", label: "최신 순" }].map(s => (
                <button key={s.key} onClick={() => setSortBy(s.key)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${sortBy === s.key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 게시물 카드 목록 */}
          <div className="space-y-2">
            {sortedPosts.map(({ origIdx, displayRank, ...post }) => {
              const isExpanded = expandedRows.has(origIdx);
              const aState = analysisMap[origIdx];
              const iState = ideasMap[origIdx];

              return (
                <div key={origIdx} className={`bg-white border rounded-xl overflow-hidden shadow-sm transition-all ${isExpanded ? "border-purple-200" : "border-gray-200"}`}>

                  {/* ── 행 (항상 표시) ── */}
                  <div
                    onClick={() => toggleExpand(origIdx)}
                    className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-all ${isExpanded ? "bg-purple-50" : "hover:bg-gray-50"}`}
                  >
                    {/* 순위 */}
                    <span className="flex-shrink-0 w-6 text-center text-xs font-mono text-gray-400 mt-0.5">{displayRank}</span>

                    {/* 본문 (미리보기) */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold ${isExpanded ? "text-purple-600" : "text-gray-500"}`}>{post.author}</span>
                        <ToneBadge tone={post.tone} />
                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{post.time}</span>
                      </div>
                      <p className={`text-sm text-gray-800 ${isExpanded ? "" : "line-clamp-2"}`}>{post.content}</p>
                    </div>

                    {/* 반응 수 + 펼침 아이콘 */}
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>❤ {Number(post.likes).toLocaleString()}</span>
                        <span>💬 {Number(post.comments).toLocaleString()}</span>
                        <span>🔁 {Number(post.shares).toLocaleString()}</span>
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

                      {/* 원문 전체 */}
                      <div className="px-5 py-4 bg-white">
                        <p className="text-xs font-semibold text-gray-500 mb-2">원문</p>
                        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                          {post.content}
                        </p>
                      </div>

                      {/* 버튼 영역 */}
                      <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
                        {/* AI 분석 버튼 */}
                        {!aState && (
                          <button
                            onClick={e => { e.stopPropagation(); handleAnalyze(origIdx); }}
                            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-all shadow-sm"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                            AI 바이럴 분석
                          </button>
                        )}
                        {aState?.loading && (
                          <div className="flex items-center gap-1.5 px-4 py-2 bg-purple-50 text-purple-600 text-xs font-semibold rounded-lg">
                            <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                            분석 중...
                          </div>
                        )}
                        {aState?.data && !aState.loading && (
                          <button
                            onClick={e => { e.stopPropagation(); handleAnalyze(origIdx); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 text-purple-600 text-xs font-medium rounded-lg border border-purple-200 hover:bg-purple-100 transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
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

                      {/* ── 분석 결과 ── */}
                      {aState?.data && !aState.loading && (
                        <div className="mx-5 mb-5 bg-purple-50 rounded-xl p-4 space-y-3 border border-purple-100">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-2 h-2 rounded-full bg-purple-500" />
                            <span className="text-xs font-bold text-purple-800">AI 바이럴 분석 결과</span>
                          </div>

                          {/* 요약 */}
                          <div className="bg-white rounded-lg px-3 py-2 border border-purple-100">
                            <p className="text-xs text-purple-400 font-medium mb-0.5">요약</p>
                            <p className="text-sm text-purple-900 font-medium">{aState.data.summary}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            {/* 키워드 */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1.5">핵심 키워드</p>
                              <div className="flex flex-wrap gap-1">
                                {aState.data.keywords?.map((k, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full font-medium">#{k}</span>
                                ))}
                              </div>
                            </div>
                            {/* 톤 */}
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1.5">톤앤매너</p>
                              {aState.data.tone && <ToneBadge tone={aState.data.tone} />}
                            </div>
                          </div>

                          {/* 후킹 */}
                          {aState.data.hook && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">후킹 방식</p>
                              <p className="text-xs text-gray-700 bg-white rounded-lg px-3 py-2 border border-purple-100">{aState.data.hook}</p>
                            </div>
                          )}

                          {/* 바이럴 요인 */}
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

                          {/* 밈 */}
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
                                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                                콘텐츠 아이디어 생성하기
                                {hasBrand && <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{brand.name} 맞춤</span>}
                              </button>
                            )}
                            {iState?.loading && (
                              <div className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-100 text-purple-600 text-sm font-semibold rounded-xl">
                                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                                아이디어 생성 중...
                              </div>
                            )}
                            {iState?.data && !iState.loading && (
                              <button
                                onClick={e => { e.stopPropagation(); handleGenerateIdeas(origIdx); }}
                                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-white text-purple-600 text-xs font-medium rounded-xl border border-purple-200 hover:bg-purple-50 transition-all"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                                아이디어 재생성
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ── 콘텐츠 아이디어 ── */}
                      {iState?.data && !iState.loading && (
                        <div className="mx-5 mb-5 bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                          <div className="px-4 py-3 bg-gradient-to-r from-purple-50 to-pink-50 border-b border-gray-100 flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-purple-600"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>
                            <span className="text-xs font-bold text-gray-800">AI 콘텐츠 아이디어</span>
                            <span className="text-xs text-gray-400">{iState.data.length}개</span>
                          </div>
                          <div className="p-3 space-y-2">
                            {iState.data.map((idea, i) => (
                              <div key={i} className="border border-gray-200 rounded-xl p-3.5 hover:border-purple-300 hover:bg-purple-50/30 transition-all group cursor-pointer">
                                <div className="flex items-start gap-2.5">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-[10px] font-bold group-hover:bg-purple-600 group-hover:text-white transition-all mt-0.5">
                                    {i + 1}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 mb-1.5">{idea.title}</p>
                                    <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2 border border-gray-100">
                                      <p className="text-[10px] text-gray-400 font-medium mb-0.5">첫 문장 (후킹)</p>
                                      <p className="text-sm text-gray-700 italic">"{idea.hook}"</p>
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
                        <div className="mx-5 mb-5 p-3 bg-red-50 rounded-lg text-red-500 text-xs">{iState.error}</div>
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
