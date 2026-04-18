interface Props { value: string; onChange: (v:string)=>void; placeholder?: string }
export default function SearchInput({ value, onChange, placeholder='검색...' }: Props) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
      <input type="text" value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
    </div>
  )
}
