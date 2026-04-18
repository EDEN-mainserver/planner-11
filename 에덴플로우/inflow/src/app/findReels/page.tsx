'use client'
import { useState } from 'react'
const CATEGORIES = ['전체','음식','뷰티','여행','라이프','피트니스','교육','패션','반려동물','방송','비즈니스','기타']
const MOCK_REELS = Array.from({length:20},(_,i)=>({
  id:i+1,
  thumbnail:`https://picsum.photos/seed/${i+20}/300/500`,
  category:CATEGORIES[(i%11)+1],
  views:`${((i+1)*3.7).toFixed(1)}만`,
}))
export default function FindReelsPage() {
  const [activeCategory, setActiveCategory] = useState('전체')
  const [search, setSearch] = useState('')
  const filtered = MOCK_REELS.filter(r=>{
    const matchCat = activeCategory==='전체' || r.category===activeCategory
    const matchSearch = search==='' || r.category.includes(search)
    return matchCat && matchSearch
  })
  return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0 px-4 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 mb-1">릴스 모음</h1>
          <p className="text-sm text-slate-400">벤치마킹할 릴스를 찾아보세요</p>
        </div>
        <input type="text" placeholder="카테고리 검색..." value={search}
          onChange={e=>setSearch(e.target.value)}
          className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-4" />
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {CATEGORIES.map(cat=>(
            <button key={cat} onClick={()=>setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
                activeCategory===cat?'bg-indigo-600 text-white shadow-md shadow-indigo-100':'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
              }`}>{cat}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {filtered.map(reel=>(
            <div key={reel.id} className="relative group cursor-pointer">
              <div className="aspect-[9/16] bg-slate-200 rounded-2xl overflow-hidden">
                <img src={reel.thumbnail} alt={`릴스 ${reel.id}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition" />
                <div className="absolute bottom-0 left-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition">
                  <p className="text-white text-xs font-semibold">▶ {reel.views}</p>
                </div>
              </div>
              <span className="absolute top-2 left-2 bg-white/90 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {reel.category}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
