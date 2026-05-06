"use client";

import { useState } from "react";
import { useHistoryStore } from "@/store/historyStore";
import type { AiType } from "@/types/ai";

export function useHistory() {
  const [search, setSearch] = useState("");
  const [activeType, setActiveType] = useState<AiType | "all">("all");
  const [page, setPage] = useState(1);
  const PER_PAGE = 12;

  const { getFiltered, deleteItem } = useHistoryStore();
  const all = getFiltered(activeType, search);
  const total = all.length;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const items = all.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return {
    items, total, totalPages, page, setPage,
    search, setSearch,
    activeType, setActiveType,
    deleteItem,
  };
}
