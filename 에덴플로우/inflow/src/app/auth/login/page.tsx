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
