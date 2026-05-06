"use client";

import { useState } from "react";
import type { NameInput, NameResult } from "@/types/ai";
import { usePlanStore } from "@/store/planStore";
import { useHistoryStore } from "@/store/historyStore";

export function useAiName() {
  const [result, setResult] = useState<NameResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { incrementUsage } = usePlanStore();
  const { addItem } = useHistoryStore();

  const generate = async (input: NameInput) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("생성에 실패했습니다.");
      const data: NameResult = await res.json();
      setResult(data);
      incrementUsage("name");
      addItem({ type: "name", title: `닉네임 추천 — ${input.keywords.slice(0, 10)}`, content: JSON.stringify(data.names) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, error, generate };
}
