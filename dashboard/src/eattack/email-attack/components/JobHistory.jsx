// 최근 작업 히스토리 (사이드 패널)

export default function JobHistory({ jobs, currentJobId, onSelect, onDelete }) {
  if (!jobs || jobs.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">최근 작업</h3>
        <p className="text-xs text-gray-400">아직 실행한 작업이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">최근 작업</h3>
      <ul className="space-y-1">
        {jobs.map((j) => {
          const isCurrent = j.id === currentJobId;
          return (
            <li key={j.id}>
              <div
                className={`group flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                  isCurrent ? "bg-orange-50 border border-orange-200" : "hover:bg-gray-50"
                }`}
                onClick={() => onSelect(j.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-900 truncate">{j.keyword}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(j.created_at).toLocaleString("ko-KR", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {" · "}
                    <span
                      className={
                        j.status === "done"
                          ? "text-green-600"
                          : j.status === "failed"
                          ? "text-red-600"
                          : "text-amber-600"
                      }
                    >
                      {j.status}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm("이 작업을 삭제할까요?")) onDelete(j.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-xs text-red-500 px-1 hover:underline"
                >
                  삭제
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
