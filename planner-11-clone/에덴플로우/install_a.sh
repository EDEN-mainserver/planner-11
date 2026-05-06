#!/bin/bash
BASE="/Users/jeongjihan/Desktop/planner-11/에덴플로우/inflow"
SRC="$BASE/src"
echo "🚀 파트 A 시작..."

# ── tailwind.config.ts ──
cat > "$BASE/tailwind.config.ts" << 'EOF'
import type { Config } from 'tailwindcss'
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['Pretendard', 'sans-serif'] },
      colors: { primary: '#4f46e5' },
    },
  },
  plugins: [],
}
export default config
EOF

# ── globals.css ──
mkdir -p "$SRC/app"
cat > "$SRC/app/globals.css" << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
:root { --background: #F8FAFC; }
body { background: var(--background); font-family: 'Pretendard', sans-serif; }
EOF

mkdir -p "$SRC/constants"
cat > "$SRC/constants/navigation.ts" << 'EOF'
export const NAV_SECTIONS = [
  {
    label: '계정진단',
    items: [{ href: '/engagement', icon: '📋', label: '보고서 확인하기' }],
  },
  {
    label: 'AI 기획',
    items: [
      { href: '/ai/direction', icon: '⊙', label: '계정 방향성 기획' },
      { href: '/ai/name', icon: 'AA', label: '이름 추천' },
      { href: '/ai/profile', icon: '👤', label: '프로필 세팅' },
      { href: '/ai/reelsPlanning', icon: '🎬', label: '릴스 기획' },
      { href: '/ai/history', icon: '🕐', label: 'AI기획 보관함' },
    ],
  },
  {
    label: '콘텐츠',
    items: [{ href: '/findReels', icon: '▶', label: '릴스 모음' }],
  },
  {
    label: '지원',
    items: [
      { href: '/board/notice', icon: '🔔', label: '공지사항' },
      { href: 'https://www.helpu.kr/agcglobal', icon: '❓', label: '원격지원', external: true },
    ],
  },
]
EOF

cat > "$SRC/constants/planLimits.ts" << 'EOF'
export const PLAN_LIMITS = {
  FREE: { direction: 1, name: 1, profile: 1, reels: 1 },
  BASIC: { direction: 10, name: 10, profile: 10, reels: 10 },
  PRO: { direction: 999, name: 999, profile: 999, reels: 999 },
}
EOF

cat > "$SRC/constants/categories.ts" << 'EOF'
export const REELS_CATEGORIES = ['전체','음식','뷰티','여행','라이프','피트니스','교육','패션','반려동물','방송','비즈니스','기타']
EOF

mkdir -p "$SRC/types"
cat > "$SRC/types/user.ts" << 'EOF'
export interface User {
  id: string; username: string; name: string; email: string
  plan: 'FREE' | 'BASIC' | 'PRO'; createdAt: string
}
EOF
cat > "$SRC/types/ai.ts" << 'EOF'
export interface AiHistory {
  id: string; type: 'direction'|'name'|'profile'|'reels'
  title: string; result: string; createdAt: string
}
EOF
cat > "$SRC/types/notice.ts" << 'EOF'
export interface Notice {
  id: string; title: string; content: string
  important: boolean; views: number; createdAt: string
}
EOF
cat > "$SRC/types/reels.ts" << 'EOF'
export interface Reel {
  id: string; title: string; category: string
  thumbnail: string; views: string; url?: string
}
EOF

mkdir -p "$SRC/store"
cat > "$SRC/store/authStore.ts" << 'EOF'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@/types/user'
interface AuthState {
  user: User | null; isLoggedIn: boolean
  login: (user: User) => void; logout: () => void
}
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: { id:'1', username:'edenflow', name:'정지한', email:'EDEN@teamedenmarketing.com', plan:'FREE', createdAt:'2024-01-01' },
      isLoggedIn: true,
      login: (user) => set({ user, isLoggedIn: true }),
      logout: () => set({ user: null, isLoggedIn: false }),
    }),
    { name: 'auth-storage' }
  )
)
EOF
cat > "$SRC/store/planStore.ts" << 'EOF'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
interface PlanState {
  used: Record<string,number>
  increment: (key:string) => void
}
export const usePlanStore = create<PlanState>()(
  persist(
    (set) => ({
      used: {},
      increment: (key) => set((s) => ({ used: { ...s.used, [key]: (s.used[key]||0)+1 } })),
    }),
    { name: 'plan-storage' }
  )
)
EOF
cat > "$SRC/store/historyStore.ts" << 'EOF'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AiHistory } from '@/types/ai'
interface HistoryState {
  items: AiHistory[]
  add: (item: AiHistory) => void
  clear: () => void
}
export const useHistoryStore = create<HistoryState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => set((s) => ({ items: [item, ...s.items] })),
      clear: () => set({ items: [] }),
    }),
    { name: 'history-storage' }
  )
)
EOF

