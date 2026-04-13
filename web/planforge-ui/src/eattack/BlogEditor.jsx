import { useState, useRef } from "react";

// ─── 블로그 에디터 컴포넌트 ───
export default function BlogEditor({ post, onBack, onSave }) {
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState(post.title || "");
  const [sections, setSections] = useState(post.sections || []);
  const [copied, setCopied] = useState(false);

  // 섹션 내용 수정
  const updateSection = (idx, field, value) => {
    setSections((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  // 전체 텍스트 복사
  const handleCopy = () => {
    const text = [
      title,
      "",
      ...sections.flatMap((s) => [
        s.heading ? `## ${s.heading}` : "",
        s.content || "",
        "",
      ]),
    ].join("\n");
    navigator.clipboard.writeText(text.trim()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // 저장
  const handleSave = (status) => {
    onSave({ ...post, title, sections, status, updatedAt: new Date().toISOString() });
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white h-full flex flex-col">
      {/* 헤더 */}
      <header className="px-4 sm:px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
            <div className="min-w-0">
              <p className="text-xs text-gray-400 font-medium truncate">
                {post.contentType === "pulling" ? "풀링 콘텐츠" : "키 콘텐츠"} · {post.keywords?.slice(0, 2).join(", ")}
              </p>
              <h1 className="text-base sm:text-lg font-bold text-gray-900 truncate">생성된 블로그 글</h1>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setEditMode(!editMode)}
              className={`h-8 px-3 text-xs font-medium rounded-lg border transition-all ${
                editMode
                  ? "bg-purple-600 text-white border-purple-600"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {editMode ? "편집 중" : "편집"}
            </button>
            <button
              onClick={handleCopy}
              className={`h-8 px-3 text-xs font-medium rounded-lg border transition-all ${
                copied
                  ? "bg-green-50 text-green-600 border-green-200"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {copied ? "복사됨!" : "복사"}
            </button>
            <button
              onClick={() => handleSave("done")}
              className="h-8 px-3 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
            >
              저장
            </button>
          </div>
        </div>
      </header>

      {/* 본문 */}
      <div className="max-w-3xl mx-auto w-full px-4 sm:px-8 py-6 sm:py-10 space-y-6">
        {/* 메타 정보 */}
        <div className="flex flex-wrap gap-2">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            post.contentType === "pulling"
              ? "bg-blue-50 text-blue-700"
              : "bg-purple-50 text-purple-700"
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {post.contentType === "pulling" ? "풀링 콘텐츠" : "키 콘텐츠"}
          </span>
          {post.funnelStages?.map((stage) => (
            <span key={stage} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
              {stage}
            </span>
          ))}
          {post.keywords?.slice(0, 4).map((kw) => (
            <span key={kw} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500 border border-gray-200">
              #{kw}
            </span>
          ))}
        </div>

        {/* 제목 */}
        <div>
          {editMode ? (
            <textarea
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-2xl sm:text-3xl font-bold text-gray-900 border-b-2 border-purple-300 focus:outline-none focus:border-purple-500 resize-none bg-transparent leading-snug"
              rows={2}
            />
          ) : (
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-snug">{title}</h2>
          )}
        </div>

        {/* 구분선 */}
        <hr className="border-gray-100" />

        {/* 섹션들 */}
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-2">
            {section.heading && (
              editMode ? (
                <input
                  value={section.heading}
                  onChange={(e) => updateSection(idx, "heading", e.target.value)}
                  className="w-full text-lg sm:text-xl font-bold text-gray-800 border-b border-purple-200 focus:outline-none focus:border-purple-400 bg-transparent"
                />
              ) : (
                <h3 className="text-lg sm:text-xl font-bold text-gray-800">{section.heading}</h3>
              )
            )}
            {section.content && (
              editMode ? (
                <textarea
                  value={section.content}
                  onChange={(e) => updateSection(idx, "content", e.target.value)}
                  className="w-full text-sm sm:text-base text-gray-700 leading-relaxed border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-1 focus:ring-purple-400 resize-none bg-gray-50/50"
                  rows={Math.max(4, section.content.split("\n").length + 1)}
                />
              ) : (
                <div className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {section.content}
                </div>
              )
            )}
          </div>
        ))}
      </div>

      {/* 하단 저장 바 */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <button
          onClick={() => handleSave("draft")}
          className="h-9 px-4 text-sm font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
        >
          초안으로 저장
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`h-9 px-4 text-sm font-medium rounded-lg border transition-all ${
              copied
                ? "bg-green-50 text-green-600 border-green-200"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {copied ? "복사됨!" : "전체 복사"}
          </button>
          <button
            onClick={() => handleSave("done")}
            className="h-9 px-4 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
          >
            완료로 저장
          </button>
        </div>
      </div>
    </div>
  );
}
