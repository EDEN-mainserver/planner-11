#!/bin/bash
BASE="/Users/jeongjihan/Desktop/planner-11/에덴플로우/inflow"
SRC="$BASE/src"
echo "🚀 파트 D 시작..."

mkdir -p "$SRC/app/api/ai/profile"
cat > "$SRC/app/api/ai/profile/route.ts" << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { callOpenAI } from '@/lib/openai'
export async function POST(req: NextRequest) {
  const body = await req.json()
  const prompt = `당신은 인스타그램 프로필 최적화 전문가입니다. 다음 정보를 바탕으로 최적화된 인스타그램 프로필 가이드를 작성해주세요.\n\n닉네임: ${body.nickname}\n분야: ${body.field}\n운영 목적: ${body.purpose}\n타겟층: ${body.target}\n\n아래 항목을 포함해 작성해주세요:\n1. 최적화된 닉네임 제안 (3가지)\n2. 프로필 소개글 예시 (3가지)\n3. 링크 활용 전략\n4. 프로필 사진 방향성\n5. 하이라이트 구성 추천`
  const result = await callOpenAI(prompt)
  return NextResponse.json({ result })
}
EOF

mkdir -p "$SRC/app/api/ai/reels"
cat > "$SRC/app/api/ai/reels/route.ts" << 'EOF'
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
EOF

mkdir -p "$SRC/app/api/history"
cat > "$SRC/app/api/history/route.ts" << 'EOF'
import { NextResponse } from 'next/server'
export async function GET() {
  return NextResponse.json({ items: [] })
}
EOF

mkdir -p "$SRC/app/api/reels"
cat > "$SRC/app/api/reels/route.ts" << 'EOF'
import { NextResponse } from 'next/server'
const REELS = Array.from({length:20},(_,i)=>({
  id: String(i+1),
  title: `릴스 ${i+1}`,
  category: ['음식','뷰티','여행','라이프','피트니스','교육','패션','반려동물','방송','비즈니스','기타'][i%11],
  thumbnail: `https://picsum.photos/seed/${i+20}/300/500`,
  views: `${((i+1)*3.7).toFixed(1)}만`,
}))
export async function GET() {
  return NextResponse.json({ reels: REELS })
}
EOF

mkdir -p "$SRC/app/api/notice"
cat > "$SRC/app/api/notice/route.ts" << 'EOF'
import { NextResponse } from 'next/server'
const NOTICES = [
  { id:'1', title:'[필독] 에덴플로우에 오신 것을 환영합니다', important:true, views:1234, createdAt:'2024.01.10' },
  { id:'2', title:'전기공사로 인한 일시적 사이트 접속 장애 안내', important:false, views:456, createdAt:'2024.01.08' },
  { id:'3', title:'AI 기능 업데이트 안내', important:false, views:789, createdAt:'2024.01.05' },
  { id:'4', title:'[필독] 서비스 이용약관 변경 안내', important:true, views:2341, createdAt:'2023.12.28' },
  { id:'5', title:'연말 이벤트 안내', important:false, views:567, createdAt:'2023.12.20' },
]
export async function GET() {
  return NextResponse.json({ notices: NOTICES })
}
EOF

cat > "$BASE/next.config.mjs" << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol:'https', hostname:'picsum.photos' }],
  },
}
export default nextConfig
EOF

if [ ! -f "$BASE/.env.local" ]; then
cat > "$BASE/.env.local" << 'EOF'
OPENAI_API_KEY=your_openai_api_key_here
EOF
fi

cd "$BASE"
if ! grep -q '"zustand"' package.json 2>/dev/null; then
  echo "📦 zustand 설치 중..."
  npm install zustand
fi

echo ""
echo "✅ 파트 D 완료! 모든 파일 생성 끝!"
echo ""
echo "📋 다음 단계:"
echo "1. npm run dev 로 서버 실행"
echo "2. localhost:3000 접속"
echo "3. AI 기능 사용 시 .env.local 에 OpenAI API 키 입력"