mkdir -p "$SRC/lib"
cat > "$SRC/lib/utils.ts" << 'EOF'
export function cn(...classes: (string|undefined|false|null)[]) {
  return classes.filter(Boolean).join(' ')
}
export function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'})
}
EOF
cat > "$SRC/lib/openai.ts" << 'EOF'
export async function callOpenAI(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return '[MOCK] OpenAI API 키가 설정되지 않았습니다.'
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', Authorization:`Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [{ role:'user', content: prompt }],
      temperature: 0.8,
    }),
  })
  const data = await res.json()
  return data.choices?.[0]?.message?.content || '결과를 생성하지 못했습니다.'
}
EOF

mkdir -p "$SRC/components/ui"

cat > "$SRC/components/ui/Button.tsx" << 'EOF'
import { cn } from '@/lib/utils'
interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary'|'outline'|'ghost'; size?: 'sm'|'md'|'lg'
}
export default function Button({ variant='primary', size='md', className, children, ...props }: Props) {
  return (
    <button className={cn(
      'inline-flex items-center justify-center font-semibold rounded-2xl transition',
      variant==='primary' && 'bg-indigo-600 text-white hover:bg-indigo-700',
      variant==='outline' && 'border border-slate-200 text-slate-700 hover:border-indigo-300 bg-white',
      variant==='ghost' && 'text-slate-600 hover:bg-slate-100',
      size==='sm' && 'px-3 py-1.5 text-xs',
      size==='md' && 'px-5 py-2.5 text-sm',
      size==='lg' && 'px-6 py-3 text-base',
      className
    )} {...props}>{children}</button>
  )
}
EOF

cat > "$SRC/components/ui/Badge.tsx" << 'EOF'
import { cn } from '@/lib/utils'
interface Props { children: React.ReactNode; variant?: 'default'|'red'|'green'|'indigo'; className?: string }
export default function Badge({ children, variant='default', className }: Props) {
  return (
    <span className={cn(
      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold',
      variant==='default' && 'bg-slate-100 text-slate-600',
      variant==='red' && 'bg-red-100 text-red-600',
      variant==='green' && 'bg-green-100 text-green-700',
      variant==='indigo' && 'bg-indigo-100 text-indigo-700',
      className
    )}>{children}</span>
  )
}
EOF

cat > "$SRC/components/ui/LoadingSpinner.tsx" << 'EOF'
export default function LoadingSpinner({ size=24 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"
        style={{ width: size, height: size }} />
    </div>
  )
}
EOF

