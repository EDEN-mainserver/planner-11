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
