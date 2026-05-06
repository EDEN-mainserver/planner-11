import { NextRequest, NextResponse } from 'next/server'
import { callOpenAI } from '@/lib/openai'
export async function POST(req: NextRequest) {
  const body = await req.json()
  const prompt = `당신은 인스타그램 성장 전문가입니다. 다음 정보를 바탕으로 맞춤 인스타그램 방향성 리포트를 작성해주세요.\n\n분야: ${body.field}\n현재 팔로워: ${body.followers}\n운영 목적: ${body.purpose}\n타겟층: ${body.target}\n\n아래 항목을 포함해 구체적으로 작성해주세요:\n1. 계정 포지셔닝 전략\n2. 콘텐츠 방향성\n3. 차별화 포인트\n4. 단기/장기 목표 설정\n5. 주의사항`
  const result = await callOpenAI(prompt)
  return NextResponse.json({ result })
}
