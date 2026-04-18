import { NextRequest, NextResponse } from 'next/server'
import { callOpenAI } from '@/lib/openai'
export async function POST(req: NextRequest) {
  const body = await req.json()
  const prompt = `당신은 인스타그램 릴스 기획 전문가입니다. 다음 정보를 바탕으로 릴스 스토리보드를 JSON 형식으로 작성해주세요.\n\n주제: ${body.topic}\n타겟: ${body.target}\n길이: ${body.duration}\n톤/분위기: ${body.tone}\n강조 포인트: ${body.point}\n\n반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):\n{\n  "title": "릴스 제목",\n  "hook": "첫 3초 훅 문구",\n  "scenes": [\n    {"scene": 1, "duration": "0-5초", "visual": "화면 묘사", "caption": "자막/나레이션", "bgm": "배경음악 추천"},\n    {"scene": 2, "duration": "5-15초", "visual": "화면 묘사", "caption": "자막/나레이션", "bgm": "배경음악 추천"},\n    {"scene": 3, "duration": "15-25초", "visual": "화면 묘사", "caption": "자막/나레이션", "bgm": "배경음악 추천"},\n    {"scene": 4, "duration": "25-30초", "visual": "화면 묘사", "caption": "자막/나레이션", "bgm": "배경음악 추천"}\n  ],\n  "cta": "CTA 문구",\n  "hashtags": ["#해시태그1", "#해시태그2", "#해시태그3", "#해시태그4", "#해시태그5"]\n}`
  const raw = await callOpenAI(prompt)
  let result
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    result = match ? JSON.parse(match[0]) : { title: body.topic, hook: '주목을 끄는 첫 장면', scenes: [], cta: '팔로우하고 더 많은 콘텐츠를 받아보세요!', hashtags: [] }
  } catch {
    result = { title: body.topic, hook: raw.slice(0,100), scenes: [], cta: '', hashtags: [] }
  }
  return NextResponse.json({ result })
}
