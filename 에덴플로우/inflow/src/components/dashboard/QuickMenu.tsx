import Link from 'next/link'
const MENUS = [
  { href:'/engagement', icon:'📊', label:'계정진단', desc:'나의 계정을 분석해 보세요' },
  { href:'/ai/reelsPlanning', icon:'🎬', label:'릴스기획', desc:'AI로 릴스 스토리보드를 만들어요' },
  { href:'/findReels', icon:'▶', label:'릴스모음', desc:'벤치마킹 릴스를 찾아보세요' },
  { href:'https://www.helpu.kr/agcglobal', icon:'❓', label:'사용방법', desc:'서비스 이용 가이드', external:true },
]
export default function QuickMenu() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {MENUS.map(m=>(
        m.external ? (
          <a key={m.href} href={m.href} target="_blank" rel="noopener noreferrer"
            className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition cursor-pointer">
            <span className="text-2xl block mb-2">{m.icon}</span>
            <p className="font-bold text-slate-800 text-sm">{m.label}</p>
            <p className="text-xs text-slate-400 mt-1">{m.desc}</p>
          </a>
        ) : (
          <Link key={m.href} href={m.href}
            className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition">
            <span className="text-2xl block mb-2">{m.icon}</span>
            <p className="font-bold text-slate-800 text-sm">{m.label}</p>
            <p className="text-xs text-slate-400 mt-1">{m.desc}</p>
          </Link>
        )
      ))}
    </div>
  )
}
