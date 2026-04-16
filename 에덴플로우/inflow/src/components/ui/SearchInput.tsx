'use client'
import { Search, X } from 'lucide-react'

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

export default function SearchInput({
  value,
  onChange,
  placeholder = '검색...',
  className = ''
}: SearchInputProps) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search className="absolute left-4 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          w-full pl-10 pr-10 py-3
          bg-slate-100 rounded-2xl
          text-sm font-medium text-slate-700
          placeholder:text-slate-400
          border-none outline-none
          focus:ring-2 focus:ring-indigo-200
          transition-all
        "
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-4 text-slate-400 hover:text-slate-600"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
