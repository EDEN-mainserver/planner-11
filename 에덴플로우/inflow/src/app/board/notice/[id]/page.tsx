'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
const NOTICES: Record<string,{title:string;date:string;important:boolean;content:string}> = {
  '1':{title:'[필독] 에덴플로우에 오신 것을 환영합니다',date:'2024.01.10',important:true,
    content:`안녕하세요, 에덴플로우입니다.\n\n에덴플로우는 AI 기술을 활용하여 인스타그램 크리에이터의 성장을 돕는 서비스입니다.\n\n주요 기능:\n• AI 방향성 기획\n• AI 이름 추천\n• AI 프로필 세팅\n• AI 릴스 기획\n• 릴스 모음\n\n감사합니다.\n에덴플로우 팀 드림`},
  '2':{title:'전기공사로 인한 일시적 사이트 접속 장애 안내',date:'2024.01.08',important:false,
    content:`안녕하세요, 에덴플로우입니다.\n\n전기공사로 인해 일시적으로 사이트 접속이 원활하지 않을 수 있습니다.\n\n작업 일정: 2024년 1월 9일 오전 2시 ~ 6시\n영향 범위: 전체 서비스 일시 중단\n\n이용에 불편을 드려 죄송합니다.`},
  '3':{title:'AI 기능 업데이트 안내',date:'2024.01.05',important:false,
    content:`AI 릴스 기획 기능이 개선되었습니다.\n\n- 스토리보드 씬 구성 개선\n- 해시태그 추천 기능 추가\n- 응답 속도 향상`},
  '4':{title:'[필독] 서비스 이용약관 변경 안내',date:'2023.12.28',important:true,
    content:`서비스 이용약관이 변경되었습니다.\n\n주요 변경사항:\n1. 개인정보 처리 방침 업데이트\n2. 서비스 이용 조건 명확화\n\n2024년 1월 1일부터 적용됩니다.`},
  '5':{title:'연말 이벤트 안내',date:'2023.12.20',important:false,
    content:`연말을 맞이하여 무료 플랜 혜택이 확대됩니다.\n\n기간: 2023년 12월 25일 ~ 31일\n혜택: AI 기획 횟수 +3회 추가 제공`},
}
export default function NoticeDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const notice = NOTICES[id]
  if (!notice) return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0 px-4 py-8 text-center">
        <p className="text-slate-400">공지사항을 찾을 수 없습니다.</p>
        <Link href="/board/notice" className="text-indigo-600 text-sm mt-4 inline-block">← 목록으로</Link>
      </div>
    </div>
  )
  return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0 px-4 lg:px-8 py-8 max-w-4xl mx-auto">
        <Link href="/board/notice" className="text-sm text-slate-400 hover:text-indigo-600 transition mb-6 inline-block">← 목록으로</Link>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 lg:p-10">
          <div className="flex items-center gap-2 mb-3">
            {notice.important && <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">필독</span>}
            <span className="text-sm text-slate-400">{notice.date}</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-800 mb-8">{notice.title}</h1>
          <div className="border-t border-slate-100 pt-8">
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{notice.content}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
