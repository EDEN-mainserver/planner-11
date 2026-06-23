// 발굴 결과 표 — 상호, 홈페이지, 이메일, 발견경로

const SOURCE_LABEL = {
  google: { label: "구글", color: "bg-blue-50 text-blue-700" },
  naver: { label: "네이버", color: "bg-green-50 text-green-700" },
};

export default function ResultsTable({ results, onGenerateProposals }) {
  if (!results || results.length === 0) {
    return (
      <div className="bg-white border border-dashed border-gray-300 rounded-xl p-8 text-center">
        <p className="text-sm text-gray-500">아직 발굴된 결과가 없습니다.</p>
        <p className="text-xs text-gray-400 mt-1">위에서 키워드 입력 후 "발굴 시작"을 누르세요.</p>
      </div>
    );
  }

  const copyAllEmails = () => {
    const emails = results.flatMap((r) => r.emails || []).join(", ");
    navigator.clipboard.writeText(emails);
  };

  const downloadCsv = () => {
    const header = ["상호", "홈페이지", "이메일", "언어", "발견경로", "키워드"];
    const rows = results.map((r) => [
      (r.brand_name || "").replace(/[",\n]/g, " "),
      r.homepage_url || `https://${r.domain}`,
      (r.emails || []).join("; "),
      r.language || "",
      r.source || "",
      r.source_keyword || "",
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `email-attack-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-gray-900">
          발굴 결과 <span className="text-gray-500">({results.length}건)</span>
        </h3>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={copyAllEmails}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-white"
          >
            이메일 전체 복사
          </button>
          <button
            onClick={downloadCsv}
            className="text-xs px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-white"
          >
            CSV 다운로드
          </button>
          {onGenerateProposals && (
            <button
              onClick={onGenerateProposals}
              className="text-xs px-3 py-1.5 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-lg hover:shadow-md font-semibold"
            >
              ✉️ 아래 DB로 제안서 생성하기
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left w-8">#</th>
              <th className="px-4 py-2 text-left">상호 / 사이트명</th>
              <th className="px-4 py-2 text-left">홈페이지</th>
              <th className="px-4 py-2 text-left">이메일</th>
              <th className="px-4 py-2 text-left">출처</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, idx) => {
              const src = SOURCE_LABEL[r.source] || { label: r.source || "?", color: "bg-gray-100 text-gray-600" };
              return (
                <tr key={r.id || idx} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 tabular-nums">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.brand_name || r.domain}
                    {r.language && r.language !== "ko" && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                        {r.language}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={r.homepage_url || `https://${r.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 hover:underline text-xs"
                    >
                      {r.domain}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-xs">
                    {(r.emails || []).slice(0, 2).join(", ")}
                    {(r.emails || []).length > 2 && (
                      <span className="text-gray-400"> (+{r.emails.length - 2})</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs ${src.color}`}>
                      {src.label}
                    </span>
                    {r.source_keyword && r.source_keyword !== results[0]?.source_keyword && (
                      <div className="text-[10px] text-gray-400 mt-0.5">{r.source_keyword}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
