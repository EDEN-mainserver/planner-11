"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import type { Notice } from "@/types/notice";

export default function NoticeDetailPage({ params }: { params: { id: string } }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/notice/${params.id}`).then((r) => r.json()).then(setNotice);
  }, [params.id]);

  if (!notice) return <div className="p-8 text-[#999]">불러오는 중...</div>;

  return (
    <div className="p-8 max-w-3xl">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-[13px] text-[#999] hover:text-[#555] mb-6">
        ← 목록으로
      </button>
      <div className="bg-white rounded-[20px] shadow-card p-8">
        <h1 className="text-xl font-bold text-[#111] mb-2">{notice.title}</h1>
        <p className="text-[12px] text-[#999] mb-6">{formatDate(notice.createdAt)}</p>
        <hr className="border-[#E5E5EF] mb-6" />
        <p className="text-[14px] text-[#555] leading-relaxed whitespace-pre-wrap">{notice.content}</p>
      </div>
    </div>
  );
}
