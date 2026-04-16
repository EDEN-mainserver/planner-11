"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import PlanCard from "@/components/layout/PlanCard";
import { useAiReels } from "@/hooks/useAiReels";
import { usePlanStore } from "@/store/planStore";

const JOBS = ["N잡러", "의사", "변호사", "유튜버", "인플루언서", "강사", "쇼핑몰 운영", "직장인", "프리랜서", "학생"];
const TARGETS = ["10대 청소년", "20대 대학생", "직장인", "주부", "창업자", "시니어"];
const TONES = ["유익하고 전문적인", "재밌고 가벼운", "감성적인", "도전적이고 에너지 넘치는"];

const TOTAL = 5;

export default function ReelsPlanningPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ job: "", target: "", topic: "", tone: "", request: "" });
  const { result, loading, error, generate, reset } = useAiReels();
  const { canUse } = usePlanStore();
  const canGenerate = canUse("reelsPlanning");
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  if (step === 0) {
    return (
      <div className="p-8 flex gap-8">
        <div className="flex-1">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F0EEFF] text-[#6C63FF] text-xs rounded-full mb-4">✦ AI 릴스 솔루션</span>
          <h1 className="text-[32px] font-bold text-[#111] mb-3 leading-tight">
            바이럴 되는 <span className="text-[#6C63FF]">릴스 스토리보드</span>를<br />AI가 완성해 드려요
          </h1>
          <p className="text-[14px] text-[#666] mb-8">직업, 타겟, 주제, 톤앤매너를 입력하면 후킹 멘트 + 캡션 + 스토리보드를 생성합니다.</p>
          {canGenerate ? (
            <Button onClick={() => setStep(1)}>시작하기 →</Button>
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
      <div className="p-8 max-w-4xl">
        <div className="bg-white rounded-[20px] shadow-card p-8">
          <h2 className="text-xl font-bold text-[#111] mb-6">🎬 릴스 기획 결과</h2>

          <div className="mb-6">
            <h3 className="font-semibold text-[#111] mb-3">✦ 후킹 멘트 5개</h3>
            <ol className="space-y-2">
              {result.hooks.map((h, i) => (
                <li key={i} className="flex gap-2 text-[14px] text-[#555]">
                  <span className="text-[#6C63FF] font-bold">{i + 1}.</span> {h}
                </li>
              ))}
            </ol>
          </div>

          <div className="mb-6">
            <h3 className="font-semibold text-[#111] mb-2">📄 캡션</h3>
            <p className="text-[14px] text-[#555] bg-[#F4F4F8] rounded-xl p-4 whitespace-pre-wrap">{result.caption}</p>
          </div>

          <div>
            <h3 className="font-semibold text-[#111] mb-3">🎬 스토리보드 ({result.storyboard.length}컷)</h3>
            <div className="space-y-4">
              {result.storyboard.map((s, i) => (
                <div key={i} className="border border-[#E5E5EF] rounded-xl p-4">
                  <p className="text-xs font-semibold text-[#6C63FF] mb-2">{s.scene}</p>
                  <p className="text-[14px] text-[#111] font-medium mb-2">{s.script}</p>
                  <div className="grid grid-cols-2 gap-2 text-[12px] text-[#999]">
                    <span>📐 구도: {s.shootingGuide.angle}</span>
                    <span>💡 조명: {s.shootingGuide.lighting}</span>
                    <span>🎭 소품: {s.shootingGuide.props}</span>
                    <span>🎬 행동: {s.shootingGuide.action}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <Button variant="outline" onClick={() => { reset(); setStep(1); }}>대본 다시 만들기</Button>
            <Button variant="outline" onClick={() => { reset(); setStep(0); }}>처음으로</Button>
          </div>
        </div>
      </div>
    );
  }

  const STEPS = [
    { key: "job" as const, label: "현재 직업이 무엇인가요?", icon: "💼", options: JOBS },
    { key: "target" as const, label: "타겟층을 선택해주세요", icon: "🎯", options: TARGETS },
    { key: "topic" as const, label: "릴스 주제는 무엇인가요?", icon: "📌", options: [], free: true },
    { key: "tone" as const, label: "톤앤매너를 선택해주세요", icon: "🎨", options: TONES },
    { key: "request" as const, label: "특별 요청사항이 있나요?", icon: "💬", options: [], free: true, optional: true },
  ];

  const cur = STEPS[step - 1];
  const val = form[cur.key];

  return (
    <div className="p-8 flex gap-8">
      <div className="flex-1 max-w-xl">
        <p className="text-xs text-[#999] tracking-widest mb-6">STEP {step} OF {TOTAL}</p>
        <h2 className="text-[24px] font-bold text-[#111] mb-6">{cur.icon} {cur.label}</h2>

        {cur.options.length > 0 && (
          <div className="grid grid-cols-2 gap-3 mb-4">
            {cur.options.map((o) => (
              <button key={o} onClick={() => set(cur.key, o)}
                className={`p-3 rounded-xl border text-[14px] transition-all ${val === o ? "border-[#6C63FF] border-2 bg-[#F5F4FF]" : "border-[#E5E5EF] bg-white hover:border-[#6C63FF]"}`}>
                {o}
              </button>
            ))}
          </div>
        )}

        <input
          className="w-full bg-[#F9F9FF] border border-dashed border-[#E5E5EF] rounded-[12px] px-4 py-3 text-sm outline-none focus:border-[#6C63FF]"
          placeholder={cur.optional ? "없으면 비워두세요" : "직접 입력해주세요"}
          value={val} onChange={(e) => set(cur.key, e.target.value)}
        />

        {error && <p className="mt-4 text-sm text-[#FF4444]">{error}</p>}
        {loading && <LoadingSpinner />}

        <div className="flex justify-between mt-8">
          <button onClick={() => setStep(Math.max(0, step - 1))} className="text-[14px] text-[#555] hover:text-[#111]">
            &lt; 이전
          </button>
          {step < TOTAL ? (
            <Button variant="dark" disabled={!val && !cur.optional} onClick={() => setStep(step + 1)}>
              다음 단계 →
            </Button>
          ) : (
            <Button variant="dark" disabled={loading} onClick={() => generate(form)}>
              생성하기 →
            </Button>
          )}
        </div>
      </div>
      <PlanCard />
    </div>
  );
}
