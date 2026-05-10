import { useState } from "react";

const INFLOW_URL =
  typeof window !== "undefined" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "http://localhost:3001"
    : "https://inflow-topaz.vercel.app";

export default function EdenFlowPanel({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 상단 바 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        <button
          onClick={onBack}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 transition-all"
          title="뒤로"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>

        {/* 주소창 스타일 라벨 */}
        <div className="flex-1 max-w-md flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex-shrink-0" />
          <span className="text-xs text-gray-500 font-medium truncate">에덴플로우 — 릴스 기획 · 인사이트</span>
        </div>

        <div className="flex-1" />

        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
          닫기
        </button>
      </div>

      {/* iframe 영역 */}
      <div className="flex-1 relative overflow-hidden">
        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10-4.48 10-10 10S2 17.52 2 12z"/>
                <path d="M8 12h8M12 8v8"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-gray-700">에덴플로우 로딩 중...</p>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 gap-3">
            <span className="text-4xl">⚡</span>
            <p className="text-sm font-semibold text-gray-700">에덴플로우 서버에 연결할 수 없습니다</p>
            <p className="text-xs text-gray-400">터미널에서 <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">npm run dev</code>를 실행해주세요</p>
            <p className="text-xs text-gray-300 font-mono">{INFLOW_URL}</p>
            <button
              onClick={() => { setError(false); setLoading(true); }}
              className="mt-2 px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        <iframe
          key={error ? "retry" : "main"}
          src={INFLOW_URL}
          className="w-full h-full border-none"
          onLoad={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          title="에덴플로우"
          allow="clipboard-read; clipboard-write"
        />
      </div>
    </div>
  );
}
