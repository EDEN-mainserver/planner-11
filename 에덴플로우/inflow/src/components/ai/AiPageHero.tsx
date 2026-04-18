interface Props {
  emoji: string; badge: string
  title: React.ReactNode; description: string
  previewText: string; isScreenshot?: boolean
}
export default function AiPageHero({ emoji, badge, title, description, previewText, isScreenshot }: Props) {
  return (
    <div className="px-6 pt-10 pb-6 max-w-2xl mx-auto">
      <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-full mb-4">
        <span>{emoji}</span><span>{badge}</span>
      </div>
      <h1 className="text-2xl lg:text-3xl font-black text-slate-800 mb-3 leading-tight">{title}</h1>
      <p className="text-sm text-slate-500 mb-6">{description}</p>
      <div className={`w-full rounded-3xl border border-slate-100 bg-white overflow-hidden shadow-sm ${isScreenshot ? 'min-h-[200px]' : ''}`}>
        {isScreenshot ? (
          <div className="w-full h-48 bg-gradient-to-br from-indigo-50 to-slate-100 flex items-center justify-center">
            <span className="text-slate-400 text-sm">{previewText}</span>
          </div>
        ) : (
          <div className="p-6 min-h-[120px] flex items-center justify-center">
            <p className="text-slate-300 text-sm text-center">{previewText}</p>
          </div>
        )}
      </div>
    </div>
  )
}
