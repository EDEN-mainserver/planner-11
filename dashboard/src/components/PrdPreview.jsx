import { calcPrdPct, pctColor, PRD_SECTIONS_DEF } from "../utils/prd";

function SkeletonLine({ width = '100%', className = '' }) {
  return <div className={`h-3 bg-gray-200 rounded-full animate-pulse ${className}`} style={{ width }} />;
}

export default function PrdPreview({ prd }) {
  const pct = calcPrdPct(prd);
  const color = pctColor(pct);
  const isEmpty = pct === 0;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8">
      {isEmpty ? (
        <div className="text-center max-w-sm">
          <div className="w-20 h-24 mx-auto mb-4 opacity-20">
            <svg viewBox="0 0 80 96" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="8" y="4" width="64" height="88" rx="6" fill="#7C3AED" opacity="0.3"/>
              <rect x="20" y="20" width="40" height="6" rx="3" fill="#7C3AED"/>
              <rect x="20" y="34" width="32" height="4" rx="2" fill="#7C3AED" opacity="0.5"/>
              <rect x="20" y="44" width="36" height="4" rx="2" fill="#7C3AED" opacity="0.5"/>
              <rect x="20" y="58" width="40" height="6" rx="3" fill="#7C3AED"/>
              <rect x="20" y="72" width="28" height="4" rx="2" fill="#7C3AED" opacity="0.5"/>
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">PRD가 여기에 표시됩니다.</h3>
          <p className="text-sm text-gray-400">왼쪽 채팅에서 질문에 답변하면<br/>자동으로 PRD 문서가 생성됩니다.</p>
          <div className="mt-6 bg-white border border-gray-200 rounded-xl p-4 text-left shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <span className="font-bold text-gray-800 text-sm">PRD</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full" />
              <div className="w-16 h-5 bg-gray-100 rounded-full" />
            </div>
            <div className="space-y-4">
              <div><div className="text-xs text-gray-400 mb-2">· 한 줄 정의</div><SkeletonLine /><SkeletonLine width="80%" className="mt-1" /></div>
              <div><div className="text-xs text-gray-400 mb-2">· 제품 목표</div><SkeletonLine width="90%" /><SkeletonLine className="mt-1" /></div>
              <div><div className="text-xs text-gray-400 mb-2">· 배경</div><SkeletonLine width="70%" /></div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-lg bg-white border border-gray-200 rounded-xl shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-3">
            <span className="font-bold text-gray-800 text-sm">PRD</span>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
            </div>
            <span className="text-xs font-semibold" style={{ color }}>{pct}%</span>
          </div>
          {PRD_SECTIONS_DEF.map(sec => (
            <div key={sec.key} className="space-y-2">
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{sec.label}</div>
              {sec.fields.map(f => {
                const val = prd[sec.key]?.[f.key] || '';
                return (
                  <div key={f.key}>
                    <div className="text-xs text-gray-400 mb-1">· {f.label}</div>
                    {val ? (
                      <p className="text-sm text-gray-700 leading-relaxed">{val}</p>
                    ) : (
                      <SkeletonLine width="90%" />
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
