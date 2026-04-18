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
