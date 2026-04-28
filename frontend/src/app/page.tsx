"use client";

import { useState } from "react";
import { StepVideoInput } from "@/components/step-1-video-input";
import { StepSubtitle } from "@/components/step-2-subtitle";
import { StepAnalysis } from "@/components/step-3-analysis";
import { StepClipSelect } from "@/components/step-4-clip-select";
import { StepGenerate } from "@/components/step-5-generate";
import { StepResult } from "@/components/step-6-result";
import type { Clip, SubtitleEntry } from "@/lib/api";
import {
  Scissors, Upload, FileText, Brain, ListChecks, Settings, Download,
} from "lucide-react";

const STEPS = [
  { label: "영상 입력", icon: Upload },
  { label: "자막 준비", icon: FileText },
  { label: "AI 분석", icon: Brain },
  { label: "구간 선택", icon: ListChecks },
  { label: "드래프트 생성", icon: Settings },
  { label: "완료", icon: Download },
];

export default function Home() {
  const [step, setStep] = useState(0);

  // Step 1
  const [videoInput, setVideoInput] = useState("");
  const [inputType, setInputType] = useState<"local" | "youtube">("local");

  // Step 2
  const [subtitles, setSubtitles] = useState<SubtitleEntry[]>([]);
  const [subtitleText, setSubtitleText] = useState("");
  const [noSubtitleMode, setNoSubtitleMode] = useState(false);

  // Step 3
  const [clips, setClips] = useState<Clip[]>([]);

  // Step 4
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [mode, setMode] = useState<"quick" | "detail">("detail");

  // Step 5
  const [cropVertical, setCropVertical] = useState(false);
  const [generatedDrafts, setGeneratedDrafts] = useState<{ name: string; content: object }[]>([]);

  const handleReset = () => {
    setStep(0);
    setVideoInput("");
    setSubtitles([]);
    setSubtitleText("");
    setNoSubtitleMode(false);
    setClips([]);
    setSelectedIndices([]);
    setGeneratedDrafts([]);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-3">
          <Scissors className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold tracking-tight">롱숏</h1>
          <span className="text-sm text-muted-foreground ml-1">
            긴 영상 &rarr; 캡컷 숏폼 자동 생성
          </span>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 pt-6 pb-2">
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.label} className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => i < step && setStep(i)}
                  disabled={i > step}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                        ? "bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {s.label}
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`w-4 h-0.5 ${isDone ? "bg-primary/40" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          Step {step + 1} / {STEPS.length}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 pb-12">
        {step === 0 && (
          <StepVideoInput
            videoInput={videoInput}
            inputType={inputType}
            onVideoInputChange={setVideoInput}
            onInputTypeChange={setInputType}
            onNext={() => setStep(1)}
          />
        )}

        {step === 1 && (
          <StepSubtitle
            videoInput={videoInput}
            inputType={inputType}
            onSubtitleReady={(subs, text) => {
              setNoSubtitleMode(false);
              setSubtitles(subs);
              setSubtitleText(text);
              setStep(2);
            }}
            onNoSubtitle={() => {
              setNoSubtitleMode(true);
              setSubtitles([]);
              setSubtitleText("");
              setClips([]);
              setSelectedIndices([]);
              setStep(2);
            }}
            onBack={() => setStep(0)}
          />
        )}

        {step === 2 && (
          <StepAnalysis
            subtitleText={subtitleText}
            totalSubtitles={subtitles.length}
            noSubtitleMode={noSubtitleMode}
            onAnalyzed={(result) => {
              setClips(result);
              setSelectedIndices(result.map((_: Clip, i: number) => i));
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <StepClipSelect
            result={{ clips, total_subtitles: subtitles.length }}
            selectedIndices={selectedIndices}
            onSelectedChange={setSelectedIndices}
            mode={mode}
            onModeChange={setMode}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}

        {step === 4 && (
          <StepGenerate
            videoInput={videoInput}
            clips={clips}
            selectedIndices={selectedIndices}
            mode={mode}
            cropVertical={cropVertical}
            onCropChange={setCropVertical}
            onGenerated={(drafts) => {
              setGeneratedDrafts(drafts);
              setStep(5);
            }}
            onBack={() => setStep(3)}
          />
        )}

        {step === 5 && (
          <StepResult
            drafts={generatedDrafts}
            onReset={handleReset}
          />
        )}
      </main>
    </div>
  );
}
