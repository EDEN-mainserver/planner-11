/**
 * 영상 콘텐츠 페이지
 * - NAS 연동 설정 탭
 * - 영상편집 자동화 탭
 * - 풀그래픽영상 탭
 * - 커뮤니티 영상 탭
 * - 롱폼을 숏폼으로 탭
 */
import { useState } from "react";

// ── 탭 정의 ──
const VIDEO_TABS = [
  {
    key: "nas",
    label: "NAS 연동 설정",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/>
        <line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>
      </svg>
    ),
    gradient: "from-slate-500 to-gray-600",
    description: "NAS 서버와 연동하여 영상 파일을 자동으로 저장·관리합니다",
  },
  {
    key: "autoedit",
    label: "영상편집 자동화",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
      </svg>
    ),
    gradient: "from-purple-500 to-violet-600",
    description: "원본 영상을 입력하면 AI가 자동으로 편집·자막·컷 편집을 처리합니다",
  },
  {
    key: "fullgraphic",
    label: "풀그래픽영상",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/>
        <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/>
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
      </svg>
    ),
    gradient: "from-fuchsia-500 to-pink-600",
    description: "텍스트·이미지만으로 모션그래픽 기반 풀그래픽 영상을 자동 생성합니다",
  },
  {
    key: "community",
    label: "커뮤니티 영상",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    gradient: "from-indigo-500 to-blue-600",
    description: "커뮤니티 반응형 숏폼·릴스 영상을 주제에 맞게 자동으로 기획·제작합니다",
  },
  {
    key: "longshort",
    label: "롱폼을 숏폼으로",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>
      </svg>
    ),
    gradient: "from-orange-500 to-rose-500",
    description: "긴 영상을 업로드하면 AI가 핵심 장면을 추출해 숏폼·릴스로 자동 변환합니다",
  },
];

// ── NAS 연동 설정 탭 ──
function NasTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-500 to-gray-600 flex items-center justify-center mb-5 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/>
          <line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>
        </svg>
      </div>
      <h4 className="text-base font-semibold text-gray-700 mb-2">NAS 연동 설정</h4>
      <p className="text-sm text-gray-400 max-w-xs">
        NAS 서버 주소·계정 정보를 설정하면<br />
        영상 파일을 자동으로 저장·동기화합니다.<br />
        <span className="text-slate-500 font-medium">준비 중입니다</span>
      </p>
    </div>
  );
}

// ── 영상편집 자동화 탭 ──
function AutoEditTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center mb-5 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
        </svg>
      </div>
      <h4 className="text-base font-semibold text-gray-700 mb-2">영상편집 자동화</h4>
      <p className="text-sm text-gray-400 max-w-xs">
        원본 영상을 업로드하면 AI가<br />
        자동 컷편집·자막·BGM 삽입을 처리합니다.<br />
        <span className="text-purple-500 font-medium">준비 중입니다</span>
      </p>
    </div>
  );
}

// ── 풀그래픽영상 탭 ──
function FullGraphicTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center mb-5 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="13.5" cy="6.5" r=".5" fill="white"/><circle cx="17.5" cy="10.5" r=".5" fill="white"/>
          <circle cx="8.5" cy="7.5" r=".5" fill="white"/><circle cx="6.5" cy="12.5" r=".5" fill="white"/>
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
        </svg>
      </div>
      <h4 className="text-base font-semibold text-gray-700 mb-2">풀그래픽영상</h4>
      <p className="text-sm text-gray-400 max-w-xs">
        텍스트와 이미지만 입력하면 AI가<br />
        모션그래픽 기반 풀그래픽 영상을 자동 생성합니다.<br />
        <span className="text-fuchsia-500 font-medium">준비 중입니다</span>
      </p>
    </div>
  );
}

// ── 커뮤니티 영상 탭 ──
function CommunityTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center mb-5 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
      </div>
      <h4 className="text-base font-semibold text-gray-700 mb-2">커뮤니티 영상</h4>
      <p className="text-sm text-gray-400 max-w-xs">
        주제를 입력하면 AI가 커뮤니티 반응형<br />
        숏폼·릴스 영상을 기획·제작합니다.<br />
        <span className="text-indigo-500 font-medium">준비 중입니다</span>
      </p>
    </div>
  );
}

// ── 롱폼을 숏폼으로 탭 ──
function LongToShortTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center mb-5 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/>
        </svg>
      </div>
      <h4 className="text-base font-semibold text-gray-700 mb-2">롱폼을 숏폼으로</h4>
      <p className="text-sm text-gray-400 max-w-xs">
        긴 영상을 업로드하면 AI가<br />
        핵심 장면을 자동 추출·편집해<br />
        숏폼·릴스로 변환합니다.<br />
        <span className="text-orange-500 font-medium">준비 중입니다</span>
      </p>
    </div>
  );
}

// ─────────────────────── 메인 컴포넌트 ───────────────────────
export default function VideoPage({ onBack }) {
  const [activeTab, setActiveTab] = useState("nas");

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
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">영상 콘텐츠</h3>
              <p className="text-sm text-gray-400">제작할 영상 유형을 선택하세요</p>
            </div>
          </div>
        </div>

        {/* 탭 선택 카드 (2×2 그리드) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {VIDEO_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative group text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
                activeTab === tab.key
                  ? "border-purple-400 bg-purple-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tab.gradient} flex items-center justify-center shadow-sm flex-shrink-0 text-white`}>
                  {tab.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-sm font-bold ${activeTab === tab.key ? "text-purple-700" : "text-gray-800"}`}>
                      {tab.label}
                    </p>
                    {activeTab === tab.key && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500 text-white">
                        선택됨
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{tab.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 탭 컨텐츠 */}
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {/* 탭 바 */}
          <div className="flex border-b border-gray-100 overflow-x-auto">
            {VIDEO_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-purple-500 text-purple-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <span className={`[&>svg]:w-4 [&>svg]:h-4 ${activeTab === tab.key ? "text-purple-500" : "text-gray-400"}`}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          {activeTab === "nas"          && <NasTab />}
          {activeTab === "autoedit"     && <AutoEditTab />}
          {activeTab === "fullgraphic"  && <FullGraphicTab />}
          {activeTab === "community"    && <CommunityTab />}
          {activeTab === "longshort"    && <LongToShortTab />}
        </div>

      </div>
    </div>
  );
}
