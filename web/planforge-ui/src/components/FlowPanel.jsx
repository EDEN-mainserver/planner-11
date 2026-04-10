import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { callGemini } from "../utils/gemini";

// ── 레이아웃 상수
const LABEL_W    = 110;
const PAD_L      = 20;
const PAD_TOP    = 44;
const NODE_H     = 28;
const ROW_H      = 54;
const SEC_PAD    = 16;   // 섹션 내부 상하 패딩
const COL_GAP    = 84;   // 열 간격
const ARROW      = 6;    // 화살촉 크기

// 컬럼 너비: [start, section_top, page/action, ...]
const CW = [80, 140, 120, 120, 120, 120];
function cw(col)    { return CW[Math.min(col, CW.length - 1)]; }
function cx(col)    { let x = LABEL_W + PAD_L; for (let i = 0; i < col; i++) x += cw(i) + COL_GAP; return x; }
function cright(col){ return cx(col) + cw(col); }

// 노드 타입별 스타일
const NS = {
  start:       { fill: '#111827',               text: '#ffffff', stroke: null,                   rx: 5  },
  section_top: { fill: '#7c3aed',               text: '#ffffff', stroke: null,                   rx: 6  },
  page:        { fill: 'rgba(124,58,237,0.13)', text: '#5b21b6', stroke: 'rgba(124,58,237,0.4)', rx: 6  },
  action:      { fill: '#ffffff',               text: '#374151', stroke: '#d4d4d4',              rx: 14 },
};

const EDGE_COLOR = '#c8c8c8';
const CROSS_EDGE_COLOR = '#a78bfa'; // 크로스 섹션 엣지 색상 (보라)

