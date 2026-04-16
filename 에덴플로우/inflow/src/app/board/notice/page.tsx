"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";
import type { Notice } from "@/types/notice";

export default function NoticePage() {
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    fetch("/api/notice").then((r) => r.json()).then(setNotices);
  }, []);

  return (
    <div className="p-8 max-w-3xl">
      {/* 헤더 */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-full bg-[#F0EEFF] flex items-center justify-center text-2xl">📢</div>
        <div>
          <h1 className="text-xl font-bold text-[#111]">공지사항</h1>
          <p className="text-[13px] text-[#999]">인플로우의 새 소식을 확인하세요</p>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-[20px] shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#E5E5EF] text-[12px] text-[#999] font-medium">
          <span>제목</span>
          <span>작성일</span>
        </div>
        {notices.map((n) => (
          <Link key={n.id} href={`/board/notice/${n.id}`}
            className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5EF] last:border-0 hover:bg-[#F9F9FF] transition-colors">
            <div className="flex items-center gap-2">
              {n.isPinned && <Badge type="pinned" />}
              <span className="text-[14px] text-[#111]">{n.title}</span>
            </div>
            <span className="text-[12px] text-[#999] shrink-0 ml-4">{formatDate(n.createdAt)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
