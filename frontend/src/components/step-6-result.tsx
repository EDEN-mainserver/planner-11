"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { GenerateResponse } from "@/lib/api";
import { FolderOpen, RotateCcw, CheckCircle2, Film, ExternalLink } from "lucide-react";

interface Props {
  result: GenerateResponse;
  onReset: () => void;
}

export function StepResult({ result, onReset }: Props) {
  return (
    <div className="space-y-6 mt-4">
      {/* Success Banner */}
      <div className="flex items-center gap-3 p-6 bg-green-500/10 border border-green-500/20 rounded-lg">
        <CheckCircle2 className="w-8 h-8 text-green-500" />
        <div>
          <h2 className="text-lg font-bold">캡컷 드래프트 생성 완료!</h2>
          <p className="text-sm text-muted-foreground">
            {result.generated}개의 드래프트가 생성되었습니다
          </p>
        </div>
      </div>

      {/* 캡컷 안내 */}
      {result.installed_to_capcut && (
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
                <span>캡컷 데스크탑 앱을 열어주세요</span>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <span className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0">2</span>
                <span>프로젝트 목록에서 생성된 드래프트를 확인하세요</span>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <span className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center text-xs font-bold text-primary shrink-0">3</span>
                <span>필요시 자동자막 추가 후 내보내기하세요</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 생성된 드래프트 목록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            생성된 드래프트 ({result.draft_names.length}개)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {result.draft_names.map((name, i) => (
            <div
              key={i}
              className="flex items-center p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center text-sm font-bold text-primary">
                  {i + 1}
                </div>
                <span className="text-sm font-medium">{name}</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 저장 위치 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            저장 위치
          </CardTitle>
        </CardHeader>
        <CardContent>
          <code className="block p-3 bg-muted rounded text-sm break-all">
            {result.output_dir}
          </code>
        </CardContent>
      </Card>

      <Button variant="outline" onClick={onReset} className="w-full">
        <RotateCcw className="w-4 h-4 mr-2" />
        새로운 영상 분석
      </Button>
    </div>
  );
}