export default function FlowPanel({ prd, specData, flowData, setFlowData }) {
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const [tx, setTx] = useState(0), [ty, setTy] = useState(0), [scale, setScale] = useState(1);
  const drag = useRef({ active: false, sx: 0, sy: 0, ox: 0, oy: 0 });

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setScale(s => {
      const ns = Math.min(3, Math.max(0.2, s * f));
      const r = ns / s;
      setTx(x => mx - r * (mx - x));
      setTy(y => my - r * (my - y));
      return ns;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const onDown = useCallback((e) => {
    if (e.button !== 0) return;
    drag.current = { active: true, sx: e.clientX, sy: e.clientY, ox: tx, oy: ty };
  }, [tx, ty]);
  const onMove = useCallback((e) => {
    if (!drag.current.active) return;
    setTx(drag.current.ox + (e.clientX - drag.current.sx));
    setTy(drag.current.oy + (e.clientY - drag.current.sy));
  }, []);
  const onUp = useCallback(() => { drag.current.active = false; }, []);

  // ── AI 생성
  const generate = async () => {
    if (!specData?.features?.length) { alert('먼저 기능명세서를 생성해주세요.'); return; }
    setLoading(true);

    // specData IDs를 그대로 전달 (AI가 노드 ID로 사용)
    const feats = specData.features.map(f => ({
      id: f.id,
      title: f.title,
      subs: (f.sub_features || []).slice(0, 6).map(s => ({ id: s.id, title: s.title }))
    }));

    const prompt = `당신은 UX 설계 전문가입니다. 아래 기능명세서를 바탕으로 각 기능의 내부 유저 플로우를 JSON으로 설계하세요.

기능명세서(ID 포함):
${JSON.stringify(feats, null, 2)}

⚠️ 중요한 ID 규칙:
- section_top 노드의 id = 해당 feature의 id 그대로 사용 (예: 기능 id가 "F-001"이면 → id: "F-001")
- page/action 노드의 id = 해당 sub_feature의 id 그대로 사용 (예: sub_feature id가 "SF-001-1"이면 → id: "SF-001-1")
- start 노드의 id = "start"
- 절대로 다른 id를 임의로 만들지 마세요!

출력 형식(JSON만, 다른 텍스트 금지):
{
  "sections": [
    {
      "featureId": "F-001",
      "featureTitle": "섹션명",
      "nodes": [
        {"id": "정확한ID", "type": "start|section_top|page|action", "label": "한국어10자이내", "col": 0, "row": 0}
      ],
      "edges": [{"from": "nodeId", "to": "nodeId"}]
    }
  ]
}

노드 타입 정의:
- start: 최초 시작점, 첫 섹션에만 1개 (id:"start", col:0, row:0, label:"시작")
- section_top: 각 기능의 메인 진입점, 섹션당 1개 (id = feature.id)
- page: 섹션 내 하위 화면 (id = sub_feature.id)
- action: 유저의 구체적 행동/결과 (id = sub_feature.id 중 행동성 항목)

섹션 내부 연결 규칙:
1. 첫 섹션: start(col:0) → section_top(col:1) → sub_features를 page/action(col:2)으로
2. 두 번째+ 섹션: section_top(col:1) → sub_features를 page/action(col:2)으로
   (섹션 간 연결은 우리가 자동으로 처리하므로 cross-section edge는 생성하지 마세요)
3. section_top의 row = 자식 노드들의 중간 row (소수 내림)
4. 같은 섹션 내 page/action의 row는 0부터 순서대로
5. 모든 edge 방향: 작은 col → 큰 col
6. edges에는 같은 섹션 내부 연결만 포함

예시:
섹션1(F-001): nodes: [start(col:0), F-001(col:1), SF-001-1(col:2), SF-001-2(col:2)]
              edges: [{from:"start",to:"F-001"},{from:"F-001",to:"SF-001-1"},{from:"F-001",to:"SF-001-2"}]
섹션2(F-002): nodes: [F-002(col:1), SF-002-1(col:2), SF-002-2(col:2)]
              edges: [{from:"F-002",to:"SF-002-1"},{from:"F-002",to:"SF-002-2"}]
→ F-001과 F-002 사이 연결은 우리가 자동 생성`;

    try {
      const text = await callGemini([{ role: 'user', content: prompt }], '');
      const m = text.match(/\{[\s\S]*\}/);
      if (m) setFlowData(JSON.parse(m[0]));
    } catch (e) { alert('생성 실패: ' + e.message); }
    setLoading(false);
  };

  // ── 레이아웃 계산
  const layout = useMemo(() => {
    if (!flowData?.sections) return null;

    const allNodeMap = {}; // id → positioned node
    const sections = [];
    let yOffset = PAD_TOP;
    let maxColGlobal = 1;

    for (const sec of flowData.sections) {
      const nodes = sec.nodes || [];
      if (!nodes.length) continue;
      const maxRow = Math.max(...nodes.map(n => n.row || 0));
      const maxCol = Math.max(...nodes.map(n => n.col || 0));
      maxColGlobal = Math.max(maxColGlobal, maxCol);
      const contentH = (maxRow + 1) * ROW_H;
      const sectionH = Math.max(contentH + SEC_PAD * 2, 76);
      const extraPad = (sectionH - contentH - SEC_PAD * 2) / 2;

      const positioned = nodes.map(n => {
        const col = n.col || 0, row = n.row || 0;
        const nw = cw(col), nx = cx(col);
        const ny = yOffset + SEC_PAD + extraPad + row * ROW_H;
        const node = { ...n, x: nx, y: ny, cx: nx + nw / 2, cy: ny + NODE_H / 2, w: nw, h: NODE_H };
        allNodeMap[n.id] = node;
        return node;
      });

      sections.push({ ...sec, positioned, yOffset, sectionH });
      yOffset += sectionH;
    }

    // ── 일반 엣지 수집 (섹션 내부)
    const bySource = {};
    for (const sec of sections) {
      for (const e of (sec.edges || [])) {
        const from = allNodeMap[e.from], to = allNodeMap[e.to];
        if (!from || !to) continue;
        if (!bySource[from.id]) bySource[from.id] = { from, targets: [] };
        bySource[from.id].targets.push({ ...to, isCross: false });
      }
    }

    // ── leads_to 기반 크로스 섹션 엣지 자동 생성
    if (specData?.features) {
      const collectSubs = (subs) => {
        const result = [];
        for (const s of subs) {
          result.push(s);
          if (s.sub_features?.length) result.push(...collectSubs(s.sub_features));
        }
        return result;
      };
      for (const feat of specData.features) {
        for (const sub of collectSubs(feat.sub_features || [])) {
          if (!sub.leads_to) continue;
          const fromNode = allNodeMap[sub.id];
          const toNode = allNodeMap[sub.leads_to];
          if (!fromNode || !toNode) continue;
          if (!bySource[fromNode.id]) bySource[fromNode.id] = { from: fromNode, targets: [] };
          const alreadyLinked = bySource[fromNode.id].targets.some(t => t.id === toNode.id);
          if (!alreadyLinked) bySource[fromNode.id].targets.push({ ...toNode, isCross: true });
        }
      }
    }

    // ── 크로스 섹션 엣지에 bypass 인덱스 부여 (겹침 방지 스태거)
    let crossIdx = 0;
    const edgeGroupsArr = Object.values(bySource).map(group => {
      const newTargets = group.targets.map(t => {
        if (t.isCross) return { ...t, bypassIdx: crossIdx++ };
        return t;
      });
      return { ...group, targets: newTargets };
    });

    // bypass 레인: col:2 노드 바로 오른쪽 고정 (경로 최소화)
    const BYPASS_BASE = cx(2) + cw(2) + 24;
    const BYPASS_STEP = 16;
    const maxBypassX = crossIdx > 0 ? BYPASS_BASE + (crossIdx - 1) * BYPASS_STEP : BYPASS_BASE;

    return {
      sections,
      edgeGroups: edgeGroupsArr,
      bypassBase: BYPASS_BASE,
      bypassStep: BYPASS_STEP,
      svgW: maxBypassX + 60,
      svgH: yOffset + PAD_TOP,
    };
  }, [flowData, specData]);

  // ── 빈 상태
  if (!flowData) return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <span className="font-semibold text-gray-800 text-sm">유저플로우</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <p className="text-gray-800 text-lg font-medium text-center">기능명세서 기반 유저플로우를 생성합니다</p>
        <p className="text-gray-500 text-sm text-center">AI가 기능별 사용자 흐름을 자동으로 시각화해드려요</p>
        <button onClick={generate} disabled={loading}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm">
          {loading ? '생성 중...' : '✨ 유저플로우 생성하기'}
        </button>
        {!specData?.features?.length && (
          <p className="text-xs text-amber-500">기능명세서 탭에서 먼저 기능명세서를 생성해주세요.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative h-full flex flex-col overflow-hidden" style={{ backgroundColor: '#ebebeb' }}>
      {/* 헤더 */}
      <div className="px-5 py-2.5 bg-white border-b border-gray-200 shrink-0 flex items-center gap-3">
        <span className="font-semibold text-gray-800 text-sm">유저플로우</span>
        <span className="text-xs text-gray-400">{flowData?.sections?.length}개 섹션</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={() => setScale(s => Math.min(3, +(s * 1.2).toFixed(2)))}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-purple-600 font-bold">+</button>
          <span className="text-xs text-gray-400 w-9 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.max(0.2, +(s * 0.85).toFixed(2)))}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-purple-600 font-bold">−</button>
          <button onClick={() => { setTx(0); setTy(0); setScale(1); }}
            className="text-xs text-gray-400 hover:text-purple-600 ml-1">↺</button>
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <button onClick={() => { setFlowData(null); }}
            className="text-xs font-medium text-purple-500 hover:text-purple-700 border border-purple-200 rounded-md px-2 py-0.5 hover:bg-purple-50 transition-colors">↺ 재생성</button>
        </div>
      </div>

      {/* 캔버스 */}
      <div ref={containerRef}
        className="flex-1 overflow-hidden relative"
        style={{ backgroundImage: 'radial-gradient(circle, #c4c4c4 1px, transparent 1px)', backgroundSize: '24px 24px', cursor: 'grab', userSelect: 'none' }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}>

        {layout && (
          <div style={{ transform: `translate(${tx}px,${ty}px) scale(${scale})`, transformOrigin: '0 0', position: 'absolute' }}>
            <svg width={layout.svgW} height={layout.svgH} style={{ display: 'block' }}
              fontFamily="'Noto Sans KR', system-ui, sans-serif">

              {/* ── 섹션 배경 */}
              {layout.sections.map((sec, si) => (
                <rect key={`bg-${sec.featureId}`}
                  x={LABEL_W} y={sec.yOffset}
                  width={layout.bypassBase - LABEL_W + (layout.bypassStep * 2)} height={sec.sectionH}
                  fill={si % 2 === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(248,246,255,0.7)'}
                  stroke="rgba(209,213,219,0.5)" strokeWidth="0.8" />
              ))}

              {/* ── 섹션 라벨 */}
              {layout.sections.map(sec => (
                <text key={`lbl-${sec.featureId}`}
                  x={LABEL_W - 10} y={sec.yOffset + sec.sectionH / 2}
                  textAnchor="end" dominantBaseline="middle"
                  fill="#6b7280" fontSize="10.5" fontWeight="500" letterSpacing="-0.3">
                  {(sec.featureTitle || '').slice(0, 13)}
                </text>
              ))}

              {/* ── 연결선 */}
              {layout.edgeGroups.map(({ from, targets }) => {
                const normalTargets = targets.filter(t => !t.isCross);
                const crossTargets  = targets.filter(t => t.isCross);
                const x1 = from.x + from.w, y1 = from.cy;

                // ── 일반 엣지: 직각 트리 스타일 (좌→우)
                const renderNormal = () => {
                  if (!normalTargets.length) return null;
                  const jx = x1 + COL_GAP / 2;

                  if (normalTargets.length === 1) {
                    const t = normalTargets[0];
                    return (
                      <g key={`en-${from.id}`}>
                        <polyline points={`${x1},${y1} ${jx},${y1} ${jx},${t.cy} ${t.x},${t.cy}`}
                          fill="none" stroke={EDGE_COLOR} strokeWidth="1.1" />
                        <polygon points={`${t.x},${t.cy} ${t.x-ARROW},${t.cy-ARROW/2} ${t.x-ARROW},${t.cy+ARROW/2}`}
                          fill={EDGE_COLOR} />
                      </g>
                    );
                  }

                  const minCY = Math.min(...normalTargets.map(t => t.cy));
                  const maxCY = Math.max(...normalTargets.map(t => t.cy));
                  return (
                    <g key={`en-${from.id}`}>
                      <line x1={x1} y1={y1} x2={jx} y2={y1} stroke={EDGE_COLOR} strokeWidth="1.1" />
                      <line x1={jx} y1={Math.min(y1, minCY)} x2={jx} y2={Math.max(y1, maxCY)}
                        stroke={EDGE_COLOR} strokeWidth="1.1" />
                      {normalTargets.map((t, ti) => (
                        <g key={`nb-${from.id}-${ti}`}>
                          <line x1={jx} y1={t.cy} x2={t.x} y2={t.cy} stroke={EDGE_COLOR} strokeWidth="1.1" />
                          <polygon points={`${t.x},${t.cy} ${t.x-ARROW},${t.cy-ARROW/2} ${t.x-ARROW},${t.cy+ARROW/2}`}
                            fill={EDGE_COLOR} />
                        </g>
                      ))}
                    </g>
                  );
                };

                // ── 크로스 섹션 엣지: 우회 경로 (우→하→좌 → section_top 왼쪽 진입)
                const renderCross = () => {
                  if (!crossTargets.length) return null;
                  return crossTargets.map((t, ti) => {
                    const bx = layout.bypassBase + (t.bypassIdx ?? ti) * layout.bypassStep;
                    const y2 = t.cy;
                    // 진입점: section_top 왼쪽 가장자리 → 오른쪽 방향 화살촉(→)
                    const entryX = t.x;
                    return (
                      <g key={`cx-${from.id}-${ti}`}>
                        {/* 우회 경로: 소스 우측 → bypass 레인 → 아래 → section_top 왼쪽 */}
                        <polyline
                          points={`${x1},${y1} ${bx},${y1} ${bx},${y2} ${entryX},${y2}`}
                          fill="none" stroke={CROSS_EDGE_COLOR} strokeWidth="1.5"
                          strokeDasharray="6,3" strokeLinejoin="round" />
                        {/* 왼쪽에서 진입하는 화살촉 (→) */}
                        <polygon
                          points={`${entryX},${y2} ${entryX-ARROW},${y2-ARROW/2} ${entryX-ARROW},${y2+ARROW/2}`}
                          fill={CROSS_EDGE_COLOR} />
                        {/* bypass 레인 꺾임점 표시 */}
                        <circle cx={bx} cy={y1} r="2.5" fill={CROSS_EDGE_COLOR} />
                        <circle cx={bx} cy={y2} r="2.5" fill={CROSS_EDGE_COLOR} />
                      </g>
                    );
                  });
                };

                return (
                  <g key={`eg-${from.id}`}>
                    {renderNormal()}
                    {renderCross()}
                  </g>
                );
              })}

              {/* ── 노드 */}
              {layout.sections.map(sec =>
                sec.positioned.map(n => {
                  const s = NS[n.type] || NS.action;
                  return (
                    <g key={`n-${n.id}`}>
                      <rect x={n.x} y={n.y} width={n.w} height={n.h}
                        rx={s.rx} fill={s.fill}
                        stroke={s.stroke || 'none'} strokeWidth={s.stroke ? 0.9 : 0} />
                      <text x={n.cx} y={n.cy + 0.5}
                        textAnchor="middle" dominantBaseline="middle"
                        fill={s.text} fontSize="10.5"
                        fontWeight={n.type === 'start' || n.type === 'section_top' ? '600' : '400'}>
                        {(n.label || '').slice(0, 12)}
                      </text>
                    </g>
                  );
                })
              )}
            </svg>
          </div>
        )}

        {/* 범례 (우측 상단) */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-3 bg-white border border-gray-200 rounded-md px-3 py-2 shadow-sm">
          {[
            { label: '시작',          fill: '#111827',               stroke: null,                   rx: 4  },
            { label: '섹션 최상위 페이지', fill: '#7c3aed',          stroke: null,                   rx: 4  },
            { label: '페이지',        fill: 'rgba(124,58,237,0.13)', stroke: 'rgba(124,58,237,0.4)', rx: 4  },
            { label: '행동',          fill: '#ffffff',               stroke: '#d4d4d4',              rx: 10 },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-1.5">
              <svg width="14" height="14" style={{ flexShrink: 0 }}>
                <rect x="0" y="0" width="14" height="14"
                  rx={item.rx} fill={item.fill}
                  stroke={item.stroke || 'none'} strokeWidth="0.8" />
              </svg>
              <span className="text-xs text-gray-500 whitespace-nowrap">{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-1">
            <svg width="22" height="14" style={{ flexShrink: 0 }}>
              <line x1="0" y1="7" x2="16" y2="7" stroke="#c8c8c8" strokeWidth="1.5" />
              <polygon points="16,7 11,4.5 11,9.5" fill="#c8c8c8" />
            </svg>
            <span className="text-xs text-gray-500 whitespace-nowrap">섹션 내부</span>
          </div>
          <div className="flex items-center gap-1">
            <svg width="22" height="14" style={{ flexShrink: 0 }}>
              <line x1="0" y1="7" x2="16" y2="7" stroke="#a78bfa" strokeWidth="1.5" strokeDasharray="5,2" />
              <polygon points="22,7 17,4.5 17,9.5" fill="#a78bfa" />
            </svg>
            <span className="text-xs text-gray-500 whitespace-nowrap">섹션 간 이동</span>
          </div>
        </div>
      </div>
    </div>
  );
}
