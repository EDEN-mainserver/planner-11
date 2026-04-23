"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { generateClips, type GenerateResponse } from "@/lib/api";
import {
  Crop, ArrowLeft, Loader2, Play,
} from "lucide-react";

interface Props {
  sessionId: string;
  selectedIndices: number[];
  mode: "quick" | "detail";
  cropVertical: boolean;
  burnSubtitles: boolean;
  subtitleTemplate: string;
  onCropChange: (v: boolean) => void;
  onGenerated: (result: GenerateResponse) => void;
  onBack: () => void;
}

export function StepVideoSettings({
  sessionId,
  selectedIndices,
  mode,
  cropVertical,
  burnSubtitles,
  subtitleTemplate,
  onCropChange,
  onGenerated,
  onBack,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const indices = mode === "quick" ? "all" : selectedIndices.join(",");
      const result = await generateClips(
        sessionId,
        indices,
        cropVertical,
        burnSubtitles,
        subtitleTemplate
      );
      onGenerated(result);
    } catch (e) {
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
            영상 출력 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>세로 크롭 (9:16)</Label>
              <p className="text-xs text-muted-foreground">
                가로 영상을 세로 숏폼 비율로 자동 크롭합니다
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
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{selectedIndices.length}</div>
              <div className="text-xs text-muted-foreground">선택된 구간</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{cropVertical ? "9:16" : "원본"}</div>
              <div className="text-xs text-muted-foreground">영상 비율</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{burnSubtitles ? "ON" : "OFF"}</div>
              <div className="text-xs text-muted-foreground">자막 삽입</div>
            </div>
          </div>
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
        <Button onClick={handleGenerate} disabled={loading} className="flex-1">
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              영상 생성 중...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              {selectedIndices.length}개 영상 생성
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
