"use client";

import ProgressBar from "@/components/ui/ProgressBar";
import { usePlanStore } from "@/store/planStore";
import { PLAN_LIMITS } from "@/constants/planLimits";

const ITEMS = [
  { key: "diagnosis" as const,     icon: "📄", label: "보고서확인" },
  { key: "direction" as const,     icon: "⊙", label: "방향성기획" },
  { key: "name" as const,          icon: "AA", label: "이름추천" },
  { key: "profile" as const,       icon: "⚙", label: "프로필세팅" },
  { key: "reelsPlanning" as const, icon: "🎬", label: "릴스기획" },
  { key: "reelsView" as const,     icon: "▶", label: "릴스모음" },
];

export default function PlanCard() {
  const { usage } = usePlanStore();

  return (
    <div className="bg-white rounded-[20px] shadow-card p-5 w-[240px] shrink-0">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[14px] font-semibold text-[#111]">나의 플랜</span>
        <span className="px-2 py-0.5 bg-[#6C63FF] text-white text-xs rounded font-medium">
          FREE
        </span>
      </div>

      {/* 사용량 목록 */}
      <ul className="space-y-3">
        {ITEMS.map(({ key, icon, label }) => {
          const limit = PLAN_LIMITS.FREE[key];
          const used = usage[key];
          const isInfinite = limit === Infinity;

          return (
            <li key={key}>
              <div className="flex items-center justify-between text-[13px] mb-1">
                <span className="flex items-center gap-1.5 text-[#555]">
                  <span className="w-4 text-center text-sm">{icon}</span>
                  <span>{label}</span>
                </span>
                <span className="text-[#999] font-medium">
                  {isInfinite ? "∞" : `${used}/${limit}`}
                </span>
              </div>
              {!isInfinite && <ProgressBar value={used} max={limit as number} />}
            </li>
          );
        })}
      </ul>

      {/* 구독 버튼 */}
      <button className="mt-5 w-full flex items-center justify-center gap-1 px-4 py-2.5 bg-[#111] text-white text-[13px] font-medium rounded-xl hover:bg-[#333] transition-colors">
        구독 및 결제 <span>›</span>
      </button>
    </div>
  );
}
