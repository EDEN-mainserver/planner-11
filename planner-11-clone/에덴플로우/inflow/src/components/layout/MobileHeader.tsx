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
