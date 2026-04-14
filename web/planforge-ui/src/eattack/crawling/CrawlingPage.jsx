import { useState, useCallback, useRef } from "react";
import ThreadPage from "./ThreadPage";
import XPage from "./XPage";

// ─── 탭 데이터 ───
const PLATFORM_TABS = [
  { key: "iboss",    label: "아이보스",  icon: "🅱" },
  { key: "x",        label: "X",         icon: "𝕏" },
  { key: "thread",   label: "쓰레드",    icon: "🧵" },
  { key: "linkedin", label: "링크드인",  icon: "in" },
];

// ─── 월 목록 (25년 8월 ~ 26년 4월, YYYYMM 수열) ───
const AVAILABLE_MONTHS = [
  { value: "202508", label: "25년 08월" },
  { value: "202509", label: "25년 09월" },
  { value: "202510", label: "25년 10월" },
  { value: "202511", label: "25년 11월" },
  { value: "202512", label: "25년 12월" },
  { value: "202601", label: "26년 01월" },
  { value: "202602", label: "26년 02월" },
  { value: "202603", label: "26년 03월" },
  { value: "202604", label: "26년 04월" },
];

// ─── API (로컬: FastAPI / 배포: Vercel Serverless) ───
const IS_LOCAL = window.location.hostname === "localhost";

