interface ProgressBarProps {
  value: number
  max: number
  className?: string
}

export default function ProgressBar({ value, max, className = '' }: ProgressBarProps) {
  const isInfinity = max === Infinity
  const percent = isInfinity ? 100 : Math.min((value / max) * 100, 100)

  return (
    <div className={`w-full h-[3px] bg-slate-100 rounded-full overflow-hidden ${className}`}>
      <div
        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
        style={{ width: `${percent}%` }}
      />
    </div>
  )
}
