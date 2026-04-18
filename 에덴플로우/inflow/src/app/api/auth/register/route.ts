import { NextRequest, NextResponse } from 'next/server'
export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.username || !body.password || !body.name || !body.email) {
    return NextResponse.json({ message: '필수 항목을 입력하세요.' }, { status: 400 })
  }
  return NextResponse.json({ message: '회원가입이 완료되었습니다.' })
}
