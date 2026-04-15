// ── 이걸 돈내고 써? — 무료 대체 툴 모음 ──
import { useState } from "react";

// ── 툴 목록 ──
const FREE_TOOLS = [
  {
    key: "esign",
    label: "전자서명",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
        <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
        <path d="m12.5 15-2-2 1-4 4-1 2 2z"/>
        <path d="m10.5 13-1.5 4.5"/>
      </svg>
    ),
    gradient: "from-amber-400 to-orange-500",
    description: "모두싸인·DocuSign 대신 — 문서 업로드, 서명 요청, PDF 다운로드까지 무료",
    url: "https://province-hearts-valued-stuart.trycloudflare.com",
    replaces: ["모두싸인 월 19,900원~", "DocuSign 월 $15~"],
    features: ["PDF·HWP·DOCX 업로드", "서명자 이메일 자동 발송", "필드 드래그 배치", "서명 완료 PDF 다운로드"],
  },
];

// ── 툴 선택 카드 ──
function ToolCard({ tool, onClick }) {
  return (
    <div
      onClick={onClick}
      className="relative group bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 transition-all duration-300
        cursor-pointer hover:border-gray-300 hover:shadow-lg hover:-translate-y-1"
    >
      {/* 아이콘 */}
      <div className={`rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 mb-4 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3 ${tool.gradient}`}>
        <div className="text-white [&>svg]:w-6 [&>svg]:h-6 sm:[&>svg]:w-7 sm:[&>svg]:h-7">
          {tool.icon}
        </div>
      </div>

      {/* 텍스트 */}
      <h3 className="font-semibold text-gray-900 text-base sm:text-lg mb-1 sm:mb-2 transition-colors group-hover:text-gray-800">
        {tool.label}
      </h3>
      <p className="text-gray-500 text-xs sm:text-sm line-clamp-2">{tool.description}</p>

      {/* 시작하기 화살표 */}
      <div className="flex items-center text-gray-400 group-hover:text-gray-600 transition-colors mt-4">
        <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-x-2 group-hover:translate-x-0">
          열기
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300">
          <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
        </svg>
      </div>
    </div>
  );
}

// ── E-Sign 상세 페이지 ──
function ESignDetail({ tool, onBack }) {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8 sm:py-12">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${tool.gradient} flex items-center justify-center shadow-md text-white [&>svg]:w-5 [&>svg]:h-5`}>
              {tool.icon}
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">{tool.label}</h3>
              <p className="text-sm text-gray-400">이걸 돈내고 써?</p>
            </div>
          </div>
        </div>

        {/* 비교 배너 */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 mb-6 text-white">
          <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">절약 비용</p>
          <h2 className="text-xl font-bold mb-4">월 0원으로 전자서명 쓰기</h2>
          <div className="flex flex-wrap gap-2">
            {tool.replaces.map(r => (
              <span key={r} className="px-3 py-1.5 bg-white/10 rounded-lg text-xs text-red-300 line-through font-medium">{r}</span>
            ))}
            <span className="px-3 py-1.5 bg-emerald-500/30 border border-emerald-400/40 rounded-lg text-xs text-emerald-300 font-bold">
              E-Sign 무료 🎉
            </span>
          </div>
        </div>

        {/* 기능 목록 */}
        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">포함 기능</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {tool.features.map((f, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </div>
              <p className="text-sm text-gray-700 font-medium">{f}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
          <p className="text-sm text-gray-500 mb-4">에덴 내부 전용 전자서명 툴 · 새 탭에서 열립니다</p>
          <a
            href={tool.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gray-900 hover:bg-gray-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            </svg>
            E-Sign 열기
          </a>
          <p className="text-xs text-gray-300 mt-3">{tool.url}</p>
        </div>

      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──
export default function MoneyPage({ onBack }) {
  const [activeTool, setActiveTool] = useState(null);

  // 툴 상세 화면
  if (activeTool) {
    const tool = FREE_TOOLS.find(t => t.key === activeTool);
    return <ESignDetail tool={tool} onBack={() => setActiveTool(null)} />;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8 sm:py-12">

        {/* 헤더 배너 */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 sm:p-8 mb-8 sm:mb-10 text-white">
          <p className="text-sm text-gray-300 mb-1 font-medium">이걸 돈내고 써?</p>
          <h2 className="text-xl sm:text-2xl font-bold mb-1">
            유료 SaaS, 우리가 직접 만들었습니다.
          </h2>
          <p className="text-sm text-gray-400">
            매달 나가는 구독료를 아끼는 에덴 내부 전용 무료 툴 모음
          </p>
        </div>

        {/* 뒤로가기 */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div>
            <h3 className="text-lg font-bold text-gray-800">툴 선택</h3>
            <p className="text-sm text-gray-400">사용할 내부 툴을 선택하세요</p>
          </div>
        </div>

        {/* 툴 카드 그리드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {FREE_TOOLS.map(tool => (
            <ToolCard
              key={tool.key}
              tool={tool}
              onClick={() => setActiveTool(tool.key)}
            />
          ))}
        </div>

      </div>
    </div>
  );
}
