import { useState } from "react";

// ─── **볼드** 마크다운을 <strong>으로 렌더링 ───
function RichText({ text }) {
  if (!text) return null;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-bold text-gray-900">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

// ─── 이미지 플레이스홀더 ───
function ImagePlaceholder({ prompt, imageUrl, onGenerate, isGenerating }) {
  return (
    <div className="my-4 rounded-xl overflow-hidden border border-gray-200">
      {imageUrl ? (
        <img src={imageUrl} alt={prompt} className="w-full h-52 object-cover" />
      ) : (
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 h-44 flex flex-col items-center justify-center gap-3 px-4">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21,15 16,10 5,21"/>
          </svg>
          <p className="text-xs text-gray-400 text-center leading-relaxed max-w-xs">{prompt}</p>
          <button
            onClick={() => onGenerate(prompt)}
            disabled={isGenerating}
            className="h-8 px-4 text-xs font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
          >
            {isGenerating ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                생성 중...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                이미지 생성
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 블로그 에디터 컴포넌트 ───
export default function BlogEditor({ post, onBack, onSave, onDone }) {
  const [editMode, setEditMode] = useState(false);
  const [title, setTitle] = useState(post.title || "");
  const [sections, setSections] = useState(post.sections || []);
  const [copied, setCopied] = useState(false);
  const [savedStatus, setSavedStatus] = useState(""); // "" | "draft" | "done"
  const [generatingImageIdx, setGeneratingImageIdx] = useState(null);
  const [sectionImages, setSectionImages] = useState({}); // { idx: imageUrl }

  // 섹션 내용 수정
  const updateSection = (idx, field, value) => {
    setSections((prev) => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  // 이미지 생성 (나노바나나 or 플레이스홀더)
  const handleGenerateImage = async (idx, prompt) => {
    setGeneratingImageIdx(idx);
    try {
      const resp = await fetch('/api/image-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      if (!resp.ok) throw new Error('이미지 생성 실패');
      const data = await resp.json();
      if (data.imageUrl) {
        setSectionImages((prev) => ({ ...prev, [idx]: data.imageUrl }));
      }
    } catch {
      // API 미연동 시 무시 (플레이스홀더 유지)
    } finally {
      setGeneratingImageIdx(null);
    }
  };

  // **볼드** 마크다운 제거 후 순수 텍스트 반환
  const stripBold = (text) => (text || "").replace(/\*\*([^*]+)\*\*/g, "$1");

  // 전체 텍스트 복사
  const handleCopy = () => {
    const text = [
      title,
      "",
      ...sections.flatMap((s) => [
        s.heading ? `[${s.heading}]` : "",
        stripBold(s.content) || "",
        s.quote ? `\n"${s.quote}"` : "",
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
    setSavedStatus(status);
    if (status === "done") {
      // 완료 저장 시 1.2초 후 목록으로 이동
      setTimeout(() => onDone?.(), 1200);
    }
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

      {/* 저장 피드백 배너 */}
      {savedStatus && (
        <div className={`px-4 sm:px-6 py-2.5 flex items-center gap-2 text-sm font-medium transition-all ${
          savedStatus === "done"
            ? "bg-green-50 text-green-700 border-b border-green-100"
            : "bg-blue-50 text-blue-700 border-b border-blue-100"
        }`}>
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          {savedStatus === "done" ? "완료로 저장됐습니다. 목록으로 돌아갑니다..." : "초안으로 저장됐습니다."}
        </div>
      )}

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
          <div key={idx} className="space-y-3">
            {/* 소제목 */}
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

            {/* 이미지 영역 */}
            {section.image_prompt && (
              <ImagePlaceholder
                prompt={section.image_prompt}
                imageUrl={sectionImages[idx]}
                onGenerate={(p) => handleGenerateImage(idx, p)}
                isGenerating={generatingImageIdx === idx}
              />
            )}

            {/* 본문 */}
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
                  <RichText text={section.content} />
                </div>
              )
            )}

            {/* 인용구 */}
            {section.quote && !editMode && (
              <blockquote className="border-l-4 border-purple-400 bg-purple-50 pl-4 py-3 pr-3 rounded-r-xl my-1">
                <p className="text-sm sm:text-base text-purple-800 font-medium leading-relaxed italic">
                  "{section.quote}"
                </p>
              </blockquote>
            )}
            {section.quote && editMode && (
              <input
                value={section.quote}
                onChange={(e) => updateSection(idx, "quote", e.target.value)}
                placeholder="인용구 (비워두면 숨김)"
                className="w-full text-sm text-purple-700 italic border border-purple-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-400 bg-purple-50/50"
              />
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
