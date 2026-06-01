import { useState } from "react";
import ErrorBox from "../ErrorBox";
import StepBar from "../StepBar";
import UserBar from "../UserBar";
import { captureViaServerScreenshot } from "../../../services/pipeline/cardCapture";

export default function AssemblyStep({
  session,
  onLogout,
  step,
  onStepClick,
  cards,
  color1,
  color2,
  cardHtmls,
  htmlContent,
  previewIdx,
  setPreviewIdx,
  topic,
  error,
  updateCard,
  setStep,
}) {
  const [downloadingPng, setDownloadingPng] = useState(false);

  // 서버 측 Puppeteer로 캡처 — CSS 효과(background-clip:text 등)를 그대로 렌더.
  // 콜드 스타트 포함 5~15초 소요될 수 있어 사용자에게 진행 표시 필수.
  const downloadAsPng = async (html, idx) => {
    if (!html || downloadingPng) return;
    setDownloadingPng(true);
    try {
      const dataUrl = await captureViaServerScreenshot(html, "png");
      if (!dataUrl) throw new Error("캡처 결과가 비어있음");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${(topic || "카드뉴스").slice(0, 15)}-카드${idx + 1}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("PNG 캡처 실패:", e);
      alert(`PNG 다운로드 실패: ${e.message}`);
    } finally {
      setDownloadingPng(false);
    }
  };
  return (
    <div className="p-6 space-y-4">
      <UserBar session={session} onLogout={onLogout} />
      <StepBar step={step} onStepClick={onStepClick} />

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-800">카드 편집</p>
          <p className="text-xs text-gray-400">
            {cards.length}장 · 텍스트를 직접 수정할 수 있습니다
          </p>
        </div>
        <div
          className="w-6 h-6 rounded-md flex-shrink-0 border border-gray-200"
          style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }}
        />
      </div>

      {/* 카드 편집 목록 */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {cards.map((card, i) => (
          <div
            key={i}
            className={`rounded-xl border p-3 space-y-2 text-xs
            ${card.part === "표지" ? "border-pink-200 bg-pink-50" : card.part === "마무리" ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"}`}
          >
            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0
                ${card.part === "표지" ? "bg-pink-200 text-pink-700" : card.part === "마무리" ? "bg-emerald-200 text-emerald-700" : "bg-gray-200 text-gray-600"}`}
              >
                {card.num}
              </span>
              <span className="text-gray-400 font-medium">{card.part}</span>
              {card.imageUrl && (
                <img
                  src={card.imageUrl}
                  alt=""
                  className="w-8 h-8 rounded object-cover ml-auto flex-shrink-0"
                />
              )}
            </div>
            <input
              type="text"
              value={card.headline}
              onChange={(e) => updateCard(i, "headline", e.target.value)}
              placeholder="제목"
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-violet-400 bg-white"
            />
            <input
              type="text"
              value={card.body}
              onChange={(e) => updateCard(i, "body", e.target.value)}
              placeholder={card.part === "표지" ? "액센트 핀 (≤25자, 짧은 약속/유도)" : "본문 (선택)"}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-violet-400 bg-white"
            />
            {card.part === "표지" && (
              <>
                <input
                  type="text"
                  value={card.personName || ""}
                  onChange={(e) => updateCard(i, "personName", e.target.value)}
                  placeholder="인물 이름 (옵션 — 예: Mike Krieger)"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-pink-400 bg-white"
                />
                <input
                  type="text"
                  value={card.personRole || ""}
                  onChange={(e) => updateCard(i, "personRole", e.target.value)}
                  placeholder="인물 직책 (옵션 — 예: Anthropic CPO · 인스타그램 창업자)"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-pink-400 bg-white"
                />
                <input
                  type="text"
                  value={card.imageUrl || ""}
                  onChange={(e) => updateCard(i, "imageUrl", e.target.value)}
                  placeholder="인물 사진 URL (옵션 — 직접 붙여넣기)"
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs outline-none focus:border-pink-400 bg-white"
                />
              </>
            )}
          </div>
        ))}
      </div>

      {/* 미리보기 슬라이더 */}
      {(cardHtmls.length > 0 || htmlContent) && (() => {
        const total = cardHtmls.length || cards.length;
        const safeIdx = Math.min(previewIdx, total - 1);
        const SCALE = 0.28;
        const W = Math.round(1080 * SCALE); // 302px
        const H = Math.round(1350 * SCALE); // 378px
        const currentHtml = cardHtmls[safeIdx] || htmlContent;
        return (
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {/* 상단 바 */}
            <div className="px-3 py-2 bg-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                </div>
                <p className="text-[11px] text-gray-400 ml-1">카드 미리보기</p>
              </div>
              <p className="text-[11px] text-gray-400 font-semibold">
                {safeIdx + 1} / {total}
              </p>
            </div>

            {/* 카드 뷰 + 좌우 버튼 */}
            <div className="bg-gray-900 flex items-center gap-0" style={{ height: `${H + 24}px` }}>
              {/* 이전 버튼 */}
              <button
                onClick={() => setPreviewIdx((p) => Math.max(0, p - 1))}
                disabled={safeIdx === 0}
                className="flex-shrink-0 w-9 h-full flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-20 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6"/>
                </svg>
              </button>

              {/* iframe 카드 */}
              <div
                className="flex-1 flex items-center justify-center"
                style={{ height: `${H + 24}px` }}
              >
                <div
                  style={{
                    width: `${W}px`,
                    height: `${H}px`,
                    overflow: "hidden",
                    borderRadius: "6px",
                    flexShrink: 0,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
                    position: "relative",
                  }}
                >
                  <iframe
                    key={`${safeIdx}-${currentHtml.slice(0, 40)}`}
                    srcDoc={currentHtml}
                    style={{
                      border: "none",
                      width: "1080px",
                      height: "1350px",
                      display: "block",
                      transformOrigin: "top left",
                      transform: `scale(${SCALE})`,
                      pointerEvents: "none",
                    }}
                    title={`카드 ${safeIdx + 1}`}
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>

              {/* 다음 버튼 */}
              <button
                onClick={() => setPreviewIdx((p) => Math.min(total - 1, p + 1))}
                disabled={safeIdx === total - 1}
                className="flex-shrink-0 w-9 h-full flex items-center justify-center text-gray-500 hover:text-white disabled:opacity-20 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>

            {/* 하단: 도트 네비게이션 + 카드 다운로드 */}
            <div className="bg-gray-900 pb-3 flex flex-col items-center gap-2">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: total }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewIdx(i)}
                    className={`rounded-full transition-all ${
                      i === safeIdx
                        ? "w-4 h-1.5 bg-violet-400"
                        : "w-1.5 h-1.5 bg-gray-600 hover:bg-gray-400"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadAsPng(cardHtmls[safeIdx] || htmlContent, safeIdx)}
                  disabled={downloadingPng}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900 disabled:cursor-wait text-white text-[11px] font-semibold transition-colors"
                  title="현재 카드를 1080×1350 PNG로 다운로드"
                >
                  {downloadingPng ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <rect width="18" height="18" x="3" y="3" rx="2"/>
                      <circle cx="9" cy="9" r="2"/>
                      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                    </svg>
                  )}
                  {downloadingPng ? "캡처 중..." : `카드 ${safeIdx + 1} PNG`}
                </button>
                <button
                  onClick={() => {
                    const html = cardHtmls[safeIdx] || htmlContent;
                    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${topic.slice(0, 15)}-카드${safeIdx + 1}.html`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1 px-3 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-[11px] font-semibold transition-colors"
                  title="HTML 원본 다운로드"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  HTML
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {error && <ErrorBox msg={error} />}

      <div className="flex gap-2">
        <button
          onClick={() => setStep("images")}
          className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
        >
          ← 이미지 재생성
        </button>
        <button
          onClick={() => setStep("deploy")}
          className="flex-[2] py-2.5 bg-gradient-to-r from-violet-500 to-pink-500 text-white text-sm font-bold rounded-xl hover:from-violet-600 hover:to-pink-600 transition-all"
        >
          배포 →
        </button>
      </div>
    </div>
  );
}
