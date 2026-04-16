import { NextRequest, NextResponse } from "next/server";
import openai from "@/lib/openai";
import type { ProfileInput } from "@/types/ai";

export async function POST(req: NextRequest) {
  const body: ProfileInput = await req.json();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "당신은 인스타그램 프로필 최적화 전문가입니다. 반드시 JSON 형식으로만 응답하세요.",
      },
      {
        role: "user",
        content: `닉네임: ${body.nickname}\n분야: ${body.field}\n운영목적: ${body.purpose}\n타겟층: ${body.target}\n\n인스타그램 바이오(150자 이내)와 추천 키워드 5개를 JSON으로 작성:\n{"bio":"소개글","keywords":["키워드1","키워드2","키워드3","키워드4","키워드5"]}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 500,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  return NextResponse.json(JSON.parse(raw));
}
