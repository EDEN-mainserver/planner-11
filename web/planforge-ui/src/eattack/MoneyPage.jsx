// ── 이걸 돈내고 써? — E-Sign 런치패드 ──
const ESIGN_URL = "https://e-sign-ver2.onrender.com";

const FEATURES = [
  { icon: "📄", title: "문서 업로드", desc: "PDF, HWP, DOCX, XLSX 등 다양한 형식 지원" },
  { icon: "✍️", title: "전자서명 요청", desc: "서명자 지정 후 이메일로 서명 링크 자동 발송" },
  { icon: "🖊️", title: "필드 배치", desc: "서명란·날짜·텍스트 입력란을 드래그로 배치" },
  { icon: "📬", title: "실시간 상태 추적", desc: "서명 완료 여부를 실시간으로 확인" },
  { icon: "📥", title: "서명 PDF 다운로드", desc: "모든 서명 완료 후 서명된 PDF 즉시 다운로드" },
  { icon: "🔒", title: "보안", desc: "토큰 기반 1회용 서명 링크, XSS 차단 헤더 적용" },
];

const VS_TOOLS = [
  { name: "모두싸인", price: "월 19,900원~", color: "text-red-500" },
  { name: "DocuSign", price: "월 $15~",     color: "text-red-500" },
  { name: "Adobe Sign", price: "월 $14.99~", color: "text-red-500" },
  { name: "E-Sign (우리꺼)", price: "무료 🎉",  color: "text-emerald-600", highlight: true },
];

export default function MoneyPage({ onBack }) {
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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md text-lg">
              💸
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">이걸 돈내고 써?</h3>
              <p className="text-sm text-gray-400">전자서명을 무료로 — E-Sign 내부 툴</p>
            </div>
          </div>
        </div>

        {/* 비교 배너 */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 mb-8 text-white">
          <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">비용 비교</p>
          <h2 className="text-xl font-bold mb-4">월 0원으로 전자서명 쓰기</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {VS_TOOLS.map(t => (
              <div
                key={t.name}
                className={`rounded-xl p-3 text-center ${t.highlight ? "bg-emerald-500/20 border border-emerald-400/40" : "bg-white/5"}`}
              >
                <p className={`text-sm font-bold ${t.highlight ? "text-emerald-300" : "text-white"}`}>{t.name}</p>
                <p className={`text-xs mt-0.5 font-semibold ${t.color}`}>{t.price}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 기능 그리드 */}
        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">포함된 기능</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {FEATURES.map(f => (
            <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3">
              <span className="text-xl flex-shrink-0">{f.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800">{f.title}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
          <p className="text-sm text-gray-500 mb-1">에덴 내부 전용 전자서명 툴</p>
          <p className="text-xs text-gray-400 mb-5">새 탭에서 열립니다 · Render.com 호스팅</p>
          <a
            href={ESIGN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-8 py-3 bg-gray-900 hover:bg-gray-700 text-white text-sm font-bold rounded-xl transition-colors shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            </svg>
            E-Sign 열기
          </a>
          <p className="text-xs text-gray-300 mt-3">{ESIGN_URL}</p>
        </div>

      </div>
    </div>
  );
}
