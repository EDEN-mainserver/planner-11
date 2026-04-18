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
