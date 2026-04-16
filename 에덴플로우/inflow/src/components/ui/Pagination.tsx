'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
  className?: string
}

export default function Pagination({ page, totalPages, onChange, className = '' }: PaginationProps) {
  return (
    <div className={`flex items-center justify-center gap-4 py-6 ${className}`}>
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all"
      >
        <ChevronLeft className="w-4 h-4 text-slate-600" />
      </button>
      <span className="text-sm font-bold text-slate-600">
        {page} / {totalPages}
      </span>
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="p-2 rounded-xl hover:bg-slate-100 disabled:opacity-30 transition-all"
      >
        <ChevronRight className="w-4 h-4 text-slate-600" />
      </button>
    </div>
  )
}
