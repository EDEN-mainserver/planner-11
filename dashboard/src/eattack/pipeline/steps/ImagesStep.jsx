import ErrorBox from "../ErrorBox";
import StepBar from "../StepBar";
import UserBar from "../UserBar";

export default function ImagesStep({
  session,
  onLogout,
  step,
  onStepClick,
  running,
  imgProg,
  images,
  plan,
  error,
  batchSize,
  setImages,
  setStep,
  startImages,
  startAssembly,
}) {
  return (
    <div className="p-6 space-y-4">
      <UserBar session={session} onLogout={onLogout} />
      <StepBar step={step} onStepClick={onStepClick} />

      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-700">
          {running
            ? `이미지 생성 중... ${imgProg.done}/${imgProg.total}`
            : `완료 ${images.filter(Boolean).length}/${plan.slides.length}장`}
        </p>
        {running && (
          <div className="w-28 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-violet-500 rounded-full transition-all"
              style={{ width: `${(imgProg.done / imgProg.total) * 100}%` }}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {plan.slides.map((s, i) => {
          const isDone = i < imgProg.done;
          const isCurrent =
            running && !isDone && i >= imgProg.done && i < imgProg.done + batchSize;
          // 표지 + personName 있는 슬라이드는 자동 생성 스킵 — 사용자가 AssemblyStep에서 실인물 사진 URL 직접 입력
          const isSkipped = s.part === "표지" && String(s.personName || "").trim().length > 0;
          return (
            <div
              key={i}
              className="relative rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
              style={{ aspectRatio: "4/5" }}
            >
              {images[i] ? (
                <img src={images[i]} alt={s.headline} className="w-full h-full object-cover" />
              ) : (
                <div
                  className={`w-full h-full flex flex-col items-center justify-center gap-1 transition-colors
                  ${isSkipped ? "bg-pink-50 border border-pink-200" : isCurrent ? "bg-violet-50 animate-pulse" : isDone && !images[i] ? "bg-red-50" : "bg-gray-50"}`}
                >
                  {isSkipped ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-pink-400">
                        <circle cx="12" cy="8" r="4"/>
                        <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
                      </svg>
                      <span className="text-[10px] text-pink-600 text-center px-1 font-semibold leading-tight">
                        인물 사진<br/>편집에서 URL 입력
                      </span>
                    </>
                  ) : isCurrent ? (
                    <svg
                      className="animate-spin text-violet-400"
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : isDone && !images[i] ? (
                    <span className="text-[10px] text-red-400 text-center px-1">생성 실패</span>
                  ) : (
                    <span className="text-xs text-gray-300 font-bold">{s.num}</span>
                  )}
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1.5 py-1">
                <p className="text-[9px] text-white truncate">{s.headline}</p>
              </div>
            </div>
          );
        })}
      </div>

      {error && <ErrorBox msg={error} />}

      {!running && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setImages([]);
                startImages();
              }}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
            >
              다시 생성
            </button>
            <button
              onClick={() => startAssembly(images)}
              className="flex-[2] py-2.5 bg-gradient-to-r from-violet-500 to-pink-500 text-white text-sm font-bold rounded-xl hover:from-violet-600 hover:to-pink-600 transition-all"
            >
              카드 조립 →
            </button>
          </div>
          <button
            onClick={() => { setImages([]); setStep("planning"); }}
            className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 flex items-center justify-center gap-1 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            기획 단계로 돌아가기
          </button>
        </div>
      )}
    </div>
  );
}
