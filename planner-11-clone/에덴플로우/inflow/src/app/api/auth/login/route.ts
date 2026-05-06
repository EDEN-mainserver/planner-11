import { NextRequest, NextResponse } from 'next/server'
export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (!username || !password) return NextResponse.json({ message: '아이디와 비밀번호를 입력하세요.' }, { status: 400 })
  const user = { id:'1', username, name:'정지한', email:'EDEN@teamedenmarketing.com', plan:'FREE', createdAt:'2024-01-01' }
  return NextResponse.json({ user })
}
