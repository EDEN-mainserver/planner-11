/**
 * X(Twitter) 실시간 크롤링 대시보드
 * - 실제 X.com 검색 결과를 크롤링
 * - 쿠키 설정으로 로그인 세션 주입 (더 많은 결과)
 * - 트렌딩 키워드 칩 → 클릭 시 바로 검색
 * - 행 클릭 → 원문 펼치기/접기 + 원본 링크
 * - [AI 분석] 버튼 → 바이럴 분석 (Gemini)
 * - [아이디어 생성] 버튼 → 콘텐츠 아이디어 5개 생성
 */
import { useState, useCallback, useEffect } from "react";
import { callGemini } from "../../utils/gemini";

// ── API 엔드포인트 ──
const IS_LOCAL = window.location.hostname === "localhost";
const CRAWL_URL    = IS_LOCAL ? "http://localhost:8001/api/crawl/x/search" : "/api/x-crawl";
const TRENDS_URL   = IS_LOCAL ? "http://localhost:8001/api/crawl/x"        : "/api/x-trends";

// ── 쿠키 관리 (localStorage) ──
const COOKIES_KEY = "x_cookies_json";
function loadCookies() {
  try { return JSON.parse(localStorage.getItem(COOKIES_KEY) || "[]"); }
  catch { return []; }
}
function saveCookies(arr) { localStorage.setItem(COOKIES_KEY, JSON.stringify(arr)); }
function clearCookies()   { localStorage.removeItem(COOKIES_KEY); }

// ── 브랜드 프로필 (Threads와 공유) ──
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
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {tone}
    </span>
  );
}

