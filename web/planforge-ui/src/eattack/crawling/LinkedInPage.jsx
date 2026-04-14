/**
 * LinkedIn 인기글 크롤링 대시보드
 * - Eden Crawl 확장 프로그램 기반 수집 (EDEN_START_LINKEDIN_CRAWL)
 * - 행 클릭 → 전문 펼치기/접기
 * - [AI 분석] 버튼 → 바이럴 분석 (Gemini)
 * - CSV 다운로드
 */
import { useState, useCallback, useEffect } from "react";
import { callGemini } from "../../utils/gemini";

// ── 브랜드 프로필 (ThreadPage와 공유) ──
const BRAND_KEY = "eattack_brand_profile";
function loadBrand() {
  try { return JSON.parse(localStorage.getItem(BRAND_KEY)) || { name: "", target: "", tone: "" }; }
  catch { return { name: "", target: "", tone: "" }; }
}

// ── JSON 파싱 헬퍼 ──
function parseJSON(text) {
  const m = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (m) { try { return JSON.parse(m[1] || m[0]); } catch { return null; } }
  return null;
}

// ── LinkedIn 수집 버튼 ──
function LinkedInCrawlButton({ keyword, count }) {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const handler = (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== 'EDEN_LINKEDIN_STATUS') return;
      setStatus(event.data.payload);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleStart = () => {
    if (!keyword.trim()) return;
    setStatus({ msg: '수집 요청 중...', done: false, error: false });
    window.postMessage({ type: 'EDEN_START_LINKEDIN_CRAWL', keyword: keyword.trim(), count }, '*');
  };

  const handleStop = () => {
    window.postMessage({ type: 'EDEN_STOP_LINKEDIN_CRAWL' }, '*');
    setStatus(prev => ({ ...(prev || {}), msg: '중지 요청 중...', done: false, error: false }));
  };

  const isCrawling = status && !status.done;
  const isDone     = status?.done && !status?.error;
  const isError    = status?.error;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <button
          onClick={handleStart}
          disabled={!keyword.trim() || isCrawling}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isCrawling
              ? "bg-blue-700 text-white cursor-not-allowed"
              : isDone
              ? "bg-green-500 hover:bg-green-400 text-white"
              : isError
              ? "bg-red-500 hover:bg-red-400 text-white"
              : "bg-blue-700 hover:bg-blue-600 text-white"
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

        {isCrawling && (
          <button
            onClick={handleStop}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-red-500 hover:bg-red-400 text-white rounded-lg shadow-sm transition-all"
            title="수집 중지 — 지금까지 수집된 결과를 표시합니다"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
            </svg>
            중지
          </button>
        )}
      </div>

      {status && (
        <p
          className={`text-[10px] px-0.5 leading-tight max-w-[220px] truncate ${
            isError ? "text-red-500" : isDone ? "text-green-600" : isCrawling ? "text-blue-700" : "text-orange-500"
          }`}
          title={status.msg}
        >
          {status.msg}
        </p>
      )}
    </div>
  );
}

