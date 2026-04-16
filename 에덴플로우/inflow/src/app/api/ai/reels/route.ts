import { NextRequest, NextResponse } from "next/server";
import openai from "@/lib/openai";
import type { ReelsPlanInput } from "@/types/ai";

export async function POST(req: NextRequest) {
  const body: ReelsPlanInput = await req.json();

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "당신은 인스타그램 릴스 기획 전문가입니다. 반드시 JSON 형식으로만 응답하세요.",
      },
      {
        role: "user",
        content: `직업: ${body.job}\n타겟층: ${body.target}\n주제: ${body.topic}\n톤앤매너: ${body.tone}\n특별요청: ${body.request}\n\n아래 JSON 형식으로 릴스 기획안을 작성해주세요:\n{"hooks":["후킹멘트1","후킹멘트2","후킹멘트3","후킹멘트4","후킹멘트5"],"caption":"릴스 캡션 텍스트","storyboard":[{"scene":"후크","script":"대사","shootingGuide":{"angle":"구도","lighting":"조명","props":"소품","action":"행동"}},{"scene":"본문1","script":"대사","shootingGuide":{"angle":"구도","lighting":"조명","props":"소품","action":"행동"}},{"scene":"본문2","script":"대사","shootingGuide":{"angle":"구도","lighting":"조명","props":"소품","action":"행동"}},{"scene":"본문3","script":"대사","shootingGuide":{"angle":"구도","lighting":"조명","props":"소품","action":"행동"}},{"scene":"행동유도","script":"대사","shootingGuide":{"angle":"구도","lighting":"조명","props":"소품","action":"행동"}}]}`,
      },
    ],
    response_format: { type: "json_object" },
    max_tokens: 2000,
  });

  const raw = completion.choices[0].message.content ?? "{}";
  return NextResponse.json(JSON.parse(raw));
}
