interface Props { page: number; total: number; onChange: (p:number)=>void }
export default function Pagination({ page, total, onChange }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button onClick={()=>onChange(page-1)} disabled={page<=1}
        className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-30 hover:border-indigo-300 transition">
        이전
      </button>
      {Array.from({length:total},(_,i)=>i+1).map(p=>(
        <button key={p} onClick={()=>onChange(p)}
          className={`w-8 h-8 rounded-xl text-sm font-semibold transition ${p===page?'bg-indigo-600 text-white':'text-slate-600 hover:bg-slate-100'}`}>
          {p}
        </button>
      ))}
      <button onClick={()=>onChange(page+1)} disabled={page>=total}
        className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-30 hover:border-indigo-300 transition">
        다음
      </button>
    </div>
  )
}
