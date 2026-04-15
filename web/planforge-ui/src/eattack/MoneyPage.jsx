// ── 이걸 돈내고 써? — 무료 대체 툴 모음 ──
import { useState } from "react";
import EdenCanvas from "./EdenCanvas";

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
    url: "https://mortgage-accepting-chose-only.trycloudflare.com",
    replaces: ["모두싸인 월 19,900원~", "DocuSign 월 $15~"],
    features: ["PDF·HWP·DOCX 업로드", "서명자 이메일 자동 발송", "필드 드래그 배치", "서명 완료 PDF 다운로드"],
  },
  {
    key: "canvas",
    label: "에덴캔버스",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 19l7-7 3 3-7 7-3-3z"/>
        <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
        <path d="M2 2l7.586 7.586"/>
        <circle cx="11" cy="11" r="2"/>
      </svg>
    ),
    gradient: "from-violet-500 to-purple-600",
    description: "Figma·Canva 대신 — 카드뉴스, 배너, 썸네일 디자인을 에덴 내부에서 무료로",
    url: "#",
    replaces: ["Figma 월 $15~", "Canva Pro 월 $13~"],
    features: ["드래그 앤 드롭 편집", "카드뉴스·배너 템플릿", "텍스트·이미지 레이어", "PNG·JPG 다운로드"],
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

// ── 에덴캔버스 상세 페이지 ──
function EdenCanvasDetail({ tool, onBack }) {
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
        <div className="bg-gradient-to-r from-violet-900 to-purple-800 rounded-2xl p-6 mb-6 text-white">
          <p className="text-xs text-violet-300 mb-1 font-medium uppercase tracking-wide">절약 비용</p>
          <h2 className="text-xl font-bold mb-4">월 0원으로 디자인 툴 쓰기</h2>
          <div className="flex flex-wrap gap-2">
            {tool.replaces.map(r => (
              <span key={r} className="px-3 py-1.5 bg-white/10 rounded-lg text-xs text-red-300 line-through font-medium">{r}</span>
            ))}
            <span className="px-3 py-1.5 bg-violet-500/30 border border-violet-400/40 rounded-lg text-xs text-violet-200 font-bold">
              에덴캔버스 무료 🎨
            </span>
          </div>
        </div>

        {/* 기능 목록 */}
        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-3">포함 기능</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {tool.features.map((f, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-violet-100 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5"/>
                </svg>
              </div>
              <p className="text-sm text-gray-700 font-medium">{f}</p>
            </div>
          ))}
        </div>

        {/* 개발 중 안내 */}
        <div className="bg-white border border-violet-200 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19l7-7 3 3-7 7-3-3z"/>
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
              <path d="M2 2l7.586 7.586"/>
              <circle cx="11" cy="11" r="2"/>
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-800 mb-1">개발 진행 중</p>
          <p className="text-xs text-gray-400">에덴캔버스는 현재 개발 중입니다. 오픈 시 여기에서 바로 사용할 수 있습니다.</p>
        </div>

      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──
