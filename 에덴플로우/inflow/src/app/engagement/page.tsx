'use client'
export default function EngagementPage() {
  const handleConnect = () => {
    alert('인스타그램 OAuth 연동 기능은 실제 API 키가 필요합니다.')
  }
  return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0 px-4 lg:px-8 py-8 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 mb-1">계정진단</h1>
          <p className="text-sm text-slate-400">인스타그램 계정을 연결하고 분석 리포트를 확인하세요</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 lg:p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center text-white text-3xl mx-auto mb-6">
            📷
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-3">인스타그램 계정 연결</h2>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            인스타그램 계정을 연결하면<br />
            팔로워, 도달률, 참여율 등<br />
            상세한 분석 리포트를 받을 수 있어요
          </p>
          <button onClick={handleConnect}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-base hover:opacity-90 transition shadow-lg">
            📷 인스타그램 연결하기
          </button>
          <p className="text-xs text-slate-400 mt-4">계정 연결 시 인스타그램 OAuth 인증이 진행됩니다</p>
        </div>
      </div>
    </div>
  )
}
