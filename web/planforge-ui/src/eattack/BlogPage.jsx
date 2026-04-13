import { useState } from "react";
import BlogNewPost from "./BlogNewPost";

// ─── 상태 필터 정의 ───
const FILTERS = [
  { key: "all", label: "전체" },
  { key: "draft", label: "초안" },
  { key: "done", label: "완료" },
  { key: "archived", label: "보관됨" },
];

// ─── 상위 탭 정의 ───
const TABS = [
  { key: "articles", label: "제작" },
  { key: "styles", label: "글쓰기 스타일" },
];

export default function BlogPage({ onBack }) {
  const [activeTab, setActiveTab] = useState("articles");
  const [activeFilter, setActiveFilter] = useState("all");
  const [posts] = useState([]); // 추후 글 목록 데이터 연결
  const [view, setView] = useState("list"); // 'list' | 'new'

  // 필터에 따른 글 목록
  const filteredPosts = posts.filter((p) => {
    if (activeFilter === "all") return true;
    return p.status === activeFilter;
  });

  // 새 글 작성 화면
  if (view === "new") {
    return (
      <BlogNewPost
        onBack={() => setView("list")}
        onGenerate={(data) => { console.log("글 생성 요청:", data); setView("list"); }}
      />
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-white h-full flex flex-col">
      {/* 헤더 */}
      <header className="px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* 뒤로가기 */}
            <button
              onClick={onBack}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">블로그 글 작성</h1>
          </div>
        </div>
      </header>

      {/* 탭: 제작 / 글쓰기 스타일 */}
      <div className="border-b border-gray-200 px-4 sm:px-6">
        <div className="inline-flex items-center gap-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative h-10 px-0 pb-3 pt-2 text-sm font-medium transition-all border-b-2
                ${activeTab === tab.key
                  ? "border-purple-600 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 제작 탭 콘텐츠 */}
      {activeTab === "articles" && (
        <div className="flex-1 flex flex-col p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* 필터 + 새 글 작성 */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => setActiveFilter(filter.key)}
                  className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors rounded-md text-xs sm:text-sm h-8 min-h-[36px] px-2.5 sm:px-3
                    ${activeFilter === filter.key
                      ? "bg-purple-600 text-white shadow hover:bg-purple-700"
                      : "border border-gray-200 bg-white text-gray-700 shadow-sm hover:bg-gray-50"
                    }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setView("new")}
              className="inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors rounded-md text-xs h-9 min-h-[36px] px-3 bg-purple-600 text-white shadow hover:bg-purple-700 w-full sm:w-auto"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
                <path d="M5 12h14" /><path d="M12 5v14" />
              </svg>
              새 글 작성
            </button>
          </div>

          {/* 글 목록 or 빈 상태 */}
          {filteredPosts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 sm:py-20 text-center px-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 sm:h-16 sm:w-16 text-gray-200 mb-3 sm:mb-4">
                <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
                <path d="M14 2v4a2 2 0 0 0 2 2h4" />
                <path d="M10 9H8" /><path d="M16 13H8" /><path d="M16 17H8" />
              </svg>
              <h3 className="text-sm sm:text-lg font-medium text-gray-800 mb-1.5 sm:mb-2">
                아직 작성한 글이 없습니다
              </h3>
              <p className="text-xs sm:text-sm text-gray-400 max-w-md mb-5 sm:mb-6 leading-relaxed">
                AI가 자료 조사, 글 구성, 본문 작성, 검색 최적화까지 도와줍니다.
                주제만 입력하면 고품질 블로그 글을 만들어 드립니다.
              </p>
              <button
                onClick={() => setView("new")}
                className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors bg-purple-600 text-white shadow hover:bg-purple-700 h-10 min-h-[44px] px-4 py-2 w-full sm:w-auto"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <path d="M5 12h14" /><path d="M12 5v14" />
                </svg>
                새 글 작성
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:border-purple-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-gray-800 truncate group-hover:text-purple-700 transition-colors">
                      {post.title}
                    </h4>
                    <p className="text-xs text-gray-400 mt-1 truncate">{post.summary}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium
                      ${post.status === "done" ? "bg-green-50 text-green-600" : ""}
                      ${post.status === "draft" ? "bg-yellow-50 text-yellow-600" : ""}
                      ${post.status === "archived" ? "bg-gray-100 text-gray-400" : ""}
                    `}>
                      {post.status === "done" ? "완료" : post.status === "draft" ? "초안" : "보관됨"}
                    </span>
                    <span className="text-xs text-gray-300">{post.date}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 글쓰기 스타일 탭 콘텐츠 */}
      {activeTab === "styles" && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 text-gray-200 mb-4">
            <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />
          </svg>
          <h3 className="text-sm sm:text-lg font-medium text-gray-800 mb-2">
            글쓰기 스타일 설정
          </h3>
          <p className="text-xs sm:text-sm text-gray-400 max-w-md leading-relaxed">
            AI가 브랜드 톤앤매너를 학습하여 일관된 스타일로 글을 작성합니다.
            <br />곧 제공될 예정입니다.
          </p>
        </div>
      )}
    </div>
  );
}
