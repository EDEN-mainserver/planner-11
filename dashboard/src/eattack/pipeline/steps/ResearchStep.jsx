import Spinner from "../Spinner";
import ErrorBox from "../ErrorBox";
import StepBar from "../StepBar";
import UserBar from "../UserBar";

export default function ResearchStep({
  session,
  onLogout,
  step,
  onStepClick,
  running,
  topic,
  research,
  sources = [],
  error,
  startResearch,
  startPlanning,
}) {
  return (
    <div className="p-6 space-y-4">
      <UserBar session={session} onLogout={onLogout} />
      <StepBar step={step} onStepClick={onStepClick} />
      {running ? (
        <Spinner
          label={`"${topic}" 리서치 중...`}
          sub="네이버 검색 + 본문 크롤 + AI 분석"
          gradient="from-blue-500 to-cyan-600"
        />
      ) : research ? (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-bold text-blue-700 mb-2">📋 리서치 보고서</p>
            <div className="text-xs text-gray-700 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto pr-1">
              {research}
            </div>
          </div>
          {sources.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs font-bold text-gray-700 mb-2">
                🔗 참고 출처 <span className="text-gray-400 font-normal">({sources.length}건, 상위 {Math.min(3, sources.length)}건 본문 포함)</span>
              </p>
              <ol className="space-y-1.5 text-xs max-h-48 overflow-y-auto pr-1">
                {sources.map((s, i) => (
                  <li key={s.link || i} className="flex gap-1.5">
                    <span className="text-gray-400 shrink-0">[{i + 1}]</span>
                    <div className="min-w-0">
                      <a
                        href={s.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline break-words"
                      >
                        {s.title || s.link}
                      </a>
                      {s.bloggername && (
                        <span className="text-gray-400 ml-1.5">— {s.bloggername}</span>
                      )}
                      {s.content && (
                        <span className="ml-1 text-[10px] text-emerald-600 font-semibold">본문</span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {error && <ErrorBox msg={error} />}
          <div className="flex gap-2">
            <button
              onClick={startResearch}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-all"
            >
              다시 리서치
            </button>
            <button
              onClick={startPlanning}
              className="flex-[2] py-2.5 bg-gradient-to-r from-violet-500 to-pink-500 text-white text-sm font-bold rounded-xl hover:from-violet-600 hover:to-pink-600 transition-all"
            >
              기획 시작 →
            </button>
          </div>
        </>
      ) : error ? (
        <ErrorBox msg={error} onRetry={startResearch} />
      ) : (
        <ErrorBox msg="리서치 결과를 받지 못했습니다. 다시 시도해주세요." onRetry={startResearch} />
      )}
    </div>
  );
}
