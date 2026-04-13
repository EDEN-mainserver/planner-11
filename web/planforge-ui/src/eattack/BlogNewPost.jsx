import { useState, useRef } from "react";

// ─── 추천 주제 ───
const SUGGESTED_TOPICS = [
  "AI 콘텐츠 자동화의 미래",
  "SaaS 성장 전략 가이드",
  "스타트업 마케팅 실전 노하우",
  "개인 브랜딩으로 커리어 성장하기",
  "원격 근무 생산성 높이는 법",
  "2026 SEO 완벽 가이드",
];

// ─── 언어 옵션 ───
const LANGUAGES = [
  { value: "auto", label: "입력 내용 따라 자동 감지" },
  { value: "ko", label: "한국어" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
];

export default function BlogNewPost({ onBack, onGenerate }) {
  const [topic, setTopic] = useState("");
  const [language, setLanguage] = useState("auto");
  const [showLangDropdown, setShowLangDropdown] = useState(false);
  const [images, setImages] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const selectedLangLabel = LANGUAGES.find((l) => l.value === language)?.label;
  const canSubmit = topic.trim().length > 0;

  // 이미지 업로드 처리
  const handleFiles = (files) => {
    const newImages = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, 12 - images.length);
    if (newImages.length === 0) return;

    const readers = newImages.map(
      (file) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve({ name: file.name, url: e.target.result, file });
          reader.readAsDataURL(file);
        })
    );
    Promise.all(readers).then((results) => {
      setImages((prev) => [...prev, ...results].slice(0, 12));
    });
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // 글 생성
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    if (onGenerate) {
      onGenerate({ topic, language, images });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white h-full">
      {/* 헤더 */}
      <header className="px-4 sm:px-6 py-4 sm:py-6">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">새 글 작성</h1>
        </div>
      </header>

      {/* 폼 */}
      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 sm:px-6 pb-24 sm:pb-8 space-y-5 sm:space-y-6">

        {/* 주제 입력 */}
        <div className="space-y-2 sm:space-y-3">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold tracking-tight text-gray-900">어떤 주제로 글을 쓸까요?</h2>
            <p className="text-sm text-gray-500 mt-1">주제만 입력하면 AI가 리서치부터 글 작성까지 알아서 해드려요</p>
          </div>

          {/* 추천 주제 */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" />
                <path d="M9 18h6" /><path d="M10 22h4" />
              </svg>
              <span className="text-xs font-medium text-gray-500">이런 주제는 어때요?</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {SUGGESTED_TOPICS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className={`shrink-0 whitespace-nowrap inline-flex items-center rounded-full border px-3 py-1 text-xs transition-colors
                    ${topic === t
                      ? "border-purple-300 bg-purple-50 text-purple-700"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-200"
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* 텍스트 입력 */}
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="블로그 주제를 입력하세요 (예: AI 콘텐츠 자동화의 미래)"
            maxLength={500}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm sm:text-base text-gray-800 placeholder-gray-400 shadow-sm resize-none min-h-[120px] sm:min-h-[160px] focus:outline-none focus:ring-1 focus:ring-purple-400 focus:border-purple-400 transition-colors"
          />
        </div>

        {/* 언어 + 이미지 */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">

          {/* 글 작성 언어 */}
          <div className="space-y-1.5 rounded-lg sm:rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 sm:p-4">
            <label className="text-xs sm:text-sm font-medium text-gray-700">글 작성 언어</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangDropdown(!showLangDropdown)}
                className="flex min-h-[44px] w-full items-center justify-between rounded-md border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-purple-400"
              >
                <span className="text-gray-700">{selectedLangLabel}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 transition-transform ${showLangDropdown ? "rotate-180" : ""}`}>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {/* 드롭다운 */}
              {showLangDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowLangDropdown(false)} />
                  <div className="absolute top-full left-0 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 max-h-60 overflow-y-auto">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.value}
                        type="button"
                        onClick={() => { setLanguage(lang.value); setShowLangDropdown(false); }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between
                          ${language === lang.value ? "bg-purple-50 text-purple-700" : "text-gray-700 hover:bg-gray-50"}`}
                      >
                        {lang.label}
                        {language === lang.value && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <p className="text-[11px] sm:text-xs text-gray-400">
              보통 주제 입력 언어를 따라갑니다. 다른 언어로 강제하고 싶을 때만 직접 선택하세요.
            </p>
          </div>

          {/* 참고 이미지 */}
          <div className="space-y-1.5 rounded-lg sm:rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 sm:p-4">
            <div>
              <label className="text-xs sm:text-sm font-medium text-gray-700">참고 이미지</label>
              <p className="mt-0.5 text-[11px] sm:text-xs text-gray-400">
                이미지를 업로드하면 글 생성 AI가 먼저 반영하고, 부족한 경우에만 자동 이미지를 찾습니다.
              </p>
            </div>

            {/* 업로드 영역 */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`rounded-xl border border-dashed p-5 transition-colors cursor-pointer
                ${isDragOver ? "border-purple-400 bg-purple-50" : "border-gray-200 bg-gray-50/50 hover:border-gray-300"}`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.png,.jpg,.jpeg,.webp"
                multiple
                onChange={(e) => handleFiles(e.target.files)}
                className="hidden"
              />
              <div className="flex flex-col items-center justify-center gap-2 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" x2="12" y1="3" y2="15" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-700">이미지를 드래그하거나 클릭하여 업로드</p>
                  <p className="text-xs text-gray-400 mt-1">최대 12장. 업로드한 이미지를 자동 이미지 검색보다 우선 사용합니다.</p>
                </div>
              </div>
            </div>

            {/* 업로드된 이미지 미리보기 */}
            {images.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-2">
                {images.map((img, i) => (
                  <div key={i} className="relative group w-16 h-16 rounded-lg overflow-hidden border border-gray-200">
                    <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                      className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 세부 설정 (접이식) */}
        <div>
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50/50 hover:bg-gray-100 hover:border-gray-300 px-4 py-3 transition-colors text-left"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 shrink-0">
              <path d="M20 7h-9" /><path d="M14 17H5" />
              <circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
            </svg>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-gray-700">세부 설정</span>
              <p className="text-xs text-gray-400">언어, 분위기, 키워드 등을 커스터마이즈</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-gray-400 shrink-0 transition-transform duration-200 ${showSettings ? "rotate-90" : ""}`}>
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          {/* 세부 설정 내용 (추후 추가) */}
          {showSettings && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50/50 p-4">
              <p className="text-sm text-gray-400 text-center py-4">세부 설정 항목이 여기에 추가됩니다.</p>
            </div>
          )}
        </div>

        {/* 글 생성 시작 버튼 (데스크톱) */}
        <button
          type="submit"
          disabled={!canSubmit}
          className={`hidden sm:inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium rounded-lg h-11 min-h-[48px] px-8 transition-colors
            ${canSubmit
              ? "bg-purple-600 text-white shadow hover:bg-purple-700"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            <path d="M20 3v4" /><path d="M22 5h-4" />
            <path d="M4 17v2" /><path d="M5 18H3" />
          </svg>
          글 생성 시작
        </button>
      </form>

      {/* 글 생성 시작 버튼 (모바일 하단 고정) */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-sm border-t border-gray-200 sm:hidden z-50">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={`inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium rounded-lg w-full h-12 text-base transition-colors
            ${canSubmit
              ? "bg-purple-600 text-white shadow hover:bg-purple-700"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
            }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            <path d="M20 3v4" /><path d="M22 5h-4" />
            <path d="M4 17v2" /><path d="M5 18H3" />
          </svg>
          글 생성 시작
        </button>
      </div>
    </div>
  );
}
