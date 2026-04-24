/**
 * 이미지 콘텐츠 페이지
 * - 통합 파이프라인 탭 (리서치 → 기획 → 이미지 → 조립 → 배포)
 * - 상세페이지 만들기 탭
 * - 제안서 자동화 탭
 */
import { useState } from "react";
import UnifiedPipelineTab from "./UnifiedPipelineTab";
import ProposalTab from "./ProposalTab";
import DetailPageTab from "./DetailPageTab";

// ── 탭 정의 ──
const IMAGE_TABS = [
  {
    key: "unified",
    label: "통합 파이프라인",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M4.22 4.22l2.12 2.12m11.32 11.32 2.12 2.12M2 12h3m14 0h3M4.22 19.78l2.12-2.12M18.66 5.34l-2.12 2.12"/>
      </svg>
    ),
    gradient: "from-violet-500 to-pink-500",
    description: "리서치 → 기획 → AI 이미지 → 카드 조립 → 배포 — 하나의 통합 흐름",
    badge: "NEW",
  },
  {
    key: "detail",
    label: "상세페이지 만들기",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
      </svg>
    ),
    gradient: "from-orange-500 to-amber-500",
    description: "제품·서비스를 구매로 이어지는 설득력 있는 상세페이지로 제작합니다",
  },
  {
    key: "proposal",
    label: "제안서 자동화",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
      </svg>
    ),
    gradient: "from-violet-500 to-purple-600",
    description: "클라이언트 맞춤형 제안서를 자동으로 구성하고 완성합니다",
  },
];



// ─────────────────────── 메인 컴포넌트 ───────────────────────
export default function ImagePage({ onBack }) {
  const [activeTab, setActiveTab] = useState("unified");

  const currentTab = IMAGE_TABS.find(t => t.key === activeTab);

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
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">이미지 콘텐츠</h3>
              <p className="text-sm text-gray-400">제작할 이미지 유형을 선택하세요</p>
            </div>
          </div>
        </div>

        {/* 탭 선택 카드 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {IMAGE_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative group text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
                activeTab === tab.key
                  ? "border-pink-400 bg-pink-50 shadow-md"
                  : "border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              {tab.badge && (
                <span className="absolute top-3 right-3 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-500 text-white">
                  {tab.badge}
                </span>
              )}
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tab.gradient} flex items-center justify-center shadow-sm flex-shrink-0 text-white`}>
                  {tab.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-sm font-bold ${activeTab === tab.key ? "text-pink-700" : "text-gray-800"}`}>
                      {tab.label}
                    </p>
                    {activeTab === tab.key && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-pink-500 text-white">
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
            {IMAGE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3.5 text-sm font-medium transition-all border-b-2 -mb-px whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-pink-500 text-pink-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <span className={`[&>svg]:w-4 [&>svg]:h-4 ${activeTab === tab.key ? "text-pink-500" : "text-gray-400"}`}>
                  {tab.icon}
                </span>
                {tab.label}
                {tab.badge && (
                  <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-violet-500 text-white">
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          {activeTab === "unified"   && <UnifiedPipelineTab />}
          {activeTab === "detail"    && <DetailPageTab />}
          {activeTab === "proposal"  && <ProposalTab />}
        </div>

      </div>
    </div>
  );
}
