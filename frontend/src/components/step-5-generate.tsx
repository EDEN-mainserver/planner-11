"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { generateDrafts, getProgress, type GenerateResponse } from "@/lib/api";
import {
  Crop, ArrowLeft, Loader2, Play,
} from "lucide-react";

interface Props {
  sessionId: string;
  selectedIndices: number[];
  mode: "quick" | "detail";
  cropVertical: boolean;
  onCropChange: (v: boolean) => void;
  onGenerated: (result: GenerateResponse) => void;
  onBack: () => void;
}

export function StepGenerate({
  sessionId,
  selectedIndices,
  mode,
  cropVertical,
  onCropChange,
  onGenerated,
  onBack,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setProgressPercent(0);
    setProgressMsg("캡컷 드래프트 생성 시작...");

    pollingRef.current = setInterval(async () => {
      const p = await getProgress(sessionId);
      setProgressPercent(p.percent);
      if (p.message) setProgressMsg(p.message);
      if (p.stage === "done" || p.stage === "error") {
        if (pollingRef.current) clearInterval(pollingRef.current);
      }
    }, 1000);

    try {
      const indices = mode === "quick" ? "all" : selectedIndices.join(",");
      const result = await generateDrafts(
        sessionId,
        indices,
        cropVertical,
      );
      if (pollingRef.current) clearInterval(pollingRef.current);
      setProgressPercent(100);
      onGenerated(result);
    } catch (e) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setError(e instanceof Error ? e.message : "생성 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Crop className="w-5 h-5" />
            캡컷 드래프트 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>세로 모드 (9:16)</Label>
              <p className="text-xs text-muted-foreground">
                숏폼용 세로 비율로 드래프트를 생성합니다
              </p>
            </div>
            <Switch checked={cropVertical} onCheckedChange={onCropChange} />
          </div>
        </CardContent>
      </Card>

      {/* 최종 요약 */}
      <Card>
        <CardHeader>
          <CardTitle>최종 확인</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{selectedIndices.length}</div>
              <div className="text-xs text-muted-foreground">선택된 구간</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{cropVertical ? "9:16" : "16:9"}</div>
              <div className="text-xs text-muted-foreground">영상 비율</div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground text-center">
            각 클립별 캡컷 드래프트가 생성되어 캡컷에 자동 설치됩니다
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm space-y-3">
          <div className="flex items-center gap-2 text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            {progressMsg || "드래프트 생성 중..."}
          </div>
          <div className="w-full bg-blue-500/20 rounded-full h-3 overflow-hidden">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="text-right text-xs text-blue-400/70 font-mono">
            {progressPercent}%
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} disabled={loading} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          이전
        </Button>
        <Button onClick={handleGenerate} disabled={loading} className="flex-1">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              드래프트 생성 중... {progressPercent}%
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              {selectedIndices.length}개 캡컷 드래프트 생성
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
