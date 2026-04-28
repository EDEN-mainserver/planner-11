"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { analyzeSubtitles, generateFallbackClipsFromDuration, type Clip } from "@/lib/api";
import {
  Brain, Sparkles, ArrowLeft, Loader2,
} from "lucide-react";

interface Props {
  subtitleText: string;
  totalSubtitles: number;
  noSubtitleMode?: boolean;
  onAnalyzed: (clips: Clip[]) => void;
  onBack: () => void;
}

export function StepAnalysis({
  subtitleText,
  totalSubtitles,
  noSubtitleMode = false,
  onAnalyzed,
  onBack,
}: Props) {
  const [numClips, setNumClips] = useState(5);
  const [clipDuration, setClipDuration] = useState(60);
  const [customPrompt, setCustomPrompt] = useState("");
  const [videoDurationMinutes, setVideoDurationMinutes] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (noSubtitleMode) {
      onAnalyzed(
        generateFallbackClipsFromDuration(
          videoDurationMinutes * 60,
          numClips,
          clipDuration,
          customPrompt
        )
      );
      return;
    }

    setLoading(true);
    setError("");
    try {
      const result = await analyzeSubtitles(subtitleText, numClips, customPrompt, clipDuration);
      onAnalyzed(result.clips);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="w-5 h-5" />
            {noSubtitleMode ? "분석 건너뛰기" : "AI 분석 옵션"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            {noSubtitleMode
              ? "자막 없이 진행 중입니다 — 영상 길이를 기준으로 선택 가능한 후보 구간을 자동 생성합니다"
              : `자막 ${totalSubtitles}개 로드됨 — AI가 숏폼 구간을 추천합니다`}
          </div>

          {noSubtitleMode ? (
            <>
              <div className="space-y-2">
                <Label>영상 전체 길이 (분)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={1}
                    max={600}
                    value={videoDurationMinutes}
                    onChange={(e) => setVideoDurationMinutes(Math.max(1, Math.min(600, Number(e.target.value) || 1)))}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">
                    후보 구간을 만들기 위한 전체 러닝타임
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>생성할 후보 구간 수: {numClips}개</Label>
                <Slider
                  value={[numClips]}
                  onValueChange={(v) => setNumClips(Array.isArray(v) ? v[0] : v)}
                  min={1}
                  max={10}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1개</span>
                  <span>10개</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>클립 러닝타임 (초)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={10}
                    max={120}
                    value={clipDuration}
                    onChange={(e) => setClipDuration(Math.max(10, Math.min(120, Number(e.target.value) || 10)))}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">
                    각 후보 구간의 기본 길이
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fallback-prompt">구간 힌트 (선택)</Label>
                <Textarea
                  id="fallback-prompt"
                  placeholder="예: 초반 인트로 제외 / 인터뷰 중심 / 후반 하이라이트 확인용"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>추출할 숏폼 개수: {numClips}개</Label>
                <Slider
                  value={[numClips]}
                  onValueChange={(v) => setNumClips(Array.isArray(v) ? v[0] : v)}
                  min={1}
                  max={15}
                  step={1}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>1개</span>
                  <span>15개</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>클립 러닝타임 (초)</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min={10}
                    max={60}
                    value={clipDuration}
                    onChange={(e) => setClipDuration(Math.max(10, Math.min(60, Number(e.target.value) || 10)))}
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">
                    10초 ~ 60초 (각 클립의 최대 길이)
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">추가 요청사항 (선택)</Label>
                <Textarea
                  id="prompt"
                  placeholder="예: 웃긴 부분 위주로 / 교육적인 내용 위주로 / 논쟁적인 발언 위주로"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  rows={3}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          이전
        </Button>
        <Button
          className="flex-1"
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              AI가 자막을 분석하고 있습니다...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              {noSubtitleMode ? "후보 구간 생성" : "AI 분석 시작"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
