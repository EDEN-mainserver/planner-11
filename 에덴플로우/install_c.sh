#!/bin/bash
BASE="/Users/jeongjihan/Desktop/planner-11/에덴플로우/inflow"
SRC="$BASE/src"
echo "🚀 파트 C 시작..."

mkdir -p "$SRC/app/ai/profile"
cat > "$SRC/app/ai/profile/page.tsx" << 'EOF'
'use client'
import { useState } from 'react'
import AiPageHero from '@/components/ai/AiPageHero'
import AiStartButton from '@/components/ai/AiStartButton'
const STEPS = [
  { title: '닉네임을 입력하세요', placeholder: '예) 맛집탐험가_지한', key: 'nickname' },
  { title: '어떤 분야인가요?', placeholder: '예) 음식/맛집, 뷰티, 여행', key: 'field' },
  { title: '운영 목적은 무엇인가요?', placeholder: '예) 퍼스널 브랜딩, 수익 창출', key: 'purpose' },
  { title: '타겟층은 누구인가요?', placeholder: '예) 20-30대 직장인', key: 'target' },
]
export default function ProfilePage() {
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string|null>(null)
  const handleNext = async () => {
    if (step < STEPS.length - 1) { setStep(step+1); return }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/profile', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(values),
      })
      const data = await res.json()
      setResult(data.result)
    } catch { setResult('오류가 발생했습니다.') }
    finally { setLoading(false) }
  }
  if (!started) return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0">
        <AiPageHero emoji="👤" badge="AI 프로필 세팅"
          title={<>나만의 인스타그램 프로필을<br />AI가 최적화해 드려요</>}
          description="닉네임, 분야, 목적, 타겟을 입력하면 맞춤 프로필 가이드를 생성합니다."
          previewText="나의 인스타그램 프로필 가이드가 여기에 표시됩니다..." />
        <div className="px-6 pb-10 max-w-2xl mx-auto">
          <AiStartButton onClick={()=>setStarted(true)} />
          <p className="text-center text-xs text-slate-400 mt-3">나의 플랜 FREE</p>
        </div>
      </div>
    </div>
  )
  if (result) return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0 px-6 py-10 max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <div className="flex items-center gap-2 mb-6">
            <span className="text-2xl">👤</span>
            <h2 className="text-xl font-bold text-slate-800">프로필 세팅 결과</h2>
          </div>
          <div className="whitespace-pre-wrap text-slate-700 leading-relaxed text-sm">{result}</div>
          <button onClick={()=>{setStarted(false);setStep(0);setValues({});setResult(null)}}
            className="mt-8 w-full py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition">
            다시 시작하기
          </button>
        </div>
      </div>
    </div>
  )
  const current = STEPS[step]
  return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0 px-6 py-10 max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="flex gap-1 mb-4">
            {STEPS.map((_,i)=>(
              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i<=step?'bg-indigo-600':'bg-slate-200'}`} />
            ))}
          </div>
          <p className="text-xs text-slate-400 mb-1">{step+1} / {STEPS.length}</p>
          <h2 className="text-2xl font-bold text-slate-800">{current.title}</h2>
        </div>
        <textarea className="w-full border border-slate-200 rounded-2xl p-4 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[120px]"
          placeholder={current.placeholder}
          value={values[current.key]||''}
          onChange={e=>setValues({...values,[current.key]:e.target.value})} />
        <button onClick={handleNext} disabled={!values[current.key]?.trim()||loading}
          className="mt-4 w-full py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition disabled:opacity-40">
          {loading?'생성 중...':step<STEPS.length-1?'다음 →':'AI 프로필 생성하기 →'}
        </button>
      </div>
    </div>
  )
}
EOF

mkdir -p "$SRC/app/ai/reelsPlanning"
cat > "$SRC/app/ai/reelsPlanning/page.tsx" << 'EOF'
'use client'
import { useState } from 'react'
import AiPageHero from '@/components/ai/AiPageHero'
import AiStartButton from '@/components/ai/AiStartButton'
const STEPS = [
  { title: '어떤 주제의 릴스인가요?', placeholder: '예) 서울 숨은 맛집 5곳', key: 'topic' },
  { title: '타겟 시청자는 누구인가요?', placeholder: '예) 20대 음식 좋아하는 사람들', key: 'target' },
  { title: '릴스 길이는 얼마나 할까요?', placeholder: '예) 30초, 60초, 90초', key: 'duration' },
  { title: '원하는 분위기/톤은 어떤가요?', placeholder: '예) 감성적, 유머러스, 정보전달형', key: 'tone' },
  { title: '특별히 강조할 포인트가 있나요?', placeholder: '예) 가격대비 맛집, 웨이팅 없는 곳', key: 'point' },
]
interface Scene { scene:number; duration:string; visual:string; caption:string; bgm:string }
interface ReelsResult { title:string; hook:string; scenes:Scene[]; cta:string; hashtags:string[] }
export default function ReelsPlanningPage() {
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ReelsResult|null>(null)
  const handleNext = async () => {
    if (step < STEPS.length - 1) { setStep(step+1); return }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/reels', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(values),
      })
      const data = await res.json()
      setResult(data.result)
    } catch { setResult(null) }
    finally { setLoading(false) }
  }
  if (!started) return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0">
        <AiPageHero emoji="🎬" badge="AI 릴스 기획"
          title={<>AI가 릴스 스토리보드를<br />자동으로 만들어 드려요</>}
          description="주제, 타겟, 분위기를 입력하면 씬별 스토리보드를 생성합니다."
          previewText="릴스 스토리보드가 여기에 표시됩니다..." isScreenshot />
        <div className="px-6 pb-10 max-w-2xl mx-auto">
          <AiStartButton onClick={()=>setStarted(true)} />
          <p className="text-center text-xs text-slate-400 mt-3">나의 플랜 FREE</p>
        </div>
      </div>
    </div>
  )
  if (result) return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0 px-4 lg:px-8 py-10 max-w-3xl mx-auto">
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 lg:p-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🎬</span>
            <h2 className="text-xl font-bold text-slate-800">{result.title}</h2>
          </div>
          <p className="text-sm text-indigo-600 font-semibold mb-6">훅: {result.hook}</p>
          <div className="space-y-4 mb-6">
            {result.scenes?.map(scene=>(
              <div key={scene.scene} className="border border-slate-100 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">씬 {scene.scene}</span>
                  <span className="text-xs text-slate-400">{scene.duration}</span>
                </div>
                <p className="text-sm font-semibold text-slate-700 mb-1">📷 {scene.visual}</p>
                <p className="text-sm text-slate-500 mb-1">💬 {scene.caption}</p>
                <p className="text-xs text-slate-400">🎵 {scene.bgm}</p>
              </div>
            ))}
          </div>
          <div className="bg-indigo-50 rounded-2xl p-4 mb-4">
            <p className="text-sm font-semibold text-indigo-700 mb-1">CTA</p>
            <p className="text-sm text-slate-600">{result.cta}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {result.hashtags?.map((tag,i)=>(
              <span key={i} className="bg-slate-100 text-slate-600 text-xs px-3 py-1 rounded-full">{tag}</span>
            ))}
          </div>
          <button onClick={()=>{setStarted(false);setStep(0);setValues({});setResult(null)}}
            className="mt-8 w-full py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition">
            다시 기획하기
          </button>
        </div>
      </div>
    </div>
  )
  const current = STEPS[step]
  return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0 px-6 py-10 max-w-2xl mx-auto">
        <div className="mb-6">
          <div className="flex gap-1 mb-4">
            {STEPS.map((_,i)=>(
              <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i<=step?'bg-indigo-600':'bg-slate-200'}`} />
            ))}
          </div>
          <p className="text-xs text-slate-400 mb-1">{step+1} / {STEPS.length}</p>
          <h2 className="text-2xl font-bold text-slate-800">{current.title}</h2>
        </div>
        <textarea className="w-full border border-slate-200 rounded-2xl p-4 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[120px]"
          placeholder={current.placeholder}
          value={values[current.key]||''}
          onChange={e=>setValues({...values,[current.key]:e.target.value})} />
        <button onClick={handleNext} disabled={!values[current.key]?.trim()||loading}
          className="mt-4 w-full py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition disabled:opacity-40">
          {loading?'스토리보드 생성 중...':step<STEPS.length-1?'다음 →':'AI 스토리보드 생성하기 →'}
        </button>
      </div>
    </div>
  )
}
EOF

