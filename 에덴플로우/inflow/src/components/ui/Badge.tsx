type BadgeType =
  | 'reels'
  | 'profile'
  | 'naming'
  | 'direction'
  | 'notice'
  | 'free'
  | 'pro'
  // 하위 호환 alias (기존 AiType 및 호출부 유지용)
  | 'name'
  | 'pinned'

interface BadgeProps {
  type: BadgeType
  label?: string
  className?: string
}

const badgeStyle: Record<BadgeType, { bg: string; text: string; label: string }> = {
  reels:     { bg: 'bg-rose-50',    text: 'text-rose-500',    label: '릴스 기획' },
  profile:   { bg: 'bg-violet-50',  text: 'text-violet-500',  label: '프로필'    },
  naming:    { bg: 'bg-blue-50',    text: 'text-blue-500',    label: '네이밍'    },
  direction: { bg: 'bg-emerald-50', text: 'text-emerald-500', label: '방향성'    },
  notice:    { bg: 'bg-rose-500',   text: 'text-white',       label: '필독'      },
  free:      { bg: 'bg-indigo-600', text: 'text-white',       label: 'FREE'      },
  pro:       { bg: 'bg-slate-900',  text: 'text-white',       label: 'PRO'       },
  name:      { bg: 'bg-blue-50',    text: 'text-blue-500',    label: '네이밍'    },
  pinned:    { bg: 'bg-rose-500',   text: 'text-white',       label: '필독'      },
}

export default function Badge({ type, label, className = '' }: BadgeProps) {
  const style = badgeStyle[type]
  return (
    <span className={`
      shrink-0 inline-flex items-center gap-1.5
      px-2.5 py-1 rounded-xl
      font-black text-[10px] uppercase
      ${style.bg} ${style.text}
      ${className}
    `}>
      {label ?? style.label}
    </span>
  )
}
