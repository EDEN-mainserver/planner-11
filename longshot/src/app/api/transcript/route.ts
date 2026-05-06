import { NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

function extractVideoId(url: string): string | null {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([^&\n?#]+)/
  );
  return m ? m[1] : null;
}

export async function POST(request: Request) {
  const { url } = await request.json();

  const videoId = extractVideoId(url);
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
    } catch {
      items = await YoutubeTranscript.fetchTranscript(videoId);
    }

    const segments = items.map((item) => ({
      start: item.offset / 1000,
      end: (item.offset + item.duration) / 1000,
      text: item.text,
    }));

    return NextResponse.json({ segments, count: segments.length });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `자막을 가져올 수 없습니다: ${msg}` },
      { status: 500 }
    );
  }
}
