#!/bin/bash
BASE="/Users/jeongjihan/Desktop/planner-11/에덴플로우/inflow"
SRC="$BASE/src"
echo "🚀 파트 B 시작..."

# ── dashboard components ──
mkdir -p "$SRC/components/dashboard"

cat > "$SRC/components/dashboard/RecentAiHistory.tsx" << 'EOF'
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
EOF

cat > "$SRC/components/dashboard/RecentEngagement.tsx" << 'EOF'
export default function RecentEngagement() {
  return (
    <div className="bg-white rounded-3xl lg:rounded-[3rem] p-6 lg:p-10 border border-slate-100 shadow-sm">
      <h2 className="font-black text-slate-800 mb-4">📊 최근 계정진단 결과</h2>
      <p className="text-sm text-slate-400">데이터가 없습니다.</p>
    </div>
  )
}
EOF

cat > "$SRC/components/dashboard/RecentNotice.tsx" << 'EOF'
import Link from 'next/link'
const NOTICES = [
  { id:1, title:'[필독] 에덴플로우에 오신 것을 환영합니다', important:true },
  { id:2, title:'전기공사로 인한 일시적 사이트 접속 장애 안내', important:false },
]
export default function RecentNotice() {
  return (
    <div className="bg-white rounded-3xl lg:rounded-[3rem] p-6 lg:p-10 border border-slate-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-black text-slate-800">🔔 공지사항</h2>
        <Link href="/board/notice" className="text-xs text-indigo-600 font-semibold hover:underline">전체 공지사항 확인 &gt;</Link>
      </div>
      <ul className="space-y-2">
        {NOTICES.map(n=>(
          <li key={n.id}>
            <Link href={`/board/notice/${n.id}`} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 transition">
              {n.important && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap">필독</span>}
              <span className="text-sm text-slate-600 truncate">{n.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
EOF

cat > "$SRC/components/dashboard/QuickMenu.tsx" << 'EOF'
import Link from 'next/link'
const MENUS = [
  { href:'/engagement', icon:'📊', label:'계정진단', desc:'나의 계정을 분석해 보세요' },
  { href:'/ai/reelsPlanning', icon:'🎬', label:'릴스기획', desc:'AI로 릴스 스토리보드를 만들어요' },
  { href:'/findReels', icon:'▶', label:'릴스모음', desc:'벤치마킹 릴스를 찾아보세요' },
  { href:'https://www.helpu.kr/agcglobal', icon:'❓', label:'사용방법', desc:'서비스 이용 가이드', external:true },
]
export default function QuickMenu() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {MENUS.map(m=>(
        m.external ? (
          <a key={m.href} href={m.href} target="_blank" rel="noopener noreferrer"
            className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition cursor-pointer">
            <span className="text-2xl block mb-2">{m.icon}</span>
            <p className="font-bold text-slate-800 text-sm">{m.label}</p>
            <p className="text-xs text-slate-400 mt-1">{m.desc}</p>
          </a>
        ) : (
          <Link key={m.href} href={m.href}
            className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition">
            <span className="text-2xl block mb-2">{m.icon}</span>
            <p className="font-bold text-slate-800 text-sm">{m.label}</p>
            <p className="text-xs text-slate-400 mt-1">{m.desc}</p>
          </Link>
        )
      ))}
    </div>
  )
}
EOF

# ── app/page.tsx (dashboard) ──
cat > "$SRC/app/page.tsx" << 'EOF'
'use client'
import { useAuthStore } from '@/store/authStore'
import RecentAiHistory from '@/components/dashboard/RecentAiHistory'
import RecentEngagement from '@/components/dashboard/RecentEngagement'
import RecentNotice from '@/components/dashboard/RecentNotice'
import QuickMenu from '@/components/dashboard/QuickMenu'
export default function DashboardPage() {
  const { user } = useAuthStore()
  return (
    <div className="px-4 lg:px-8 py-8 max-w-5xl mx-auto w-full">
      <div className="mb-8">
        <p className="text-sm text-slate-400 mb-1">안녕하세요 👋</p>
        <h1 className="text-2xl lg:text-3xl font-black text-slate-800">대시보드</h1>
      </div>
      <div className="space-y-6">
        <QuickMenu />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RecentAiHistory />
          <RecentEngagement />
        </div>
        <RecentNotice />
      </div>
    </div>
  )
}
EOF

# ── auth/login/page.tsx ──
mkdir -p "$SRC/app/auth/login"
cat > "$SRC/app/auth/login/page.tsx" << 'EOF'
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const router = useRouter()
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || '로그인 실패'); return }
      login(data.user)
      router.push('/')
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-indigo-600">EDEN<span className="text-slate-800">FLOW</span></h1>
          <p className="text-sm text-slate-400 mt-2">AI 인스타그램 성장 플랫폼</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <h2 className="text-xl font-black text-slate-800 mb-6">로그인</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">아이디</label>
              <input type="text" value={username} onChange={e=>setUsername(e.target.value)}
                placeholder="아이디를 입력하세요" required
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 mb-1.5 block">비밀번호</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
                placeholder="비밀번호를 입력하세요" required
                className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition disabled:opacity-40">
              {loading ? '로그인 중...' : '로그인'}
            </button>
          </form>
          <div className="flex items-center justify-center gap-3 mt-6 text-xs text-slate-400">
            <Link href="/auth/register" className="hover:text-indigo-600 transition">회원가입</Link>
            <span>·</span>
            <Link href="/auth/find/pw" className="hover:text-indigo-600 transition">비밀번호 찾기</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
EOF

# ── auth/register/page.tsx ──
mkdir -p "$SRC/app/auth/register"
cat > "$SRC/app/auth/register/page.tsx" << 'EOF'
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ username:'', password:'', passwordConfirm:'', name:'', email:'', phone:'', referrer:'', agree:false })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.password !== form.passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }
    if (!form.agree) { setError('이용약관에 동의해주세요.'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message || '회원가입 실패'); return }
      router.push('/auth/login')
    } catch {
      setError('서버 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }
  const fields = [
    { key:'username', label:'아이디', type:'text', placeholder:'영문+숫자 조합' },
    { key:'password', label:'비밀번호', type:'password', placeholder:'8자 이상' },
    { key:'passwordConfirm', label:'비밀번호 확인', type:'password', placeholder:'비밀번호를 다시 입력하세요' },
    { key:'name', label:'이름', type:'text', placeholder:'실명을 입력하세요' },
    { key:'email', label:'이메일', type:'email', placeholder:'example@email.com' },
    { key:'phone', label:'연락처', type:'tel', placeholder:'010-0000-0000' },
    { key:'referrer', label:'추천인 아이디', type:'text', placeholder:'(선택사항)' },
  ]
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-indigo-600">EDEN<span className="text-slate-800">FLOW</span></h1>
          <p className="text-sm text-slate-400 mt-2">회원가입</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map(f=>(
              <div key={f.key}>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">{f.label}</label>
                <input type={f.type} value={(form as Record<string,string|boolean>)[f.key] as string}
                  onChange={e=>set(f.key, e.target.value)}
                  placeholder={f.placeholder}
                  required={f.key !== 'referrer'}
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
            ))}
            <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
              <input type="checkbox" checked={form.agree} onChange={e=>set('agree', e.target.checked)}
                className="rounded" />
              이용약관 및 개인정보처리방침에 동의합니다
            </label>
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <button type="submit" disabled={loading}
              className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition disabled:opacity-40">
              {loading ? '처리 중...' : '회원가입'}
            </button>
          </form>
          <div className="text-center mt-6 text-xs text-slate-400">
            이미 계정이 있으신가요?{' '}
            <Link href="/auth/login" className="text-indigo-600 font-semibold hover:underline">로그인</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
EOF

# ── auth/find/pw/page.tsx ──
mkdir -p "$SRC/app/auth/find/pw"
cat > "$SRC/app/auth/find/pw/page.tsx" << 'EOF'
'use client'
import { useState } from 'react'
import Link from 'next/link'
export default function FindPwPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await new Promise(r => setTimeout(r, 1000))
    setSent(true)
    setLoading(false)
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-indigo-600">EDEN<span className="text-slate-800">FLOW</span></h1>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8">
          <h2 className="text-xl font-black text-slate-800 mb-2">비밀번호 찾기</h2>
          <p className="text-sm text-slate-400 mb-6">가입 시 사용한 이메일로 재설정 링크를 보내드립니다.</p>
          {sent ? (
            <div className="text-center py-4">
              <p className="text-2xl mb-3">📧</p>
              <p className="font-bold text-slate-800 mb-1">이메일을 발송했습니다</p>
              <p className="text-sm text-slate-400 mb-6">{email}로 재설정 링크를 보냈습니다.</p>
              <Link href="/auth/login" className="text-indigo-600 text-sm font-semibold hover:underline">로그인으로 돌아가기</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1.5 block">이메일</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
                  placeholder="가입한 이메일을 입력하세요" required
                  className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-2xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition disabled:opacity-40">
                {loading ? '발송 중...' : '재설정 링크 발송'}
              </button>
              <div className="text-center">
                <Link href="/auth/login" className="text-xs text-slate-400 hover:text-indigo-600 transition">← 로그인으로 돌아가기</Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
EOF

# ── engagement/page.tsx ──
mkdir -p "$SRC/app/engagement"
cat > "$SRC/app/engagement/page.tsx" << 'EOF'
'use client'
export default function EngagementPage() {
  const handleConnect = () => {
    alert('인스타그램 OAuth 연동 기능은 실제 API 키가 필요합니다.')
  }
  return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0 px-4 lg:px-8 py-8 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl lg:text-3xl font-black text-slate-800 mb-1">계정진단</h1>
          <p className="text-sm text-slate-400">인스타그램 계정을 연결하고 분석 리포트를 확인하세요</p>
        </div>
        <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 lg:p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-3xl flex items-center justify-center text-white text-3xl mx-auto mb-6">
            📷
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-3">인스타그램 계정 연결</h2>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">
            인스타그램 계정을 연결하면<br />
            팔로워, 도달률, 참여율 등<br />
            상세한 분석 리포트를 받을 수 있어요
          </p>
          <button onClick={handleConnect}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold text-base hover:opacity-90 transition shadow-lg">
            📷 인스타그램 연결하기
          </button>
          <p className="text-xs text-slate-400 mt-4">계정 연결 시 인스타그램 OAuth 인증이 진행됩니다</p>
        </div>
      </div>
    </div>
  )
}
EOF

# ── ai/direction/page.tsx ──
mkdir -p "$SRC/app/ai/direction"
cat > "$SRC/app/ai/direction/page.tsx" << 'EOF'
'use client'
import { useState } from 'react'
import AiPageHero from '@/components/ai/AiPageHero'
import AiStartButton from '@/components/ai/AiStartButton'
const STEPS = [
  { title: '어떤 분야에 관심 있으신가요?', placeholder: '예) 음식/맛집, 뷰티, 여행, 피트니스', key: 'field' },
  { title: '현재 팔로워 수는 얼마인가요?', placeholder: '예) 0명, 500명, 1000명 이상', key: 'followers' },
  { title: '인스타그램 운영 목적은 무엇인가요?', placeholder: '예) 퍼스널 브랜딩, 수익 창출, 취미', key: 'purpose' },
  { title: '타겟으로 삼고 싶은 대상은 누구인가요?', placeholder: '예) 20-30대 직장인, 요리 좋아하는 사람', key: 'target' },
]
export default function DirectionPage() {
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string|null>(null)
  const handleNext = async () => {
    if (step < STEPS.length - 1) { setStep(step+1); return }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/direction', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify(values),
      })
      const data = await res.json()
      setResult(data.result)
    } catch { setResult('오류가 발생했습니다. 다시 시도해주세요.') }
    finally { setLoading(false) }
  }
  if (!started) return (
    <div className="flex-1 w-full overflow-y-auto">
      <div className="pt-16 lg:pt-0">
        <AiPageHero emoji="⊙" badge="AI 방향성 기획"
          title={<>나만의 인스타그램 방향성을<br />AI가 설계해 드려요</>}
          description="분야, 팔로워수, 목적, 타겟을 입력하면 맞춤 방향성 리포트를 생성합니다."
          previewText="나의 인스타그램 방향성 리포트가 여기에 표시됩니다..." />
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
            <span className="text-2xl">⊙</span>
            <h2 className="text-xl font-bold text-slate-800">방향성 기획 결과</h2>
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
          {loading?'생성 중...':step<STEPS.length-1?'다음 →':'AI 방향성 생성하기 →'}
        </button>
      </div>
    </div>
  )
}
EOF