// ── 쿠키 설정 모달 ──
function CookieModal({ onClose }) {
  const [raw, setRaw] = useState(() => {
    const c = loadCookies();
    return c.length ? JSON.stringify(c, null, 2) : "";
  });
  const [error, setError] = useState("");

  const handleSave = () => {
    setError("");
    if (!raw.trim()) { clearCookies(); onClose(); return; }
    try {
      const parsed = JSON.parse(raw.trim());
      if (!Array.isArray(parsed)) throw new Error("JSON 배열 형식이어야 합니다");
      saveCookies(parsed);
      onClose();
    } catch (e) {
      setError("JSON 형식 오류: " + e.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-800">X 쿠키 설정</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-4">
          <p className="text-xs font-bold text-gray-800 mb-2">쿠키 추출 방법 (Chrome)</p>
          <ol className="text-xs text-gray-600 space-y-1 list-decimal list-inside">
            <li>Chrome에서 <strong>x.com</strong>에 로그인</li>
            <li>Chrome 웹스토어에서 <strong>&quot;Cookie-Editor&quot;</strong> 확장 설치</li>
            <li>X 탭에서 Cookie-Editor 아이콘 클릭</li>
            <li>우측 상단 <strong>Export → Export as JSON</strong> 클릭</li>
            <li>복사된 JSON을 아래 입력창에 붙여넣기</li>
          </ol>
          <p className="text-[11px] text-gray-400 mt-2">
            쿠키는 이 브라우저 로컬에만 저장되며 크롤링 요청 시 서버에 전달됩니다.
          </p>
        </div>

        <textarea
          value={raw}
          onChange={e => { setRaw(e.target.value); setError(""); }}
          placeholder={'[{"name": "auth_token", "value": "...", "domain": ".x.com", ...}]'}
          rows={8}
          className="w-full px-3 py-2 text-xs font-mono border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 resize-none"
        />
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}

        <div className="flex gap-2 mt-4">
          <button
            onClick={() => { clearCookies(); setRaw(""); }}
            className="px-3 py-2 text-xs text-red-500 border border-red-200 rounded-xl hover:bg-red-50"
          >
            초기화
          </button>
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-xl"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
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
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
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
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
            취소
          </button>
          <button
            onClick={() => { saveBrand(brand); onClose(); }}
            className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-700 rounded-xl"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────── 메인 컴포넌트 ───────────────────────
export default function XPage() {
  const [keyword, setKeyword]               = useState("");
  const [posts, setPosts]                   = useState([]);
  const [collectLoading, setCollectLoading] = useState(false);
  const [collectError, setCollectError]     = useState("");
  const [sortBy, setSortBy]                 = useState("likes");

  const [trends, setTrends]         = useState([]);
  const [trendsLoading, setTrendsLoading] = useState(false);

  const [expandedRows, setExpandedRows] = useState(new Set());
  const [analysisMap, setAnalysisMap]   = useState({});
  const [ideasMap, setIdeasMap]         = useState({});

  const [showBrandModal,  setShowBrandModal]  = useState(false);
  const [showCookieModal, setShowCookieModal] = useState(false);

  // ── 트렌딩 키워드 로딩 (마운트 시) ──
  useEffect(() => {
    setTrendsLoading(true);
    fetch(TRENDS_URL)
      .then(r => r.json())
      .then(data => {
        if (data.posts?.length) setTrends(data.posts.slice(0, 10));
      })
      .catch(() => {})
      .finally(() => setTrendsLoading(false));
  }, []);

  // ── 1. 실제 크롤링 ──
  const handleCollect = useCallback(async (overrideKeyword) => {
    const kw = (overrideKeyword ?? keyword).trim();
    if (!kw) return;
    if (overrideKeyword) setKeyword(overrideKeyword);

    setCollectLoading(true);
    setCollectError("");
    setPosts([]);
    setExpandedRows(new Set());
    setAnalysisMap({});
    setIdeasMap({});

    try {
      const cookies = loadCookies();
      let res;

      if (IS_LOCAL) {
        const qs = new URLSearchParams({ keyword: kw, limit: "20" });
        if (cookies.length) qs.set("cookies", btoa(JSON.stringify(cookies)));
        res = await fetch(`${CRAWL_URL}?${qs}`);
      } else {
        res = await fetch(CRAWL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw, cookies }),
        });
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `서버 오류 (${res.status})`);
      }

      const data = await res.json();
      if (data.error && (!data.posts || data.posts.length === 0)) {
        throw new Error(data.error);
      }
      if (!Array.isArray(data.posts)) throw new Error("데이터 형식 오류");
      if (data.posts.length === 0) {
        const dbg = data.debug;
        let msg = cookies.length === 0
          ? "트윗을 찾을 수 없습니다. X 쿠키를 설정하면 더 많은 결과를 볼 수 있습니다."
          : "트윗을 찾을 수 없습니다. 쿠키를 갱신해주세요.";
        if (dbg?.articleCount === 0) msg += " (검색 결과 없음 — 로그인이 필요할 수 있습니다)";
        throw new Error(msg);
      }

      setPosts(data.posts);
    } catch (e) {
      setCollectError(e.message || "트윗 수집에 실패했습니다.");
    } finally {
      setCollectLoading(false);
    }
  }, [keyword]);

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
`다음 X(트위터) 게시물의 바이럴 성공 요인을 심층 분석해주세요.

작성자: ${post.author}
내용: ${post.content}
좋아요: ${post.likes} | 댓글: ${post.comments} | 리트윗: ${post.shares}

JSON 형식으로만 반환:
{
  "summary": "이 트윗이 바이럴된 이유 한 줄 요약",
  "keywords": ["핵심 키워드1", "키워드2", "키워드3"],
  "tone": "유머러스|정보성|감성적|솔직한|도발적|공감형 중 하나",
  "viral_factors": [
    {"factor": "요인명", "desc": "설명 한 문장"},
    {"factor": "요인명", "desc": "설명 한 문장"},
    {"factor": "요인명", "desc": "설명 한 문장"}
  ],
  "hook": "이 트윗의 첫 문장이 독자를 끌어당기는 방식",
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
`다음 바이럴 분석을 바탕으로 X(트위터)용 콘텐츠 아이디어 5개를 생성해주세요.

원본 트윗: ${post.content}
바이럴 요인: ${JSON.stringify(analysis.viral_factors)}
핵심 키워드: ${analysis.keywords?.join(", ")}
${brandInfo}

