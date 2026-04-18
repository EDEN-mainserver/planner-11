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
