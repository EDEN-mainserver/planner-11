import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { youtubeUrl } = body;

    if (!youtubeUrl) {
      return NextResponse.json({ error: "YouTube URL이 필요합니다." }, { status: 400 });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `다음 YouTube 영상의 URL을 분석해주세요: ${youtubeUrl}

이 영상의 전체 대화/나레이션 내용을 SRT 자막 형식으로 변환해주세요.
반드시 아래 SRT 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:

1
00:00:00,000 --> 00:00:03,000
첫 번째 자막

2
00:00:03,000 --> 00:00:06,000
두 번째 자막

규칙:
- 자연스러운 문장 단위로 끊어주세요
- 타임스탬프는 실제 대화 흐름에 맞게 배치해주세요
- 한국어로 작성해주세요
- 최대한 많은 내용을 포함해주세요`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // 코드 블록 제거
    if (text.includes("```srt")) {
      text = text.split("```srt")[1].split("```")[0].trim();
    } else if (text.includes("```")) {
      text = text.split("```")[1].split("```")[0].trim();
    }

    return NextResponse.json({ srt: text });
  } catch (error) {
    console.error("Transcribe error:", error);
    return NextResponse.json(
      { error: "자막 생성 중 오류가 발생했습니다.", detail: String(error) },
      { status: 500 }
    );
  }
}