async function fetchIbossPosts(month) {
  const url = IS_LOCAL
    ? `http://localhost:8001/api/crawl/iboss?limit=50&month=${month}`
    : `/api/iboss-crawl?limit=50&month=${month}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("크롤링 API 호출 실패");
  return res.json();
}

async function fetchPostDetail(sourceUrl) {
  const url = IS_LOCAL
    ? `http://localhost:8001/api/crawl/iboss/detail?url=${encodeURIComponent(sourceUrl)}`
    : `/api/iboss-crawl?detail=true&url=${encodeURIComponent(sourceUrl)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("상세 크롤링 실패");
  return res.json();
}

// ─── 범위 내 월 목록 반환 ───
function getMonthsInRange(startMonth, endMonth) {
  const startIdx = AVAILABLE_MONTHS.findIndex((m) => m.value === startMonth);
  const endIdx = AVAILABLE_MONTHS.findIndex((m) => m.value === endMonth);
  if (startIdx === -1 || endIdx === -1) return [];
  const from = Math.min(startIdx, endIdx);
  const to = Math.max(startIdx, endIdx);
  return AVAILABLE_MONTHS.slice(from, to + 1).map((m) => m.value);
}

// ─── 월 범위 선택 캘린더 ───
function MonthRangePicker({ startMonth, endMonth, onChangeStart, onChangeEnd, disabled }) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(null);
  const ref = useRef(null);

  const startLabel = AVAILABLE_MONTHS.find((m) => m.value === startMonth)?.label || "";
  const endLabel = AVAILABLE_MONTHS.find((m) => m.value === endMonth)?.label || "";

  const handleMonthClick = (value) => {
    if (picking === "start") {
      onChangeStart(value);
      if (value > endMonth) onChangeEnd(value);
      setPicking("end");
    } else {
      if (value < startMonth) {
        onChangeStart(value);
        onChangeEnd(startMonth);
      } else {
        onChangeEnd(value);
      }
      setPicking(null);
      setOpen(false);
    }
  };

  const startIdx = AVAILABLE_MONTHS.findIndex((m) => m.value === startMonth);
  const endIdx = AVAILABLE_MONTHS.findIndex((m) => m.value === endMonth);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen(!open); setPicking("start"); }}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-blue-400 disabled:opacity-50 transition-all shadow-sm"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
          <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
        </svg>
        <span className="font-semibold text-blue-600">{startLabel}</span>
        <span className="text-gray-400">~</span>
        <span className="font-semibold text-blue-600">{endLabel}</span>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => { setOpen(false); setPicking(null); }} />
          <div className="absolute top-full left-0 mt-2 z-20 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden w-[280px]">
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <p className="text-xs text-gray-500 font-medium">
                {picking === "start" ? "시작 월을 선택하세요" : "종료 월을 선택하세요"}
              </p>
            </div>
            <div className="p-3 grid grid-cols-3 gap-1.5">
              {AVAILABLE_MONTHS.map((m, idx) => {
                const isStart = m.value === startMonth;
                const isEnd = m.value === endMonth;
                const isInRange = idx >= startIdx && idx <= endIdx;
                let cls = "text-gray-600 hover:bg-blue-50";
                if (isStart || isEnd) cls = "bg-blue-600 text-white font-semibold";
                else if (isInRange) cls = "bg-blue-100 text-blue-700";
                return (
                  <button
                    key={m.value}
                    onClick={() => handleMonthClick(m.value)}
                    className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${cls}`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── 메인 크롤링 페이지 ───
export default function CrawlingPage({ onBack }) {
  const [activeTab, setActiveTab] = useState("iboss");
  const [startMonth, setStartMonth] = useState("202604");
  const [endMonth, setEndMonth] = useState("202604");

  // 아이보스 전용 상태
  const [ibossData, setIbossData] = useState({ posts: [], loading: false, error: "", selectedRow: null });
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailContent, setDetailContent] = useState("");

  const { posts, loading, error, selectedRow } = ibossData;
  const rangeMonths = getMonthsInRange(startMonth, endMonth);

  // 아이보스 크롤링 실행
  const handleRefresh = useCallback(async () => {
    setIbossData((prev) => ({ ...prev, loading: true, error: "", selectedRow: null }));
    setDetailContent("");
    try {
      const months = getMonthsInRange(startMonth, endMonth);
      const allPosts = [];
      let rank = 1;
      for (const month of months) {
        const data = await fetchIbossPosts(month);
        if (data.posts) {
          for (const post of data.posts) {
            allPosts.push({ ...post, rank: rank++ });
          }
        }
      }
      allPosts.sort((a, b) => b.views - a.views);
      const top50 = allPosts.slice(0, 50).map((p, i) => ({ ...p, rank: i + 1 }));
      setIbossData((prev) => ({ ...prev, loading: false, posts: top50 }));
    } catch (e) {
      setIbossData((prev) => ({ ...prev, loading: false, error: e.message || "크롤링에 실패했습니다." }));
    }
  }, [startMonth, endMonth]);

  // 행 클릭 (아이보스 전용)
  const handleRowClick = useCallback(async (post, idx) => {
    if (ibossData.selectedRow === idx) {
      setIbossData((prev) => ({ ...prev, selectedRow: null }));
      setDetailContent("");
      return;
    }
    setIbossData((prev) => ({ ...prev, selectedRow: idx }));
    setDetailContent("");

    if (post.source_url) {
      setDetailLoading(true);
      try {
        const data = await fetchPostDetail(post.source_url);
        setDetailContent(data.content || "(본문을 불러올 수 없습니다)");
      } catch {
        setDetailContent("(본문 로딩 실패)");
      } finally {
        setDetailLoading(false);
      }
    }
  }, [ibossData.selectedRow]);

  // 재구성하기
  const handleRecompose = useCallback(() => {
    if (ibossData.selectedRow === null) return;
    const post = ibossData.posts[ibossData.selectedRow];
    alert(`"${post.title}" 레퍼런스로 재구성을 시작합니다.\n(Step 4 — AI 키워드 추천 모달은 다음 단계에서 구현)`);
  }, [ibossData]);

  // CSV 다운로드 (아이보스 전용)
  const handleDownloadCSV = useCallback(() => {
    if (!ibossData.posts.length) return;
    const headers = ["순위", "제목", "작성자", "조회수", "좋아요", "댓글", "날짜", "URL"];
    const rows = ibossData.posts.map((p) => [
      p.rank,
      `"${(p.title || "").replace(/"/g, '""')}"`,
      `"${(p.author || "").replace(/"/g, '""')}"`,
      p.views,
      p.likes,
      p.comments,
      p.created_at || "",
      p.source_url || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0, 16).replace(/[T:]/g, "-");
    a.href = url;
    a.download = `crawl_iboss_${startMonth}-${endMonth}_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [ibossData, startMonth, endMonth]);

  // 탭 전환
  const handleTabClick = (tabKey) => {
    setActiveTab(tabKey);
    setDetailContent("");
  };

  // 아이보스 전용 탭 여부
  const isIbossTab = activeTab === "iboss";

  return (
    <div className="flex-1 overflow-y-auto bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ── 상단 헤더 ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <div>
              <h2 className="text-lg font-bold text-gray-900">마케팅 트렌드 및 인기글</h2>
              <p className="text-xs text-gray-400">커뮤니티 인기 게시물을 크롤링하여 트렌드를 분석합니다</p>
            </div>
          </div>
        </div>

        {/* ── 탭 + 컨트롤 바 ── */}
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            {/* 플랫폼 탭 */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {PLATFORM_TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => handleTabClick(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    activeTab === tab.key
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* 월 범위 캘린더 (아이보스만) */}
            {isIbossTab && (
              <MonthRangePicker
                startMonth={startMonth}
                endMonth={endMonth}
                onChangeStart={setStartMonth}
                onChangeEnd={setEndMonth}
                disabled={loading}
              />
            )}
          </div>

          {/* 새로고침 (아이보스만) */}
          {isIbossTab && (
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all shadow-sm"
            >
              {loading ? (
                <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
                  <path d="M21 3v5h-5"/>
                </svg>
              )}
              <span>+ 새로고침</span>
            </button>
          )}
        </div>

        {/* ── X 대시보드 ── */}
        {activeTab === "x" && <XPage />}

        {/* ── 쓰레드 대시보드 ── */}
        {activeTab === "thread" && <ThreadPage />}

        {/* ── 링크드인 준비 중 ── */}
        {activeTab === "linkedin" && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="currentColor" className="mb-4 text-gray-300">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/>
            </svg>
            <p className="text-sm font-medium text-gray-500 mb-1">링크드인 크롤링 준비 중</p>
            <p className="text-xs text-gray-400">해당 기능은 추후 업데이트 예정입니다</p>
          </div>
        )}

        {/* ── 아이보스 전용 영역 ── */}
        {isIbossTab && (
          <>
            {/* 에러 */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>
                </svg>
                {error}
                <button onClick={handleRefresh} className="ml-auto text-red-500 hover:text-red-700 underline text-xs">재시도</button>
              </div>
            )}

            {/* 빈 상태 */}
            {!loading && posts.length === 0 && !error && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-gray-300">
                  <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <p className="text-sm font-medium text-gray-500 mb-1">아직 크롤링 데이터가 없습니다</p>
                <p className="text-xs text-gray-400">기간을 선택하고 &apos;+ 새로고침&apos; 버튼을 클릭하여 인기글을 수집하세요</p>
              </div>
            )}

            {/* 로딩 */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-20">
                <svg className="animate-spin w-8 h-8 text-blue-500 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <p className="text-gray-600 text-sm">크롤링 중... 잠시만 기다려주세요</p>
                <p className="text-gray-400 text-xs mt-1">{rangeMonths.length}개월 범위에서 인기글을 수집합니다</p>
              </div>
            )}

            {/* 테이블 */}
            {!loading && posts.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-gray-500">
                    총 <span className="text-blue-600 font-semibold">{posts.length}</span>개 인기글 (조회수 순)
                  </p>
                  <button
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                          <th className="text-left px-4 py-3 text-gray-500 font-medium w-12">#</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-medium">제목</th>
                          <th className="text-left px-4 py-3 text-gray-500 font-medium w-24">아이디</th>
                          <th className="text-center px-4 py-3 text-gray-500 font-medium w-28">조회/좋아요/댓글</th>
                          <th className="text-center px-4 py-3 text-gray-500 font-medium w-24">날짜</th>
                          <th className="text-center px-4 py-3 text-gray-500 font-medium w-20">링크</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posts.map((post, idx) => (
                          <tr
                            key={idx}
                            onClick={() => handleRowClick(post, idx)}
                            className={`border-b border-gray-100 cursor-pointer transition-all ${
                              selectedRow === idx ? "bg-blue-50 border-blue-200" : "hover:bg-gray-50"
                            }`}
                          >
                            <td className="px-4 py-3 text-gray-400 font-mono text-xs">{post.rank}</td>
                            <td className="px-4 py-3">
                              <span className={`font-medium truncate max-w-md block ${selectedRow === idx ? "text-blue-700" : "text-gray-800"}`}>
                                {post.title || "(제목 없음)"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs truncate">{post.author}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
                                <span title="조회수" className="font-medium text-gray-700">{post.views.toLocaleString()}</span>
                                <span className="text-gray-300">·</span>
                                <span title="좋아요">{post.likes.toLocaleString()}</span>
                                <span className="text-gray-300">·</span>
                                <span title="댓글">{post.comments.toLocaleString()}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-xs text-gray-400">{post.created_at}</td>
                            <td className="px-4 py-3 text-center">
                              {post.source_url && (
                                <a
                                  href={post.source_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-blue-500 hover:text-blue-600 text-xs underline"
                                >
                                  원문
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 본문 미리보기 */}
                  {selectedRow !== null && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-sm font-medium text-gray-700">
                          본문 미리보기 — {posts[selectedRow]?.title}
                        </span>
                      </div>
                      {detailLoading ? (
                        <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
                          <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                          </svg>
                          본문을 불러오는 중...
                        </div>
                      ) : (
                        <p className="text-gray-600 text-sm leading-relaxed line-clamp-5 whitespace-pre-wrap">
                          {detailContent || posts[selectedRow]?.content_raw || "(본문을 불러오려면 잠시 기다려주세요)"}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* 하단 재구성 버튼 */}
            {selectedRow !== null && !loading && (
              <div className="mt-6 flex justify-center">
                <button
                  onClick={handleRecompose}
                  className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 transition-all hover:scale-105 active:scale-95"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z"/>
                  </svg>
                  해당 레퍼런스로 재구성하기
                </button>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
