import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AiHistory } from '@/types/ai'
interface HistoryState {
  items: AiHistory[]
  add: (item: AiHistory) => void
  clear: () => void
}
export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => set((s) => ({ items: [item, ...s.items] })),
      clear: () => set({ items: [] }),
    }),
    { name: 'history-storage' }
  )
)
