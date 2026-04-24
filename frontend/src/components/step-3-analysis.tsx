"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { analyzeVideo, type PrepareResponse, type AnalyzeResponse } from "@/lib/api";
import {
  Brain, Sparkles, ArrowLeft, Loader2, CheckCircle2, Video, Mic, AlertCircle,
} from "lucide-react";

interface Props {
  sessionId: string;
  prepareResult: PrepareResponse;
  onAnalyzed: (result: AnalyzeResponse) => void;
  onBack: () => void;
}

export function StepAnalysis({
  sessionId,
  prepareResult,
  onAnalyzed,
  onBack,
}: Props) {
  const [numClips, setNumClips] = useState(5);
  const [clipDuration, setClipDuration] = useState(60);
  const [customPrompt, setCustomPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const hasSubtitle = !!prepareResult.srt_path;

  const handleAnalyze = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await analyzeVideo(sessionId, numClips, customPrompt, clipDuration);
      onAnalyzed(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 mt-4">
      {/* 준비 완료 요약 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            영상 준비 완료
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-16">영상:</span>
            <code className="text-xs bg-muted rounded px-2 py-1 break-all">
              {prepareResult.youtube_title || prepareResult.video_path}
            </code>
            {prepareResult.youtube_title && (
              <Badge variant="secondary"><Video className="w-3 h-3 mr-1" />YouTube</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground w-16">자막:</span>
            {hasSubtitle ? (
              <>
                <code className="text-xs bg-muted rounded px-2 py-1 break-all">
                  {prepareResult.srt_path}
                </code>
                <Badge variant="secondary"><Mic className="w-3 h-3 mr-1" />SRT</Badge>
              </>
            ) : (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                캡컷 자동자막 사용
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 자막 없을 때 안내 */}
      {!hasSubtitle && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-yellow-400 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium">자막 파일이 없어 AI 분석을 할 수 없습니다.</span>
            <span className="block text-xs opacity-70 mt-1">
              SRT 자막 파일을 제공하거나, YouTube 자막이 있는 영상을 사용해주세요.
              캡컷 자동자막은 드래프트 생성 후 캡컷에서 적용할 수 있습니다.
            </span>
          </div>
        </div>
      )}

      {/* AI 분석 옵션 */}
      {hasSubtitle && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5" />
              AI 분석 옵션
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
      )}

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
          disabled={loading || !hasSubtitle}
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              AI가 자막을 분석하고 있습니다...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              AI 분석 시작
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
