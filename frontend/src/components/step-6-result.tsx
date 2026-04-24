"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { downloadDraftAsJson } from "@/lib/api";
import { RotateCcw, CheckCircle2, Film, Download, ExternalLink } from "lucide-react";

interface Props {
  drafts: { name: string; content: object }[];
  onReset: () => void;
}

export function StepResult({ drafts, onReset }: Props) {
  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center gap-3 p-6 bg-green-500/10 border border-green-500/20 rounded-lg">
        <CheckCircle2 className="w-8 h-8 text-green-500" />
        <div>
          <h2 className="text-lg font-bold">캡컷 드래프트 생성 완료!</h2>
          <p className="text-sm text-muted-foreground">
            {drafts.length}개의 클립 정보가 생성되었습니다
          </p>
        </div>
      </div>

      {/* 다운로드 */}
      <Button
        className="w-full"
        size="lg"
        onClick={() => downloadDraftAsJson(drafts)}
      >
        <Download className="w-4 h-4 mr-2" />
        드래프트 JSON 다운로드
      </Button>

      {/* 안내 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            다음 단계
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2 text-sm">
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0">1</span>
              <span>다운로드된 JSON 파일에서 각 클립의 시간 정보를 확인하세요</span>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0">2</span>
              <span>캡컷에서 원본 영상을 열고 해당 구간을 잘라주세요</span>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
              <span className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0">3</span>
              <span>캡컷 자동자막을 추가하고 내보내기하세요</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 클립 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            생성된 클립 ({drafts.length}개)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {drafts.map((draft, i) => (
            <div
              key={i}
              className="flex items-center p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center text-sm font-bold text-primary">
                  {i + 1}
                </div>
                <span className="text-sm font-medium">{draft.name}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Button variant="outline" onClick={onReset} className="w-full">
        <RotateCcw className="w-4 h-4 mr-2" />
        새로운 영상 분석
      </Button>
    </div>
  );
}
