"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import PlanCard from "@/components/layout/PlanCard";
import { useAiDirection } from "@/hooks/useAiDirection";
import { usePlanStore } from "@/store/planStore";

const TOPICS = ["뷰티/패션", "음식/맛집", "운동/건강", "여행", "재테크", "직장/커리어"];
const PURPOSES = ["퍼스널 브랜딩", "수익 창출", "브랜드/사업 홍보", "취미 기록"];
const EXPERIENCES = [
  { value: "beginner" as const, label: "인스타 초보예요" },
  { value: "intermediate" as const, label: "경험은 있지만 성장이 느려요" },
  { value: "advanced" as const, label: "운영 중인 크리에이터예요" },
];

export default function DirectionPage() {
  const [step, setStep] = useState(0); // 0=랜딩
  const [nickname, setNickname] = useState("");
  const [topic, setTopic] = useState("");
  const [purpose, setPurpose] = useState("");
  const [experience, setExperience] = useState<"beginner" | "intermediate" | "advanced" | "">("");

  const { result, loading, error, generate } = useAiDirection();
  const { canUse } = usePlanStore();
  const canGenerate = canUse("direction");

  const handleGenerate = () => {
    if (!nickname || !topic || !purpose || !experience) return;
    generate({ nickname, topic, purpose, experience });
  };

  if (step === 0) {
    return (
      <div className="p-8 flex gap-8">
        <div className="flex-1">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F0EEFF] text-[#6C63FF] text-xs rounded-full mb-4">✦ AI 방향성 솔루션</span>
          <h1 className="text-[32px] font-bold text-[#111] mb-3 leading-tight">
            나만의 <span className="text-[#6C63FF]">인스타그램 방향성</span>을<br />AI가 설계해 드려요
          </h1>
          <p className="text-[14px] text-[#666] mb-8">닉네임, 관심사, 목적을 입력하면 맞춤 방향성 리포트를 생성합니다.</p>
          <div className="bg-white rounded-[20px] shadow-card p-6 mb-6 blur-[2px] opacity-60 pointer-events-none">
            <p className="text-[14px] text-[#555]">📄 나의 인스타그램 방향성 리포트가 여기에 표시됩니다...</p>
          </div>
          {canGenerate ? (
            <Button onClick={() => setStep(1)}>기획 시작하기 →</Button>
          ) : (
            <p className="text-sm text-[#FF4444]">사용 횟수를 모두 사용했습니다.</p>
          )}
        </div>
        <PlanCard />
      </div>
    );
  }

  if (result) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="bg-white rounded-[20px] shadow-card p-8">
          <h2 className="text-xl font-bold text-[#111] mb-4">📄 나의 인스타그램 방향성 리포트</h2>
          <pre className="whitespace-pre-wrap text-[14px] text-[#555] leading-relaxed">{result.result}</pre>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" onClick={() => { setStep(0); }}>처음으로</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 flex gap-8">
      <div className="flex-1 max-w-xl">
        <p className="text-xs text-[#999] tracking-widest mb-6">STEP {step} OF 4</p>

        {step === 1 && (
          <>
            <h2 className="text-[24px] font-bold text-[#111] mb-6">📝 닉네임을 입력해주세요</h2>
            <input
              className="w-full bg-[#F9F9FF] border border-dashed border-[#E5E5EF] rounded-[12px] px-4 py-3 text-sm outline-none focus:border-[#6C63FF]"
              placeholder="예: 정지한, eden_official"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-[24px] font-bold text-[#111] mb-6">💡 관심 주제를 선택해주세요</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {TOPICS.map((t) => (
                <button key={t} onClick={() => setTopic(t)}
                  className={`p-3 rounded-xl border text-[14px] transition-all ${topic === t ? "border-[#6C63FF] border-2 bg-[#F5F4FF]" : "border-[#E5E5EF] bg-white hover:border-[#6C63FF]"}`}>
                  {t}
                </button>
              ))}
            </div>
            <input className="w-full bg-[#F9F9FF] border border-dashed border-[#E5E5EF] rounded-[12px] px-4 py-3 text-sm outline-none focus:border-[#6C63FF]"
              placeholder="리스트에 없다면 직접 입력해주세요." value={topic} onChange={(e) => setTopic(e.target.value)} />
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-[24px] font-bold text-[#111] mb-6">🎯 운영 목적을 선택해주세요</h2>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {PURPOSES.map((p) => (
                <button key={p} onClick={() => setPurpose(p)}
                  className={`p-3 rounded-xl border text-[14px] transition-all ${purpose === p ? "border-[#6C63FF] border-2 bg-[#F5F4FF]" : "border-[#E5E5EF] bg-white hover:border-[#6C63FF]"}`}>
                  {p}
                </button>
              ))}
            </div>
            <input className="w-full bg-[#F9F9FF] border border-dashed border-[#E5E5EF] rounded-[12px] px-4 py-3 text-sm outline-none"
              placeholder="리스트에 없다면 직접 입력해주세요." value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="text-[24px] font-bold text-[#111] mb-6">📱 인스타그램 경험은?</h2>
            <div className="space-y-3">
              {EXPERIENCES.map((e) => (
                <button key={e.value} onClick={() => setExperience(e.value)}
                  className={`w-full p-4 rounded-xl border text-[14px] text-left transition-all ${experience === e.value ? "border-[#6C63FF] border-2 bg-[#F5F4FF]" : "border-[#E5E5EF] bg-white hover:border-[#6C63FF]"}`}>
                  {e.label}
                </button>
              ))}
            </div>
          </>
        )}

        {error && <p className="mt-4 text-sm text-[#FF4444]">{error}</p>}
        {loading && <LoadingSpinner />}

        <div className="flex justify-between mt-8">
          <button onClick={() => setStep(Math.max(0, step - 1))} className="text-[14px] text-[#555] hover:text-[#111]">
            &lt; 이전
          </button>
          {step < 4 ? (
            <Button
              variant="dark"
              disabled={step === 1 ? !nickname : step === 2 ? !topic : step === 3 ? !purpose : false}
              onClick={() => setStep(step + 1)}>
              다음 단계 →
            </Button>
          ) : (
            <Button variant="dark" disabled={!experience || loading} onClick={handleGenerate}>
              생성하기 →
            </Button>
          )}
        </div>
      </div>
      <PlanCard />
    </div>
  );
}
