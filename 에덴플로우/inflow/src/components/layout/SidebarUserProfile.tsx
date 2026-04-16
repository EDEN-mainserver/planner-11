"use client";

export default function SidebarUserProfile() {
  const user = {
    name: "정지한",
    email: "EDEN@teamedenmarketing.com",
    avatarInitial: "정",
  };

  return (
    <div className="border-t border-[#E5E5EF] px-4 py-4 shrink-0">
      {/* 유저 정보 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-[#6C63FF] flex items-center justify-center text-white text-sm font-bold shrink-0">
          {user.avatarInitial}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-medium text-[#111] truncate">
            {user.name} 님
          </p>
          <p className="text-[12px] text-[#999] truncate">{user.email}</p>
        </div>
      </div>

      {/* 로그아웃 */}
      <button
        onClick={() => {}}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-[#E5E5EF] text-[14px] text-[#555] hover:bg-[#EEEEF8] hover:text-[#111] transition-colors"
      >
        <span>→</span>
        <span>로그아웃</span>
      </button>
    </div>
  );
}
