interface Props { tabs: string[]; active: string; onChange: (t:string)=>void }
export default function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map(tab=>(
        <button key={tab} onClick={()=>onChange(tab)}
          className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
            active===tab ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
            : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
          }`}>
          {tab}
        </button>
      ))}
    </div>
  )
}
