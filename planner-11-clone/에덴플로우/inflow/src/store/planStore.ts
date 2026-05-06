import { create } from 'zustand'
import { persist } from 'zustand/middleware'
interface PlanState {
  used: Record<string,number>
  increment: (key:string) => void
}
export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      used: {},
      increment: (key) => set((s) => ({ used: { ...s.used, [key]: (s.used[key]||0)+1 } })),
    }),
    { name: 'plan-storage' }
  )
)
