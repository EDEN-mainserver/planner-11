// 작업 진행 상황 표시
export default function JobProgress({ job }) {
  if (!job) return null;
  const { status, progress = {}, error, keyword } = job;
  const phase = progress.phase || status;
  const phaseLabel = {
    queued: "대기 중",
    search: "검색 중",
    extracting: "이메일 추출 중",
    done: "완료",
    empty: "검색 결과 없음",
    failed: "실패",
  }[phase] || phase;

  const pct =
    progress.total > 0
      ? Math.min(100, Math.round((progress.current / progress.total) * 100))
      : 0;

  const isRunning = status === "running" || status === "queued";

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">{keyword}</span>
          <span
            className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
              status === "done"
                ? "bg-green-100 text-green-700"
                : status === "failed"
                ? "bg-red-100 text-red-700"
                : "bg-amber-100 text-amber-700"
            }`}
          >
            {phaseLabel}
          </span>
        </div>
        {progress.total > 0 && (
          <span className="text-xs text-gray-500 tabular-nums">
            {progress.current} / {progress.total}
            {progress.found_domains != null && ` · 발견 ${progress.found_domains}`}
          </span>
        )}
      </div>

      {isRunning && (
        <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-600 mt-2">{error}</p>
      )}
    </div>
  );
}
