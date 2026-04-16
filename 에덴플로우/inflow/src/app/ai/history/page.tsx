"use client";

import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Tabs from "@/components/ui/Tabs";
import { useHistory } from "@/hooks/useHistory";
import { formatDate } from "@/lib/utils";
import type { AiType } from "@/types/ai";

const TABS: { key: AiType | "all"; label: string }[] = [
  { key: "all",       label: "전체" },
  { key: "reels",     label: "릴스 기획" },
  { key: "profile",   label: "프로필" },
  { key: "name",      label: "네이밍" },
  { key: "direction", label: "방향성" },
];

export default function HistoryPage() {
  const { items, totalPages, page, setPage, search, setSearch, activeType, setActiveType, deleteItem } = useHistory();

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#111]">✦ 보관함</h1>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="제목으로 검색..."
          className="w-72"
        />
      </div>

      <div className="mb-4">
        <Tabs tabs={TABS} active={activeType} onChange={setActiveType} />
      </div>

      {items.length === 0 ? (
        <EmptyState message="저장된 기획이 없습니다." />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            {items.map((item) => (
              <div key={item.id} className="bg-white rounded-[16px] shadow-card overflow-hidden group relative cursor-pointer hover:shadow-md transition-shadow">
                {/* 썸네일 */}
                <div className="w-full h-[130px] bg-gradient-to-br from-[#F0EEFF] to-[#E5E5FF] flex items-center justify-center text-3xl">
                  {item.type === "reels" ? "🎬" : item.type === "profile" ? "👤" : item.type === "name" ? "AA" : "⊙"}
                </div>
                {/* 뱃지 오버레이 */}
                <div className="absolute top-2 left-2">
                  <Badge type={item.type} />
                </div>
                {/* 삭제 버튼 */}
                <button
                  onClick={(e) => { e.stopPropagation(); if (confirm("삭제하시겠습니까?")) deleteItem(item.id); }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-7 h-7 bg-white rounded-full flex items-center justify-center text-xs text-[#999] hover:text-[#FF4444] shadow transition-all"
                >
                  🗑
                </button>
                {/* 정보 */}
                <div className="p-3">
                  <p className="text-[13px] font-medium text-[#111] truncate">{item.title}</p>
                  <p className="text-[11px] text-[#999] mt-1">{formatDate(item.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>

          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
