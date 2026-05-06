import Link from 'next/link'
const NOTICES = [
  { id:1, title:'[필독] 에덴플로우에 오신 것을 환영합니다', important:true },
  { id:2, title:'전기공사로 인한 일시적 사이트 접속 장애 안내', important:false },
]
export default function RecentNotice() {
  return (
    <div className="bg-white rounded-3xl lg:rounded-[3rem] p-6 lg:p-10 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-black text-slate-800">🔔 공지사항</h2>
        <Link href="/board/notice" className="text-xs text-indigo-600 font-semibold hover:underline">전체 공지사항 확인 &gt;</Link>
      </div>
      <ul className="space-y-2">
        {NOTICES.map(n=>(
          <li key={n.id}>
            <Link href={`/board/notice/${n.id}`} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 transition">
              {n.important && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">필독</span>}
              <span className="text-sm text-slate-600 truncate">{n.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
