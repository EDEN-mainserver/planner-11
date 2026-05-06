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
