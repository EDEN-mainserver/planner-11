import { NextRequest, NextResponse } from "next/server";
import type { Notice } from "@/types/notice";

const NOTICES: Notice[] = [
  {
    id: "1",
    title: "[필독] 인스타그램 성장의 시작, 에덴 플로우에 오신 것을 환영합니다",
    content: "EDEN FLOW 서비스를 이용해 주셔서 감사합니다.\n\nAI 기획 기능을 통해 인스타그램 성장을 도와드리겠습니다.\n\n- 계정 방향성 기획\n- 이름 추천\n- 프로필 세팅\n- 릴스 기획\n\n궁금한 점은 채팅 버튼을 이용해 주세요.",
    isPinned: true,
    createdAt: "2026-02-04T00:00:00.000Z",
  },
  {
    id: "2",
    title: "전기공사로 인한 일시적 사이트 접속 장애 안내",
    content: "2026년 3월 15일 새벽 2시~4시 사이 서버 점검으로 일시적인 접속 장애가 발생할 수 있습니다.\n\n불편을 드려 죄송합니다.",
    isPinned: false,
    createdAt: "2026-02-04T00:00:00.000Z",
  },
];

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const notice = NOTICES.find((n) => n.id === params.id);
  if (!notice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(notice);
}
