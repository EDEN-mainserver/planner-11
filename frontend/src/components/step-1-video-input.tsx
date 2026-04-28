"use client";

import { type ChangeEvent, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Film, Video, FolderOpen, ArrowRight } from "lucide-react";

interface Props {
  videoInput: string;
  inputType: "local" | "youtube";
  onVideoInputChange: (v: string) => void;
  onInputTypeChange: (t: "local" | "youtube") => void;
  onNext: () => void;
}

export function StepVideoInput({
  videoInput,
  inputType,
  onVideoInputChange,
  onInputTypeChange,
  onNext,
}: Props) {
  const localFileRef = useRef<HTMLInputElement | null>(null);
  const [localFileName, setLocalFileName] = useState("");

  const handleLocalFilePick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLocalFileName(file.name);
    onVideoInputChange(file.name);
  };

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            영상 소스 선택
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 소스 타입 선택 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => onInputTypeChange("local")}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                inputType === "local"
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <FolderOpen className="w-8 h-8 mx-auto mb-2 text-primary" />
              <div className="font-medium">로컬 파일</div>
              <div className="text-xs text-muted-foreground mt-1">
                컴퓨터에 저장된 영상
              </div>
            </button>
            <button
              onClick={() => onInputTypeChange("youtube")}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                inputType === "youtube"
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <Video className="w-8 h-8 mx-auto mb-2 text-red-500" />
              <div className="font-medium">YouTube URL</div>
              <div className="text-xs text-muted-foreground mt-1">
                유튜브 영상 자동 다운로드
              </div>
            </button>
          </div>

          {/* 입력 필드 */}
          {inputType === "local" && (
            <div className="space-y-2">
              <Label>영상 파일 불러오기</Label>
              <input
                ref={localFileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleLocalFilePick}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => localFileRef.current?.click()}
                >
                  불러오기
                </Button>
                <Input
                  value={localFileName || videoInput || ""}
                  placeholder="데스크탑에서 영상을 선택하세요"
                  readOnly
                />
              </div>
              <p className="text-xs text-muted-foreground">
                브라우저에서는 실제 절대경로 대신 선택된 파일명만 표시됩니다
              </p>
            </div>
          )}

          {inputType === "youtube" && (
            <div className="space-y-2">
              <Label htmlFor="video-input">YouTube URL</Label>
              <Input
                id="video-input"
                placeholder="https://www.youtube.com/watch?v=..."
                value={videoInput}
                onChange={(e) => onVideoInputChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                YouTube 영상 URL을 붙여넣으세요
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        size="lg"
        className="w-full"
        onClick={onNext}
        disabled={!videoInput}
      >
        다음: 자막 준비
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}
