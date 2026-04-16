"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import PlanCard from "@/components/layout/PlanCard";
import { useAiProfile } from "@/hooks/useAiProfile";
import { usePlanStore } from "@/store/planStore";

export default function ProfilePage() {
  const [started, setStarted] = useState(false);
  const [form, setForm] = useState({ nickname: "", field: "", purpose: "", target: "" });
  const { result, loading, error, generate } = useAiProfile();
  const { canUse } = usePlanStore();
  const canGenerate = canUse("profile");
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  if (!started) {
    return (
      <div className="p-8 flex gap-8">
        <div className="flex-1">
          <span className="inline-flex items-center gap-1 px-3 py-1 bg-[#F0EEFF] text-[#6C63FF] text-xs rounded-full mb-4">✦ AI 프로필 솔루션</span>
          <h1 className="text-[32px] font-bold text-[#111] mb-3 leading-tight">
            눈에 띄는 <span className="text-[#6C63FF]">프로필 소개글</span>을<br />AI가 만들어 드려요
          </h1>
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
        <h2 className="text-[24px] font-bold text-[#111] mb-6">👤 프로필 정보를 입력해주세요</h2>
        <div className="space-y-4">
          {(["nickname","field","purpose","target"] as const).map((k) => (
            <div key={k}>
              <label className="block text-[13px] font-medium text-[#555] mb-1">
                {{ nickname:"닉네임", field:"분야", purpose:"운영 목적", target:"타겟층" }[k]}
              </label>
              <input className="w-full bg-[#F4F4F8] rounded-[12px] px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#6C63FF]"
                placeholder={{ nickname:"예: 정지한", field:"예: 마케팅", purpose:"예: 퍼스널 브랜딩", target:"예: 20~30대 직장인" }[k]}
                value={form[k]} onChange={set(k)} />
            </div>
          ))}
        </div>

        {error && <p className="mt-2 text-sm text-[#FF4444]">{error}</p>}
        {loading && <LoadingSpinner />}

        {result && (
          <div className="mt-6 bg-white rounded-[20px] shadow-card p-6">
            <h3 className="text-[15px] font-bold text-[#111] mb-3">📱 인스타그램 프로필 미리보기</h3>
            <div className="bg-white border border-[#E5E5EF] rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-[#6C63FF] flex items-center justify-center text-white font-bold">
                  {form.nickname.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-[#111]">{form.nickname}</p>
                  <p className="text-xs text-[#999]">{result.keywords.join(" · ")}</p>
                </div>
              </div>
              <p className="text-[13px] text-[#555] whitespace-pre-wrap">{result.bio}</p>
            </div>
          </div>
        )}

        <div className="mt-6">
          <Button variant="dark" disabled={!form.nickname || !form.field || loading} onClick={() => generate(form)}>
            {result ? "다시 생성하기 →" : "생성하기 →"}
          </Button>
        </div>
      </div>
      <PlanCard />
    </div>
  );
}
