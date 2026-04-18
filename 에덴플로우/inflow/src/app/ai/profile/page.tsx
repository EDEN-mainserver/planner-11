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
