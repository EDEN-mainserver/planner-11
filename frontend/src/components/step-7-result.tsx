"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { GenerateResponse } from "@/lib/api";
import { getDownloadUrl } from "@/lib/api";
import { Download, FolderOpen, RotateCcw, CheckCircle2, Film } from "lucide-react";

interface Props {
  result: GenerateResponse;
  sessionId: string;
  onReset: () => void;
}

export function StepResult({ result, sessionId, onReset }: Props) {
  return (
    <div className="space-y-6 mt-4">
      {/* Success Banner */}
      <div className="flex items-center gap-3 p-6 bg-green-500/10 border border-green-500/20 rounded-lg">
        <CheckCircle2 className="w-8 h-8 text-green-500" />
        <div>
          <h2 className="text-lg font-bold">숏폼 생성 완료!</h2>
          <p className="text-sm text-muted-foreground">
            {result.generated}개의 영상이 생성되었습니다
          </p>
        </div>
      </div>

      {/* Output Location */}
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

      {/* File List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Film className="w-5 h-5" />
            생성된 파일 ({result.files.length}개)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {result.files.map((file, i) => (
            <div
              key={i}
              className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-primary/20 rounded flex items-center justify-center text-sm font-bold text-primary">
                  {i + 1}
                </div>
                <span className="text-sm font-medium">{file}</span>
              </div>
              <a
                href={getDownloadUrl(sessionId, file)}
                download
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                <Download className="w-3 h-3" />
                다운로드
              </a>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Actions */}
      <Button variant="outline" onClick={onReset} className="w-full">
        <RotateCcw className="w-4 h-4 mr-2" />
        새로운 영상 분석
      </Button>
    </div>
  );
}
