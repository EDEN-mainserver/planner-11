import { cn } from "@/lib/utils";
import type { AiType } from "@/types/ai";

const TYPE_STYLES: Record<AiType | "pinned", string> = {
  reels:     "bg-[#FFE5E5] text-[#FF4444]",
  profile:   "bg-[#EEE5FF] text-[#6C63FF]",
  name:      "bg-[#E5F0FF] text-[#3B82F6]",
  direction: "bg-[#E5FFF0] text-[#22C55E]",
  pinned:    "bg-[#FF6584] text-white",
};

const TYPE_LABELS: Record<AiType | "pinned", string> = {
  reels:     "릴스기획",
  profile:   "프로필",
  name:      "네이밍",
  direction: "방향성",
  pinned:    "필독",
};

interface BadgeProps {
  type: AiType | "pinned";
  className?: string;
}

export default function Badge({ type, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-block px-2 py-0.5 rounded-[8px] text-xs font-medium",
        TYPE_STYLES[type],
        className
      )}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}
