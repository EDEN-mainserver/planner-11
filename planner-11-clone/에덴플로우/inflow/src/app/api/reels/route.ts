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
