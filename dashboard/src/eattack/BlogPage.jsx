import { useState, useEffect } from "react";
import { emitEAttackContext, onEAttackCommand } from "./eattackContext";
import BlogNewPost from "./BlogNewPost";
import BlogEditor from "./BlogEditor";
import { callGemini } from "../utils/gemini";

const STYLE_STORAGE_KEY = "eattack_blog_style";

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

// ─── 스타일 저장/불러오기 ───
// eslint-disable-next-line react-refresh/only-export-components
export function loadBlogStyle() {
  try { return JSON.parse(localStorage.getItem(STYLE_STORAGE_KEY) || "null"); }
  catch { return null; }
}
function saveBlogStyle(style) {
  localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(style));
}

// ─── 글쓰기 스타일 분석 탭 ───
function StyleAnalysisTab() {
  const [blogUrl, setBlogUrl]         = useState("");
  const [step, setStep]               = useState("idle"); // idle | crawling | analyzing | done | error
  const [stepMsg, setStepMsg]         = useState("");
  const [savedStyle, setSavedStyle]   = useState(loadBlogStyle);
  const [previewStyle, setPreviewStyle] = useState(null);
  const [error, setError]             = useState("");

  const blogIdFromUrl = (url) => {
    const m = url.match(/blog\.naver\.com\/([a-zA-Z0-9_]+)/);
    return m ? m[1] : url.trim();
  };

  const handleAnalyze = async () => {
    if (!blogUrl.trim()) return;
    setError("");
    setStep("crawling");
    setStepMsg("블로그 글 수집 중...");
    setPreviewStyle(null);

    try {
      const blogId = blogIdFromUrl(blogUrl);

      // Step 1: 크롤링
      const crawlResp = await fetch(`/api/naver-blog-crawl?blogId=${encodeURIComponent(blogId)}`);
      const crawlData = await crawlResp.json();
      if (!crawlResp.ok) throw new Error(crawlData.error || "크롤링 실패");

      const { posts, total } = crawlData;
      setStepMsg(`${posts.length}개 글 분석 중... (총 ${total}개)`);
      setStep("analyzing");

      // Step 2: Gemini로 스타일 분석
      const postsText = posts.map((p, i) =>
        `[글 ${i + 1}] 제목: ${p.title}\n${p.content}`
      ).join("\n\n---\n\n");

      const prompt = `다음은 네이버 블로그 "${blogId}"의 최근 글들입니다. 이 블로거의 글쓰기 스타일을 철저히 분석해주세요.

${postsText}

다음 JSON 형식으로 정확히 반환해. 설명 없이 JSON만:
{
  "blogger": "${blogId}",
  "analyzed_count": ${posts.length},
  "tone": "한 문장으로 표현한 전체적인 톤앤매너",
  "title_pattern": "제목 작성 패턴 설명",
  "title_examples": ["실제 제목 패턴 예시 2개"],
  "intro_style": "도입부 작성 방식",
  "heading_style": "소제목 스타일",
  "content_structure": "글 전체 구조 (단계별)",
  "avg_length": "글 평균 길이 (짧음/보통/김)",
  "paragraph_style": "문단 구성 방식",
  "cta_style": "마무리 및 CTA 방식",
  "special_features": ["이 블로거만의 특징 3~5가지"],
  "writing_rules": ["글 작성 시 반드시 지킬 규칙 5가지"],
  "avoid": ["이 스타일에서 피해야 할 것 3가지"]
}`;

      const result = await callGemini(
        [{ role: "user", content: prompt }],
        "당신은 콘텐츠 마케팅 전문가로서 블로그 글쓰기 스타일을 정밀하게 분석합니다."
      );

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("분석 결과 파싱 실패");
      const styleData = JSON.parse(jsonMatch[0]);
      styleData.savedAt = new Date().toISOString();
      styleData.blogUrl = `https://blog.naver.com/${blogId}`;

      setPreviewStyle(styleData);
      setStep("done");
      setStepMsg("");

    } catch (e) {
      setError(e.message);
      setStep("error");
      setStepMsg("");
    }
  };

  const handleSave = () => {
    if (!previewStyle) return;
    saveBlogStyle(previewStyle);
    setSavedStyle(previewStyle);
    setPreviewStyle(null);
    setBlogUrl("");
    setStep("idle");
  };

  const handleDelete = () => {
    localStorage.removeItem(STYLE_STORAGE_KEY);
    setSavedStyle(null);
  };

  const isLoading = step === "crawling" || step === "analyzing";

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">

      {/* 저장된 스타일 있으면 표시 */}
      {savedStyle && (
        <div className="rounded-2xl border border-purple-200 bg-purple-50/50 p-4 sm:p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-xs font-bold text-purple-600 uppercase tracking-wider">적용 중인 스타일</span>
              </div>
              <p className="text-sm font-semibold text-gray-900">{savedStyle.blogger} 스타일</p>
              <a href={savedStyle.blogUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-gray-400 hover:text-purple-600 transition-colors">
                {savedStyle.blogUrl}
              </a>
            </div>
            <button onClick={handleDelete}
              className="h-7 px-2.5 text-xs font-medium rounded-lg border border-red-200 text-red-400 hover:bg-red-50 transition-colors flex-shrink-0">
              삭제
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 border border-purple-100">
              <p className="text-[10px] font-bold text-purple-500 uppercase mb-1.5">톤앤매너</p>
              <p className="text-xs text-gray-700">{savedStyle.tone}</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-purple-100">
              <p className="text-[10px] font-bold text-purple-500 uppercase mb-1.5">제목 패턴</p>
              <p className="text-xs text-gray-700">{savedStyle.title_pattern}</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-purple-100">
              <p className="text-[10px] font-bold text-purple-500 uppercase mb-1.5">글 구조</p>
              <p className="text-xs text-gray-700">{savedStyle.content_structure}</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-purple-100">
              <p className="text-[10px] font-bold text-purple-500 uppercase mb-1.5">마무리 방식</p>
              <p className="text-xs text-gray-700">{savedStyle.cta_style}</p>
            </div>
          </div>

          {savedStyle.special_features?.length > 0 && (
            <div className="bg-white rounded-xl p-3 border border-purple-100">
              <p className="text-[10px] font-bold text-purple-500 uppercase mb-2">이 블로거만의 특징</p>
              <ul className="space-y-1">
                {savedStyle.special_features.map((f, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <span className="text-purple-400 mt-0.5">•</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {savedStyle.writing_rules?.length > 0 && (
            <div className="bg-white rounded-xl p-3 border border-purple-100">
              <p className="text-[10px] font-bold text-purple-500 uppercase mb-2">글 작성 규칙</p>
              <ul className="space-y-1">
                {savedStyle.writing_rules.map((r, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <span className="text-purple-400 font-bold">{i + 1}.</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className="text-[10px] text-gray-400 text-right">
            {savedStyle.analyzed_count}개 글 분석 · {new Date(savedStyle.savedAt).toLocaleDateString('ko-KR')}
          </p>
        </div>
      )}

      {/* 분석 입력 섹션 */}
      <div className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            {savedStyle ? "다른 블로그 분석" : "레퍼런스 블로그 분석"}
          </h2>
          <p className="text-xs text-gray-400 mt-0.5">
            잘 쓴 블로그 URL을 입력하면 AI가 글쓰기 구조를 학습합니다
          </p>
        </div>

        <div className="flex gap-2">
          <input
            value={blogUrl}
            onChange={(e) => setBlogUrl(e.target.value)}
            placeholder="https://blog.naver.com/블로그ID"
            disabled={isLoading}
            className="flex-1 rounded-xl border border-gray-200 bg-gray-50/50 px-3.5 py-2.5 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-400 transition-all disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={!blogUrl.trim() || isLoading}
            className={`h-10 px-4 text-sm font-semibold rounded-xl transition-all flex-shrink-0 flex items-center gap-2 ${
              blogUrl.trim() && !isLoading
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "bg-gray-100 text-gray-400 cursor-not-allowed"
            }`}
          >
            {isLoading ? (
              <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
              </svg>
            )}
            {isLoading ? stepMsg : "분석 시작"}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400 mt-0.5 flex-shrink-0">
              <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
            </svg>
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}
      </div>

      {/* 분석 결과 미리보기 */}
      {previewStyle && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-gray-900">{previewStyle.blogger} 스타일 분석 완료</h3>
              <p className="text-xs text-gray-400">{previewStyle.analyzed_count}개 글 기반</p>
            </div>
            <button
              onClick={handleSave}
              className="h-9 px-4 text-sm font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              스타일 저장 · 적용
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { label: "톤앤매너", value: previewStyle.tone },
              { label: "제목 패턴", value: previewStyle.title_pattern },
              { label: "도입부 방식", value: previewStyle.intro_style },
              { label: "글 구조", value: previewStyle.content_structure },
              { label: "문단 스타일", value: previewStyle.paragraph_style },
              { label: "마무리/CTA", value: previewStyle.cta_style },
            ].map(({ label, value }) => value && (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{label}</p>
                <p className="text-xs text-gray-700">{value}</p>
              </div>
            ))}
          </div>

          {previewStyle.special_features?.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">특징</p>
              <ul className="space-y-1">
                {previewStyle.special_features.map((f, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <span className="text-gray-400">•</span>{f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {previewStyle.writing_rules?.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
              <p className="text-[10px] font-bold text-yellow-600 uppercase mb-2">글 작성 규칙</p>
              <ul className="space-y-1">
                {previewStyle.writing_rules.map((r, i) => (
                  <li key={i} className="text-xs text-gray-700 flex items-start gap-1.5">
                    <span className="text-yellow-500 font-bold">{i + 1}.</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

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

  useEffect(() => {
    emitEAttackContext({
      page: "BlogPage",
      section: "글",
      tab: activeTab,
      mode: view,
      status: activeFilter,
      summary: `블로그 탭 ${activeTab}, 목록 필터 ${activeFilter}, 현재 뷰 ${view}, 저장된 글 ${posts.length}개.`,
    });
  }, [activeTab, activeFilter, view, posts.length]);

  useEffect(() => onEAttackCommand((command) => {
    if (command?.targetPage !== "BlogPage" || command?.action !== "setTab") return;
    if (TABS.some((tab) => tab.key === command.tab)) {
      setActiveTab(command.tab);
    }
  }), []);

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
        onDone={() => {
          setCurrentPost(null);
          setView("list");
        }}
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
        <StyleAnalysisTab />
      )}
    </div>
  );
}
