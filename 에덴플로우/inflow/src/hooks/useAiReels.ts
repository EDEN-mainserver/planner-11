"use client";

import { useState } from "react";
import type { ReelsPlanInput, ReelsPlanResult } from "@/types/ai";
import { usePlanStore } from "@/store/planStore";
import { useHistoryStore } from "@/store/historyStore";

export function useAiReels() {
  const [result, setResult] = useState<ReelsPlanResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { incrementUsage } = usePlanStore();
  const { addItem } = useHistoryStore();

  const generate = async (input: ReelsPlanInput) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/reels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("생성에 실패했습니다.");
      const data: ReelsPlanResult = await res.json();
      setResult(data);
      incrementUsage("reelsPlanning");
      addItem({ type: "reels", title: `릴스 기획 — ${input.topic.slice(0, 20)}`, content: JSON.stringify(data) });
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => setResult(null);
  return { result, loading, error, generate, reset };
}
