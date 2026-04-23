"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prepareVideo, type PrepareResponse } from "@/lib/api";
import {
  FileText, Mic, ArrowLeft, ArrowRight, Loader2, CheckCircle2,
} from "lucide-react";

interface Props {
  videoInput: string;
  inputType: "local" | "youtube";
  srtPath: string;
  whisperModel: string;
  onSrtPathChange: (v: string) => void;
  onWhisperModelChange: (v: string) => void;
  onPrepared: (result: PrepareResponse) => void;
  onBack: () => void;
}

const WHISPER_MODELS = [
  { value: "tiny", label: "Tiny", desc: "가장 빠름, 정확도 낮음" },
  { value: "base", label: "Base", desc: "빠름, 적당한 정확도 (추천)" },
  { value: "small", label: "Small", desc: "보통 속도, 좋은 정확도" },
  { value: "medium", label: "Medium", desc: "느림, 높은 정확도" },
  { value: "large", label: "Large", desc: "가장 느림, 최고 정확도" },
];

export function StepSubtitle({
  videoInput,
  inputType,
  srtPath,
  whisperModel,
  onSrtPathChange,
  onWhisperModelChange,
  onPrepared,
  onBack,
}: Props) {
  const [subtitleMode, setSubtitleMode] = useState<"file" | "auto">(
    srtPath ? "file" : "auto"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");

  const handlePrepare = async () => {
    setLoading(true);
    setError("");

    if (inputType === "youtube") {
      setStatusMsg("YouTube 영상 다운로드 중...");
    }
    if (subtitleMode === "auto") {
      setStatusMsg((prev) =>
        prev ? prev + " → 자막 자동 생성 대기 중..." : "Whisper로 자막 생성 중..."
      );
    }

    try {
      const result = await prepareVideo(
        videoInput,
        subtitleMode === "file" ? srtPath : "",
        whisperModel
      );
      onPrepared(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "준비 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
      setStatusMsg("");
    }
  };

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            자막 준비 방식
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 자막 모드 선택 */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setSubtitleMode("file")}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                subtitleMode === "file"
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <FileText className="w-8 h-8 mx-auto mb-2 text-primary" />
              <div className="font-medium">SRT 파일 직접 입력</div>
              <div className="text-xs text-muted-foreground mt-1">
                이미 자막 파일이 있는 경우
              </div>
            </button>
            <button
              onClick={() => setSubtitleMode("auto")}
              className={`p-4 rounded-lg border-2 text-center transition-all ${
                subtitleMode === "auto"
                  ? "border-primary bg-primary/10"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <Mic className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <div className="font-medium">Whisper 자동 생성</div>
              <div className="text-xs text-muted-foreground mt-1">
                AI가 음성에서 자막 추출
              </div>
            </button>
          </div>

          {/* SRT 파일 입력 */}
          {subtitleMode === "file" && (
            <div className="space-y-2">
              <Label htmlFor="srt">SRT 파일 경로</Label>
              <Input
                id="srt"
                placeholder="/Users/you/Videos/my_video.srt"
                value={srtPath}
                onChange={(e) => onSrtPathChange(e.target.value)}
              />
            </div>
          )}

          {/* Whisper 모델 선택 */}
          {subtitleMode === "auto" && (
            <div className="space-y-2">
              <Label>Whisper 모델 선택</Label>
              <div className="grid grid-cols-1 gap-2">
                {WHISPER_MODELS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => onWhisperModelChange(m.value)}
                    className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                      whisperModel === m.value
                        ? "border-primary bg-primary/10"
                        : "border-border/50 hover:border-border"
                    }`}
                  >
                    <div>
                      <span className="font-medium">{m.label}</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        {m.desc}
                      </span>
                    </div>
                    {whisperModel === m.value && (
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                    )}
                  </button>
                ))}
              </div>
              {inputType === "youtube" && (
                <p className="text-xs text-muted-foreground bg-muted/50 p-3 rounded">
                  YouTube 자막이 있으면 자동으로 사용하고, 없을 때만 Whisper가 동작합니다.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}

      {loading && statusMsg && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-400 text-sm flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          {statusMsg}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          이전
        </Button>
        <Button
          className="flex-1"
          onClick={handlePrepare}
          disabled={loading || (subtitleMode === "file" && !srtPath)}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              준비 중...
            </>
          ) : (
            <>
              다음: AI 분석
              <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
