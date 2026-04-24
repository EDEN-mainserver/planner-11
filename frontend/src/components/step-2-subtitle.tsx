"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { parseSrt, subtitlesToText, checkSubtitle, transcribeYoutube, type SubtitleEntry } from "@/lib/api";
import {
  FileText, Sparkles, ArrowLeft, ArrowRight, Loader2, CheckCircle2,
} from "lucide-react";

interface Props {
  videoInput: string;
  inputType: "local" | "youtube";
  onSubtitleReady: (subtitles: SubtitleEntry[], text: string) => void;
  onBack: () => void;
}

export function StepSubtitle({
  videoInput,
  inputType,
  onSubtitleReady,
  onBack,
}: Props) {
  const [srtContent, setSrtContent] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [subtitleInfo, setSubtitleInfo] = useState<{ checked: boolean; has: boolean; source: string | null }>({
    checked: false, has: false, source: null,
  });
  const [checkingSubtitle, setCheckingSubtitle] = useState(false);

  useEffect(() => {
    if (inputType === "youtube" && videoInput && !subtitleInfo.checked) {
      setCheckingSubtitle(true);
      checkSubtitle(videoInput).then((result) => {
        setSubtitleInfo({ checked: true, has: result.has_subtitle, source: result.source });
        setCheckingSubtitle(false);
      });
    }
  }, [inputType, videoInput, subtitleInfo.checked]);

  const handleAutoGenerate = async () => {
    setGenerating(true);
    setError("");
    try {
      const srt = await transcribeYoutube(videoInput);
      setSrtContent(srt);
    } catch (e) {
      setError(e instanceof Error ? e.message : "자막 생성에 실패했습니다.");
    } finally {
      setGenerating(false);
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
          {/* AI 자동 생성 버튼 */}
          {inputType === "youtube" && (
            <div className="space-y-2">
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
                    Gemini AI로 자막 생성 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI 자동 자막 생성 (Gemini)
                  </>
                )}
              </Button>
            </div>
          )}

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
              SRT 파일 내용을 복사해서 붙여넣거나, 위 버튼으로 AI 자동 생성하세요
            </p>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
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
          onClick={handleNext}
          disabled={!srtContent.trim()}
        >
          다음: AI 분석
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
