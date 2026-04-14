import { useState } from "react";
import BlogPage from "./BlogPage";
import CrawlingPage from "./crawling/CrawlingPage";
import ImagePage from "./ImagePage";
import VideoPage from "./VideoPage";

// ─── 채널 데이터 정의 ───
const CONTENT_TYPES = [
  {
    key: "text",
    label: "글",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>
      </svg>
    ),
    gradient: "from-blue-500 to-cyan-600",
    description: "블로그, 아이보스 등 텍스트 기반 콘텐츠를 자동으로 생성합니다",
  },
  {
    key: "image",
    label: "이미지",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
      </svg>
    ),
    gradient: "from-pink-500 to-rose-600",
    description: "카드뉴스, 인스타그램 피드 등 이미지 콘텐츠를 제작합니다",
  },
  {
    key: "video",
    label: "영상",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>
      </svg>
    ),
    gradient: "from-purple-500 to-violet-600",
    description: "숏폼, 릴스 등 영상 콘텐츠를 자동으로 만들어냅니다",
  },
  {
    key: "crawling",
    label: "크롤링",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    ),
    gradient: "from-blue-500 to-cyan-600",
    description: "웹사이트를 크롤링하여 콘텐츠 소스를 자동으로 수집합니다",
  },
];

const TEXT_CHANNELS = [
  {
    key: "blog",
    label: "전문 퍼널 블로그 글 셋팅",
    description: "AI가 구매 전환을 유도하는 퍼널 구조의 전문 블로그 글을 세팅해드려요",
    gradient: "from-blue-500 to-cyan-600",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>
      </svg>
    ),
  },
  {
    key: "iboss",
    label: "아이보스 글 작성",
    description: "마케팅 커뮤니티에 최적화된 전문적인 글을 자동 생성합니다",
    gradient: "from-emerald-500 to-teal-600",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    disabled: true,
  },
];

// ─── 채널 카드 컴포넌트 ───
function ChannelCard({ item, onClick }) {
  const isDisabled = item.disabled;

  return (
    <div
      onClick={isDisabled ? undefined : onClick}
      className={`relative group bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 transition-all duration-300
        ${isDisabled
          ? "opacity-50 cursor-not-allowed"
          : "cursor-pointer hover:border-gray-300 hover:shadow-lg hover:-translate-y-1"
        }`}
    >
      {/* 아이콘 */}
      <div className={`rounded-xl flex items-center justify-center bg-gradient-to-br shadow-lg flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 mb-4 transition-all duration-500 ${isDisabled ? "" : "group-hover:scale-110 group-hover:rotate-3"} ${item.gradient}`}>
        <div className="text-white [&>svg]:w-6 [&>svg]:h-6 sm:[&>svg]:w-7 sm:[&>svg]:h-7">
          {item.icon}
        </div>
      </div>

      {/* 텍스트 */}
      <h3 className="font-semibold text-gray-900 text-base sm:text-lg mb-1 sm:mb-2 transition-colors group-hover:text-gray-800">
        {item.label}
      </h3>
      <p className="text-gray-500 text-xs sm:text-sm line-clamp-2">
        {item.description}
      </p>

      {/* 시작하기 화살표 */}
      {!isDisabled && (
        <div className="flex items-center text-gray-400 group-hover:text-gray-600 transition-colors mt-4">
          <span className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 -translate-x-2 group-hover:translate-x-0">
            시작하기
          </span>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 ml-1 transform group-hover:translate-x-1 transition-transform duration-300">
            <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
          </svg>
        </div>
      )}

      {/* 준비중 뱃지 */}
      {isDisabled && (
        <div className="mt-4">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-400">
            준비중
          </span>
        </div>
      )}
    </div>
  );
}

// ─── 메인 E-Attack 페이지 ───
export default function EAttackPage() {
  // depth: 'root' → 글/이미지/영상 | 'text' → 블로그/아이보스 | 'blog' → 블로그 대시보드
  const [depth, setDepth] = useState("root");

  // 콘텐츠 타입 클릭
  const handleTypeClick = (type) => {
    if (type.key === "text") {
      setDepth("text");
    } else if (type.key === "crawling") {
      setDepth("crawling");
    } else if (type.key === "image") {
      setDepth("image");
    } else if (type.key === "video") {
      setDepth("video");
    }
  };

  // 채널 클릭
  const handleChannelClick = (channel) => {
    if (channel.key === "blog") {
      setDepth("blog");
    }
  };

  // 크롤링 대시보드
  if (depth === "crawling") {
    return <CrawlingPage onBack={() => setDepth("root")} />;
  }

  // 블로그 대시보드
  if (depth === "blog") {
    return <BlogPage onBack={() => setDepth("text")} />;
  }

  // 이미지 대시보드
  if (depth === "image") {
    return <ImagePage onBack={() => setDepth("root")} />;
  }

  // 영상 대시보드
  if (depth === "video") {
    return <VideoPage onBack={() => setDepth("root")} />;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8 sm:py-12">

        {/* 헤더 배너 */}
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 sm:p-8 mb-8 sm:mb-10 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300 mb-1 font-medium">E-Attack</p>
              <h2 className="text-xl sm:text-2xl font-bold mb-1">
                내가 올릴 콘텐츠, AI가 미리 다 준비해드립니다.
              </h2>
              <p className="text-sm text-gray-400">
                채널 맞춤 콘텐츠를 AI가 분석 · 기획 · 제작 · 발행하기 마련합니다.
              </p>
            </div>
          </div>
        </div>

        {/* 브레드크럼 */}
        {depth !== "root" && (
          <div className="flex items-center gap-2 mb-6 text-sm">
            <button
              onClick={() => setDepth("root")}
              className="text-gray-400 hover:text-gray-600 transition-colors font-medium"
            >
              E-Attack
            </button>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
              <path d="m9 18 6-6-6-6"/>
            </svg>
            <span className="text-gray-700 font-semibold">글</span>
          </div>
        )}

        {/* ════ 루트: 글 / 이미지 / 영상 ════ */}
        {depth === "root" && (
          <>
            <h3 className="text-lg font-bold text-gray-800 mb-1">콘텐츠 유형 선택</h3>
            <p className="text-sm text-gray-400 mb-6">제작할 콘텐츠 유형을 선택하세요</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
              {CONTENT_TYPES.map((type) => (
                <ChannelCard
                  key={type.key}
                  item={type}
                  onClick={() => handleTypeClick(type)}
                />
              ))}
            </div>
          </>
        )}

        {/* ════ 글 하위: 블로그 / 아이보스 ════ */}
        {depth === "text" && (
          <>
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setDepth("root")}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m15 18-6-6 6-6"/>
                </svg>
              </button>
              <div>
                <h3 className="text-lg font-bold text-gray-800">글 콘텐츠</h3>
                <p className="text-sm text-gray-400">텍스트 기반 콘텐츠를 생성할 채널을 선택하세요</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {TEXT_CHANNELS.map((channel) => (
                <ChannelCard
                  key={channel.key}
                  item={channel}
                  onClick={() => handleChannelClick(channel)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
