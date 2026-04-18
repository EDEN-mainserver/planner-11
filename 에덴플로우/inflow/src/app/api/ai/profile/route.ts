import { NextRequest, NextResponse } from 'next/server'
import { callOpenAI } from '@/lib/openai'
export async function POST(req: NextRequest) {
  const body = await req.json()
  const prompt = `당신은 인스타그램 프로필 최적화 전문가입니다. 다음 정보를 바탕으로 최적화된 인스타그램 프로필 가이드를 작성해주세요.\n\n닉네임: ${body.nickname}\n분야: ${body.field}\n운영 목적: ${body.purpose}\n타겟층: ${body.target}\n\n아래 항목을 포함해 작성해주세요:\n1. 최적화된 닉네임 제안 (3가지)\n2. 프로필 소개글 예시 (3가지)\n3. 링크 활용 전략\n4. 프로필 사진 방향성\n5. 하이라이트 구성 추천`
  const result = await callOpenAI(prompt)
  return NextResponse.json({ result })
}
