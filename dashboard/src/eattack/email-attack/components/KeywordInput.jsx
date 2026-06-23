// 키워드 입력 + 검색 소스 선택 (구글/네이버)
import { useState } from "react";

export default function KeywordInput({ onRun, running }) {
  const [keyword, setKeyword] = useState("");
  const [useGoogle, setUseGoogle] = useState(true);
  const [useNaver, setUseNaver] = useState(true);
  const [targetCount, setTargetCount] = useState(20);

  const handleRun = () => {
    if (!keyword.trim()) return;
    const sources = [];
    if (useGoogle) sources.push("google");
    if (useNaver) sources.push("naver");
    if (sources.length === 0) return alert("검색 소스 하나 이상 선택");
    onRun({ keyword: keyword.trim(), sources, targetCount });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-base font-semibold text-gray-900 mb-3">키워드로 발굴 시작</h3>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !running && handleRun()}
          placeholder="예: 반려동물 영양제, 비건 수분크림"
          disabled={running}
          className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent disabled:bg-gray-50"
        />
        <button
          onClick={handleRun}
          disabled={running || !keyword.trim()}
          className="px-6 py-2.5 bg-gradient-to-br from-amber-400 to-orange-500 text-white text-sm font-semibold rounded-lg disabled:opacity-50 hover:shadow-md transition-all"
        >
          {running ? "발굴 중..." : "발굴 시작"}
        </button>
      </div>

      <div className="flex items-center gap-4 text-sm flex-wrap">
        <span className="text-gray-500 text-xs">검색 소스:</span>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={useGoogle}
            onChange={(e) => setUseGoogle(e.target.checked)}
            disabled={running}
          />
          <span>구글 (SerpAPI)</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={useNaver}
            onChange={(e) => setUseNaver(e.target.checked)}
            disabled={running}
          />
          <span>네이버 (공식 API)</span>
        </label>
        <span className="ml-auto flex items-center gap-2 text-xs text-gray-500">
          목표
          <input
            type="number"
            min={5}
            max={50}
            value={targetCount}
            onChange={(e) => setTargetCount(Number(e.target.value) || 20)}
            disabled={running}
            className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
          />
          개
        </span>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        유관 키워드 4~5개로 자동 확장됩니다. 매체·포털·대형쇼핑몰은 자동 제외.
      </p>
    </div>
  );
}
