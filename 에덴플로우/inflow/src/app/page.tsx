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
