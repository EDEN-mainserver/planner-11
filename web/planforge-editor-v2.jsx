import { useState, useRef, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */
const DEMO_PRD = {
  overview: { one_liner: "AI 기반 바이럴 콘텐츠 예측 플랫폼", product_goal: "콘텐츠 바이럴 가능성을 사전에 예측하고 트렌드를 분석하여 성과를 극대화한다.", background: "콘텐츠 크리에이터와 마케터들이 어떤 콘텐츠가 성공할지 미리 예측하고 기획하는 데 전문적인 데이터 분석이 필요함." },
  core_value: { problem: "트렌드 파악의 어려움, 콘텐츠 성과 예측 불가 및 반복적인 리서치 업무", solution: "AI 모델을 통한 바이럴 예측, 실시간 트렌드 및 키워드 분석, 아이디어 자동 생성 자동화", differentiator: "단순 트렌드 제공이 아닌, 사용자의 텍스트/이미지를 분석해 실제 바이럴 지수 점수와 예상 성과를 예측." },
  target: { users: "콘텐츠를 주기적으로 제작하는 크리에이터, 마케터, 소셜 미디어 관리자", scenario: "1. 타겟 도메인/키워드 분석 → 2. AI가 뜨는 아이디어 추천 → 3. 콘텐츠 초안 작성 → 4. 바이럴 예측 지수 확인 → 5. 성과 리포트 출력" },
  metrics: { kpis: "예측 정확도 85% 이상 / 콘텐츠 기획 시간 60% 단축 / 활성 사용자 주 3회 이상 사용", risks: "플랫폼별 알고리즘 변화에 따른 예측 모델 오차 발생 가능성" },
  settings: { category: "마케팅/AI 예측", roles: ["크리에이터", "마케터", "시스템"], devices: ["Desktop", "Mobile Web"] }
};

const SPEC_TREE = {
  id: "root", label: "AI 기반 바이럴 콘텐츠 예측 플랫폼", type: "root", children: [
    { id: "R-001", label: "AI 기반 콘텐츠 아이디어 추천 및 생성", type: "requirement", priority: "critical", desc: "사용자가 설정한 관심사, 타겟 분석, 특정 브랜드 및 지역 트렌드를 기반으로 타겟팅 가능성이 높은 콘텐츠 아이디어를 추천하고, 텍스트 기반 아이디어 예시를 생성하여 제공합니다.", children: [] },
    { id: "R-002", label: "AI 바이럴 예측 모델", type: "requirement", priority: "critical", desc: "콘텐츠 데이터가 들어간 텍스트, 이미지, 영상 형태의 예측 시 모델이 학습결과를 조회하고, 예상 달성 가능성을 시각적 그래프 또는 점수로 제시합니다. 예측 정확성을 고도화합니다.", children: [] },
    { id: "R-003", label: "실시간 트렌드 및 키워드 분석", type: "requirement", priority: "high", desc: "주요 소셜 미디어 플랫폼, 검색 엔진, 커뮤니티 등에서 실시간으로 급상승 하는 인기 트렌드와 키워드를 분석하여 사용자에게 제공합니다. 수집 데이터를 기반으로 트렌드 상세 정보 제공.", children: [] },
    { id: "R-004", label: "경쟁사 콘텐츠 성과 분석", type: "requirement", priority: "high", desc: "사용자가 등록한 경쟁 채널 혹은 타겟/예시 콘텐츠 URL에 대한 성과 데이터를 분석하고, 어떤 콘텐츠가 높은 반응을 얻었는지 전략적 차이를 비교 인덱스로 제공합니다.", children: [] },
    { id: "R-005", label: "개인화된 대시보드 및 리포트", type: "requirement", priority: "medium", desc: "사용자의 콘텐츠 기획 활동, 예측 결과, 경쟁사 분석 리포트 확인 등 요약을 확인할 수 있는 개인화된 전체 대시보드를 제공하며 주/월간 등 자동 리포트를 생성합니다.", children: [] },
  ]
};

const FLOW_SECTIONS = [
  { id: "sec-1", label: "트리거", color: "#2d6a4f", nodes: [
    { id: "N-001", label: "5분 주기 트리거", type: "start", x: 80, y: 40 },
  ]},
  { id: "sec-2", label: "수집 및 분류", color: "#1d3557", nodes: [
    { id: "N-002", label: "크몽 메시지함\n스크래핑", type: "action", x: 80, y: 40 },
    { id: "N-003", label: "새 문의\n있는가?", type: "decision", x: 280, y: 40 },
    { id: "N-004", label: "AI 문의\n유형 분류", type: "action", x: 280, y: 160 },
    { id: "N-005", label: "자동 응대\n가능?", type: "decision", x: 280, y: 280 },
  ]},
  { id: "sec-3", label: "응대 처리", color: "#6a040f", nodes: [
    { id: "N-006", label: "맞춤 응답\n생성", type: "action", x: 80, y: 40 },
    { id: "N-007", label: "응답\n검증?", type: "decision", x: 80, y: 160 },
    { id: "N-008", label: "크몽 메시지\n발송", type: "action", x: 80, y: 280 },
    { id: "N-009", label: "담당자\n슬랙 알림", type: "action", x: 320, y: 40 },
  ]},
  { id: "sec-4", label: "기록 및 완료", color: "#7b2d8e", nodes: [
    { id: "N-010", label: "구글 시트\n로그 기록", type: "action", x: 80, y: 40 },
    { id: "N-011", label: "사이클 완료\n대기", type: "end", x: 280, y: 40 },
  ]},
];

const FLOW_EDGES = [
  { from: "N-001", to: "N-002" }, { from: "N-002", to: "N-003" },
  { from: "N-003", to: "N-011", label: "No" }, { from: "N-003", to: "N-004", label: "Yes" },
  { from: "N-004", to: "N-005" }, { from: "N-005", to: "N-006", label: "Yes" },
  { from: "N-005", to: "N-009", label: "No" }, { from: "N-006", to: "N-007" },
  { from: "N-007", to: "N-008", label: "통과" }, { from: "N-007", to: "N-006", label: "재생성" },
  { from: "N-008", to: "N-010" }, { from: "N-009", to: "N-010" },
  { from: "N-010", to: "N-011" },
];

const FLOW_VERSIONS = [
  { id: "v1", name: "새 플로우 1", date: "2026.04.09", active: true },
];

const priorityColors = { critical: '#ff4466', high: '#ffb443', medium: '#4499ff', low: '#5c6480' };
const typeColors = { root: '#00e877', requirement: '#4499ff', feature: '#ffb443', sub: '#8090c0' };
const nodeShapes = { start: '#2d6a4f', end: '#2d6a4f', action: '#1a2040', decision: '#b5651d', error: '#9d0208' };

/* ═══════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════ */
const Icon = ({ d, size = 14 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const IconSend = () => <Icon d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" size={15} />;
const IconPlus = () => <Icon d="M12 5V19M5 12H19" />;
const IconFile = () => <><Icon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path d="M14 2v6h6" stroke="currentColor" strokeWidth="2" fill="none" /></>;
const IconTree = () => <Icon d="M12 3v18M3 12h18M3 6h6M15 6h6M3 18h6M15 18h6" />;
const IconGrid = () => <Icon d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />;

/* ═══════════════════════════════════════════
   EDITABLE FIELD
   ═══════════════════════════════════════════ */
function EditField({ label, value, onChange, multiline }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);
  useEffect(() => { if (editing && ref.current) ref.current.focus(); }, [editing]);
  const save = () => { setEditing(false); onChange?.(draft); };

  if (editing) {
    const cls = "w-full bg-[#080c18] border border-[#00e87744] rounded-lg p-3 text-[#e0e4f0] text-sm leading-relaxed outline-none focus:border-[#00e877]";
    return multiline
      ? <textarea ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={save} className={cls + " resize-y min-h-[80px]"} />
      : <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)} onBlur={save} onKeyDown={e => e.key === 'Enter' && save()} className={cls} />;
  }
  return (
    <div onClick={() => setEditing(true)} className="cursor-text group">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#3a4060] mb-1">{label}</div>
      <div className="text-[13px] text-[#a0a8c8] leading-relaxed group-hover:bg-[#12162a] rounded px-2 py-1.5 -mx-2 transition-colors whitespace-pre-wrap">
        {value || <span className="text-[#1e2440] italic">클릭하여 입력...</span>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   PRD PANEL
   ═══════════════════════════════════════════ */
function PRDPanel({ prd, setPrd }) {
  const [openSections, setOpenSections] = useState({ overview: true, core: true, target: true, metrics: false, settings: false });
  const toggle = k => setOpenSections(p => ({ ...p, [k]: !p[k] }));
  const upd = (s, f, v) => setPrd(p => ({ ...p, [s]: { ...p[s], [f]: v } }));

  const filled = Object.values(prd).reduce((a, s) => a + Object.values(s).filter(v => v && String(v).length > 0).length, 0);
  const total = Object.values(prd).reduce((a, s) => a + Object.keys(s).length, 0);
  const pct = Math.round((filled / total) * 100);

  const SH = ({ id, icon, title }) => (
    <button onClick={() => toggle(id)} className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-[#12162a] transition-colors">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: openSections[id] ? 'rotate(90deg)' : 'rotate(0)', transition: '0.15s' }}><path d="M9 18l6-6-6-6" /></svg>
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#4a5070]">{icon} {title}</span>
    </button>
  );

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#141830] shrink-0">
        <span className="font-mono text-sm font-semibold text-[#e0e4f0]">PRD</span>
        <div className="flex-1 h-1 bg-[#080c18] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#00e877] to-[#00c4ff] rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="font-mono text-[10px] text-[#00e877]">{pct}%</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        <SH id="overview" icon="📋" title="개요" />
        {openSections.overview && <div className="px-4 pb-4 space-y-4">
          <EditField label="한 줄 정의" value={prd.overview.one_liner} onChange={v => upd('overview', 'one_liner', v)} />
          <EditField label="제품 목표" value={prd.overview.product_goal} onChange={v => upd('overview', 'product_goal', v)} multiline />
          <EditField label="배경" value={prd.overview.background} onChange={v => upd('overview', 'background', v)} multiline />
        </div>}
        <SH id="core" icon="💎" title="핵심 가치" />
        {openSections.core && <div className="px-4 pb-4 space-y-4">
          <EditField label="사용자 문제" value={prd.core_value.problem} onChange={v => upd('core_value', 'problem', v)} multiline />
          <EditField label="해결 방식" value={prd.core_value.solution} onChange={v => upd('core_value', 'solution', v)} multiline />
          <EditField label="차별점" value={prd.core_value.differentiator} onChange={v => upd('core_value', 'differentiator', v)} multiline />
        </div>}
        <SH id="target" icon="🎯" title="타겟 및 시나리오" />
        {openSections.target && <div className="px-4 pb-4 space-y-4">
          <EditField label="타겟 사용자" value={prd.target.users} onChange={v => upd('target', 'users', v)} multiline />
          <EditField label="사용 시나리오" value={prd.target.scenario} onChange={v => upd('target', 'scenario', v)} multiline />
        </div>}
        <SH id="metrics" icon="📊" title="성공 지표" />
        {openSections.metrics && <div className="px-4 pb-4 space-y-4">
          <EditField label="핵심 KPI" value={prd.metrics.kpis} onChange={v => upd('metrics', 'kpis', v)} multiline />
          <EditField label="리스크" value={prd.metrics.risks} onChange={v => upd('metrics', 'risks', v)} multiline />
        </div>}
        <SH id="settings" icon="⚙️" title="속성 설정" />
        {openSections.settings && <div className="px-4 pb-4 space-y-3">
          <EditField label="카테고리" value={prd.settings.category} onChange={v => upd('settings', 'category', v)} />
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#3a4060] mb-1">역할</div>
          <div className="flex flex-wrap gap-1">{prd.settings.roles.map((r, i) => <span key={i} className="px-2 py-0.5 text-[11px] rounded bg-[#080c18] border border-[#141830] text-[#6878a8]">{r}</span>)}</div>
        </div>}
        <div className="p-4">
          <button className="w-full py-2.5 text-xs font-mono text-[#4a5070] border border-[#141830] rounded-lg hover:border-[#00e87740] hover:text-[#00e877] transition-colors">
            기능명세서로 이동 →
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SPEC TREE / MINDMAP PANEL
   ═══════════════════════════════════════════ */
function SpecTreeNode({ node, depth = 0, selectedId, onSelect }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;
  const color = typeColors[node.type] || '#8090c0';

  return (
    <div>
      <div className={`flex items-center gap-1 py-1 px-2 rounded-md cursor-pointer transition-colors ${isSelected ? 'bg-[#151a30]' : 'hover:bg-[#0e1224]'}`}
        style={{ paddingLeft: `${depth * 20 + 8}px` }}
        onClick={() => onSelect(node)}>
        {hasChildren ? (
          <button onClick={e => { e.stopPropagation(); setOpen(!open); }} className="w-4 h-4 flex items-center justify-center shrink-0">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: '0.15s' }}><path d="M9 18l6-6-6-6" /></svg>
          </button>
        ) : <div className="w-4 h-4 flex items-center justify-center shrink-0"><div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} /></div>}
        <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color, opacity: 0.6 }} />
        <span className="text-[12px] text-[#c0c8e0] truncate flex-1">{node.label}</span>
        {node.priority && <span className="text-[9px] font-mono uppercase px-1.5 py-0 rounded shrink-0" style={{ background: (priorityColors[node.priority] || '#555') + '18', color: priorityColors[node.priority] || '#555' }}>{node.priority[0].toUpperCase()}</span>}
      </div>
      {open && hasChildren && node.children.map(c => <SpecTreeNode key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />)}
    </div>
  );
}

function SpecPanel() {
  const [view, setView] = useState('tree'); // tree | graph
  const [selected, setSelected] = useState(null);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#141830] shrink-0">
        <span className="font-mono text-sm font-semibold text-[#e0e4f0]">기능명세서</span>
        <div className="flex-1" />
        <div className="flex bg-[#080c18] rounded border border-[#141830]">
          <button onClick={() => setView('tree')} className={`px-2.5 py-1 text-[10px] font-mono rounded transition-colors ${view === 'tree' ? 'bg-[#151a30] text-[#00e877]' : 'text-[#4a5070]'}`}>트리 뷰</button>
          <button onClick={() => setView('graph')} className={`px-2.5 py-1 text-[10px] font-mono rounded transition-colors ${view === 'graph' ? 'bg-[#151a30] text-[#00e877]' : 'text-[#4a5070]'}`}>그래프 뷰</button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Tree */}
        <div className={`${selected ? 'w-[45%]' : 'w-full'} overflow-y-auto border-r border-[#141830] py-2 transition-all`}>
          {view === 'tree' ? (
            <SpecTreeNode node={SPEC_TREE} selectedId={selected?.id} onSelect={setSelected} />
          ) : (
            <SpecGraphView onSelect={setSelected} selectedId={selected?.id} />
          )}
        </div>
        {/* Detail */}
        {selected && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] font-mono text-[#3a4060] uppercase tracking-wider">{selected.type} · {selected.id}</div>
                <div className="text-base font-semibold text-[#e0e4f0] mt-0.5">{selected.label}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-[#3a4060] hover:text-[#8090c0] text-lg">✕</button>
            </div>
            {selected.priority && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded" style={{ background: (priorityColors[selected.priority]) + '18', color: priorityColors[selected.priority], border: `1px solid ${priorityColors[selected.priority]}30` }}>{selected.priority}</span>
                {selected.specId && <span className="text-[10px] font-mono text-[#00e877] px-2 py-0.5 rounded bg-[#00e87710] border border-[#00e87720]">{selected.specId}</span>}
              </div>
            )}
            {selected.children && selected.children.length > 0 && (
              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-[#3a4060] mb-2">하위 항목 ({selected.children.length})</div>
                {selected.children.map(c => (
                  <button key={c.id} onClick={() => setSelected(c)} className="w-full text-left px-3 py-2 mb-1 rounded-lg bg-[#080c18] border border-[#141830] hover:border-[#00e87730] transition-colors flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: typeColors[c.type] }} />
                    <span className="text-[12px] text-[#a0a8c8]">{c.label}</span>
                    {c.priority && <span className="text-[9px] font-mono ml-auto" style={{ color: priorityColors[c.priority] }}>{c.priority[0].toUpperCase()}</span>}
                  </button>
                ))}
              </div>
            )}
            <div className="pt-2">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-[#4a5070] border border-dashed border-[#1a1f35] rounded-lg hover:border-[#00e87740] hover:text-[#00e877] transition-colors">
                <span>+</span> 하위 항목 추가
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* Graph View - visual mindmap (Light UI Refined) */
function SpecGraphView({ onSelect, selectedId }) {
  const root = SPEC_TREE;
  const children = root.children || [];
  
  const rootW = 220, rootH = 74;
  const childW = 360, childH = 90;
  const placeholderW = 180, placeholderH = 34;
  
  const gapY = 16;
  const startX = 40;
  const childX = startX + rootW + 60;
  const placeholderX = childX + childW + 60;
  
  const totalH = children.length * (childH + gapY) - gapY;
  const rootY = Math.max(0, (totalH - rootH) / 2) + 20;
  
  const svgW = Math.max(1000, placeholderX + placeholderW + 120);
  const svgH = Math.max(totalH + 80, rootY + rootH + 40);

  return (
    <div className="w-full h-full overflow-auto bg-[#fafbfc]" style={{ minHeight: '100%' }}>
      <svg width={svgW} height={svgH} className="min-w-full">
        {/* Edges from root to children */}
        {children.map((c, i) => {
          const cy = 20 + i * (childH + gapY);
          const fromX = startX + rootW;
          const fromY = rootY + rootH / 2;
          const toX = childX;
          const toY = cy + childH / 2;
          
          return (
            <g key={`edge-${i}`}>
              <path d={`M${fromX},${fromY} C${fromX + 30},${fromY} ${toX - 30},${toY} ${toX},${toY}`} 
                fill="none" stroke="#e4e7ed" strokeWidth="1.5" />
              <g transform={`translate(${startX + rootW + 30}, ${fromY - 8})`}>
                 <rect x="0" y="0" width="16" height="16" rx="8" fill="#fff" stroke="#e4e7ed" strokeWidth="1.5"/>
                 <text x="8" y="12" fontSize="13" fill="#a0aab8" textAnchor="middle">+</text>
              </g>
            </g>
          );
        })}
        
        {/* Edges from children to placeholders */}
        {children.map((c, i) => {
          const cy = 20 + i * (childH + gapY);
          const fromX = childX + childW;
          const fromY = cy + childH / 2;
          const toX = placeholderX;
          const toY = fromY;
          
          return (
             <g key={`edge-p-${i}`}>
               <path d={`M${fromX},${fromY} L${toX},${toY}`} stroke="#e4e7ed" strokeWidth="1.5" strokeDasharray="4 3"/>
               <g transform={`translate(${fromX + 24}, ${fromY - 8})`}>
                 <rect x="0" y="0" width="16" height="16" rx="8" fill="#fff" stroke="#e4e7ed" strokeWidth="1.5"/>
                 <text x="8" y="12" fontSize="13" fill="#a0aab8" textAnchor="middle">+</text>
              </g>
             </g>
          );
        })}

        {/* Root Node */}
        <foreignObject x={startX} y={rootY} width={rootW} height={rootH}>
          <div className="w-full h-full bg-white rounded-xl border border-gray-200/60 p-3.5 flex flex-col justify-center gap-1.5" style={{boxShadow: '0 4px 16px rgba(0,0,0,0.03)'}}>
            <div className="flex items-center gap-2">
              <div className="text-gray-400 text-sm">📄</div>
              <div className="text-[12px] font-bold text-gray-800 tracking-tight leading-tight">{root.label} <span className="text-[10px] text-gray-400 font-normal ml-0.5">↗ PRD</span></div>
            </div>
            <button className="mt-0.5 text-[10px] text-indigo-500 font-medium bg-indigo-50/50 py-1 rounded-md border border-indigo-100 flex items-center justify-center gap-1 hover:bg-indigo-50 transition-colors">
              ✨ 모든 하위 항목 생성
            </button>
          </div>
        </foreignObject>
        
        {/* Children Nodes */}
        {children.map((c, i) => {
          const cy = 20 + i * (childH + gapY);
          return (
            <foreignObject key={c.id} x={childX} y={cy} width={childW} height={childH}>
               <div className="w-full h-full bg-white rounded-xl border border-gray-200/60 p-4 flex flex-col" style={{boxShadow: '0 2px 10px rgba(0,0,0,0.02)'}}>
                 <div className="flex items-center justify-between mb-1.5">
                   <div className="flex items-center gap-2">
                     <span className="text-red-400 text-[13px]">📊</span>
                     <span className="text-[12px] font-bold text-gray-800 tracking-tight">{c.label}</span>
                   </div>
                   <span className="text-yellow-400 text-xs">⭐</span>
                 </div>
                 <div className="text-[10px] text-gray-500/90 leading-relaxed font-medium break-keep h-full overflow-hidden">
                   {c.desc}
                 </div>
               </div>
            </foreignObject>
          );
        })}
        
        {/* Placeholder Node 1 */}
        {children.map((c, i) => {
          const cy = 20 + i * (childH + gapY);
          return (
             <foreignObject key={`p1-${i}`} x={placeholderX} y={cy + childH/2 - placeholderH/2} width={placeholderW} height={placeholderH}>
               <div className="w-full h-full bg-white/80 rounded-lg border border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-white transition-colors">
                 <span className="text-[10.5px] text-gray-400 font-medium">상세 기능 추가</span>
               </div>
             </foreignObject>
          );
        })}

        {/* Placeholder Nodes 2 (Detailed functions placeholders mapping to image right-most) */}
        {children.map((c, i) => {
          const cy = 20 + i * (childH + gapY);
          const fromX2 = placeholderX + placeholderW;
          const fromY2 = cy + childH / 2;
          const toX2 = fromX2 + 80;
          return (
             <g key={`p2-${i}`}>
               <path d={`M${fromX2},${fromY2} L${toX2},${fromY2}`} stroke="#e4e7ed" strokeWidth="1.5" strokeDasharray="4 3"/>
               <foreignObject x={toX2} y={cy + childH/2 - placeholderH/2} width={placeholderW} height={placeholderH}>
                 <div className="w-full h-full bg-white/80 rounded-lg border border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:bg-white transition-colors">
                   <span className="text-[10.5px] text-gray-400 font-medium">상세 기능 추가</span>
                 </div>
               </foreignObject>
             </g>
          );
        })}

      </svg>
    </div>
  );
}

/* ═══════════════════════════════════════════
   FLOW CANVAS PANEL
   ═══════════════════════════════════════════ */
function FlowPanel() {
  const [versions] = useState(FLOW_VERSIONS);
  const [selectedNode, setSelectedNode] = useState(null);

  // Build absolute positions
  const sectionH = 380;
  const sectionW = 480;
  const allNodes = {};
  FLOW_SECTIONS.forEach((sec, si) => {
    sec.nodes.forEach(n => {
      allNodes[n.id] = { ...n, absX: 100 + n.x, absY: si * sectionH + 60 + n.y };
    });
  });

  const totalH = FLOW_SECTIONS.length * sectionH;

  return (
    <div className="h-full flex flex-col">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-[#141830] shrink-0">
        <span className="font-mono text-sm font-semibold text-[#e0e4f0]">유저플로우</span>
        <div className="flex-1" />
        {/* Legend */}
        <div className="flex items-center gap-3 text-[10px] font-mono text-[#4a5070]">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#2d6a4f]" /> 시작/끝</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-[#1a2040]" /> 액션</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rotate-45 bg-[#b5651d]" /> 분기</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-[#080b14]" style={{ backgroundImage: 'radial-gradient(circle, #141830 1px, transparent 1px)', backgroundSize: '24px 24px' }}>
          <svg width={sectionW + 200} height={totalH + 40} className="min-w-full">
            {/* Sections */}
            {FLOW_SECTIONS.map((sec, si) => (
              <g key={sec.id}>
                <rect x={0} y={si * sectionH} width={sectionW + 200} height={sectionH} fill="none" stroke={sec.color + '30'} strokeWidth="1" strokeDasharray="4 4" rx={8} />
                <text x={16} y={si * sectionH + 24} fill={sec.color} fontSize="11" fontFamily="monospace" fontWeight="600" opacity={0.7}>{sec.label}</text>
              </g>
            ))}

            {/* Edges */}
            {FLOW_EDGES.map((e, i) => {
              const from = allNodes[e.from];
              const to = allNodes[e.to];
              if (!from || !to) return null;
              const fx = from.absX + 60, fy = from.absY + 24;
              const tx = to.absX + 60, ty = to.absY;
              const my = (fy + ty) / 2;
              return (
                <g key={i}>
                  <path d={`M${fx},${fy} C${fx},${my} ${tx},${my} ${tx},${ty}`} fill="none" stroke="#3a4060" strokeWidth="1.5" />
                  <polygon points={`${tx - 4},${ty - 6} ${tx + 4},${ty - 6} ${tx},${ty}`} fill="#3a4060" />
                  {e.label && <text x={(fx + tx) / 2 + 8} y={(fy + ty) / 2 - 4} fill="#5c6480" fontSize="9" fontFamily="monospace">{e.label}</text>}
                </g>
              );
            })}

            {/* Nodes */}
            {Object.values(allNodes).map(n => {
              const fill = nodeShapes[n.type] || '#1a2040';
              const isSel = selectedNode === n.id;
              const w = 120, h = 48;
              if (n.type === 'decision') {
                const cx = n.absX + 60, cy = n.absY + 24;
                return (
                  <g key={n.id} onClick={() => setSelectedNode(isSel ? null : n.id)} className="cursor-pointer">
                    <polygon points={`${cx},${cy - 28} ${cx + 55},${cy} ${cx},${cy + 28} ${cx - 55},${cy}`} fill={fill} stroke={isSel ? '#ffb443' : '#b5651d50'} strokeWidth={isSel ? 2 : 1} />
                    {n.label.split('\n').map((line, li) => <text key={li} x={cx} y={cy - 4 + li * 14} textAnchor="middle" fill="#e0e4f0" fontSize="10" fontFamily="'Noto Sans KR', sans-serif">{line}</text>)}
                  </g>
                );
              }
              if (n.type === 'start' || n.type === 'end') {
                return (
                  <g key={n.id} onClick={() => setSelectedNode(isSel ? null : n.id)} className="cursor-pointer">
                    <ellipse cx={n.absX + 60} cy={n.absY + 20} rx={55} ry={20} fill={fill} stroke={isSel ? '#00e877' : '#40916c50'} strokeWidth={isSel ? 2 : 1} />
                    {n.label.split('\n').map((line, li) => <text key={li} x={n.absX + 60} y={n.absY + 18 + li * 13} textAnchor="middle" fill="#fff" fontSize="10" fontFamily="'Noto Sans KR', sans-serif">{line}</text>)}
                  </g>
                );
              }
              return (
                <g key={n.id} onClick={() => setSelectedNode(isSel ? null : n.id)} className="cursor-pointer">
                  <rect x={n.absX} y={n.absY} width={w} height={h} rx={8} fill={fill} stroke={isSel ? '#4499ff' : '#1e254050'} strokeWidth={isSel ? 2 : 1} />
                  {n.label.split('\n').map((line, li) => <text key={li} x={n.absX + 60} y={n.absY + 20 + li * 14} textAnchor="middle" fill="#d0d4e0" fontSize="10" fontFamily="'Noto Sans KR', sans-serif">{line}</text>)}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Right panel - versions + sections */}
        <div className="w-[220px] shrink-0 border-l border-[#141830] bg-[#0a0e1a] overflow-y-auto">
          <div className="px-3 py-3 border-b border-[#141830]">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#3a4060] mb-2">유저플로우</div>
            <button className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono text-[#00e877] bg-[#00e87708] border border-[#00e87720] rounded-lg hover:bg-[#00e87715] transition-colors">
              <span>+</span> 새 유저 플로우
            </button>
          </div>

          {/* Versions */}
          <div className="px-3 py-2 border-b border-[#141830]">
            {versions.map(v => (
              <div key={v.id} className={`flex items-center gap-2 px-2 py-1.5 rounded text-[11px] ${v.active ? 'bg-[#12162a] text-[#e0e4f0]' : 'text-[#4a5070]'}`}>
                <div className="w-1.5 h-1.5 rounded-full bg-[#00e877]" />
                <span className="flex-1">{v.name}</span>
                <span className="text-[9px] text-[#3a4060]">{v.date}</span>
              </div>
            ))}
            <button className="w-full mt-1.5 px-2 py-1.5 text-[10px] font-mono text-[#4a5070] border border-dashed border-[#141830] rounded hover:border-[#4a5070] transition-colors">
              수정본 만들기
            </button>
          </div>

          {/* Sections */}
          <div className="px-3 py-2">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#3a4060] mb-2">섹션</div>
            {FLOW_SECTIONS.map((sec, i) => (
              <div key={sec.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[#12162a] transition-colors mb-0.5 group">
                <div className="w-2 h-2 rounded-sm" style={{ background: sec.color }} />
                <span className="text-[11px] text-[#8090c0] flex-1">{sec.label}</span>
                <span className="text-[9px] text-[#2a3050] group-hover:text-[#4a5070]">{sec.nodes.length}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CHAT
   ═══════════════════════════════════════════ */
function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''} mb-3`}>
      <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 ${isUser ? 'bg-[#141830] text-[#6878a8]' : 'bg-[#00e87715] text-[#00e877]'}`}>
        {isUser ? 'J' : 'P'}
      </div>
      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed ${isUser ? 'bg-[#141830] text-[#c0c8e0]' : 'bg-[#0a0e1a] border border-[#141830] text-[#a0a8c8]'}`}>
        {msg.content}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════ */
export default function PlanForgeEditor() {
  const [activeTab, setActiveTab] = useState('spec');
  const [projectTitle, setProjectTitle] = useState('AI 기반 바이럴 콘텐츠 예측 플랫폼');
  const [prd, setPrd] = useState(DEMO_PRD);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([{ role: 'assistant', content: '안녕하세요! PlanForge AI입니다. PRD, 기능명세서, 유저플로우에 대해 질문하거나 수정을 요청해주세요.' }]);
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!chatInput.trim() || isLoading) return;
    const userMsg = { role: 'user', content: chatInput.trim() };
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsLoading(true);
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: `PlanForge AI 어시스턴트. PRD/기능명세서/유저플로우 작성을 돕는다. 프로젝트: ${projectTitle}. 현재 PRD: ${JSON.stringify(prd)}. 간결한 한국어로 답변.`,
          messages: [...messages.slice(-6), userMsg].map(m => ({ role: m.role, content: m.content }))
        })
      });
      const data = await resp.json();
      setMessages(prev => [...prev, { role: 'assistant', content: data.content?.map(c => c.text || '').join('') || '응답 오류' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `오류: ${err.message}` }]);
    }
    setIsLoading(false);
  }, [chatInput, isLoading, messages, prd, projectTitle]);

  const quickActions = ['PRD 내용을 검토해줘', '요구사항을 더 구체화해줘', '기능명세서 완성하기'];
  const tabs = [{ id: 'prd', label: 'PRD' }, { id: 'spec', label: '기능명세서' }, { id: 'flow', label: '유저플로우' }];

  return (
    <div className="h-screen flex flex-col" style={{ background: '#070a12', fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* NAV */}
      <nav className="flex items-center px-3 h-11 border-b border-[#141830] bg-[#0a0e1a] shrink-0 gap-2">
        <button className="text-[#00e877] font-mono font-bold text-sm px-2 hover:opacity-80">◆ PF</button>
        <input value={projectTitle} onChange={e => setProjectTitle(e.target.value)} className="bg-transparent text-[13px] text-[#e0e4f0] font-medium w-56 outline-none focus:bg-[#12162a] rounded px-2 py-1" placeholder="제목 입력" />
        <div className="flex-1" />
        <div className="flex bg-[#080c18] rounded-md border border-[#141830]">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`px-3.5 py-1 text-[11px] font-mono font-medium rounded-md transition-all ${activeTab === t.id ? 'bg-[#00e87712] text-[#00e877]' : 'text-[#3a4060] hover:text-[#6878a8]'}`}>{t.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-3">
          <button className="px-2.5 py-1 text-[10px] font-mono text-[#4a5070] hover:text-[#8090c0] rounded transition-colors">코멘트</button>
          <button className="px-2.5 py-1 text-[10px] font-mono text-[#4a5070] hover:text-[#8090c0] rounded transition-colors">기록</button>
          <button className="px-2.5 py-1 text-[10px] font-mono text-[#4a5070] hover:text-[#8090c0] rounded transition-colors">공유</button>
          <button className="px-2.5 py-1 text-[10px] font-mono text-[#00e877] border border-[#00e87725] rounded hover:bg-[#00e87712] transition-colors">내보내기</button>
        </div>
      </nav>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* CHAT SIDEBAR */}
        {sidebarOpen ? (
          <div className="w-[340px] shrink-0 border-r border-[#141830] bg-[#0a0e1a] flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#141830]">
              <button className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono text-[#00e877] bg-[#00e87708] rounded hover:bg-[#00e87715] transition-colors">+ 새 채팅</button>
              <div className="flex-1" />
              <button onClick={() => setSidebarOpen(false)} className="text-[#3a4060] hover:text-[#6878a8] text-xs rounded p-1">✕</button>
            </div>
            {messages.length <= 1 && (
              <div className="px-3 py-2.5 space-y-1 border-b border-[#141830]">
                {quickActions.map((q, i) => (
                  <button key={i} onClick={() => setChatInput(q)} className="w-full text-left px-2.5 py-1.5 text-[11px] text-[#6878a8] bg-[#080c18] border border-[#141830] rounded hover:border-[#00e87730] transition-colors">{q}</button>
                ))}
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {messages.map((m, i) => <ChatMessage key={i} msg={m} />)}
              {isLoading && (
                <div className="flex gap-2 mb-3">
                  <div className="w-6 h-6 rounded-md bg-[#00e87715] text-[#00e877] flex items-center justify-center text-[10px] font-bold">P</div>
                  <div className="bg-[#0a0e1a] border border-[#141830] rounded-lg px-3 py-2 flex gap-1">
                    {[0, 150, 300].map(d => <div key={d} className="w-1.5 h-1.5 bg-[#00e877] rounded-full animate-bounce" style={{ animationDelay: d + 'ms' }} />)}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="px-3 pb-2.5 pt-1">
              <div className="flex items-end gap-1.5 bg-[#080c18] border border-[#141830] rounded-lg px-2.5 py-2 focus-within:border-[#00e87730]">
                <button className="text-[#3a4060] hover:text-[#6878a8] p-0.5 shrink-0">📎</button>
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                  placeholder="메시지 입력..." rows={1} className="flex-1 bg-transparent text-[12px] text-[#c0c8e0] placeholder-[#1e2440] outline-none resize-none" />
                <button onClick={sendMessage} disabled={!chatInput.trim()} className={`p-1 rounded shrink-0 transition-all ${chatInput.trim() ? 'bg-[#00e877] text-[#070a12]' : 'text-[#1e2440]'}`}>
                  <IconSend />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1 px-1 text-[9px] font-mono text-[#2a3050]">
                <span>실행 모드</span><span>·</span><span className="text-[#00e877]">claude-sonnet</span>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setSidebarOpen(true)} className="w-9 shrink-0 border-r border-[#141830] bg-[#0a0e1a] flex items-center justify-center text-[#3a4060] hover:text-[#00e877] transition-colors">💬</button>
        )}

        {/* DOCUMENT PANEL */}
        <div className="flex-1 bg-[#0c1020] overflow-hidden">
          {activeTab === 'prd' && <PRDPanel prd={prd} setPrd={setPrd} />}
          {activeTab === 'spec' && <SpecPanel />}
          {activeTab === 'flow' && <FlowPanel />}
        </div>
      </div>
    </div>
  );
}