cat > "$SRC/components/ui/EmptyState.tsx" << 'EOF'
interface Props { emoji?: string; title: string; description?: string }
export default function EmptyState({ emoji='📭', title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-4xl mb-3">{emoji}</span>
      <p className="font-semibold text-slate-600">{title}</p>
      {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
    </div>
  )
}
EOF

cat > "$SRC/components/ui/Pagination.tsx" << 'EOF'
interface Props { page: number; total: number; onChange: (p:number)=>void }
export default function Pagination({ page, total, onChange }: Props) {
  return (
    <div className="flex items-center justify-center gap-2 mt-8">
      <button onClick={()=>onChange(page-1)} disabled={page<=1}
        className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-30 hover:border-indigo-300 transition">
        이전
      </button>
      {Array.from({length:total},(_,i)=>i+1).map(p=>(
        <button key={p} onClick={()=>onChange(p)}
          className={`w-8 h-8 rounded-xl text-sm font-semibold transition ${p===page?'bg-indigo-600 text-white':'text-slate-600 hover:bg-slate-100'}`}>
          {p}
        </button>
      ))}
      <button onClick={()=>onChange(page+1)} disabled={page>=total}
        className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm text-slate-600 disabled:opacity-30 hover:border-indigo-300 transition">
        다음
      </button>
    </div>
  )
}
EOF

cat > "$SRC/components/ui/SearchInput.tsx" << 'EOF'
interface Props { value: string; onChange: (v:string)=>void; placeholder?: string }
export default function SearchInput({ value, onChange, placeholder='검색...' }: Props) {
  return (
    <div className="relative">
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
      <input type="text" value={value} onChange={e=>onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
    </div>
  )
}
EOF

cat > "$SRC/components/ui/Tabs.tsx" << 'EOF'
interface Props { tabs: string[]; active: string; onChange: (t:string)=>void }
export default function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map(tab=>(
        <button key={tab} onClick={()=>onChange(tab)}
          className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition ${
            active===tab ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100'
            : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'
          }`}>
          {tab}
        </button>
      ))}
    </div>
  )
}
EOF

cat > "$SRC/components/ui/ChatButton.tsx" << 'EOF'
export default function ChatButton() {
  return (
    <a href="https://www.helpu.kr/agcglobal" target="_blank" rel="noopener noreferrer"
      className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center text-xl hover:bg-indigo-700 transition z-50">
      💬
    </a>
  )
}
EOF

mkdir -p "$SRC/components/layout"

cat > "$SRC/components/layout/PlanCard.tsx" << 'EOF'
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
EOF

cat > "$SRC/components/layout/SidebarNav.tsx" << 'EOF'
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_SECTIONS } from '@/constants/navigation'
export default function SidebarNav() {
  const pathname = usePathname()
  return (
    <nav className="flex-1 px-4 py-6 overflow-y-auto space-y-6">
      {NAV_SECTIONS.map(section=>(
        <div key={section.label}>
          <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest px-3 mb-2">{section.label}</p>
          <ul className="space-y-1">
            {section.items.map(item=>{
              const isActive = !item.external && pathname === item.href
              return (
                <li key={item.href}>
                  {item.external ? (
                    <a href={item.href} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm text-slate-600 hover:bg-slate-100 transition">
                      <span className="text-base">{item.icon}</span>{item.label}
                    </a>
                  ) : (
                    <Link href={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm transition ${
                        isActive ? 'bg-indigo-600 text-white shadow-md shadow-indigo-100 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                      }`}>
                      <span className="text-base">{item.icon}</span>{item.label}
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}
EOF

cat > "$SRC/components/layout/SidebarUserProfile.tsx" << 'EOF'
'use client'
import { useAuthStore } from '@/store/authStore'
import { useRouter } from 'next/navigation'
export default function SidebarUserProfile() {
  const { user, logout } = useAuthStore()
  const router = useRouter()
  const handleLogout = () => { logout(); router.push('/auth/login') }
  return (
    <div className="px-4 py-4 border-t border-slate-100">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
          {user?.name?.charAt(0) ?? 'U'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800 truncate">{user?.name} 님</p>
          <p className="text-xs text-slate-400 truncate">{user?.email}</p>
        </div>
      </div>
      <button onClick={handleLogout}
        className="w-full py-2 rounded-xl text-xs text-slate-500 border border-slate-200 hover:bg-slate-50 transition">
        → 로그아웃
      </button>
    </div>
  )
}
EOF

cat > "$SRC/components/layout/Sidebar.tsx" << 'EOF'
import Link from 'next/link'
import SidebarNav from './SidebarNav'
import SidebarUserProfile from './SidebarUserProfile'
export default function Sidebar() {
  return (
    <aside className="hidden lg:flex sticky top-0 left-0 h-screen w-64 border-r border-slate-100 flex-col z-[30] bg-white">
      <div className="px-6 py-5 border-b border-slate-100">
        <Link href="/" className="text-xl font-black tracking-tight text-indigo-600">
          EDEN<span className="text-slate-800">FLOW</span>
        </Link>
      </div>
      <SidebarNav />
      <SidebarUserProfile />
    </aside>
  )
}
EOF

cat > "$SRC/components/layout/MobileHeader.tsx" << 'EOF'
'use client'
import { useState } from 'react'
import Link from 'next/link'
import SidebarNav from './SidebarNav'
import SidebarUserProfile from './SidebarUserProfile'
export default function MobileHeader() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-100 px-5 flex items-center justify-between z-[40]">
        <Link href="/" className="text-lg font-black tracking-tight text-indigo-600">
          EDEN<span className="text-slate-800">FLOW</span>
        </Link>
        <button onClick={()=>setOpen(true)} className="text-slate-600 text-xl">☰</button>
      </header>
      {open && (
        <div className="fixed inset-0 z-[50] lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={()=>setOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white flex flex-col">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <Link href="/" className="text-xl font-black tracking-tight text-indigo-600" onClick={()=>setOpen(false)}>
                EDEN<span className="text-slate-800">FLOW</span>
              </Link>
              <button onClick={()=>setOpen(false)} className="text-slate-400 text-xl">✕</button>
            </div>
            <SidebarNav />
            <SidebarUserProfile />
          </div>
        </div>
      )}
    </>
  )
}
EOF

cat > "$SRC/app/layout.tsx" << 'EOF'
import type { Metadata } from 'next'
import './globals.css'
import Sidebar from '@/components/layout/Sidebar'
import MobileHeader from '@/components/layout/MobileHeader'
export const metadata: Metadata = { title: 'EDEN FLOW', description: 'AI 인스타그램 성장 플랫폼' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-[#F8FAFC]">
        <div className="flex w-full min-h-screen bg-[#F8FAFC]">
          <Sidebar />
          <MobileHeader />
          <main className="flex-1 w-full overflow-y-auto">
            <div className="pt-16 lg:pt-0 flex flex-col min-h-screen">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  )
}
EOF

mkdir -p "$SRC/components/ai"

cat > "$SRC/components/ai/AiPageHero.tsx" << 'EOF'
interface Props {
  emoji: string; badge: string
  title: React.ReactNode; description: string
  previewText: string; isScreenshot?: boolean
}
export default function AiPageHero({ emoji, badge, title, description, previewText, isScreenshot }: Props) {
  return (
    <div className="px-6 pt-10 pb-6 max-w-2xl mx-auto">
      <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
        <span>{emoji}</span><span>{badge}</span>
      </div>
      <h1 className="text-2xl lg:text-3xl font-black text-slate-800 mb-3 leading-tight">{title}</h1>
      <p className="text-sm text-slate-500 mb-6">{description}</p>
      <div className={`w-full rounded-3xl border border-slate-100 bg-white overflow-hidden shadow-sm ${isScreenshot ? 'min-h-[200px]' : ''}`}>
        {isScreenshot ? (
          <div className="w-full h-48 bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center">
            <span className="text-slate-400 text-sm">{previewText}</span>
          </div>
        ) : (
          <div className="p-6 min-h-[120px] flex items-center justify-center">
            <p className="text-slate-300 text-sm text-center">{previewText}</p>
          </div>
        )}
      </div>
    </div>
  )
}
EOF

cat > "$SRC/components/ai/AiStartButton.tsx" << 'EOF'
interface Props { onClick: () => void; label?: string }
export default function AiStartButton({ onClick, label='기획 시작하기 →' }: Props) {
  return (
    <button onClick={onClick}
      className="w-full py-4 rounded-2xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 transition shadow-lg shadow-indigo-100">
      {label}
    </button>
  )
}
EOF

echo "✅ 파트 A 완료! (설정, 컴포넌트, 레이아웃)"
