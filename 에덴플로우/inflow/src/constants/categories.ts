// 릴스 카테고리 상수
import type { ReelsCategory } from "@/types/reels";

export const REELS_CATEGORIES: { key: ReelsCategory; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "marketing", label: "마케팅/정보전달" },
  { key: "ai", label: "AI/IT" },
  { key: "beauty", label: "뷰티/미용" },
  { key: "health", label: "헬스/스포츠" },
  { key: "daily", label: "일상/생활/리빙" },
  { key: "food", label: "음식/요리" },
];
