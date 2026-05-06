"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type SubtitleSource = "youtube_auto" | "srt" | "none";
type Segment = { start: number; end: number; text: string };

function parseSRTTime(t: string): number {
  const [hms, ms] = t.split(",");
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + s + Number(ms) / 1000;
}

function parseSRT(content: string): Segment[] {
  return content
    .trim()
    .split(/\n\n+/)
    .flatMap((block) => {
      const lines = block.trim().split("\n");
      if (lines.length < 3) return [];
      const m = lines[1].match(
        /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/
      );
      if (!m) return [];
      return [
        {
          start: parseSRTTime(m[1]),
          end: parseSRTTime(m[2]),
          text: lines.slice(2).join(" ").trim(),
        },
      ];
    });
}

export default function Home() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const srtInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"youtube" | "upload">("youtube");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 옵션 상태
  const [removeSilence, setRemoveSilence] = useState(false);
  const [addHookVoice, setAddHookVoice] = useState(true);
  const [subtitleStyle, setSubtitleStyle] = useState("karaoke");

  // 자막 소스 상태
  const [subtitleSource, setSubtitleSource] = useState<SubtitleSource>("youtube_auto");
  const [srtFile, setSrtFile] = useState<File | null>(null);
  const [srtSegments, setSrtSegments] = useState<Segment[] | null>(null);

  const handleSrtFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSrtFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      setSrtSegments(parseSRT(content));
    };
    reader.readAsText(file, "utf-8");
  };

  const handleTabChange = (tab: "youtube" | "upload") => {
    setActiveTab(tab);
    // 업로드 탭은 youtube_auto 사용 불가
    if (tab === "upload" && subtitleSource === "youtube_auto") {
      setSubtitleSource("srt");
    }
  };

  const handleYoutubeSubmit = async () => {
    if (!youtubeUrl.trim()) {
      setError("유튜브 링크를 입력해주세요");
      return;
    }
    if (subtitleSource === "srt" && !srtSegments) {
      setError("SRT 파일을 첨부해주세요");
      return;
    }
    setIsSubmitting(true);
    setError("");

    try {
      // 자막 소스에 따라 세그먼트 수집
      let subtitleSegments: Segment[] | null = null;

      if (subtitleSource === "youtube_auto") {
        const tRes = await fetch("/api/transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: youtubeUrl }),
        });
        if (tRes.ok) {
          const tData = await tRes.json();
          subtitleSegments = tData.segments;
        } else {
          const tErr = await tRes.json().catch(() => ({}));
          throw new Error(tErr.error || "유튜브 자막을 가져오지 못했습니다");
        }
      } else if (subtitleSource === "srt") {
        subtitleSegments = srtSegments;
      }

      // 1. 프로젝트 생성
      const res = await fetch(`${API_URL}/api/projects/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_type: "youtube",
          youtube_url: youtubeUrl,
        }),
      });
      const project = await res.json();

      // 2. 쇼츠 생성 시작
      await fetch(`${API_URL}/api/shorts/${project.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options: {
            remove_silence: removeSilence,
            add_hook_voice: addHookVoice,
            subtitle_style: subtitleStyle,
            subtitle_source: subtitleSource,
            subtitle_segments: subtitleSegments,
          },
        }),
      });

      // 3. 대시보드로 이동
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(
        e instanceof Error
          ? e.message
          : "서버 연결에 실패했습니다. 백엔드가 실행 중인지 확인해주세요."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileSubmit = async () => {
    if (!selectedFile) {
      setError("파일을 선택해주세요");
      return;
    }
    setIsSubmitting(true);
    setError("");

    if (subtitleSource === "srt" && !srtSegments) {
      setError("SRT 파일을 첨부해주세요");
      return;
    }

    try {
      // 1. 파일 업로드 + 프로젝트 생성
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch(`${API_URL}/api/projects/upload`, {
        method: "POST",
        body: formData,
      });
      const project = await res.json();

      // 2. 쇼츠 생성 시작
      await fetch(`${API_URL}/api/shorts/${project.id}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          options: {
            remove_silence: removeSilence,
            add_hook_voice: addHookVoice,
            subtitle_style: subtitleStyle,
            subtitle_source: subtitleSource,
            subtitle_segments: subtitleSource === "srt" ? srtSegments : null,
          },
        }),
      });

      // 3. 대시보드로 이동
      router.push("/dashboard");
    } catch {
      setError("서버 연결에 실패했습니다. 백엔드가 실행 중인지 확인해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* 상단 알림 배너 */}
      <div className="w-full bg-primary text-primary-foreground text-center py-2 text-sm">
        지금 회원가입하고 <strong>무료 30분</strong> 이용권으로 쇼츠를 제작해보세요!
      </div>

      {/* GNB */}
      <header className="w-full border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-16 px-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight">LongShot</span>
          </Link>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">기능</a>
            <Link href="/dashboard" className="hover:text-foreground transition-colors">내 프로젝트</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>로그인</Button>
            <Button size="sm" onClick={() => router.push("/login")}>무료로 시작하기</Button>
          </div>
        </div>
      </header>

      {/* Hero 섹션 */}
      <main className="flex-1">
        <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight mb-6">
            영상 하나로<br />
            <span className="text-primary">쇼츠 N편</span> 자동 생성
          </h1>
          <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
            유튜브 링크 하나만 입력하세요. AI가 핵심 하이라이트를 추출하고,
            자막·후킹·제목까지 자동으로 완성합니다.
          </p>

          {/* 영상 입력 카드 */}
          <div className="max-w-xl mx-auto bg-card border rounded-2xl p-6 shadow-lg">
            {/* 탭 */}
            <div className="flex gap-1 mb-4 bg-muted rounded-lg p-1">
              <button
                onClick={() => handleTabChange("youtube")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "youtube"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                유튜브 링크
              </button>
              <button
                onClick={() => handleTabChange("upload")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === "upload"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                파일 업로드
              </button>
            </div>

            {/* 유튜브 링크 입력 */}
            {activeTab === "youtube" && (
              <div className="flex flex-col gap-3">
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => { setYoutubeUrl(e.target.value); setError(""); }}
                  placeholder="유튜브 영상 링크를 입력하세요 (예: https://www.youtube.com/watch?v=...)"
                  className="w-full px-4 py-3 border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleYoutubeSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "처리 중..." : "쇼츠로 변환하기 →"}
                </Button>
              </div>
            )}

            {/* 파일 업로드 */}
            {activeTab === "upload" && (
              <div className="flex flex-col gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".mp4,.mov,.avi,.mkv,.webm"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { setSelectedFile(file); setError(""); }
                  }}
                />
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    selectedFile ? "border-primary bg-primary/5" : "hover:border-primary/50"
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                >
                  {selectedFile ? (
                    <>
                      <div className="text-3xl mb-2">✓</div>
                      <p className="text-sm font-medium">{selectedFile.name}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl mb-2">↑</div>
                      <p className="text-sm text-muted-foreground">
                        클릭하거나 파일을 드래그하여 업로드
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        MP4, MOV, AVI 지원
                      </p>
                    </>
                  )}
                </div>
                <Button
                  size="lg"
                  className="w-full"
                  onClick={handleFileSubmit}
                  disabled={isSubmitting || !selectedFile}
                >
                  {isSubmitting ? "업로드 중..." : "쇼츠로 변환하기 →"}
                </Button>
              </div>
            )}

            {/* 에러 메시지 */}
            {error && (
              <p className="text-sm text-red-500 mt-3">{error}</p>
            )}

            {/* 옵션 토글 */}
            <div className="mt-4 pt-4 border-t space-y-3">
              <p className="text-xs font-medium text-muted-foreground text-left">AI 옵션</p>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addHookVoice}
                    onChange={(e) => setAddHookVoice(e.target.checked)}
                    className="rounded"
                  />
                  AI 후킹 보이스
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeSilence}
                    onChange={(e) => setRemoveSilence(e.target.checked)}
                    className="rounded"
                  />
                  무음 구간 제거
                </label>
                <select
                  value={subtitleStyle}
                  onChange={(e) => setSubtitleStyle(e.target.value)}
                  className="text-xs border rounded px-2 py-1 bg-background"
                >
                  <option value="karaoke">자막: 노래방 스타일</option>
                  <option value="highlight">자막: 하이라이트</option>
                  <option value="simple">자막: 심플</option>
                </select>
              </div>

              {/* 자막 소스 선택 */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground text-left">자막 소스</p>
                <div className="flex flex-wrap gap-2">
                  {activeTab === "youtube" && (
                    <button
                      type="button"
                      onClick={() => setSubtitleSource("youtube_auto")}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        subtitleSource === "youtube_auto"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      }`}
                    >
                      YouTube 자동자막
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSubtitleSource("srt")}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      subtitleSource === "srt"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    SRT 파일 첨부
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubtitleSource("none")}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      subtitleSource === "none"
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}
                  >
                    자막 없음
                  </button>
                </div>

                {/* SRT 파일 선택 */}
                {subtitleSource === "srt" && (
                  <div className="flex items-center gap-2">
                    <input
                      ref={srtInputRef}
                      type="file"
                      accept=".srt"
                      className="hidden"
                      onChange={handleSrtFile}
                    />
                    <button
                      type="button"
                      onClick={() => srtInputRef.current?.click()}
                      className={`text-xs px-3 py-1.5 rounded-lg border border-dashed transition-colors ${
                        srtFile
                          ? "border-primary text-primary bg-primary/5"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {srtFile ? `✓ ${srtFile.name}` : "SRT 파일 선택"}
                    </button>
                    {srtSegments && (
                      <span className="text-xs text-muted-foreground">
                        {srtSegments.length}개 자막
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 수치 */}
          <div className="flex justify-center gap-12 mt-12 text-center">
            <div>
              <div className="text-2xl font-bold">~300원</div>
              <div className="text-sm text-muted-foreground">쇼츠 1편당</div>
            </div>
            <div>
              <div className="text-2xl font-bold">N ÷ 2</div>
              <div className="text-sm text-muted-foreground">분당 쇼츠 생성</div>
            </div>
            <div>
              <div className="text-2xl font-bold">30분</div>
              <div className="text-sm text-muted-foreground">무료 이용권</div>
            </div>
          </div>
        </section>

        {/* 기능 섹션 */}
        <section id="features" className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-center mb-12">AI가 전부 해드립니다</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "AI 하이라이트 추출", desc: "영상의 핵심 장면을 AI가 자동으로 선별하여 쇼츠로 만듭니다." },
              { title: "자동 자막 생성", desc: "음성 인식으로 자막을 자동 생성하고, 타임라인에 정확히 배치합니다." },
              { title: "무음 구간 제거", desc: "지루한 침묵 구간을 자동으로 감지하고 제거하여 속도감을 높입니다." },
              { title: "AI 후킹 보이스", desc: "영상 시작부에 AI 나레이션을 삽입하여 이탈률을 줄입니다." },
              { title: "첫 3초 하이라이트", desc: "가장 임팩트 있는 장면을 영상 앞에 배치하여 시선을 잡습니다." },
              { title: "제목·태그 추천", desc: "유튜브 알고리즘에 최적화된 제목, 해시태그, 설명글을 자동 생성합니다." },
            ].map((feature) => (
              <div
                key={feature.title}
                className="border rounded-xl p-6 bg-card hover:shadow-md transition-shadow"
              >
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            ))}
          </div>
        </section>

      </main>

      {/* 푸터 */}
      <footer className="border-t py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">LongShot</span>
          <div className="flex gap-6">
            <a href="#" className="hover:text-foreground">이용약관</a>
            <a href="#" className="hover:text-foreground">개인정보처리방침</a>
            <a href="#" className="hover:text-foreground">환불정책</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
