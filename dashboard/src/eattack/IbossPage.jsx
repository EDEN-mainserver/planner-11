import { useState, useEffect, useRef } from "react";
import IbossNewPost from "./IbossNewPost";
import IbossEditor from "./IbossEditor";

const STORAGE_KEY = "eattack_iboss_posts";

const FILTERS = [
  { key: "all", label: "전체" },
  { key: "draft", label: "초안" },
  { key: "done", label: "완료" },
];

const POST_TYPE_LABELS = {
  info: "정보공유형",
  case: "사례형",
  insight: "인사이트형",
  question: "질문형",
};

const POST_TYPE_COLORS = {
  info: "bg-blue-50 text-blue-600",
  case: "bg-emerald-50 text-emerald-600",
  insight: "bg-violet-50 text-violet-700",
  question: "bg-orange-50 text-orange-600",
};

const STATUS_LABELS = { done: "완료", draft: "초안" };
const STATUS_COLORS = {
  done: "bg-green-50 text-green-600",
  draft: "bg-yellow-50 text-yellow-600",
};

const TABS = [
  { key: "articles", label: "제작" },
  { key: "trends", label: "인기글 분석" },
];

function loadPosts() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function savePosts(posts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
}

// ─── 인기글 분석 탭 (확장 프로그램 방식) ───
function TrendsTab() {
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [detailContent, setDetailContent] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const timeoutRef = useRef(null);
  const detailTimeoutRef = useRef(null);

  // 확장 프로그램 → 목록 수신
  useEffect(() => {
    const handler = (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== "EDEN_IBOSS_LIST") return;
      const { posts: newPosts = [], error: err } = event.data.payload || {};
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (err) {
        setError("수집 오류: " + err);
        setIsLoading(false);
        return;
      }
      const ranked = newPosts.slice(0, 30).map((p, i) => ({ ...p, rank: i + 1 }));
      setPosts(ranked);
      setIsLoading(false);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  // 확장 프로그램 → 본문 수신
  useEffect(() => {
    const handler = (event) => {
      if (event.source !== window) return;
      if (event.data?.type !== "EDEN_IBOSS_CONTENT") return;
      if (detailTimeoutRef.current) clearTimeout(detailTimeoutRef.current);
      const { content, error: err } = event.data.payload || {};
      setDetailContent(content || (err ? `오류: ${err}` : "본문을 불러올 수 없습니다."));
      setDetailLoading(false);
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleLoad = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsLoading(true);
    setError("");
    setPosts([]);
    setSelectedIdx(null);
    setDetailContent("");
    window.postMessage({ type: "EDEN_GET_IBOSS_LIST", month }, "*");
    // 15초 타임아웃
    timeoutRef.current = setTimeout(() => {
      setIsLoading((prev) => {
        if (prev) setError("수집 시간 초과 — Eden Crawl 확장 프로그램이 설치되어 있는지 확인해주세요.");
        return false;
      });
    }, 15000);
  };

  const handleRowClick = (idx) => {
    if (selectedIdx === idx) {
      setSelectedIdx(null);
      setDetailContent("");
      return;
    }
    setSelectedIdx(idx);
    setDetailContent("");
    const post = posts[idx];
    if (post?.source_url) {
      setDetailLoading(true);
      window.postMessage({ type: "EDEN_GET_IBOSS_CONTENT", sourceUrl: post.source_url }, "*");
      detailTimeoutRef.current = setTimeout(() => {
        setDetailLoading((prev) => {
          if (prev) setDetailContent("본문을 불러올 수 없습니다. 확장 프로그램을 확인해주세요.");
          return false;
        });
      }, 15000);
    }
  };

  const monthOptions = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const val = d.toISOString().slice(0, 7).replace("-", "");
    const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    monthOptions.push({ val, label });
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4 overflow-y-auto">
      {/* 필터 */}
      <div className="flex items-center gap-2">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          {monthOptions.map(({ val, label }) => (
            <option key={val} value={val}>{label}</option>
          ))}
        </select>
        <button
          onClick={handleLoad}
          disabled={isLoading}
          className="h-10 px-4 text-sm font-semibold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {isLoading ? (
            <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
              <path d="M21 3v5h-5"/>
            </svg>
          )}
          {isLoading ? "로딩 중..." : "불러오기"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
            <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
          </svg>
          {error}
        </div>
      )}

      {/* 인기글 목록 */}
      {posts.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {monthOptions.find(m => m.val === month)?.label} 인기글 TOP {posts.length}
          </p>
          {posts.map((post, idx) => (
            <div key={post.rank}>
              <div
                className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer group"
                onClick={() => handleRowClick(idx)}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                  post.rank <= 3 ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}>
                  {post.rank}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate group-hover:text-emerald-700 transition-colors">
                    {post.title}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    {post.views > 0 && (
                      <span className="text-[11px] text-gray-400">조회 {post.views.toLocaleString()}</span>
                    )}
                    {post.likes > 0 && (
                      <span className="text-[11px] text-gray-400">좋아요 {post.likes}</span>
                    )}
                    {post.comments > 0 && (
                      <span className="text-[11px] text-gray-400">댓글 {post.comments}</span>
                    )}
                    {post.author && (
                      <span className="text-[11px] text-gray-300">{post.author}</span>
                    )}
                  </div>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={`text-gray-300 flex-shrink-0 transition-transform ${selectedIdx === idx ? "rotate-180" : ""}`}
                >
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </div>

              {/* 상세 본문 */}
              {selectedIdx === idx && (
                <div className="mx-2 border border-t-0 border-emerald-100 rounded-b-xl bg-emerald-50/30 px-4 py-3">
                  {detailLoading ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-gray-400">
                      <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      본문 불러오는 중...
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap line-clamp-10">
                        {detailContent || "본문을 불러오려면 잠시 기다려주세요."}
                      </p>
                      <a
                        href={post.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                        onClick={(e) => e.stopPropagation()}
                      >
                        원문 보기
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                          <polyline points="15 3 21 3 21 9"/><line x1="10" x2="21" y1="14" y2="3"/>
                        </svg>
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!isLoading && posts.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="text-3xl">📊</div>
          <p className="text-sm text-gray-400">불러오기 버튼을 눌러 인기글을 조회하세요</p>
        </div>
      )}
    </div>
  );
}

// ─── 메인 페이지 ───
export default function IbossPage({ onBack, referencePost = null, onClearReference }) {
  const [activeTab, setActiveTab] = useState("articles");
  const [activeFilter, setActiveFilter] = useState("all");
  const [posts, setPosts] = useState(loadPosts);
  // 레퍼런스가 있으면 바로 새 글 작성 뷰로 진입
  const [view, setView] = useState(referencePost ? "new" : "list");
  const [currentPost, setCurrentPost] = useState(null);

  useEffect(() => {
    savePosts(posts);
  }, [posts]);

  const filteredPosts = posts.filter((p) => {
    if (activeFilter === "all") return true;
    return p.status === activeFilter;
  });

  const handleGenerate = (postData) => {
    setPosts((prev) => [postData, ...prev]);
    setCurrentPost(postData);
    setView("editor");
  };

  const handleSave = (updatedPost) => {
    setPosts((prev) => prev.map((p) => p.id === updatedPost.id ? updatedPost : p));
    setCurrentPost(updatedPost);
  };

  const handleDelete = (id) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  const handlePostClick = (post) => {
    setCurrentPost(post);
    setView("editor");
  };

  const formatDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${d.getMonth() + 1}.${d.getDate()}`;
  };

  if (view === "new") {
    return (
      <IbossNewPost
        onBack={() => { setView("list"); onClearReference?.(); }}
        onGenerate={handleGenerate}
        referencePost={referencePost}
      />
    );
  }

  if (view === "editor" && currentPost) {
    return (
      <IbossEditor
        post={currentPost}
        onBack={() => { setCurrentPost(null); setView("list"); }}
        onSave={handleSave}
        onDone={() => { setCurrentPost(null); setView("list"); }}
      />
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-white h-full flex flex-col">
      {/* 헤더 */}
      <header className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">아이보스</h1>
              <p className="text-xs text-gray-400 mt-0.5">마케팅 커뮤니티 최적화 글 작성 · 자동 포스팅</p>
            </div>
          </div>
          {activeTab === "articles" && (
            <button
              onClick={() => setView("new")}
              className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors rounded-lg text-xs h-9 px-3 bg-emerald-600 text-white shadow hover:bg-emerald-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="M12 5v14"/>
              </svg>
              새 글 작성
            </button>
          )}
        </div>
      </header>

      {/* 탭 */}
      <div className="border-b border-gray-100 px-4 sm:px-6">
        <div className="inline-flex items-center gap-5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative h-10 px-0 pb-3 pt-2 text-sm font-medium transition-all border-b-2 ${
                activeTab === tab.key
                  ? "border-emerald-600 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 제작 탭 */}
      {activeTab === "articles" && (
        <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4 overflow-y-auto">
          {/* 필터 */}
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors rounded-lg text-xs h-8 px-3 ${
                  activeFilter === filter.key
                    ? "bg-emerald-600 text-white shadow"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {filter.label}
                {filter.key !== "all" && (
                  <span className={`text-[10px] rounded-full px-1.5 py-0.5 ${
                    activeFilter === filter.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                  }`}>
                    {posts.filter((p) => p.status === filter.key).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 목록 or 빈 상태 */}
          {filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4 flex-1">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-300">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-1.5">
                {activeFilter === "all" ? "아직 작성한 글이 없습니다" : `${STATUS_LABELS[activeFilter]} 상태의 글이 없습니다`}
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 max-w-sm mb-6 leading-relaxed">
                아이보스 마케팅 커뮤니티에 올릴<br />전문적인 글을 AI로 자동 생성해보세요.
              </p>
              <button
                onClick={() => setView("new")}
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium bg-emerald-600 text-white shadow hover:bg-emerald-700 h-10 px-5 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="M12 5v14"/>
                </svg>
                새 글 작성
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-emerald-200 hover:shadow-sm transition-all cursor-pointer group"
                  onClick={() => handlePostClick(post)}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${POST_TYPE_COLORS[post.postType] || "bg-gray-100 text-gray-500"}`}>
                        {POST_TYPE_LABELS[post.postType] || post.postType}
                      </span>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-800 truncate group-hover:text-emerald-700 transition-colors">
                      {post.title}
                    </h4>
                    {post.topic && (
                      <p className="text-[11px] text-gray-400 mt-0.5 truncate">주제: {post.topic}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[post.status] || "bg-gray-100 text-gray-500"}`}>
                      {STATUS_LABELS[post.status] || post.status}
                    </span>
                    <span className="text-xs text-gray-300">{formatDate(post.createdAt)}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                      className="w-6 h-6 flex items-center justify-center rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 인기글 분석 탭 */}
      {activeTab === "trends" && <TrendsTab />}
    </div>
  );
}
