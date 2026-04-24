"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { generateCapcutDraftJson, type Clip } from "@/lib/api";
import { Crop, ArrowLeft, Play } from "lucide-react";

interface Props {
  videoInput: string;
  clips: Clip[];
  selectedIndices: number[];
  mode: "quick" | "detail";
  cropVertical: boolean;
  onCropChange: (v: boolean) => void;
  onGenerated: (drafts: { name: string; content: object }[]) => void;
  onBack: () => void;
}

export function StepGenerate({
  videoInput,
  clips,
  selectedIndices,
  mode,
  cropVertical,
  onCropChange,
  onGenerated,
  onBack,
}: Props) {
  const handleGenerate = () => {
    const selected = mode === "quick"
      ? clips
      : selectedIndices.map((i) => clips[i]);

    const drafts = generateCapcutDraftJson(videoInput, selected, cropVertical);
    onGenerated(drafts);
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
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          이전
        </Button>
        <Button onClick={handleGenerate} className="flex-1">
          <Play className="w-4 h-4 mr-2" />
          {selectedIndices.length}개 캡컷 드래프트 생성
        </Button>
      </div>
    </div>
  );
}
