import { NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

function extractVideoId(url: string): string | null {
  const value = url.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  try {
    const parsed = new URL(value);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const watchId = parsed.searchParams.get("v");
      if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;

      const parts = parsed.pathname.split("/").filter(Boolean);
      const route = parts[0];
      const id = parts[1];
      if (
        ["shorts", "embed", "live"].includes(route) &&
        id &&
        /^[a-zA-Z0-9_-]{11}$/.test(id)
      ) {
        return id;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeTimestamp(value: number): number {
  // youtube-transcript returns milliseconds for srv3 captions and seconds for
  // the legacy XML format. Treat large values as milliseconds.
  return value > 1000 ? value / 1000 : value;
}

function normalizeSegments(
  items: Awaited<ReturnType<typeof YoutubeTranscript.fetchTranscript>>
) {
  return items
    .map((item) => {
      const start = normalizeTimestamp(Number(item.offset));
      const duration = normalizeTimestamp(Number(item.duration));
      return {
        start,
        end: start + duration,
        text: item.text.replace(/\s+/g, " ").trim(),
        lang: item.lang,
      };
    })
    .filter((segment) => segment.text && segment.end > segment.start);
}

export async function POST(request: Request) {
  const { url } = await request.json().catch(() => ({ url: "" }));

  const videoId = typeof url === "string" ? extractVideoId(url) : null;
  if (!videoId) {
    return NextResponse.json(
      { error: "유효하지 않은 유튜브 URL입니다" },
      { status: 400 }
    );
  }

  try {
    // 한국어 자막 우선, 없으면 첫 번째 가용 언어로 폴백
    let items;
    try {
      items = await YoutubeTranscript.fetchTranscript(videoId, { lang: "ko" });
    } catch (koError) {
      console.info("한국어 자막 없음, 기본 자막으로 재시도:", koError);
      items = await YoutubeTranscript.fetchTranscript(videoId);
    }

    const segments = normalizeSegments(items);
    if (segments.length === 0) {
      return NextResponse.json(
        { error: "사용 가능한 자막 내용이 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      segments,
      count: segments.length,
      language: segments[0]?.lang || null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `자막을 가져올 수 없습니다: ${msg}` },
      { status: 500 }
    );
  }
}
