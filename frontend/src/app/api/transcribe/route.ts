import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

function extractSrt(text: string) {
  if (text.includes("```srt")) {
    return text.split("```srt")[1].split("```")[0].trim();
  }
  if (text.includes("```")) {
    return text.split("```")[1].split("```")[0].trim();
  }
  return text.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { youtubeUrl } = body;

    if (!youtubeUrl) {
      return NextResponse.json({ error: "YouTube URL이 필요합니다." }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `다음 YouTube 영상 URL의 대화/나레이션 내용을 SRT 자막 형식으로 정리해주세요: ${youtubeUrl}

반드시 아래 형식의 SRT만 출력하세요. 설명, 머리말, 코드 블록 언어 설명은 넣지 마세요.

1
00:00:00,000 --> 00:00:03,000
첫 번째 자막

2
00:00:03,000 --> 00:00:06,000
두 번째 자막

규칙:
- 자막 번호, 타임코드, 자막 텍스트만 출력
- 한국어로 작성
- 문장 단위로 자연스럽게 끊기
- 영상 내용을 모르면 추측하지 말고 최대한 확인 가능한 범위만 작성`;

    const result = await model.generateContent(prompt);
    const srt = extractSrt(result.response.text());

    if (!srt) {
      return NextResponse.json(
        { error: "AI가 자막을 생성하지 못했습니다. SRT를 직접 붙여넣어 주세요." },
        { status: 502 }
      );
    }

    return NextResponse.json({ srt, source: "gemini" });
  } catch (error) {
    console.error("Transcribe error:", error);

    const message = String(error);
    const isRateLimited = message.includes("429") || message.includes("Resource exhausted");

    return NextResponse.json(
      {
        error: isRateLimited
          ? "현재 자동 자막 생성 요청이 많습니다. 잠시 후 다시 시도하거나 SRT를 직접 붙여넣어 주세요."
          : "자막 생성 중 오류가 발생했습니다. SRT를 직접 붙여넣어 주세요.",
        detail: message,
      },
      { status: isRateLimited ? 429 : 500 }
    );
  }
}