# ── ai/name/page.tsx ──
mkdir -p "$SRC/app/ai/name"
cat > "$SRC/app/ai/name/page.tsx" << 'EOF'
'use client'
import { useState } from 'react'
import AiPageHero from '@/components/ai/AiPageHero'
import AiStartButton from '@/components/ai/AiStartButton'
const STEPS = [
  { title: '어떤 분야의 계정인가요?', placeholder: '예) 음식/맛집, 뷰티, 여행', key: 'field' },
  { title: '타겟층은 누구인가요?', placeholder: '예) 20-30대 직장인', key: 'target' },
  { title: '원하는 계정 분위기는?', placeholder: '예) 감성적, 유머러스, 전문적', key: 'mood' },
]
export default function NamePage() {
  const [started, setStarted] = useState(false)
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Record<string,string>>({})
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<string|null>(null)
  const handleNext = async () => {
    if (step < STEPS.length - 1) { setStep(step+1); return }
    setLoading(true)
    try {
      const res = await fetch('/api/ai/name', {
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
        <AiPageHero emoji="AA" badge="AI 이름 추천"
          title={<>분야와 타겟에 맞는<br />계정 이름을 추천해 드려요</>}
          description="분야, 타겟, 분위기를 입력하면 맞춤 계정 이름을 추천합니다."
          previewText="추천 계정 이름이 여기에 표시됩니다..." />
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
            <span className="text-2xl">AA</span>
            <h2 className="text-xl font-bold text-slate-800">이름 추천 결과</h2>
          </div>
          <div className="whitespace-pre-wrap text-slate-700 leading-relaxed text-sm">{result}</div>
          <button onClick={()=>{setStarted(false);setStep(0);setValues({});setResult(null)}}
            className="mt-8 w-full py-3 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition">
            다시 추천받기
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
          {loading?'생성 중...':step<STEPS.length-1?'다음 →':'AI 이름 추천받기 →'}
        </button>
      </div>
    </div>
  )
}
EOF

# ── ai/profile/page.tsx ──
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
          title={<>눈에 띄는 프로필 소개글을<br />AI가 만들어 드려요</>}
          description="닉네임, 분야, 목적, 타겟을 입력하면 맞춤 프로필을 생성합니다."
          previewText="프로필 소개글이 여기에 표시됩니다..." />
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
            다시 생성하기
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

echo "✅ 파트 B 완료! (대시보드, 인증, AI 페이지)"