mkdir -p "$SRC/app/ai/history"
cat > "$SRC/app/ai/history/page.tsx" << 'EOF'
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
EOF

mkdir -p "$SRC/app/findReels"
cat > "$SRC/app/findReels/page.tsx" << 'EOF'
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
EOF

mkdir -p "$SRC/app/board/notice"
cat > "$SRC/app/board/notice/page.tsx" << 'EOF'
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
EOF

mkdir -p "$SRC/app/board/notice/[id]"
cat > "$SRC/app/board/notice/[id]/page.tsx" << 'EOF'
'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
const NOTICES: Record<string,{title:string;date:string;important:boolean;content:string}> = {
  '1':{title:'[필독] 에덴플로우에 오신 것을 환영합니다',date:'2024.01.10',important:true,
    content:`안녕하세요, 에덴플로우입니다.\n\n에덴플로우는 AI 기술을 활용하여 인스타그램 크리에이터의 성장을 돕는 서비스입니다.\n\n주요 기능:\n• AI 방향성 기획\n• AI 이름 추천\n• AI 프로필 세팅\n• AI 릴스 기획\n• 릴스 모음\n\n감사합니다.\n에덴플로우 팀 드림`},
  '2':{title:'전기공사로 인한 일시적 사이트 접속 장애 안내',date:'2024.01.08',important:false,
    content:`안녕하세요, 에덴플로우입니다.\n\n전기공사로 인해 일시적으로 사이트 접속이 원활하지 않을 수 있습니다.\n\n작업 일정: 2024년 1월 9일 오전 2시 ~ 6시\n영향 범위: 전체 서비스 일시 중단\n\n이용에 불편을 드려 죄송합니다.`},
  '3':{title:'AI 기능 업데이트 안내',date:'2024.01.05',important:false,
    content:`AI 릴스 기획 기능이 개선되었습니다.\n\n- 스토리보드 씬 구성 개선\n- 해시태그 추천 기능 추가\n- 응답 속도 향상`},
  '4':{title:'[필독] 서비스 이용약관 변경 안내',date:'2023.12.28',important:true,
    content:`서비스 이용약관이 변경되었습니다.\n\n주요 변경사항:\n1. 개인정보 처리 방침 업데이트\n2. 서비스 이용 조건 명확화\n\n2024년 1월 1일부터 적용됩니다.`},
  '5':{title:'연말 이벤트 안내',date:'2023.12.20',important:false,
    content:`연말을 맞이하여 무료 플랜 혜택이 확대됩니다.\n\n기간: 2023년 12월 25일 ~ 31일\n혜택: AI 기획 횟수 +3회 추가 제공`},
}
export default function NoticeDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const notice = NOTICES[id]
  if (!notice) return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0 px-4 py-8 text-center">
        <p className="text-slate-400">공지사항을 찾을 수 없습니다.</p>
        <Link href="/board/notice" className="text-indigo-600 text-sm mt-4 inline-block">← 목록으로</Link>
      </div>
    </div>
  )
  return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0 px-4 lg:px-8 py-8 max-w-4xl mx-auto">
        <Link href="/board/notice" className="text-sm text-slate-400 hover:text-indigo-600 transition mb-6 inline-block">← 목록으로</Link>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 lg:p-10">
          <div className="flex items-center gap-2 mb-3">
            {notice.important && <span className="bg-red-100 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">필독</span>}
            <span className="text-sm text-slate-400">{notice.date}</span>
          </div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-800 mb-8">{notice.title}</h1>
          <div className="border-t border-slate-100 pt-8">
            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{notice.content}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
