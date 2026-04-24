"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prepareVideo, startProgress, getProgress, checkSubtitle, type PrepareResponse } from "@/lib/api";
import {
  FileText, Mic, ArrowLeft, ArrowRight, Loader2, CheckCircle2,
} from "lucide-react";

interface Props {
  videoInput: string;
  inputType: "local" | "youtube";
  srtPath: string;
  onSrtPathChange: (v: string) => void;
  onPrepared: (result: PrepareResponse) => void;
  onBack: () => void;
}

export function StepSubtitle({
  videoInput,
  inputType,
  srtPath,
  onSrtPathChange,
  onPrepared,
  onBack,
}: Props) {
  const [subtitleMode, setSubtitleMode] = useState<"file" | "auto">(
    srtPath ? "file" : "auto"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [progressPercent, setProgressPercent] = useState(0);
  const [subtitleInfo, setSubtitleInfo] = useState<{ checked: boolean; has: boolean; source: string | null }>({
    checked: false, has: false, source: null,
  });
  const [checkingSubtitle, setCheckingSubtitle] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // YouTube URL인 경우 자막 존재 여부를 자동 확인
  useEffect(() => {
    if (inputType === "youtube" && videoInput && !subtitleInfo.checked) {
      setCheckingSubtitle(true);
      checkSubtitle(videoInput).then((result) => {
        setSubtitleInfo({ checked: true, has: result.has_subtitle, source: result.source });
        setCheckingSubtitle(false);
      });
    }
  }, [inputType, videoInput, subtitleInfo.checked]);

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  const handlePrepare = async () => {
    setLoading(true);
    setError("");
    setProgressPercent(0);

    try {
      const progressId = await startProgress();

      pollingRef.current = setInterval(async () => {
        const p = await getProgress(progressId);
        setProgressPercent(p.percent);
        if (p.message) setStatusMsg(p.message);
        if (p.stage === "done" || p.stage === "error") {
          if (pollingRef.current) clearInterval(pollingRef.current);
        }
      }, 1000);

      setStatusMsg("준비 시작...");

      const result = await prepareVideo(
        videoInput,
        subtitleMode === "file" ? srtPath : "",
        progressId
      );

      if (pollingRef.current) clearInterval(pollingRef.current);
      setProgressPercent(100);
      onPrepared(result);
    } catch (e) {
      if (pollingRef.current) clearInterval(pollingRef.current);
      setError(e instanceof Error ? e.message : "준비 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
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
              <div className="font-medium">자동 자막</div>
              <div className="text-xs text-muted-foreground mt-1">
                YouTube 자막 또는 캡컷 자동자막
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

          {/* 자동 자막 안내 */}
          {subtitleMode === "auto" && (
            <div className="space-y-2">
              {inputType === "youtube" && (
                <div className={`p-3 rounded-lg border text-sm flex items-center gap-2 ${
                  checkingSubtitle
                    ? "bg-muted/50 border-border/50 text-muted-foreground"
                    : subtitleInfo.has
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                }`}>
                  {checkingSubtitle ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      YouTube 자막 확인 중...
                    </>
                  ) : subtitleInfo.has ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <div>
                        <span className="font-medium">{subtitleInfo.source} 자막이 존재합니다</span>
                        <span className="block text-xs opacity-70 mt-0.5">
                          자동으로 자막을 가져옵니다
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      <div>
                        <span className="font-medium">YouTube 자막이 없습니다</span>
                        <span className="block text-xs opacity-70 mt-0.5">
                          캡컷에서 자동자막을 생성할 수 있습니다
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
              {inputType === "local" && (
                <div className="p-3 rounded-lg border border-blue-500/30 bg-blue-500/10 text-sm text-blue-400">
                  <span className="font-medium">캡컷 자동자막 사용</span>
                  <span className="block text-xs opacity-70 mt-0.5">
                    캡컷에서 드래프트를 열면 자동자막 기능을 사용할 수 있습니다
                  </span>
                </div>
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

      {loading && (
        <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm space-y-3">
          <div className="flex items-center gap-2 text-blue-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            {statusMsg || "준비 중..."}
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
