export interface Clip {
  title: string;
  start_time: string;
  end_time: string;
  reason: string;
  hook: string;
  virality_score: number;
  category: string;
}

export interface AnalyzeResponse {
  clips: Clip[];
}

export interface SubtitleEntry {
  index: number;
  start: string;
  end: string;
  start_seconds: number;
  end_seconds: number;
  text: string;
}

export interface SubtitleCheck {
  has_subtitle: boolean;
  source: string | null;
  title?: string;
  valid?: boolean;
}

// SRT 파싱 (브라우저에서 처리)
export function parseSrt(srtContent: string): SubtitleEntry[] {
  const blocks = srtContent.trim().split(/\n\s*\n/);
  const entries: SubtitleEntry[] = [];

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    if (lines.length < 3) continue;

    const index = parseInt(lines[0]);
    if (isNaN(index)) continue;

    const timeParts = lines[1].split(" --> ");
    if (timeParts.length !== 2) continue;

    const start = timeParts[0].trim();
    const end = timeParts[1].trim();
    const text = lines.slice(2).join(" ").trim();

    entries.push({
      index,
      start,
      end,
      start_seconds: timeToSeconds(start),
      end_seconds: timeToSeconds(end),
      text,
    });
  }

  return entries;
}

function timeToSeconds(time: string): number {
  const parts = time.replace(",", ".").split(":");
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const s = parseFloat(parts[2]);
  return h * 3600 + m * 60 + s;
}

export function subtitlesToText(subtitles: SubtitleEntry[]): string {
  return subtitles.map((s) => `[${s.start} --> ${s.end}] ${s.text}`).join("\n");
}

// Gemini로 YouTube 자막 자동 생성
export async function transcribeYoutube(youtubeUrl: string): Promise<string> {
  const res = await fetch("/api/transcribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ youtubeUrl }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "자막 생성 실패");
  }

  const data = await res.json();
  return data.srt;
}

// YouTube 자막 확인
export async function checkSubtitle(url: string): Promise<SubtitleCheck> {
  try {
    const res = await fetch(`/api/check-subtitle?url=${encodeURIComponent(url)}`);
    return res.json();
  } catch {
    return { has_subtitle: false, source: null };
  }
}

// AI 분석 (Next.js API route → Claude)
export async function analyzeSubtitles(
  subtitleText: string,
  numClips: number = 5,
  customPrompt: string = "",
  clipDuration: number = 60
): Promise<AnalyzeResponse> {
  const res = await fetch("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subtitleText, numClips, customPrompt, clipDuration }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "AI 분석 실패");
  }

  return res.json();
}

// 캡컷 드래프트 JSON 생성 (브라우저에서 처리)
export function generateCapcutDraftJson(
  videoPath: string,
  clips: Clip[],
  vertical: boolean = false,
): { name: string; content: object }[] {
  const drafts: { name: string; content: object }[] = [];

  for (let i = 0; i < clips.length; i++) {
    const clip = clips[i];
    const startSec = parseTimeToSeconds(clip.start_time);
    const endSec = parseTimeToSeconds(clip.end_time);
    const duration = endSec - startSec;

    const safeTitle = clip.title.replace(/[^a-zA-Z0-9가-힣 _-]/g, "_").slice(0, 30);
    const draftName = `${String(i + 1).padStart(2, "0")}_${safeTitle}`;

    // 캡컷 드래프트 JSON 구조 (간략화)
    const draftContent = {
      canvas_config: {
        width: vertical ? 1080 : 1920,
        height: vertical ? 1920 : 1080,
        ratio: vertical ? "9:16" : "16:9",
      },
      duration: Math.round(duration * 1000000), // microseconds
      tracks: [
        {
          type: "video",
          segments: [
            {
              material_id: "main_video",
              target_timerange: {
                start: 0,
                duration: Math.round(duration * 1000000),
              },
              source_timerange: {
                start: Math.round(startSec * 1000000),
                duration: Math.round(duration * 1000000),
              },
            },
          ],
        },
      ],
      materials: {
        videos: [
          {
            id: "main_video",
            path: videoPath,
            duration: Math.round(duration * 1000000),
          },
        ],
      },
      clip_info: {
        title: clip.title,
        start_time: clip.start_time,
        end_time: clip.end_time,
        reason: clip.reason,
        hook: clip.hook,
        virality_score: clip.virality_score,
        category: clip.category,
      },
    };

    drafts.push({ name: draftName, content: draftContent });
  }

  return drafts;
}

function parseTimeToSeconds(time: string): number {
  const t = time.replace(",", ".");
  const parts = t.split(":");
  return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
}

// 드래프트를 JSON 파일로 다운로드
export function downloadDraftAsJson(drafts: { name: string; content: object }[]) {
  const allData = {
    version: "longshot_v2",
    generated_at: new Date().toISOString(),
    drafts: drafts.map((d) => ({
      name: d.name,
      ...d.content,
    })),
  };

  const blob = new Blob([JSON.stringify(allData, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `롱숏_캡컷드래프트_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
