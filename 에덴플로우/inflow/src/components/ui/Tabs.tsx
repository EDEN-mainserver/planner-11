'use client'

interface Tab<T extends string> {
  key: T
  label: string
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[]
  active: T
  onChange: (key: T) => void
  className?: string
}

export default function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className = '',
}: TabsProps<T>) {
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`
            px-4 py-2 rounded-xl text-sm font-bold
            whitespace-nowrap transition-all
            ${active === tab.key
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
