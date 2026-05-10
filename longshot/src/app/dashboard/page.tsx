"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Short {
  id: string;
  status: string;
  video_path?: string;
  thumbnail_path?: string;
  title?: string;
  description?: string;
  hashtags?: string[];
  highlight?: {
    start: number;
    end: number;
    reason?: string;
    score?: number;
    hook_text?: string;
  };
  metadata?: {
    title?: string;
    description?: string;
    hashtags?: string[];
  };
  error?: string;
}

interface Project {
  id: string;
  title: string;
  source_type: string;
  youtube_url?: string;
  status: string;
  shorts?: Short[];
  duration_seconds?: number;
  thumbnail_url?: string;
}

interface PipelineStatus {
  project_id: string;
  status: string;
  progress: number;
  current_step: string;
  shorts_completed: number;
  shorts_total: number;
  error?: string;
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingStatuses, setProcessingStatuses] = useState<
    Record<string, PipelineStatus>
  >({});

  const fetchProjects = useCallback(async (): Promise<Project[]> => {
    const res = await fetch(`${API_URL}/api/projects/`);
    if (!res.ok) throw new Error("프로젝트 목록 로드 실패");
    const data = await res.json();
    return data.projects || [];
  }, []);

  useEffect(() => {
    let ignore = false;

    fetchProjects()
      .then((nextProjects) => {
        if (!ignore) setProjects(nextProjects);
      })
      .catch(() => {
        console.error("프로젝트 목록 로드 실패");
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [fetchProjects]);

  // 처리 중인 프로젝트 상태 폴링
  useEffect(() => {
    const processingProjects = projects.filter(
      (p) => p.status === "processing"
    );
    if (processingProjects.length === 0) return;

    const interval = setInterval(async () => {
      for (const p of processingProjects) {
        try {
          const res = await fetch(`${API_URL}/api/shorts/${p.id}/status`);
          const status: PipelineStatus = await res.json();
          setProcessingStatuses((prev) => ({ ...prev, [p.id]: status }));

          if (status.status === "completed" || status.status === "error") {
            fetchProjects()
              .then(setProjects)
              .catch(() => console.error("프로젝트 목록 로드 실패"));
          }
        } catch {
          // 무시
        }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [projects, fetchProjects]);

  const handleDelete = async (projectId: string) => {
    if (!confirm("프로젝트를 삭제하시겠습니까?")) return;
    await fetch(`${API_URL}/api/projects/${projectId}`, { method: "DELETE" });
    fetchProjects()
      .then(setProjects)
      .catch(() => console.error("프로젝트 목록 로드 실패"));
  };

  const handleDownload = (projectId: string, shortId: string) => {
    window.open(
      `${API_URL}/api/shorts/${projectId}/shorts/${shortId}/download`,
      "_blank"
    );
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: "bg-gray-100 text-gray-700",
      processing: "bg-blue-100 text-blue-700",
      completed: "bg-green-100 text-green-700",
      error: "bg-red-100 text-red-700",
    };
    const labels: Record<string, string> = {
      pending: "대기 중",
      processing: "처리 중",
      completed: "완료",
      error: "오류",
    };
    return (
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[status] || styles.pending}`}
      >
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* GNB */}
      <header className="w-full border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <Link href="/" className="text-xl font-bold tracking-tight">
            LongShot
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <Link
              href="/dashboard"
              className="text-foreground font-semibold"
            >
              내 프로젝트
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <div className="text-sm text-muted-foreground">
              잔여 <strong className="text-foreground">30분</strong>
            </div>
            <Button size="sm" variant="outline">
              업그레이드
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-6 py-8">
        {/* 상단 */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold">내 프로젝트</h1>
            <p className="text-sm text-muted-foreground mt-1">
              생성한 쇼츠를 관리하세요
            </p>
          </div>
          <Link href="/">
            <Button>+ 새 쇼츠 만들기</Button>
          </Link>
        </div>

        {/* 프로젝트 목록 */}
        {loading ? (
          <div className="text-center py-20 text-muted-foreground">
            로딩 중...
          </div>
        ) : projects.length === 0 ? (
          /* 빈 상태 */
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🎬</div>
            <h2 className="text-lg font-semibold mb-2">
              아직 만든 쇼츠가 없어요
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              유튜브 링크 하나만 입력하면 AI가 쇼츠를 자동으로 만들어드려요
            </p>
            <Link href="/">
              <Button size="lg">첫 쇼츠 만들기</Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="border rounded-xl bg-card overflow-hidden"
              >
                {/* 프로젝트 헤더 */}
                <div className="flex items-center justify-between p-4 border-b bg-muted/30">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold">{project.title}</h3>
                    {statusBadge(project.status)}
                    {project.duration_seconds && (
                      <span className="text-xs text-muted-foreground">
                        원본 {Math.floor(project.duration_seconds / 60)}분{" "}
                        {project.duration_seconds % 60}초
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {project.source_type === "youtube" &&
                      project.youtube_url && (
                        <a
                          href={project.youtube_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          원본 보기 ↗
                        </a>
                      )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(project.id)}
                      className="text-muted-foreground hover:text-red-500"
                    >
                      삭제
                    </Button>
                  </div>
                </div>

                {/* 처리 중 상태 */}
                {project.status === "processing" && (
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                      <span className="text-sm font-medium">
                        {processingStatuses[project.id]?.current_step ||
                          "AI 처리 중..."}
                      </span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all duration-500"
                        style={{
                          width: `${processingStatuses[project.id]?.progress || 10}%`,
                        }}
                      />
                    </div>
                    {processingStatuses[project.id]?.shorts_total > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {processingStatuses[project.id].shorts_completed} /{" "}
                        {processingStatuses[project.id].shorts_total} 쇼츠 완료
                      </p>
                    )}
                  </div>
                )}

                {/* 에러 상태 */}
                {project.status === "error" && (
                  <div className="p-6 text-center">
                    <p className="text-sm text-red-500">
                      생성 중 오류가 발생했습니다.{" "}
                      {processingStatuses[project.id]?.error}
                    </p>
                  </div>
                )}

                {/* 쇼츠 카드 그리드 */}
                {(project.shorts?.length || 0) > 0 && (
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {project.shorts?.map((short) => (
                      <div
                        key={short.id}
                        className="border rounded-lg overflow-hidden group hover:shadow-md transition-shadow"
                      >
                        {/* 썸네일 */}
                        <div className="aspect-[9/16] bg-muted relative">
                          {short.thumbnail_path ? (
                            <img
                              src={`${API_URL}/static/outputs/${project.id}/${short.id}/thumbnail.jpg`}
                              alt={short.metadata?.title || short.id}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-3xl">
                              🎬
                            </div>
                          )}
                          {short.highlight?.score && (
                            <span className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                              ★ {short.highlight.score}
                            </span>
                          )}
                          {statusBadge(short.status)}
                        </div>

                        {/* 정보 */}
                        <div className="p-3">
                          <h4 className="text-sm font-medium truncate">
                            {short.metadata?.title ||
                              short.highlight?.hook_text ||
                              `쇼츠 ${short.id.slice(-4)}`}
                          </h4>
                          {short.highlight && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {Math.floor(short.highlight.start)}s ~{" "}
                              {Math.floor(short.highlight.end)}s
                            </p>
                          )}

                          {/* 액션 버튼 */}
                          {short.status === "completed" && (
                            <div className="flex gap-1 mt-2">
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() =>
                                  handleDownload(project.id, short.id)
                                }
                              >
                                다운로드
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 완료 상태인데 쇼츠 없음 */}
                {project.status === "completed" &&
                  (project.shorts?.length || 0) === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      생성된 쇼츠가 없습니다
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="border-t py-8 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">LongShot</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">이용약관</a>
            <a href="#" className="hover:text-foreground">개인정보처리방침</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
