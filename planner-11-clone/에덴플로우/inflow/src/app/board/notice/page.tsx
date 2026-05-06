'use client'
import Link from 'next/link'
const NOTICES = [
  { id:1, title:'[필독] 에덴플로우에 오신 것을 환영합니다', date:'2024.01.10', important:true, views:1234 },
  { id:2, title:'전기공사로 인한 일시적 사이트 접속 장애 안내', date:'2024.01.08', important:false, views:456 },
  { id:3, title:'AI 기능 업데이트 안내 - 릴스 기획 기능 개선', date:'2024.01.05', important:false, views:789 },
  { id:4, title:'[필독] 서비스 이용약관 변경 안내', date:'2023.12.28', important:true, views:2341 },
  { id:5, title:'연말 이벤트 안내 - 무료 플랜 혜택 확대', date:'2023.12.20', important:false, views:567 },
]
export default function NoticePage() {
  return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0 px-4 lg:px-8 py-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 mb-1">공지사항</h1>
          <p className="text-sm text-slate-400">서비스 관련 공지사항을 확인하세요</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest w-16">번호</th>
                <th className="text-left px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">제목</th>
                <th className="text-left px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest w-28 hidden md:table-cell">날짜</th>
                <th className="text-left px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest w-20 hidden md:table-cell">조회수</th>
              </tr>
            </thead>
            <tbody>
              {NOTICES.map((notice,i)=>(
                <tr key={notice.id} className="border-b border-slate-50 hover:bg-slate-50 transition">
                  <td className="px-6 py-4 text-sm text-slate-400">{i+1}</td>
                  <td className="px-6 py-4">
                    <Link href={`/board/notice/${notice.id}`} className="flex items-center gap-2 hover:text-indigo-600 transition">
                      {notice.important && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">필독</span>}
                      <span className={`text-sm ${notice.important?'font-bold text-slate-800':'text-slate-600'}`}>{notice.title}</span>
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400 hidden md:table-cell">{notice.date}</td>
                  <td className="px-6 py-4 text-sm text-slate-400 hidden md:table-cell">{notice.views.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
