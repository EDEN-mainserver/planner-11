// 사이드바 네비게이션 메뉴 상수

export type NavItem = {
  label: string;
  href: string;
  icon: string; // emoji or icon key
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "계정진단",
    items: [
      { label: "보고서 확인하기", href: "/diagnosis", icon: "📄" },
    ],
  },
  {
    title: "AI 기획",
    items: [
      { label: "계정 방향성 기획", href: "/ai/direction", icon: "⊙" },
      { label: "이름 추천", href: "/ai/name", icon: "AA" },
      { label: "프로필 세팅", href: "/ai/profile", icon: "👤" },
      { label: "릴스 기획", href: "/ai/reelsPlanning", icon: "🎬" },
      { label: "AI기획 보관함", href: "/ai/history", icon: "🕐" },
    ],
  },
  {
    title: "콘텐츠",
    items: [
      { label: "릴스 모음", href: "/findReels", icon: "▶" },
    ],
  },
  {
    title: "지원",
    items: [
      { label: "공지사항", href: "/board/notice", icon: "🔔" },
      { label: "원격지원", href: "#", icon: "❓" },
    ],
  },
];