export default function MoneyPage({ onBack }) {
  const [activeTool, setActiveTool] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);

  // 툴 상세 화면
  if (activeTool) {
    const tool = FREE_TOOLS.find(t => t.key === activeTool);
    if (tool.key === "canvas") return <EdenCanvas onBack={() => setActiveTool(null)} />;
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
          <div className="flex-1">
            <h3 className="text-lg font-bold text-gray-800">툴 선택</h3>
            <p className="text-sm text-gray-400">사용할 내부 툴을 선택하세요</p>
          </div>
          <button
            onClick={() => setGuideOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-600 text-xs font-semibold hover:bg-purple-100 hover:border-purple-300 transition-all whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            </svg>
            확장프로그램 설치 · 가이드
          </button>
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

      {/* 확장프로그램 설치 가이드 모달 */}
      {guideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setGuideOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">EDEN Benchmark Analyzer 설치</h3>
                  <p className="text-[11px] text-gray-400">Chrome 전용 · 웹사이트 나노 분석 → 기능명세서 + 유저플로우 자동 생성</p>
                </div>
              </div>
              <button onClick={() => setGuideOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {[
                { num: 1, title: "GitHub에서 파일 다운로드", desc: (<>아래 링크를 클릭해서 GitHub 페이지로 이동하세요.<a href="https://github.com/EDEN-mainserver/copycopy-program" target="_blank" rel="noopener noreferrer" className="block mt-1.5 px-3 py-1.5 bg-gray-900 text-green-400 rounded-lg text-xs font-mono hover:bg-gray-800 transition-all truncate">github.com/EDEN-mainserver/copycopy-program</a><span className="block mt-1.5">페이지에서 초록색 <strong>{"<>"} Code</strong> 버튼 → <strong>Download ZIP</strong> 클릭</span></>) },
                { num: 2, title: "ZIP 압축 해제", desc: (<>다운로드된 ZIP 파일을 압축 해제하세요.<br />압축을 풀면 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-purple-700">copycopy-program-main</code> 폴더가 생깁니다. 이 폴더 안에 확장 프로그램 파일들이 있습니다.</>) },
                { num: 3, title: "Chrome 확장 프로그램 페이지 열기", desc: (<>Chrome 주소창에 아래를 그대로 붙여넣고 엔터를 누르세요.<code className="block mt-1.5 px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-mono text-blue-700">chrome://extensions</code></>) },
                { num: 4, title: "개발자 모드 켜기", desc: (<>페이지 <strong>우측 상단</strong>에 있는 <strong>개발자 모드</strong> 토글을 클릭해서 <strong>파란색(ON)</strong>으로 켜주세요.</>) },
                { num: 5, title: "'압축 해제된 확장 프로그램을 로드합니다' 클릭", desc: (<>개발자 모드를 켜면 <strong>좌측 상단</strong>에 버튼이 생깁니다.<br />클릭 후 2단계에서 압축 해제한 <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-mono text-purple-700">copycopy-program-main</code> 폴더를 선택하세요.</>) },
                { num: 6, title: "Claude / Gemini API Key 입력 후 분석 시작", desc: (<>확장 프로그램 아이콘 클릭 → <strong>⚙️ 설정</strong>에서 API Key를 입력하세요.<div className="mt-1.5 space-y-0.5"><div className="flex items-center gap-1.5"><span className="text-purple-500 font-bold">🔵</span><span>Claude: <code className="bg-gray-100 px-1 rounded font-mono">sk-ant-</code> 로 시작하는 키</span></div><div className="flex items-center gap-1.5"><span className="text-green-500 font-bold">🟢</span><span>Gemini: <code className="bg-gray-100 px-1 rounded font-mono">AIza</code> 로 시작하는 키</span></div></div><span className="block mt-1.5">분석할 사이트에서 <strong>🚀 전체 분석 시작</strong>을 누르면 기능명세서 + 유저플로우 MD가 자동 생성됩니다.</span></>) },
              ].map(step => (
                <div key={step.num} className="flex gap-3">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">{step.num}</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-0.5">{step.title}</p>
                    <div className="text-xs text-gray-500 leading-relaxed">{step.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 사용 방법 */}
            <div className="px-5 pb-5">
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5">
                  <span className="text-base">🚀</span> 사용 방법
                </p>
                <div className="space-y-3">
                  {[
                    { icon: "🌐", title: "분석할 사이트 접속", desc: "벤치마킹하고 싶은 웹사이트를 Chrome에서 열어두세요." },
                    { icon: "🔍", title: "확장 프로그램 아이콘 클릭", desc: <>주소창 오른쪽 퍼즐 조각(🧩) 아이콘 → <strong>EDEN Benchmark Analyzer</strong> 선택</> },
                    { icon: "⚙️", title: "API Key 설정 (최초 1회)", desc: <>팝업 우측 상단 <strong>⚙️</strong> 클릭 → Claude(<code className="bg-gray-100 px-1 rounded font-mono text-purple-700">sk-ant-</code>) 또는 Gemini(<code className="bg-gray-100 px-1 rounded font-mono text-purple-700">AIza</code>) 키 입력 → 저장</> },
                    { icon: "🚀", title: "전체 분석 시작", desc: <>팝업에서 <strong>🚀 전체 분석 시작</strong> 클릭. 모든 서브 페이지를 자동 수집합니다.<br /><span className="text-amber-500">페이지 수에 따라 1~5분 소요됩니다.</span></> },
                    { icon: "📋", title: "결과 확인 및 다운로드", desc: <>분석 완료 후 두 탭에서 결과 확인:<div className="mt-1.5 space-y-0.5"><div><strong>📋 기능명세서</strong> 탭 — UI 요소·기능 명세 MD</div><div><strong>🔀 유저플로우</strong> 탭 — Mermaid 다이어그램 MD</div></div><span className="block mt-1.5">각 탭 하단 <strong>⬇️ MD 다운로드</strong> 또는 <strong>🖼️ 이미지 저장</strong> 클릭</span></> },
                  ].map((item, i) => (
                    <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                      <span className="text-base flex-shrink-0 mt-0.5">{item.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-gray-800 mb-0.5">{item.title}</p>
                        <div className="text-xs text-gray-500 leading-relaxed">{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
