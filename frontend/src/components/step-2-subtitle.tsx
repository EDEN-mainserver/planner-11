"use client";

import { type ChangeEvent, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { parseSrt, subtitlesToText, checkSubtitle, transcribeYoutube, type SubtitleEntry } from "@/lib/api";
import {
  FileText, Sparkles, ArrowLeft, ArrowRight, Loader2, CheckCircle2, Upload,
} from "lucide-react";

interface Props {
  videoInput: string;
  inputType: "local" | "youtube";
  onSubtitleReady: (subtitles: SubtitleEntry[], text: string) => void;
  onNoSubtitle: () => void;
  onBack: () => void;
}

export function StepSubtitle({
  videoInput,
  inputType,
  onSubtitleReady,
  onNoSubtitle,
  onBack,
}: Props) {
  const [srtContent, setSrtContent] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [subtitleMethod, setSubtitleMethod] = useState<"file" | "ai" | "none">("file");
  const [hasLoadedSrtFile, setHasLoadedSrtFile] = useState(false);
  const [subtitleInfo, setSubtitleInfo] = useState<{ checkedUrl: string; has: boolean; source: string | null }>({
    checkedUrl: "", has: false, source: null,
  });
  const checkingSubtitle = inputType === "youtube" && !!videoInput && subtitleInfo.checkedUrl !== videoInput;

  useEffect(() => {
    if (inputType === "youtube" && videoInput && subtitleInfo.checkedUrl !== videoInput) {
      let cancelled = false;

      checkSubtitle(videoInput).then((result) => {
        if (cancelled) return;
        setSubtitleInfo({ checkedUrl: videoInput, has: result.has_subtitle, source: result.source });
      });

      return () => {
        cancelled = true;
      };
    }
  }, [inputType, videoInput, subtitleInfo.checkedUrl]);

  const handleAutoGenerate = async () => {
    setGenerating(true);
    setError("");
    setSubtitleMethod("ai");
    setHasLoadedSrtFile(false);
    try {
      const srt = await transcribeYoutube(videoInput);
      setSrtContent(srt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "자막 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
    }
  };

  const handleSrtFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError("");
    setSubtitleMethod("file");
    setHasLoadedSrtFile(false);

    if (!file.name.toLowerCase().endsWith(".srt")) {
      setError("SRT 파일만 불러올 수 있습니다.");
      return;
    }

    try {
      const content = await file.text();
      setSrtContent(content);
      setHasLoadedSrtFile(true);
    } catch {
      setError("SRT 파일을 읽는 중 오류가 발생했습니다.");
    }
  };

  const handleNext = () => {
    setError("");
    if (!srtContent.trim()) {
      setError("SRT 자막 내용을 붙여넣거나 자동 생성해주세요.");
      return;
    }

    const subtitles = parseSrt(srtContent);
    if (subtitles.length === 0) {
      setError("유효한 SRT 자막을 파싱하지 못했습니다. 형식을 확인해주세요.");
      return;
    }

    const text = subtitlesToText(subtitles);
    onSubtitleReady(subtitles, text);
  };

  return (
    <div className="space-y-6 mt-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            자막 준비
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => setSubtitleMethod("file")}
              className={`rounded-xl border p-4 space-y-3 text-left transition-colors ${
                subtitleMethod === "file"
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/60 bg-muted/20"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Upload className="w-4 h-4" />
                  SRT 파일 불러오기
                </div>
                <p className="text-xs text-muted-foreground">
                  기존에 가지고 있는 자막 파일을 바로 첨부합니다
                </p>
              </div>
              <Input
                type="file"
                accept=".srt"
                onChange={handleSrtFileChange}
              />
            </button>

            <div
              className={`rounded-xl border p-4 space-y-3 transition-colors ${
                subtitleMethod === "ai"
                  ? "border-primary/50 bg-primary/5"
                  : "border-border/60 bg-muted/20"
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="w-4 h-4" />
                  AI 자동 자막 생성
                </div>
                <p className="text-xs text-muted-foreground">
                  YouTube URL 기준으로 자동 자막 생성을 시도합니다
                </p>
              </div>

              {inputType === "youtube" ? (
                <>
                  {checkingSubtitle ? (
                    <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 text-sm flex items-center gap-2 text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      YouTube 영상 확인 중...
                    </div>
                  ) : subtitleInfo.has ? (
                    <div className="p-3 rounded-lg border border-green-200 bg-green-50 text-sm flex items-center gap-2 text-green-700">
                      <CheckCircle2 className="w-4 h-4" />
                      유효한 YouTube 영상입니다
                    </div>
                  ) : null}

                  <Button
                    onClick={handleAutoGenerate}
                    disabled={generating}
                    variant="outline"
                    className="w-full"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        AI 자동 자막 생성 중...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        AI 자동 자막 생성
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <div className="p-3 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
                  AI 자동 자막 생성은 YouTube URL 입력 시 사용할 수 있습니다
                </div>
              )}
            </div>
          </div>

          {subtitleMethod === "file" && hasLoadedSrtFile && (
            <div className="space-y-2">
              <Label>SRT 자막 내용</Label>
              <Textarea
                placeholder={`1\n00:00:00,000 --> 00:00:03,000\n첫 번째 자막 내용\n\n2\n00:00:03,000 --> 00:00:06,000\n두 번째 자막 내용`}
                value={srtContent}
                onChange={(e) => setSrtContent(e.target.value)}
                rows={12}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                불러온 SRT 내용을 확인하거나 직접 수정할 수 있습니다
              </p>
            </div>
          )}

          {subtitleMethod === "ai" && srtContent.trim() && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              AI 자동 자막이 준비되었습니다. 다음 단계로 진행할 수 있습니다.
            </div>
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileText className="w-4 h-4" />
            자막 없음
          </div>
          <p className="text-sm text-muted-foreground">
            자막 없이 진행하면 영상 길이를 기준으로 후보 구간을 생성한 뒤, 직접 선택해서 드래프트를 만들 수 있습니다.
          </p>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setSubtitleMethod("none");
              onNoSubtitle();
            }}
          >
            자막 없이 진행
          </Button>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          <ArrowLeft className="w-4 h-4 mr-2" />
          이전
        </Button>
        <Button
          className="flex-1"
          onClick={handleNext}
          disabled={subtitleMethod !== "none" && !srtContent.trim()}
        >
          다음: AI 분석
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
