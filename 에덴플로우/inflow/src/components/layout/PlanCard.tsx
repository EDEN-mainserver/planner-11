'use client'
import { useAuthStore } from '@/store/authStore'
export default function PlanCard() {
  const { user } = useAuthStore()
  return (
    <div className="bg-white rounded-[2.5rem] p-7 border border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] w-64 mx-auto max-h-[90vh] flex flex-col">
      <div className="mb-6">
        <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mb-1">나의 플랜</p>
        <p className="text-2xl font-black text-slate-800">{user?.plan ?? 'FREE'}</p>
      </div>
      <div className="space-y-3 flex-1">
        {[
          { label:'방향성 기획', used:0, total:1 },
          { label:'이름 추천', used:0, total:1 },
          { label:'프로필 세팅', used:0, total:1 },
          { label:'릴스 기획', used:0, total:1 },
        ].map(item=>(
          <div key={item.label}>
            <div className="flex justify-between text-xs text-slate-500 mb-1">
              <span>{item.label}</span>
              <span>{item.used}/{item.total}</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-600 rounded-full transition-all"
                style={{ width: `${(item.used/item.total)*100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <button className="mt-6 w-full py-2.5 rounded-2xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition">
        플랜 업그레이드
      </button>
    </div>
  )
}
