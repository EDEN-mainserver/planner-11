import Spinner from "../Spinner";
import ErrorBox from "../ErrorBox";
import StepBar from "../StepBar";
import UserBar from "../UserBar";

export default function PlanningStep({
  session,
  onLogout,
  step,
  running,
  plan,
  topic,
  error,
  benchmarkImg,
  setBenchmarkImg,
  handleBenchmarkFile,
  templateId,
  startPlanning,
  startBenchmarkImages,
  startImages,
  startAssembly,
}) {
  const isHighest = templateId === "highest";
  const templateLabel = isHighest ? "🔥 이미지 생성 + HIGHEST 조립 →" : "✨ 프리미엄 템플릿으로 조립 →";
  const templateBtnClass = isHighest
    ? "bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600"
    : "bg-gradient-to-r from-violet-500 to-pink-500 hover:from-violet-600 hover:to-pink-600";
  const onConfirmPlan = () => (isHighest ? startImages() : startAssembly([]));
  return (
    <div className="p-6 space-y-4">
      <UserBar session={session} onLogout={onLogout} />
      <StepBar step={step} />
      {running ? (
        <Spinner label="카드뉴스 기획 중..." gradient="from-purple-500 to-violet-600" />
      ) : plan ? (
        <>
          <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <p className="text-xs font-bold text-purple-700">
              📋 {plan.type} · {plan.slides?.length}장
            </p>
            <span className="text-[10px] text-purple-500">{topic}</span>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {plan.slides?.map((s, i) => (
              <div
                key={i}
                className={`flex items-start gap-2.5 px-3 py-2 rounded-lg border text-xs
                ${s.part === "표지" ? "border-pink-200 bg-pink-50" : s.part === "마무리" ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white"}`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5
                  ${s.part === "표지" ? "bg-pink-200 text-pink-700" : s.part === "마무리" ? "bg-emerald-200 text-emerald-700" : "bg-gray-200 text-gray-600"}`}
                >
                  {s.num}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-gray-800 truncate">{s.headline}</p>
                  {s.body && <p className="text-gray-500 mt-0.5 line-clamp-1">{s.body}</p>}
                  <p className="text-gray-300 mt-0.5 line-clamp-1 italic text-[10px]">
                    {s.imagePrompt}
                  </p>
                </div>
              </div>
            ))}
          </div>
          {error && <ErrorBox msg={error} />}

          {/* 벤치마킹 디자인 첨부 */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden">
            {benchmarkImg ? (
              <div className="flex items-center gap-3 p-3">
                <img
                  src={benchmarkImg.dataUrl}
                  alt="벤치마킹"
                  className="w-12 h-[60px] object-cover rounded-lg border border-gray-200 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-violet-700">벤치마킹 디자인 첨부됨</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">이 디자인 스타일로 HTML 카드가 생성됩니다</p>
                </div>
                <button
                  type="button"
                  onClick={() => setBenchmarkImg(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors flex-shrink-0"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="file" accept="image/*" onChange={handleBenchmarkFile} className="hidden" />
                <div className="w-12 h-[60px] rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
                    <circle cx="9" cy="9" r="2"/>
                    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-600">벤치마킹 디자인 첨부 <span className="font-normal text-gray-400">(선택)</span></p>
                  <p className="text-[10px] text-gray-400 mt-0.5">카드뉴스 레퍼런스 이미지를 첨부하면 그 디자인 그대로 생성됩니다</p>
                </div>
              </label>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={startPlanning}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
            >
              다시 기획
            </button>
            {benchmarkImg ? (
              <button
                onClick={startBenchmarkImages}
                className="flex-[2] py-2.5 text-white text-sm font-bold rounded-xl transition-all bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
              >
                벤치마킹 디자인으로 생성 →
              </button>
            ) : (
              <button
                onClick={onConfirmPlan}
                className={`flex-[2] py-2.5 text-white text-sm font-bold rounded-xl transition-all ${templateBtnClass}`}
              >
                {templateLabel}
              </button>
            )}
          </div>
        </>
      ) : (
        error && <ErrorBox msg={error} onRetry={startPlanning} />
      )}
    </div>
  );
}
