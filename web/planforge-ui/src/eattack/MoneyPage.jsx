export default function MoneyPage({ onBack }) {
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8 sm:py-12">

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
          <div>
            <h3 className="text-lg font-bold text-gray-800">이걸 돈내고 써?</h3>
            <p className="text-sm text-gray-400">유료 툴 대비 AI 자동화 비용 분석</p>
          </div>
        </div>

        {/* 빈 상태 */}
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mb-5 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
              <path d="M12 18V6"/>
            </svg>
          </div>
          <h4 className="text-xl font-bold text-gray-800 mb-2">준비 중입니다</h4>
          <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
            유료 SaaS 툴과 AI 자동화 비용을 비교해드리는 기능을 준비하고 있습니다.
          </p>
        </div>

      </div>
    </div>
  );
}
