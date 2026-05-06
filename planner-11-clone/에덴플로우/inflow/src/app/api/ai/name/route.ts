import { NextRequest, NextResponse } from 'next/server'
import { callOpenAI } from '@/lib/openai'
export async function POST(req: NextRequest) {
  const body = await req.json()
  const prompt = `당신은 인스타그램 브랜딩 전문가입니다. 다음 조건에 맞는 인스타그램 계정 이름을 10개 추천해주세요.\n\n분야: ${body.field}\n타겟층: ${body.target}\n원하는 분위기: ${body.mood}\n\n각 이름에 대해 추천 이유와 함께 설명해주세요.`
  const result = await callOpenAI(prompt)
  return NextResponse.json({ result })
}
