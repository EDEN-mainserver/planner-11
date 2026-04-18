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
