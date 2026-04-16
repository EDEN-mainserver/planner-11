"use client";

import { useState, useEffect } from "react";
import type { Reel, ReelsCategory } from "@/types/reels";

export function useReels() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState<ReelsCategory>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      category,
      search,
      page: String(page),
    });
    fetch(`/api/reels?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setReels(data.reels ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => setReels([]))
      .finally(() => setLoading(false));
  }, [category, search, page]);

  return { reels, loading, category, setCategory, search, setSearch, page, setPage, total };
}
