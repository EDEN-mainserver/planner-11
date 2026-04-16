import Link from "next/link";
import SidebarNav from "./SidebarNav";
import SidebarUserProfile from "./SidebarUserProfile";

export default function Sidebar() {
  return (
    <aside className="w-[260px] shrink-0 h-screen sticky top-0 flex flex-col bg-[#F0F0F6] border-r border-[#E5E5EF]">
      {/* 로고 — "IN" 검정 + "FLOW" 보라→핑크 그라데이션 */}
      <div className="px-5 py-5 shrink-0">
        <Link href="/" className="flex items-center gap-1.5">
          <div className="w-7 h-7 rounded-lg bg-[#6C63FF] flex items-center justify-center shrink-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7L6 11L12 3" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-tight">
            <span className="text-[#111]">IN</span>
            <span
              style={{
                background: "linear-gradient(90deg, #6C63FF, #FF6584)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              FLOW
            </span>
          </span>
        </Link>
      </div>

      {/* 네비게이션 */}
      <SidebarNav />

      {/* 유저 프로필 + 로그아웃 */}
      <SidebarUserProfile />
    </aside>
  );
}
