"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { Clip } from "@/lib/api";
import { Zap, ListChecks, ArrowRight, ArrowLeft, Clock, Star } from "lucide-react";

interface Props {
  result: { clips: Clip[]; total_subtitles: number };
  selectedIndices: number[];
  onSelectedChange: (indices: number[]) => void;
  mode: "quick" | "detail";
  onModeChange: (mode: "quick" | "detail") => void;
  onNext: () => void;
  onBack: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  funny: "웃김",
  insight: "인사이트",
  emotional: "감동",
  controversial: "논쟁",
  informative: "정보",
};

const CATEGORY_COLORS: Record<string, string> = {
  funny: "bg-yellow-500/20 text-yellow-400",
  insight: "bg-blue-500/20 text-blue-400",
  emotional: "bg-pink-500/20 text-pink-400",
  controversial: "bg-red-500/20 text-red-400",
  informative: "bg-green-500/20 text-green-400",
};

export function StepClipSelect({
  result,
  selectedIndices,
  onSelectedChange,
  mode,
  onModeChange,
  onNext,
  onBack,
}: Props) {
  const toggleIndex = (index: number) => {
    if (selectedIndices.includes(index)) {
      onSelectedChange(selectedIndices.filter((i) => i !== index));
    } else {
      onSelectedChange([...selectedIndices, index]);
    }
  };

  const selectAll = () => onSelectedChange(result.clips.map((_, i) => i));
  const deselectAll = () => onSelectedChange([]);

  return (
    <div className="space-y-6 mt-4">
      <div className="flex gap-3">
        <Button
          variant={mode === "quick" ? "default" : "outline"}
          onClick={() => {
            onModeChange("quick");
            selectAll();
          }}
          className="flex-1"
        >
          <Zap className="w-4 h-4 mr-2" />
          빠른 편집
          <span className="ml-2 text-xs opacity-70">전체 자동 생성</span>
        </Button>
        <Button
          variant={mode === "detail" ? "default" : "outline"}
          onClick={() => onModeChange("detail")}
          className="flex-1"
        >
          <ListChecks className="w-4 h-4 mr-2" />
          구간 편집
          <span className="ml-2 text-xs opacity-70">선택해서 생성</span>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>AI 추천 구간 ({result.clips.length}개)</CardTitle>
            {mode === "detail" && (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  전체 선택
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll}>
                  전체 해제
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {result.clips.map((clip, i) => (
            <div
              key={i}
              className={`p-4 rounded-lg border transition-all ${
                selectedIndices.includes(i)
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/50 bg-muted/30 opacity-60"
              }`}
            >
              <div className="flex items-start gap-3">
                {mode === "detail" && (
                  <Checkbox
                    checked={selectedIndices.includes(i)}
                    onCheckedChange={() => toggleIndex(i)}
                    className="mt-1"
                  />
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium">{clip.title}</h3>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={CATEGORY_COLORS[clip.category] || ""}
                      >
                        {CATEGORY_LABELS[clip.category] || clip.category}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        {clip.virality_score}/10
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="w-3.5 h-3.5" />
                    {clip.start_time} ~ {clip.end_time}
                  </div>
                  <p className="text-sm text-muted-foreground">{clip.reason}</p>
                  <div className="text-xs bg-muted/50 rounded px-3 py-2 italic">
                    &ldquo;{clip.hook}&rdquo;
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="text-center text-sm text-muted-foreground">
        {selectedIndices.length}개 구간 선택됨
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          이전
        </Button>
        <Button
          onClick={onNext}
          disabled={selectedIndices.length === 0}
          className="flex-1"
        >
          다음: 드래프트 생성
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
