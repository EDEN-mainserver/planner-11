import { useState, useEffect } from "react";
import BlogNewPost from "./BlogNewPost";
import BlogEditor from "./BlogEditor";

const BLOG_STORAGE_KEY = "eattack_blog_posts";

// ─── 상태 필터 정의 ───
const FILTERS = [
  { key: "all", label: "전체" },
  { key: "draft", label: "초안" },
  { key: "done", label: "완료" },
];

// ─── 상위 탭 정의 ───
const TABS = [
  { key: "articles", label: "제작" },
  { key: "styles", label: "글쓰기 스타일" },
];

// ─── 글 불러오기/저장 ───
function loadPosts() {
  try { return JSON.parse(localStorage.getItem(BLOG_STORAGE_KEY) || "[]"); }
  catch { return []; }
}
function savePosts(posts) {
  localStorage.setItem(BLOG_STORAGE_KEY, JSON.stringify(posts));
}

// ─── 상태 레이블 ───
const STATUS_LABELS = { done: "완료", draft: "초안" };
const STATUS_COLORS = {
  done: "bg-green-50 text-green-600",
  draft: "bg-yellow-50 text-yellow-600",
};

// ─── 콘텐츠 타입 레이블 ───
const CTYPE_LABELS = { pulling: "풀링", key: "키" };
const CTYPE_COLORS = {
  pulling: "bg-blue-50 text-blue-600",
  key: "bg-purple-50 text-purple-700",
};

export default function BlogPage({ onBack }) {
  const [activeTab, setActiveTab] = useState("articles");
  const [activeFilter, setActiveFilter] = useState("all");
  const [posts, setPosts] = useState(loadPosts);
  const [view, setView] = useState("list"); // 'list' | 'new' | 'editor'
  const [currentPost, setCurrentPost] = useState(null);

  // 저장 동기화
  useEffect(() => {
    savePosts(posts);
  }, [posts]);

  // 필터에 따른 글 목록
  const filteredPosts = posts.filter((p) => {
    if (activeFilter === "all") return true;
    return p.status === activeFilter;
  });

  // 새 글 생성 완료
  const handleGenerate = (postData) => {
    const newPost = {
      ...postData,
      id: `blog_${Date.now()}`,
    };
    setPosts((prev) => [newPost, ...prev]);
    setCurrentPost(newPost);
    setView("editor");
  };

  // 글 저장 (에디터에서)
  const handleSave = (updatedPost) => {
    setPosts((prev) => prev.map((p) => p.id === updatedPost.id ? updatedPost : p));
    setCurrentPost(updatedPost);
  };

  // 글 삭제
  const handleDelete = (id) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  };

  // 글 클릭 → 에디터
  const handlePostClick = (post) => {
    setCurrentPost(post);
    setView("editor");
  };

  // 에디터 뒤로가기
  const handleEditorBack = () => {
    setCurrentPost(null);
    setView("list");
  };

  // 날짜 포맷
  const formatDate = (iso) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}.${d.getDate()}`;
  };

  // ─── 화면 분기 ───
  if (view === "new") {
    return (
      <BlogNewPost
        onBack={() => setView("list")}
        onGenerate={handleGenerate}
      />
    );
  }

  if (view === "editor" && currentPost) {
    return (
      <BlogEditor
        post={currentPost}
        onBack={handleEditorBack}
        onSave={handleSave}
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
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">전문 퍼널 블로그</h1>
              <p className="text-xs text-gray-400 mt-0.5">풀링 · 키 콘텐츠 퍼널 구조 자동 작성</p>
            </div>
          </div>
          <button
            onClick={() => setView("new")}
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors rounded-lg text-xs h-9 px-3 bg-purple-600 text-white shadow hover:bg-purple-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" /><path d="M12 5v14" />
            </svg>
            새 글 작성
          </button>
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
                  ? "border-purple-600 text-gray-900"
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
        <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4">
          {/* 필터 */}
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors rounded-lg text-xs h-8 px-3 ${
                  activeFilter === filter.key
                    ? "bg-purple-600 text-white shadow"
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

          {/* 글 목록 or 빈 상태 */}
          {filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4 flex-1">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
                  <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                  <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                  <path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
                </svg>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-1.5">
                {activeFilter === "all" ? "아직 작성한 글이 없습니다" : `${STATUS_LABELS[activeFilter]} 상태의 글이 없습니다`}
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 max-w-sm mb-6 leading-relaxed">
                풀링 콘텐츠로 트래픽을 모으고,<br />키 콘텐츠로 구매 전환을 만들어보세요.
              </p>
              <button
                onClick={() => setView("new")}
                className="inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium bg-purple-600 text-white shadow hover:bg-purple-700 h-10 px-5 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" /><path d="M12 5v14" />
                </svg>
                새 글 작성
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-purple-200 hover:shadow-sm transition-all cursor-pointer group"
                  onClick={() => handlePostClick(post)}
                >
                  <div className="flex-1 min-w-0 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${CTYPE_COLORS[post.contentType] || "bg-gray-100 text-gray-500"}`}>
                        {CTYPE_LABELS[post.contentType] || post.contentType}
                      </span>
                      {post.funnelStages && (
                        <span className="text-[10px] text-gray-400">{post.funnelStages.join("→")}</span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold text-gray-800 truncate group-hover:text-purple-700 transition-colors">
                      {post.title}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      {post.keywords?.slice(0, 3).map((kw) => (
                        <span key={kw} className="text-[10px] text-gray-400">#{kw}</span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS[post.status] || "bg-gray-100 text-gray-500"}`}>
                      {STATUS_LABELS[post.status] || post.status}
                    </span>
                    <span className="text-xs text-gray-300">{post.createdAt ? formatDate(post.createdAt) : ""}</span>
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

      {/* 글쓰기 스타일 탭 */}
      {activeTab === "styles" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
              <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
            </svg>
          </div>
          <h3 className="text-sm sm:text-base font-semibold text-gray-800 mb-2">글쓰기 스타일 설정</h3>
          <p className="text-xs sm:text-sm text-gray-400 max-w-sm leading-relaxed">
            AI가 브랜드 톤앤매너를 학습하여<br />일관된 스타일로 글을 작성합니다.
            <br /><span className="text-gray-300">곧 제공될 예정입니다.</span>
          </p>
        </div>
      )}
    </div>
  );
}
