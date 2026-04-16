import { NextRequest, NextResponse } from "next/server";
import openai from "@/lib/openai";
import type { DirectionInput } from "@/types/ai";

export async function POST(req: NextRequest) {
  const body: DirectionInput = await req.json();
  const { nickname, topic, purpose, experience } = body;

  const expLabel = { beginner: "초보자", intermediate: "경험자", advanced: "운영 중인 크리에이터" }[experience];

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "당신은 인스타그램 성장 전략 전문가입니다. 사용자의 정보를 바탕으로 맞춤형 계정 방향성 리포트를 작성해주세요. 마크다운 형식으로 작성하고, 실용적이고 구체적인 조언을 제공하세요.",
      },
      {
        role: "user",
        content: `닉네임: ${nickname}\n관심 주제: ${topic}\n운영 목적: ${purpose}\n인스타 경험: ${expLabel}\n\n위 정보를 바탕으로 인스타그램 계정 방향성 리포트를 작성해주세요.`,
      },
    ],
    max_tokens: 1500,
  });

  const result = completion.choices[0].message.content ?? "";
  return NextResponse.json({ result });
}
