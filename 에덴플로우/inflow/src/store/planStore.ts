import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PlanUsage } from "@/types/user";
import { PLAN_LIMITS } from "@/constants/planLimits";

interface PlanState {
  usage: PlanUsage;
  incrementUsage: (key: keyof PlanUsage) => void;
  canUse: (key: keyof PlanUsage) => boolean;
  resetUsage: () => void;
}

const INITIAL_USAGE: PlanUsage = {
  diagnosis: 0,
  direction: 0,
  name: 0,
  profile: 0,
  reelsPlanning: 0,
  reelsView: 0,
};

export const usePlanStore = create<PlanState>()(
  persist(
    (set, get) => ({
      usage: INITIAL_USAGE,
      incrementUsage: (key) =>
        set((s) => ({ usage: { ...s.usage, [key]: s.usage[key] + 1 } })),
      canUse: (key) => {
        const limit = PLAN_LIMITS.FREE[key];
        if (limit === Infinity) return true;
        return get().usage[key] < limit;
      },
      resetUsage: () => set({ usage: INITIAL_USAGE }),
    }),
    { name: "inflow-plan" }
  )
);