EOF

mkdir -p "$SRC/app/api/auth/login"
cat > "$SRC/app/api/auth/login/route.ts" << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
export async function POST(req: NextRequest) {
  const { username, password } = await req.json()
  if (!username || !password) return NextResponse.json({ message: '아이디와 비밀번호를 입력하세요.' }, { status: 400 })
  const user = { id:'1', username, name:'정지한', email:'EDEN@teamedenmarketing.com', plan:'FREE', createdAt:'2024-01-01' }
  return NextResponse.json({ user })
}
EOF

mkdir -p "$SRC/app/api/auth/register"
cat > "$SRC/app/api/auth/register/route.ts" << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
export async function POST(req: NextRequest) {
  const body = await req.json()
  if (!body.username || !body.password || !body.name || !body.email) {
    return NextResponse.json({ message: '필수 항목을 입력하세요.' }, { status: 400 })
  }
  return NextResponse.json({ message: '회원가입이 완료되었습니다.' })
}
EOF

mkdir -p "$SRC/app/api/ai/direction"
cat > "$SRC/app/api/ai/direction/route.ts" << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { callOpenAI } from '@/lib/openai'
export async function POST(req: NextRequest) {
  const body = await req.json()
  const prompt = `당신은 인스타그램 성장 전문가입니다. 다음 정보를 바탕으로 맞춤 인스타그램 방향성 리포트를 작성해주세요.\n\n분야: ${body.field}\n현재 팔로워: ${body.followers}\n운영 목적: ${body.purpose}\n타겟층: ${body.target}\n\n아래 항목을 포함해 구체적으로 작성해주세요:\n1. 계정 포지셔닝 전략\n2. 콘텐츠 방향성\n3. 차별화 포인트\n4. 단기/장기 목표 설정\n5. 주의사항`
  const result = await callOpenAI(prompt)
  return NextResponse.json({ result })
}
EOF

