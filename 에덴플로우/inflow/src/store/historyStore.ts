import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HistoryItem, AiType } from "@/types/ai";
import { generateId } from "@/lib/utils";

interface HistoryState {
  items: HistoryItem[];
  addItem: (item: Omit<HistoryItem, "id" | "createdAt">) => void;
  deleteItem: (id: string) => void;
  getFiltered: (type: AiType | "all", search: string) => HistoryItem[];
}

export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      items: [],
      addItem: (item) =>
        set((s) => ({
          items: [
            { ...item, id: generateId(), createdAt: new Date().toISOString() },
            ...s.items,
          ],
        })),
      deleteItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      getFiltered: (type, search) => {
        let list = get().items;
        if (type !== "all") list = list.filter((i) => i.type === type);
        if (search) list = list.filter((i) => i.title.includes(search));
        return list;
      },
    }),
    { name: "inflow-history" }
  )
);
