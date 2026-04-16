"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import PlanCard from "@/components/layout/PlanCard";
import { useAiName } from "@/hooks/useAiName";
import { usePlanStore } from "@/store/planStore";

export default function NamePage() {
  const [started, setStarted] = useState(false);
  const [keywords, setKeywords] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const { result, loading, error, generate } = useAiName();
  const { canUse } = usePlanStore();
  const canGenerate = canUse("name");

  if (!started) {
    return (
      <div className="p-8 flex gap-8">
        <div className="flex-1">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F0EEFF] text-[#6C63FF] text-xs rounded-full mb-4">✦ AI 네이밍 솔루션</span>
          <h1 className="text-[32px] font-bold text-[#111] mb-3 leading-tight">
            나에게 딱 맞는 <span className="text-[#6C63FF]">인스타 이름</span>을<br />AI가 추천해 드려요
          </h1>
          <p className="text-[14px] text-[#666] mb-8">키워드나 특성을 입력하면 개성 있는 닉네임 7개를 추천합니다.</p>
          {canGenerate ? (
            <Button onClick={() => setStarted(true)}>시작하기 →</Button>
          ) : (
            <p className="text-sm text-[#FF4444]">사용 횟수를 모두 사용했습니다.</p>
          )}
        </div>
        <PlanCard />
      </div>
    );
  }

  return (
    <div className="p-8 flex gap-8">
      <div className="flex-1 max-w-xl">
        <h2 className="text-[24px] font-bold text-[#111] mb-2">AA 어떤 느낌의 이름을 원하세요?</h2>
        <p className="text-[14px] text-[#999] mb-6">분야, 특성, 느낌을 자유롭게 입력해주세요.</p>
        <textarea
          rows={4}
          className="w-full bg-[#F9F9FF] border border-dashed border-[#E5E5EF] rounded-[12px] px-4 py-3 text-sm outline-none focus:border-[#6C63FF] resize-none"
          placeholder="예: 운동, 활발함, 영어 이름, 짧고 기억하기 쉬운 느낌"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
        />
        {error && <p className="mt-2 text-sm text-[#FF4444]">{error}</p>}
        {loading && <LoadingSpinner />}

        {result && (
          <div className="mt-6 space-y-3">
            {result.names.map((n) => (
              <button key={n.number} onClick={() => setSelected(n.number)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${selected === n.number ? "border-[#6C63FF] border-2 bg-[#F5F4FF]" : "border-[#E5E5EF] bg-white hover:border-[#6C63FF]"}`}>
                <span className="text-[#6C63FF] font-bold mr-2">#{n.number}</span>
                <span className="font-semibold text-[#111] mr-2">{n.name}</span>
                <span className="text-[13px] text-[#999]">{n.description}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6">
          <Button variant="dark" disabled={!keywords || loading} onClick={() => generate({ keywords })}>
            생성하기 →
          </Button>
        </div>
      </div>
      <PlanCard />
    </div>
  );
}