mkdir -p "$SRC/app/api/ai/name"
cat > "$SRC/app/api/ai/name/route.ts" << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { callOpenAI } from '@/lib/openai'
export async function POST(req: NextRequest) {
  const body = await req.json()
  const prompt = `당신은 인스타그램 브랜딩 전문가입니다. 다음 조건에 맞는 인스타그램 계정 이름을 10개 추천해주세요.\n\n분야: ${body.field}\n타겟층: ${body.target}\n원하는 분위기: ${body.mood}\n\n각 이름에 대해 추천 이유와 함께 설명해주세요.`
  const result = await callOpenAI(prompt)
  return NextResponse.json({ result })
}
EOF

mkdir -p "$SRC/app/api/ai/profile"
cat > "$SRC/app/api/ai/profile/route.ts" << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { callOpenAI } from '@/lib/openai'
export async function POST(req: NextRequest) {
  const body = await req.json()
  const prompt = `당신은 인스타그램 프로필 최적화 전문가입니다. 다음 정보를 바탕으로 최적화된 인스타그램 프로필 가이드를 작성해주세요.\n\n닉네임: ${body.nickname}\n분야: ${body.field}\n운영 목적: ${body.purpose}\n타겟층: ${body.target}\n\n아래 항목을 포함해 작성해주세요:\n1. 프로필 사진 추천\n2. 바이오(소개글) 3가지 버전\n3. 하이라이트 구성 추천\n4. 프로필 링크 전략`
  const result = await callOpenAI(prompt)
  return NextResponse.json({ result })
}
EOF

mkdir -p "$SRC/app/api/ai/reels"
cat > "$SRC/app/api/ai/reels/route.ts" << 'EOF'
import { NextRequest, NextResponse } from 'next/server'
import { callOpenAI } from '@/lib/openai'
export async function POST(req: NextRequest) {
  const body = await req.json()
  const prompt = `당신은 인스타그램 릴스 기획 전문가입니다. 다음 정보를 바탕으로 릴스 스토리보드를 JSON 형식으로 작성해주세요.\n\n주제: ${body.topic}\n타겟: ${body.target}\n길이: ${body.duration}\n톤: ${body.tone}\n강조 포인트: ${body.point}\n\n반드시 아래 JSON 형식으로만 응답해주세요:\n{"title":"릴스 제목","hook":"첫 3초 후킹 멘트","scenes":[{"scene":1,"duration":"5초","visual":"영상 설명","caption":"자막","bgm":"BGM 추천"}],"cta":"행동 유도 멘트","hashtags":["#해시태그1","#해시태그2"]}`
  const raw = await callOpenAI(prompt)
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) : { title: body.topic, hook: '결과를 파싱하지 못했습니다.', scenes: [], cta: '', hashtags: [] }
    return NextResponse.json({ result })
  } catch {
    return NextResponse.json({ result: { title: body.topic, hook: raw.slice(0, 100), scenes: [], cta: '', hashtags: [] } })
  }
}
EOF

echo "✅ 파트 C 완료! (AI 페이지, 릴스, 공지사항, API)"
