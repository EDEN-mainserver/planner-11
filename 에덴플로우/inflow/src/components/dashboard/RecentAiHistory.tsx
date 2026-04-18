'use client'
import Link from 'next/link'
import { useHistoryStore } from '@/store/historyStore'
export default function RecentAiHistory() {
  const { items } = useHistoryStore()
  return (
    <div className="bg-white rounded-3xl lg:rounded-[3rem] p-6 lg:p-10 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-black text-slate-800">⭐ 최근 AI기획 사용내역</h2>
        <Link href="/ai/history" className="text-xs text-indigo-600 font-semibold hover:underline">전체 기획내역 확인 &gt;</Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-400">데이터가 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0,3).map(item=>(
            <li key={item.id} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition">
              <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{item.type}</span>
              <span className="text-sm text-slate-700 truncate">{item.title}</span>
              <span className="text-xs text-slate-400 ml-auto whitespace-nowrap">{item.createdAt}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
