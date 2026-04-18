'use client'
import { useState } from 'react'
import { useHistoryStore } from '@/store/historyStore'
const TABS = ['전체','방향성','이름','프로필','릴스기획']
export default function HistoryPage() {
  const { items } = useHistoryStore()
  const [activeTab, setActiveTab] = useState('전체')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<typeof items[0]|null>(null)
  const filtered = items.filter(h=>{
    const matchTab = activeTab==='전체' || h.type===activeTab
    const matchSearch = h.title.includes(search) || h.result.includes(search)
    return matchTab && matchSearch
  })
  return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0 px-4 lg:px-8 py-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 mb-1">AI기획 보관함</h1>
          <p className="text-sm text-slate-400">생성된 AI 기획 내역을 확인하세요</p>
        </div>
        <input type="text" placeholder="기획 내역 검색..." value={search}
          onChange={e=>setSearch(e.target.value)}
          className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4" />
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TABS.map(tab=>(
            <button key={tab} onClick={()=>setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                activeTab===tab?'bg-indigo-600 text-white shadow-md shadow-indigo-100':'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
              }`}>{tab}</button>
          ))}
        </div>
        {filtered.length===0 ? (
          <div className="text-center py-20 text-slate-400">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm">기획 내역이 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map(h=>(
              <div key={h.id} onClick={()=>setSelected(h)}
                className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md hover:border-indigo-200 transition cursor-pointer">
                <div className="flex items-center gap-2 mb-3">
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{h.type}</span>
                  <span className="text-xs text-slate-400 ml-auto">{h.createdAt}</span>
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{h.title}</h3>
                <p className="text-xs text-slate-500 line-clamp-2">{h.result}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      {selected && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={()=>setSelected(null)}>
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{selected.type}</span>
              <span className="text-xs text-slate-400 ml-auto">{selected.createdAt}</span>
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-4">{selected.title}</h3>
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{selected.result}</p>
            <button onClick={()=>setSelected(null)}
              className="mt-6 w-full py-3 rounded-2xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 transition">
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
