"use client";

import EmptyState from "@/components/ui/EmptyState";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import Pagination from "@/components/ui/Pagination";
import SearchInput from "@/components/ui/SearchInput";
import Tabs from "@/components/ui/Tabs";
import { REELS_CATEGORIES } from "@/constants/categories";
import { useReels } from "@/hooks/useReels";

export default function FindReelsPage() {
  const { reels, loading, category, setCategory, search, setSearch, page, setPage, totalPages } = useReels();

  return (
    <div className="p-8">
      <h1 className="text-xl font-bold text-[#111] mb-6">릴스 모음</h1>

      <SearchInput value={search} onChange={setSearch}
        placeholder="캡션/해시태그 검색..." className="w-full mb-4" />

      <div className="mb-6 overflow-x-auto">
        <Tabs tabs={REELS_CATEGORIES} active={category} onChange={setCategory} />
      </div>

      {loading ? (
        <LoadingSpinner />
      ) : reels.length === 0 ? (
        <EmptyState message="릴스 데이터가 없습니다." />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            {reels.map((r) => (
              <a key={r.id} href={r.link} target="_blank" rel="noopener noreferrer"
                className="bg-white rounded-[16px] shadow-card overflow-hidden hover:shadow-md transition-shadow">
                <div className="w-full aspect-[9/16] bg-[#F4F4F8] flex items-center justify-center text-4xl">
                  🎬
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-1.5 text-[12px] text-[#999] mb-1">
                    <span>📅</span><span>{r.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-[#6C63FF] flex items-center justify-center text-white text-xs">
                      {r.account.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[13px] text-[#555]">{r.account}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
}
