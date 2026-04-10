import { useState, useRef } from "react";
import { callGemini } from "../utils/gemini";

const PRIORITY_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' };
const PRIORITY_LABELS = { high: '높음', medium: '보통', low: '낮음' };

// 마인드맵 레이아웃 상수
const MM = {
  rootW: 160, rootH: 56,
  featW: 200, featH: 80,
  subW: 140, subH: 40,
  detailW: 120, detailH: 36,
  colGap: 60, rowGap: 24, padX: 40, padY: 40,
};

export default function SpecPanel({ prd, specData, setSpecData }) {
  const [modal, setModal]       = useState(false);
  const [loading, setLoading]   = useState(false);
  const [selected, setSelected] = useState(null);
  const svgRef = useRef(null);

  /* ── AI로 기능명세서 생성 ── */
  const generate = async () => {
    setLoading(true);
    const prompt = `다음 PRD를 분석하여 기능명세서를 JSON으로 생성하세요.

PRD: ${JSON.stringify(prd)}

반환 형식 (JSON만, 설명 없이):
{
  "features": [
    {
      "id": "F-001",
      "title": "기능 제목",
      "description": "2~3문장 설명",
      "priority": "high|medium|low",
      "sub_features": [
        { "id": "SF-001-1", "title": "하위 기능", "detail": "상세 설명" }
      ]
    }
  ]
}

규칙:
- features는 3~6개 (핵심 요구사항 중심)
- 각 feature는 sub_features 2~4개
- priority: high(핵심)/medium(중요)/low(선택)
- 한국어로 작성`;

    try {
      const text = await callGemini([{ role: 'user', content: prompt }], '');
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0]);
        setSpecData(data);
        setModal(true);
      }
    } catch (e) {
      alert('생성 실패: ' + e.message);
    }
    setLoading(false);
  };

  /* ── 마인드맵 좌표 계산 ── */
  const features = specData?.features || [];
  const ROW_H = MM.featH + MM.rowGap;
  const totalH = Math.max(features.length * ROW_H + MM.padY * 2, 400);

  const rootY = totalH / 2 - MM.rootH / 2;
  const rootX = MM.padX;
  const featStartY = MM.padY;
  const featX = rootX + MM.rootW + MM.colGap;
  const getFeatY  = (i) => featStartY + i * ROW_H;
  const getFeatCY = (i) => getFeatY(i) + MM.featH / 2;
  const subX    = featX + MM.featW + MM.colGap;
  const detailX = subX + MM.subW + MM.colGap;
  const svgW    = detailX + MM.detailW + MM.padX + 20;

  /* ── 빈 상태 (미생성) ── */
  if (!specData) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="px-5 py-3 bg-white border-b border-gray-200 shrink-0 flex items-center justify-between">
          <span className="font-semibold text-gray-800 text-sm">기능명세서</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
          <div className="relative h-[110px] w-[320px]">
            <svg viewBox="0 0 320 110" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 h-full w-full">
              <rect x="10" y="47" width="70" height="24" rx="4" fill="#845DDE" fillOpacity="0.2"/>
              <rect x="138" y="10" width="70" height="24" rx="4" fill="#845DDE" fillOpacity="0.15"/>
              <rect x="138" y="43" width="70" height="24" rx="4" fill="#845DDE" fillOpacity="0.15"/>
              <rect x="138" y="76" width="70" height="24" rx="4" fill="#845DDE" fillOpacity="0.15"/>
              <rect x="240" y="10" width="70" height="24" rx="4" fill="#845DDE" fillOpacity="0.1"/>
              <rect x="240" y="43" width="70" height="24" rx="4" fill="#845DDE" fillOpacity="0.1"/>
              <rect x="240" y="76" width="70" height="24" rx="4" fill="#845DDE" fillOpacity="0.1"/>
              <path d="M80 59 C109 59 109 22 138 22" stroke="#D2D0D0" strokeWidth="1.5"/>
              <path d="M80 59 C109 59 109 55 138 55" stroke="#D2D0D0" strokeWidth="1.5"/>
              <path d="M80 59 C109 59 109 88 138 88" stroke="#D2D0D0" strokeWidth="1.5"/>
              <path d="M208 22 H240" stroke="#D2D0D0" strokeWidth="1.5"/>
              <path d="M208 55 H240" stroke="#D2D0D0" strokeWidth="1.5"/>
              <path d="M208 88 H240" stroke="#D2D0D0" strokeWidth="1.5"/>
            </svg>
          </div>
          <div className="flex flex-col gap-2 text-center">
            <p className="text-gray-800 text-lg font-medium">PRD 기반 기능명세서를 생성합니다</p>
            <p className="text-gray-500 text-sm">AI가 핵심 요구사항을 분석하고<br/>마인드맵으로 펼쳐드려요</p>
          </div>
          <button onClick={generate} disabled={loading}
            className="px-6 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm">
            {loading ? '생성 중...' : '✨ 기능명세서 생성하기'}
          </button>
        </div>

        {/* 생성완료 팝업 */}
        {modal && specData && (
          <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl shadow-xl w-[340px] overflow-hidden">
              <div className="flex flex-col items-center gap-5 p-6">
                <div className="relative h-[100px] w-[280px]">
                  <svg viewBox="0 0 320 110" fill="none" xmlns="http://www.w3.org/2000/svg" className="absolute inset-0 h-full w-full">
                    <rect x="10" y="47" width="70" height="24" rx="4" fill="url(#mg1)" fillOpacity="0.8"/>
                    <rect x="138" y="10" width="70" height="24" rx="4" fill="#845DDE" fillOpacity="0.15"/>
                    <rect x="138" y="43" width="70" height="24" rx="4" fill="#845DDE" fillOpacity="0.15"/>
                    <rect x="138" y="76" width="70" height="24" rx="4" fill="#845DDE" fillOpacity="0.15"/>
                    <path d="M80 59 C109 59 109 22 138 22" stroke="#D2D0D0" strokeWidth="1.5"/>
                    <path d="M80 59 C109 59 109 55 138 55" stroke="#D2D0D0" strokeWidth="1.5"/>
                    <path d="M80 59 C109 59 109 88 138 88" stroke="#D2D0D0" strokeWidth="1.5"/>
                    <defs>
                      <linearGradient id="mg1" x1="10" y1="47" x2="80" y2="71" gradientUnits="userSpaceOnUse">
                        <stop stopColor="#B18FFF"/><stop offset="1" stopColor="#744CD3"/>
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
                <div className="flex flex-col gap-2 text-center">
                  <p className="text-gray-800 text-lg font-medium">기능명세서 초안이 생성되었어요!</p>
                  <p className="text-gray-500 text-sm">
                    <span className="block">{specData.features.length}개의 핵심 요구사항이 생성되었습니다.</span>
                    <span className="block">마인드맵으로 확인하고 편집하세요.</span>
                  </p>
                </div>
                <button onClick={() => setModal(false)}
                  className="w-full py-2 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors">
                  기능명세서 보러가기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── 마인드맵 뷰 ── */
  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-5 py-3 bg-white border-b border-gray-200 shrink-0 flex items-center gap-3">
        <span className="font-semibold text-gray-800 text-sm">기능명세서</span>
        <span className="text-xs text-gray-400">{features.length}개 핵심 요구사항</span>
        <button onClick={() => { setSpecData(null); setSelected(null); }}
          className="ml-auto text-xs text-gray-400 hover:text-purple-600 transition-colors">↺ 재생성</button>
      </div>

      <div className="flex-1 overflow-auto"
        style={{ backgroundImage: 'radial-gradient(circle, #E5E7EB 1px, transparent 1px)', backgroundSize: '22px 22px', backgroundColor: '#f9fafb' }}>
        <svg ref={svgRef} width={svgW} height={totalH} style={{ display: 'block', minWidth: '100%', minHeight: '100%' }}>

          {/* 루트 노드 */}
          <g>
            <rect x={rootX} y={rootY} width={MM.rootW} height={MM.rootH} rx="8"
              fill="white" stroke="#e5e7eb" strokeWidth="1.5" filter="url(#shadow)"/>
            <text x={rootX + MM.rootW / 2} y={rootY + 18} textAnchor="middle"
              fontSize="11" fontWeight="600" fill="#374151" fontFamily="Noto Sans KR, sans-serif">
              {(prd?.overview?.one_liner || '프로젝트').slice(0, 14)}
            </text>
            <text x={rootX + MM.rootW / 2} y={rootY + 33} textAnchor="middle"
              fontSize="9" fill="#9ca3af" fontFamily="Noto Sans KR, sans-serif">↗ PRD</text>
            <circle cx={rootX + MM.rootW + 16} cy={rootY + MM.rootH / 2} r="10" fill="white" stroke="#e5e7eb" strokeWidth="1.5"/>
            <text x={rootX + MM.rootW + 16} y={rootY + MM.rootH / 2 + 4} textAnchor="middle" fontSize="14" fill="#9ca3af">+</text>
          </g>

          {/* feature 노드들 */}
          {features.map((feat, fi) => {
            const fy = getFeatY(fi);
            const fcy = getFeatCY(fi);
            const rootCX = rootX + MM.rootW;
            const rootCY = rootY + MM.rootH / 2;
            const pColor = PRIORITY_COLORS[feat.priority] || '#6b7280';
            const isSelected = selected === feat.id;

            return (
              <g key={feat.id}>
                {/* 루트 → feature 베지어 연결선 */}
                <path
                  d={`M ${rootCX + 26} ${rootCY} C ${rootCX + 26 + (featX - rootCX) * 0.5} ${rootCY} ${featX} ${fcy} ${featX} ${fcy}`}
                  stroke="#D1D5DB" strokeWidth="1.2" fill="none"/>

                {/* feature 카드 */}
                <g onClick={() => setSelected(isSelected ? null : feat.id)} style={{ cursor: 'pointer' }}>
                  <rect x={featX} y={fy} width={MM.featW} height={MM.featH} rx="8"
                    fill={isSelected ? '#f5f3ff' : 'white'}
                    stroke={isSelected ? '#7c3aed' : '#e5e7eb'}
                    strokeWidth={isSelected ? 1.5 : 1} filter="url(#shadow)"/>
                  <rect x={featX} y={fy} width="4" height={MM.featH} rx="2" fill={pColor}/>
                  <rect x={featX + 12} y={fy + 8} width="28" height="14" rx="7" fill={pColor + '22'}/>
                  <text x={featX + 26} y={fy + 19} textAnchor="middle" fontSize="8" fill={pColor} fontWeight="600" fontFamily="Noto Sans KR, sans-serif">
                    {PRIORITY_LABELS[feat.priority] || '보통'}
                  </text>
                  <text x={featX + 12} y={fy + 35} fontSize="11" fontWeight="700" fill="#111827" fontFamily="Noto Sans KR, sans-serif">
                    {feat.title.slice(0, 16)}{feat.title.length > 16 ? '…' : ''}
                  </text>
                  <foreignObject x={featX + 12} y={fy + 42} width={MM.featW - 20} height={30}>
                    <div xmlns="http://www.w3.org/1999/xhtml" style={{ fontSize: 9, color: '#6b7280', lineHeight: '1.4', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {feat.description}
                    </div>
                  </foreignObject>
                </g>

                {/* feature 오른쪽 + 버튼 */}
                <circle cx={featX + MM.featW + 16} cy={fcy} r="10" fill="white" stroke="#e5e7eb" strokeWidth="1.5"/>
                <text x={featX + MM.featW + 16} y={fcy + 4} textAnchor="middle" fontSize="14" fill="#9ca3af">+</text>

                {/* sub_features */}
                {(feat.sub_features || []).map((sub, si) => {
                  const subCount = feat.sub_features.length;
                  const subTotalH = subCount * (MM.subH + MM.rowGap) - MM.rowGap;
                  const subStartY = fcy - subTotalH / 2;
                  const sy = subStartY + si * (MM.subH + MM.rowGap);
                  const scy = sy + MM.subH / 2;
                  const featRX = featX + MM.featW;

                  return (
                    <g key={sub.id}>
                      <path
                        d={`M ${featRX + 26} ${fcy} C ${featRX + 26 + (subX - featRX) * 0.5} ${fcy} ${subX} ${scy} ${subX} ${scy}`}
                        stroke="#E5E7EB" strokeWidth="1" fill="none"/>
                      <rect x={subX} y={sy} width={MM.subW} height={MM.subH} rx="6"
                        fill="white" stroke="#e5e7eb" strokeWidth="1"/>
                      <text x={subX + 8} y={sy + MM.subH / 2 + 4} fontSize="10" fill="#374151" fontFamily="Noto Sans KR, sans-serif">
                        {sub.title.slice(0, 12)}{sub.title.length > 12 ? '…' : ''}
                      </text>
                      <path d={`M ${subX + MM.subW} ${scy} H ${detailX}`}
                        stroke="#E5E7EB" strokeWidth="1" fill="none"/>
                      <rect x={detailX} y={scy - MM.detailH / 2} width={MM.detailW} height={MM.detailH} rx="5"
                        fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" strokeDasharray="4 3"/>
                      <text x={detailX + MM.detailW / 2} y={scy + 4} textAnchor="middle" fontSize="9" fill="#d1d5db" fontFamily="Noto Sans KR, sans-serif">
                        상세 기능 추가
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          <defs>
            <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="#000" floodOpacity="0.06"/>
            </filter>
          </defs>
        </svg>
      </div>

      {/* 선택된 feature 상세 패널 */}
      {selected && (() => {
        const feat = features.find(f => f.id === selected);
        if (!feat) return null;
        const pColor = PRIORITY_COLORS[feat.priority] || '#6b7280';
        return (
          <div className="shrink-0 bg-white border-t border-gray-200 p-4 max-h-[200px] overflow-y-auto">
            <div className="flex items-start gap-3 mb-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: pColor + '18', color: pColor }}>
                {PRIORITY_LABELS[feat.priority]}
              </span>
              <p className="font-semibold text-gray-800 text-sm flex-1">{feat.title}</p>
              <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500">✕</button>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed mb-3">{feat.description}</p>
            <div className="flex flex-wrap gap-2">
              {(feat.sub_features || []).map(sub => (
                <div key={sub.id} className="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded-lg">
                  {sub.title}
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
