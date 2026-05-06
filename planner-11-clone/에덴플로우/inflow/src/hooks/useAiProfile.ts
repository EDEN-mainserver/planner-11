"use client";

import { useState } from "react";
import type { ProfileInput, ProfileResult } from "@/types/ai";
import { usePlanStore } from "@/store/planStore";
import { useHistoryStore } from "@/store/historyStore";

export function useAiProfile() {
  const [result, setResult] = useState<ProfileResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { incrementUsage } = usePlanStore();
  const { addItem } = useHistoryStore();

  const generate = async (input: ProfileInput) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("생성에 실패했습니다.");
      const data: ProfileResult = await res.json();
      setResult(data);
      incrementUsage("profile");
      addItem({ type: "profile", title: `${input.nickname} 프로필 소개글`, content: data.bio });
    } catch (e) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return { result, loading, error, generate };
}
