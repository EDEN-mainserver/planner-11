import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { subtitleText, numClips = 5, customPrompt = "", clipDuration = 60 } = body;

    if (!subtitleText) {
      return NextResponse.json({ error: "자막 텍스트가 필요합니다." }, { status: 400 });
    }

    const systemPrompt = `당신은 숏폼 영상 전문 편집자입니다.
긴 영상의 자막을 분석하여, 숏폼(${clipDuration}초 이내)으로 만들기 좋은 구간을 추천해야 합니다.

추천 기준:
1. 독립적으로 의미가 통하는 완결된 이야기/주제
2. 강한 감정(웃김, 놀라움, 감동, 공감)을 유발하는 구간
3. 핵심 정보나 인사이트가 담긴 구간
4. 논쟁적이거나 호기심을 자극하는 발언
5. 시작과 끝이 자연스러운 구간

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
[
  {
    "title": "클립 제목 (숏폼 제목으로 적합한)",
    "start_time": "HH:MM:SS,mmm",
    "end_time": "HH:MM:SS,mmm",
    "reason": "선정 이유 (한 줄)",
    "hook": "추천 훅 멘트 (시청자를 끌어들일 첫 문장)",
    "virality_score": 8,
    "category": "funny|insight|emotional|controversial|informative"
  }
]`;

    const userMessage = `다음 자막에서 숏폼으로 만들기 좋은 구간을 ${numClips}개 추천해주세요.
${customPrompt ? `추가 요청: ${customPrompt}` : ""}

자막:
${subtitleText}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    let text = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    if (text.includes("```json")) {
      text = text.split("```json")[1].split("```")[0].trim();
    } else if (text.includes("```")) {
      text = text.split("```")[1].split("```")[0].trim();
    }

    const clips = JSON.parse(text);
    return NextResponse.json({ clips });
  } catch (error) {
    console.error("Analyze error:", error);
    return NextResponse.json(
      { error: "AI 분석 중 오류가 발생했습니다.", detail: String(error) },
      { status: 500 }
    );
  }
}
