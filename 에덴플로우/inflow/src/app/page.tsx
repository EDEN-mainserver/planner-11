import Link from "next/link";
import ChatButton from "@/components/ui/ChatButton";

const QUICK_LINKS = [
  { href: "/diagnosis",        icon: "📊", label: "계정진단",  desc: "나의 계정을 분석해 보세요",        color: "bg-[#6C63FF]" },
  { href: "/ai/reelsPlanning", icon: "🎬", label: "릴스기획",  desc: "AI로 릴스 스토리보드를 만들어요",  color: "bg-[#111]" },
  { href: "/findReels",        icon: "▶", label: "릴스모음",  desc: "벤치마킹 릴스를 찾아보세요",       color: "bg-[#FF6584]" },
  { href: "#",                 icon: "❓", label: "사용방법",  desc: "서비스 이용 가이드",               color: "bg-[#FFA500]" },
];

export default function DashboardPage() {
  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-[#111] mb-6">대시보드</h1>

      {/* 상단 2열 카드 */}
      <div className="grid grid-cols-[1fr_auto] gap-5 mb-5">
        {/* 최근 AI기획 */}
        <div className="bg-white rounded-[20px] shadow-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">★</span>
              <span className="text-[15px] font-semibold text-[#111]">최근 AI기획 사용내역</span>
            </div>
            <Link href="/ai/history" className="text-[13px] text-[#6C63FF] hover:underline">
              전체 기획내역 확인 &gt;
            </Link>
          </div>
          <p className="text-[13px] text-[#999]">데이터가 없습니다.</p>
        </div>

        {/* 계정진단 */}
        <div className="bg-white rounded-[20px] shadow-card p-6 w-[260px]">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📊</span>
            <span className="text-[15px] font-semibold text-[#111]">최근 계정진단 결과</span>
          </div>
          <p className="text-[13px] text-[#999]">데이터가 없습니다.</p>
        </div>
      </div>

      {/* 공지사항 */}
      <div className="bg-white rounded-[20px] shadow-card p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">🔔</span>
            <span className="text-[15px] font-semibold text-[#111]">공지사항</span>
          </div>
          <Link href="/board/notice" className="text-[13px] text-[#6C63FF] hover:underline">
            전체 공지사항 확인 &gt;
          </Link>
        </div>
        <div className="space-y-2">
          <Link href="/board/notice/1" className="block text-[14px] text-[#555] hover:text-[#111] truncate">
            [필독] 인스타그램 성장의 시작, 인플로우에 오신 것을 환영합니다
          </Link>
          <Link href="/board/notice/2" className="block text-[14px] text-[#555] hover:text-[#111] truncate">
            전기공사로 인한 일시적 사이트 접속 장애 안내
          </Link>
        </div>
      </div>

      {/* 하단 바로가기 카드 4개 */}
      <div className="grid grid-cols-4 gap-4">
        {QUICK_LINKS.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="bg-white rounded-[20px] shadow-card p-5 hover:shadow-md transition-shadow flex flex-col items-center text-center gap-3"
          >
            <div className={`w-14 h-14 rounded-full ${q.color} flex items-center justify-center text-white text-2xl`}>
              {q.icon}
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#111]">{q.label}</p>
              <p className="text-[12px] text-[#999] mt-0.5">{q.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <ChatButton />
    </div>
  );
}
