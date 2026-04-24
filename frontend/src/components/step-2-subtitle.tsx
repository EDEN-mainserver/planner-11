"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { parseSrt, subtitlesToText, checkSubtitle, type SubtitleEntry } from "@/lib/api";
import {
  FileText, Mic, ArrowLeft, ArrowRight, Loader2, CheckCircle2,
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

  const handleNext = () => {
    setError("");
    if (!srtContent.trim()) {
      setError("SRT 자막 내용을 붙여넣어주세요.");
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
            자막 입력
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              SRT 파일 내용을 복사해서 붙여넣으세요. YouTube에서 자막을 다운로드하거나, 캡컷에서 자동생성한 자막을 사용할 수 있습니다.
            </p>
          </div>

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
                  YouTube 영상 확인 중...
                </>
              ) : subtitleInfo.has ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <div>
                    <span className="font-medium">유효한 YouTube 영상입니다</span>
                    <span className="block text-xs opacity-70 mt-0.5">
                      YouTube에서 자막을 다운로드하여 위에 붙여넣으세요
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <Mic className="w-4 h-4" />
                  <div>
                    <span className="font-medium">캡컷 자동자막을 활용하세요</span>
                    <span className="block text-xs opacity-70 mt-0.5">
                      캡컷에서 자동자막 생성 후 SRT로 내보내서 붙여넣으세요
                    </span>
                  </div>
                </>
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