// ── 분석 결과 카드 ──
function AnalysisCard({ analysis }) {
  if (!analysis) return null;
  if (analysis.error) return <p className="text-xs text-red-500 mt-1">분석 실패: {analysis.error}</p>;
  if (analysis.raw) return <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{analysis.raw}</p>;

  return (
    <div className="mt-2 p-3 bg-white rounded-lg border border-blue-200 text-xs space-y-1.5">
      {analysis.viral_factors && (
        <div>
          <span className="font-semibold text-blue-700">바이럴 요인: </span>
          <span className="text-gray-600">{analysis.viral_factors.join(", ")}</span>
        </div>
      )}
      {analysis.keywords && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="font-semibold text-blue-700 mr-0.5">핵심 키워드:</span>
          {analysis.keywords.map((k, i) => (
            <span key={i} className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{k}</span>
          ))}
        </div>
      )}
      {analysis.tone && (
        <div>
          <span className="font-semibold text-blue-700">톤: </span>
          <span className="text-gray-600">{analysis.tone}</span>
        </div>
      )}
      {analysis.target_audience && (
        <div>
          <span className="font-semibold text-blue-700">타겟: </span>
          <span className="text-gray-600">{analysis.target_audience}</span>
        </div>
      )}
      {analysis.content_ideas && (
        <div>
          <span className="font-semibold text-blue-700">콘텐츠 아이디어:</span>
          <ul className="mt-0.5 space-y-0.5">
            {analysis.content_ideas.map((idea, i) => (
              <li key={i} className="text-gray-600">• {idea}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── 메인 LinkedIn 페이지 ──
export default function LinkedInPage() {
  const [posts, setPosts] = useState([]);
  const [keyword, setKeyword] = useState("");
  const [count, setCount] = useState(20);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [analysisMap, setAnalysisMap] = useState({});
  const [analyzingIdx, setAnalyzingIdx] = useState(null);

  // 확장 프로그램 결과 수신
  useEffect(() => {
    const handler = (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== 'EDEN_LINKEDIN_RESULTS') return;
      const { posts: newPosts = [], keyword: kw = "" } = event.data.payload || {};
      setPosts(newPosts.map((p, i) => ({ ...p, rank: i + 1 })));
      if (kw) setKeyword(kw);
      setExpandedRows(new Set());
      setAnalysisMap({});
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // 행 펼침 토글
  const toggleExpand = useCallback((idx) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }, []);

  // AI 분석
  const handleAnalyze = useCallback(async (post, idx) => {
    if (analyzingIdx !== null) return;
    setAnalyzingIdx(idx);

    try {
      const brand = loadBrand();
      const brandCtx = brand.name
        ? `\n브랜드 정보: 이름="${brand.name}", 타겟="${brand.target}", 톤="${brand.tone}"`
        : '';

      const prompt = `다음 LinkedIn 게시물을 마케팅 관점에서 분석해줘.${brandCtx}

작성자: ${post.author}
내용:
${post.content}
반응수: ${(post.likes || 0).toLocaleString()}, 댓글수: ${(post.comments || 0).toLocaleString()}

반드시 JSON만 반환 (markdown 블록 포함):
\`\`\`json
{
  "viral_factors": ["요인1", "요인2", "요인3"],
  "keywords": ["키워드1", "키워드2", "키워드3"],
  "tone": "톤 한 줄 설명",
  "target_audience": "주요 타겟 독자",
  "content_ideas": ["이 게시물 스타일 기반 아이디어1", "아이디어2", "아이디어3"]
}
\`\`\``;

      const raw = await callGemini(prompt);
      const parsed = parseJSON(raw);
      setAnalysisMap(prev => ({ ...prev, [idx]: parsed || { raw } }));
    } catch (e) {
      setAnalysisMap(prev => ({ ...prev, [idx]: { error: e.message } }));
    } finally {
      setAnalyzingIdx(null);
    }
  }, [analyzingIdx]);

  // CSV 다운로드
  const handleDownloadCSV = useCallback(() => {
    if (!posts.length) return;
    const headers = ["순위", "작성자", "내용", "반응", "댓글", "날짜", "게시물URL", "프로필URL"];
    const rows = posts.map(p => [
      p.rank,
      `"${(p.author || "").replace(/"/g, '""')}"`,
      `"${(p.content || "").replace(/"/g, '""').replace(/\n/g, ' ').slice(0, 300)}"`,
      p.likes || 0,
      p.comments || 0,
      p.time || "",
      p.postUrl || "",
      p.profileUrl || "",
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `linkedin_${keyword || "crawl"}_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [posts, keyword]);

  // Enter 키로 수집 시작
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && keyword.trim()) {
      window.postMessage({ type: 'EDEN_START_LINKEDIN_CRAWL', keyword: keyword.trim(), count }, '*');
    }
  }, [keyword, count]);

  return (
    <div className="space-y-4">

      {/* ── 컨트롤 영역 ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
        {/* 키워드 입력 */}
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            검색 키워드
            <span className="ml-1 text-gray-400 font-normal">예: AI마케팅:20, 스타트업:15</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
            </div>
            <input
              type="text"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="키워드 입력 (복수 시 쉼표 구분, 키워드:개수)"
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all shadow-sm"
            />
          </div>
        </div>

        {/* 개수 선택 */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">개수</label>
          <select
            value={count}
            onChange={e => setCount(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-blue-500 shadow-sm bg-white"
          >
            {[10, 20, 30, 50].map(n => <option key={n} value={n}>{n}개</option>)}
          </select>
        </div>

        {/* 수집 버튼 */}
        <LinkedInCrawlButton keyword={keyword} count={count} />
      </div>

      {/* ── 안내 배너 ── */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 shrink-0">
          <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
        </svg>
        <span>
          Eden Crawl 확장 프로그램이 필요합니다. LinkedIn에 로그인된 상태에서 수집하세요.
          검색어를 <strong>영문</strong>으로 입력하면 더 많은 결과를 얻을 수 있습니다.
        </span>
      </div>

      {/* ── 빈 상태 ── */}
      {posts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="currentColor" className="mb-3 text-gray-200">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>
          </svg>
          <p className="text-sm font-medium text-gray-500 mb-1">LinkedIn 게시물이 없습니다</p>
          <p className="text-xs text-gray-400">키워드를 입력하고 수집 버튼을 클릭하세요</p>
        </div>
      )}

      {/* ── 결과 테이블 ── */}
      {posts.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500">
              총 <span className="text-blue-700 font-semibold">{posts.length}</span>개 게시물
              {keyword && <span className="ml-1 text-gray-400">— "{keyword}"</span>}
            </p>
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
              </svg>
              CSV 다운로드
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left px-4 py-3 text-gray-500 font-medium w-10">#</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium w-32">작성자</th>
                    <th className="text-left px-4 py-3 text-gray-500 font-medium">내용</th>
                    <th className="text-center px-4 py-3 text-gray-500 font-medium w-28">반응 / 댓글</th>
                    <th className="text-center px-4 py-3 text-gray-500 font-medium w-20">날짜</th>
                    <th className="text-center px-4 py-3 text-gray-500 font-medium w-14">링크</th>
                    <th className="text-center px-4 py-3 text-gray-500 font-medium w-20">분석</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post, idx) => (
                    <>
                      {/* 본문 행 */}
                      <tr
                        key={`row-${idx}`}
                        onClick={() => toggleExpand(idx)}
                        className={`border-b border-gray-100 cursor-pointer transition-all ${
                          expandedRows.has(idx) ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-4 py-3 text-gray-400 font-mono text-xs">{post.rank}</td>
                        <td className="px-4 py-3">
                          {post.profileUrl ? (
                            <a
                              href={post.profileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-blue-700 hover:underline text-xs font-medium truncate block max-w-[120px]"
                            >
                              {post.author}
                            </a>
                          ) : (
                            <span className="text-gray-700 text-xs font-medium truncate block max-w-[120px]">{post.author}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs truncate block max-w-sm ${expandedRows.has(idx) ? "text-blue-700 font-medium" : "text-gray-700"}`}>
                            {post.content?.slice(0, 90)}{(post.content?.length || 0) > 90 ? "…" : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                            <span className="font-medium text-gray-700" title="반응수">{(post.likes || 0).toLocaleString()}</span>
                            <span className="text-gray-300">·</span>
                            <span title="댓글수">{(post.comments || 0).toLocaleString()}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-xs text-gray-400">{post.time || "-"}</td>
                        <td className="px-4 py-3 text-center">
                          {post.postUrl ? (
                            <a
                              href={post.postUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="text-blue-600 hover:text-blue-700 text-xs underline"
                            >원문</a>
                          ) : <span className="text-gray-300 text-xs">-</span>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={e => { e.stopPropagation(); handleAnalyze(post, idx); }}
                            disabled={analyzingIdx !== null}
                            className="px-2 py-1 text-[11px] font-medium bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 disabled:opacity-50 transition-all"
                          >
                            {analyzingIdx === idx ? "분석 중..." : "AI 분석"}
                          </button>
                        </td>
                      </tr>

                      {/* 펼침 행 — 전문 + 분석 결과 */}
                      {expandedRows.has(idx) && (
                        <tr key={`expand-${idx}`} className="bg-blue-50 border-b border-blue-100">
                          <td colSpan={7} className="px-5 py-3">
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                              <span className="text-xs font-medium text-blue-700">{post.author}의 게시물 전문</span>
                            </div>
                            <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                              {post.content}
                            </p>
                            <AnalysisCard analysis={analysisMap[idx]} />
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
