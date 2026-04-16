import { NextRequest, NextResponse } from "next/server";
import openai from "@/lib/openai";
import type { NameInput } from "@/types/ai";

export async function POST(req: NextRequest) {
  const body: NameInput = await req.json();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "당신은 인스타그램 닉네임 전문 작명가입니다. 사용자의 키워드를 분석해 기억하기 쉽고 독창적인 인스타그램 닉네임 7개를 추천해주세요. 반드시 JSON 형식으로만 응답하세요.",
      },
      {
        role: "user",
        content: `키워드: ${body.keywords}\n\n아래 JSON 형식으로 닉네임 7개를 추천해주세요:\n{"names":[{"number":1,"name":"닉네임","description":"한 줄 설명"},...]}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 800,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  return NextResponse.json(JSON.parse(raw));
}
