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
