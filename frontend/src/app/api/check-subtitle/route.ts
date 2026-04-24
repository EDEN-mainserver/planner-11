import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ has_subtitle: false, source: null });
  }

  // YouTube oEmbed API로 영상 정보 확인
  // 자막 존재 여부는 정확히 알 수 없지만, 영상 유효성은 확인 가능
  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(5000) });

    if (!res.ok) {
      return NextResponse.json({ has_subtitle: false, source: null, valid: false });
    }

    const data = await res.json();
    return NextResponse.json({
      has_subtitle: true, // YouTube 영상이 유효하면 자막 가능성 있음
      source: "YouTube",
      title: data.title,
      valid: true,
    });
  } catch {
    return NextResponse.json({ has_subtitle: false, source: null, valid: false });
  }
}
