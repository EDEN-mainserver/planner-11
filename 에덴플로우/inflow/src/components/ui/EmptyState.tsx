interface Props { emoji?: string; title: string; description?: string }
export default function EmptyState({ emoji='📭', title, description }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <span className="text-4xl mb-3">{emoji}</span>
      <p className="font-semibold text-slate-600">{title}</p>
      {description && <p className="text-sm text-slate-400 mt-1">{description}</p>}
    </div>
  )
}
