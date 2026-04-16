"use client";

import { useState } from "react";
import type { DirectionInput, DirectionResult } from "@/types/ai";
import { usePlanStore } from "@/store/planStore";
import { useHistoryStore } from "@/store/historyStore";

export function useAiDirection() {
  const [result, setResult] = useState<DirectionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { incrementUsage } = usePlanStore();
  const { addItem } = useHistoryStore();

  const generate = async (input: DirectionInput) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/direction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("생성에 실패했습니다.");
      const data: DirectionResult = await res.json();
      setResult(data);
      incrementUsage("direction");
      addItem({ type: "direction", title: `${input.nickname}의 방향성 기획`, content: data.result });
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, error, generate };
}
