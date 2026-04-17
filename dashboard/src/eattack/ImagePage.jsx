/**
 * 이미지 콘텐츠 페이지
 * - 카드뉴스 만들기 탭
 * - 상세페이지 만들기 탭
 */
import { useState } from "react";
import CardNewsTab from "./CardNewsTab";

// ── 탭 정의 ──
const IMAGE_TABS = [
  {
    key: "cardnews",
    label: "카드뉴스 만들기",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/>
        <rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
      </svg>
    ),
    gradient: "from-pink-500 to-rose-500",
    description: "여러 장의 슬라이드 이미지로 핵심 정보를 시각적으로 전달합니다",
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
];


// ── 상세페이지 탭 ──
function DetailPageTab() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center mb-5 shadow-lg">
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>
        </svg>
      </div>
      <h4 className="text-base font-semibold text-gray-700 mb-2">상세페이지 제작 기능</h4>
      <p className="text-sm text-gray-400 max-w-xs">
        제품·서비스 정보를 입력하면 AI가 구매 전환에 최적화된<br />
        상세페이지 구성을 자동으로 기획합니다.<br />
        <span className="text-orange-500 font-medium">준비 중입니다</span>
      </p>
    </div>
  );
}

// ─────────────────────── 메인 컴포넌트 ───────────────────────
export default function ImagePage({ onBack }) {
  const [activeTab, setActiveTab] = useState("cardnews");

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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
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
              <div className="flex items-start gap-4">
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
          <div className="flex border-b border-gray-100">
            {IMAGE_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                  activeTab === tab.key
                    ? "border-pink-500 text-pink-600"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <span className={`[&>svg]:w-4 [&>svg]:h-4 ${activeTab === tab.key ? "text-pink-500" : "text-gray-400"}`}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* 탭 내용 */}
          {activeTab === "cardnews" && <CardNewsTab />}
          {activeTab === "detail"   && <DetailPageTab />}
        </div>

      </div>
    </div>
  );
}