JSON 배열 형식으로만 반환:
[
  {
    "title": "아이디어 제목 (20자 내외)",
    "hook": "첫 문장 후킹 멘트 (실제로 쓸 수 있는 트윗 형식)",
    "summary": "아이디어 설명 1~2문장",
    "keywords": ["키워드1", "키워드2"],
    "why": "이 아이디어가 X에서 바이럴될 이유"
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

  // ── 정렬 ──
  const sortedPosts = [...posts]
    .sort((a, b) => sortBy === "likes" ? b.likes - a.likes : a.rank - b.rank)
    .map((p) => ({ ...p, origIdx: posts.indexOf(p), displayRank: posts.indexOf(p) + 1 }));

  const brand      = loadBrand();
  const hasBrand   = brand.name || brand.target || brand.tone;
  const hasCookies = loadCookies().length > 0;

  return (
    <div className="space-y-5">

      {/* ── 트렌딩 키워드 칩 ── */}
      {(trends.length > 0 || trendsLoading) && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium flex-shrink-0">
            🔥 지금 트렌드
          </span>
          {trendsLoading
            ? <span className="text-xs text-gray-300 animate-pulse">로딩 중...</span>
            : trends.map((t, i) => (
                <button
                  key={i}
                  onClick={() => !collectLoading && handleCollect(t.title)}
                  disabled={collectLoading}
                  className="px-2.5 py-1 text-xs font-medium rounded-full border border-gray-200 text-gray-600 hover:bg-gray-900 hover:text-white hover:border-gray-900 transition-all disabled:opacity-40"
                >
                  {t.title}
                </button>
              ))
          }
        </div>
      )}

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
            onKeyDown={e => e.key === "Enter" && !collectLoading && keyword.trim() && handleCollect()}
            placeholder="키워드 입력 (예: AI, 마케팅, K-pop)"
            disabled={collectLoading}
            className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:border-gray-500 focus:ring-2 focus:ring-gray-100 disabled:opacity-50 shadow-sm"
          />
        </div>

        <button
          onClick={() => handleCollect()}
          disabled={collectLoading || !keyword.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg shadow-sm transition-all"
        >
          {collectLoading
            ? <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            : <span className="font-bold text-base leading-none">𝕏</span>
          }
          {collectLoading ? "수집 중..." : "실시간 수집"}
        </button>

        {/* 쿠키 설정 버튼 */}
        <button
          onClick={() => setShowCookieModal(true)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
            hasCookies
              ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
              : "bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          {hasCookies ? "쿠키 설정됨 ✓" : "쿠키 설정"}
        </button>

        {/* 브랜드 설정 버튼 */}
        <button
          onClick={() => setShowBrandModal(true)}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-all ${
            hasBrand
              ? "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200"
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

      {/* ── 쿠키 미설정 안내 ── */}
      {!hasCookies && !collectLoading && posts.length === 0 && !collectError && (
        <div className="flex items-start gap-3 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-600 flex-shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <p className="text-xs font-semibold text-yellow-800">쿠키 설정 권장</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              X(트위터) 로그인 쿠키를 설정하면 더 많은 트윗을 가져올 수 있습니다.{" "}
              <button onClick={() => setShowCookieModal(true)} className="underline font-semibold">
                지금 설정하기
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── 에러 메시지 ── */}
      {collectError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-500 flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
          </svg>
          <span className="text-red-600 text-sm flex-1">{collectError}</span>
          <button onClick={() => handleCollect()} className="text-red-500 underline text-xs flex-shrink-0">
            재시도
          </button>
        </div>
      )}

      {/* ── 로딩 ── */}
      {collectLoading && (
        <div className="flex flex-col items-center justify-center py-16">
          <svg className="animate-spin w-8 h-8 text-gray-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          <p className="text-gray-600 text-sm font-medium">"{keyword}" 실시간 수집 중...</p>
          <p className="text-gray-400 text-xs mt-1">X.com에서 실제 트윗을 가져오고 있습니다 (최대 30초)</p>
        </div>
      )}

      {/* ── 빈 상태 ── */}
      {!collectLoading && posts.length === 0 && !collectError && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-5xl mb-4 font-bold">𝕏</span>
          <p className="text-sm font-medium text-gray-500 mb-1">X 트윗을 실시간으로 수집합니다</p>
          <p className="text-xs text-gray-400 text-center max-w-xs">
            키워드를 입력하거나 위 트렌드 칩을 클릭하면<br />
            X.com에서 실제 트윗을 크롤링하고<br />
            AI가 바이럴 성공 요인을 분석합니다
          </p>
        </div>
      )}

      {/* ── 게시물 목록 ── */}
      {!collectLoading && posts.length > 0 && (
        <div className="space-y-4">

          {/* 헤더 */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              <span className="text-gray-900 font-semibold">{posts.length}</span>개 트윗 —{" "}
              <span className="text-gray-400">"{keyword}"</span>
              <span className="ml-2 text-gray-400">· 행 클릭 시 원문 펼침</span>
            </p>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              {[{ key: "likes", label: "좋아요 순" }, { key: "latest", label: "순서 순" }].map(s => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    sortBy === s.key ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {s.label}
                </button>
              ))}
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
                    isExpanded ? "border-gray-400" : "border-gray-200"
                  }`}
                >
                  {/* ── 요약 행 ── */}
                  <div
                    onClick={() => toggleExpand(origIdx)}
                    className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-all ${
                      isExpanded ? "bg-gray-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex-shrink-0 w-6 text-center text-xs font-mono text-gray-400 mt-0.5">
                      {displayRank}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold ${isExpanded ? "text-gray-900" : "text-gray-500"}`}>
                          {post.author}
                        </span>
                        {aState?.data?.tone && <ToneBadge tone={aState.data.tone} />}
                        <span className="text-xs text-gray-400 ml-auto flex-shrink-0">{post.time}</span>
                      </div>
                      <p className={`text-sm text-gray-800 ${isExpanded ? "" : "line-clamp-2"}`}>
                        {post.content}
                      </p>
                    </div>
                    <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span>❤ {Number(post.likes || 0).toLocaleString()}</span>
                        <span>💬 {Number(post.comments || 0).toLocaleString()}</span>
                        <span>🔁 {Number(post.shares || 0).toLocaleString()}</span>
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
                    <div className="border-t border-gray-100">

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
                              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 underline"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                <polyline points="15 3 21 3 21 9"/>
                                <line x1="10" y1="14" x2="21" y2="3"/>
                              </svg>
                              X에서 보기
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
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 hover:bg-gray-700 rounded-lg transition-all"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                            </svg>
                            AI 분석
                          </button>
                        )}

                        {aState?.loading && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            분석 중...
                          </div>
                        )}

                        {aState?.error && (
                          <span className="text-xs text-red-500">{aState.error}</span>
                        )}

                        {aState?.data && !iState && (
                          <button
                            onClick={e => { e.stopPropagation(); handleGenerateIdeas(origIdx); }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all border border-gray-200"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                            </svg>
                            아이디어 생성
                          </button>
                        )}

                        {iState?.loading && (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                            </svg>
                            아이디어 생성 중...
                          </div>
                        )}
                      </div>

                      {/* AI 분석 결과 */}
                      {aState?.data && (
                        <div className="mx-5 mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-900" />
                            <span className="text-xs font-bold text-gray-700">바이럴 분석</span>
                            <ToneBadge tone={aState.data.tone} />
                          </div>

                          <p className="text-sm text-gray-800 mb-3 font-medium">{aState.data.summary}</p>

                          {aState.data.viral_factors?.length > 0 && (
                            <div className="space-y-1.5 mb-3">
                              {aState.data.viral_factors.map((f, i) => (
                                <div key={i} className="flex items-start gap-2">
                                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-gray-900 text-white text-[10px] flex items-center justify-center font-bold mt-0.5">
                                    {i + 1}
                                  </span>
                                  <div>
                                    <span className="text-xs font-semibold text-gray-700">{f.factor}</span>
                                    <span className="text-xs text-gray-500"> — {f.desc}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {aState.data.hook && (
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <p className="text-[11px] text-gray-400 font-medium mb-1">후킹 방식</p>
                              <p className="text-xs text-gray-700">{aState.data.hook}</p>
                            </div>
                          )}

                          {aState.data.keywords?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {aState.data.keywords.map((kw, i) => (
                                <span key={i} className="px-2 py-0.5 text-[11px] bg-gray-200 text-gray-600 rounded-full">
                                  #{kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* 아이디어 카드 */}
                      {iState?.data?.length > 0 && (
                        <div className="mx-5 mb-4 space-y-2">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                            <span className="text-xs font-bold text-gray-700">콘텐츠 아이디어 {iState.data.length}개</span>
                          </div>
                          {iState.data.map((idea, i) => (
                            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-gray-800">{idea.title}</span>
                                <div className="flex gap-1">
                                  {idea.keywords?.map((kw, j) => (
                                    <span key={j} className="px-2 py-0.5 text-[10px] bg-gray-100 text-gray-500 rounded-full">
                                      #{kw}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2 border border-gray-100">
                                <p className="text-[11px] text-gray-400 mb-1">후킹 문장</p>
                                <p className="text-sm text-gray-800 font-medium">&ldquo;{idea.hook}&rdquo;</p>
                              </div>
                              <p className="text-xs text-gray-600 mb-1.5">{idea.summary}</p>
                              <p className="text-[11px] text-gray-400 italic">{idea.why}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {iState?.error && (
                        <div className="mx-5 mb-4 text-xs text-red-500">{iState.error}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 모달 */}
      {showCookieModal && <CookieModal onClose={() => setShowCookieModal(false)} />}
      {showBrandModal  && <BrandModal  onClose={() => setShowBrandModal(false)}  />}
    </div>
  );
}
