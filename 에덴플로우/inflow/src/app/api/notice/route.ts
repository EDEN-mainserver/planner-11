import { NextResponse } from "next/server";
import type { Notice } from "@/types/notice";

// 임시 하드코딩 공지사항 데이터
const NOTICES: Notice[] = [
  {
    id: "1",
    title: "[필독] 인스타그램 성장의 시작, 인플로우에 오신 것을 환영합니다",
    content: "INFLOW 서비스를 이용해 주셔서 감사합니다. AI 기획 기능을 통해 인스타그램 성장을 도와드리겠습니다.",
    isPinned: true,
    createdAt: "2026-02-04T00:00:00.000Z",
  },
  {
    id: "2",
    title: "전기공사로 인한 일시적 사이트 접속 장애 안내",
    content: "2026년 3월 15일 새벽 2시~4시 사이 서버 점검으로 일시적인 접속 장애가 발생할 수 있습니다.",
    isPinned: false,
    createdAt: "2026-02-04T00:00:00.000Z",
  },
];

export async function GET() {
  const sorted = [...NOTICES].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  return NextResponse.json(sorted);
}
