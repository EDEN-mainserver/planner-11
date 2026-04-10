import { useState, useRef, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════
   DATA
   ═══════════════════════════════════════════ */
const DEMO_PRD = {
  overview: { one_liner: "크몽 문의 자동 감지 및 맞춤 응대 시스템", product_goal: "문의 응대 자동화를 통해 응답 시간을 4시간에서 5분으로 단축하고, 자동 응대 비율 70% 이상을 달성한다.", background: "클라이언트는 크몽에서 디자인 서비스를 판매 중이며, 하루 평균 30건의 문의가 들어오나 수동으로 응대하여 평균 응답 시간이 4시간을 초과함." },
  core_value: { problem: "문의 응대 지연으로 전환율이 낮고, 반복적인 질문(가격, 작업기간, 수정횟수)에 매번 동일한 답변을 수동 작성해야 함.", solution: "크몽 문의를 자동 감지하고, 문의 유형을 분류하여 사전 정의된 템플릿 기반 자동 응답을 발송.", differentiator: "단순 자동응답이 아닌, 문의 내용을 AI로 분석하여 맥락에 맞는 맞춤 응대를 생성하고 견적까지 자동 산출." },
  target: { users: "크몽에서 서비스를 판매하며 문의 응대에 하루 2시간 이상을 소모하는 프리랜서/소규모 팀", scenario: "1. 구매자가 크몽 메시지로 가격 문의 → 2. 시스템이 AI로 유형 분류 → 3. 맞춤 응답 자동 생성 → 4. 크몽 메시지로 자동 발송 → 5. 로그 기록" },
  metrics: { kpis: "평균 응답 시간 5분 이내 / 자동 응대 비율 70%+ / 문의 전환율 15%+", risks: "크몽 UI 변경 시 스크래핑 로직 수정 필요 / AI 자동 응답 부적절 내용 생성 가능성" },
  settings: { category: "고객관리/CS", roles: ["시스템", "크몽 구매자", "담당자"], devices: ["Desktop"] }
};

const SPEC_TREE = {
  id: "root", label: "크몽 자동 응대", type: "root", children: [
    { id: "R-001", label: "문의 수집 및 감지", type: "requirement", priority: "critical", children: [
      { id: "F-001", label: "크몽 메시지 자동 감지", type: "feature", priority: "critical", specId: "SPEC-001", children: [
        { id: "S-001-1", label: "메시지함 폴링 (5분 주기)", type: "sub", priority: "high" },
        { id: "S-001-2", label: "읽지 않은 메시지 필터링", type: "sub", priority: "high" },
        { id: "S-001-3", label: "세션 만료 자동 재로그인", type: "sub", priority: "medium" },
      ]},
    ]},
    { id: "R-002", label: "문의 분석 및 분류", type: "requirement", priority: "critical", children: [
      { id: "F-002", label: "문의 유형 AI 분류", type: "feature", priority: "critical", specId: "SPEC-002", children: [
        { id: "S-002-1", label: "5개 유형 분류 (price/timeline/revision/custom/other)", type: "sub", priority: "critical" },
        { id: "S-002-2", label: "confidence score 기반 분기", type: "sub", priority: "high" },
      ]},
    ]},
    { id: "R-003", label: "자동 응대 및 발송", type: "requirement", priority: "critical", children: [
      { id: "F-003", label: "맞춤 응답 생성 및 발송", type: "feature", priority: "critical", specId: "SPEC-003", children: [
        { id: "S-003-1", label: "유형별 응답 템플릿 로드", type: "sub", priority: "high" },
        { id: "S-003-2", label: "LLM 맞춤 응답 생성", type: "sub", priority: "critical" },
        { id: "S-003-3", label: "금칙어 필터 + 길이 검증", type: "sub", priority: "high" },
        { id: "S-003-4", label: "크몽 메시지 자동 발송", type: "sub", priority: "critical" },
      ]},
      { id: "F-004", label: "담당자 알림 발송", type: "feature", priority: "high", specId: "SPEC-004", children: [
        { id: "S-004-1", label: "슬랙 Webhook 알림", type: "sub", priority: "high" },
        { id: "S-004-2", label: "접수 확인 자동 응답", type: "sub", priority: "medium" },
      ]},
    ]},
    { id: "R-004", label: "기록 및 관리", type: "requirement", priority: "medium", children: [
      { id: "F-005", label: "응대 로그 기록", type: "feature", priority: "medium", specId: "SPEC-005", children: [
        { id: "S-005-1", label: "Google Sheets API 연동", type: "sub", priority: "medium" },
        { id: "S-005-2", label: "일별/주별 통계 시트", type: "sub", priority: "low" },
      ]},
    ]},
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

/* Graph View - visual mindmap */
function SpecGraphView({ onSelect, selectedId }) {
  const flat = [];
  const flatten = (node, depth = 0, parentIdx = -1) => {
    const idx = flat.length;
    flat.push({ ...node, depth, parentIdx, idx });
    (node.children || []).forEach(c => flatten(c, depth + 1, idx));
  };
  flatten(SPEC_TREE);

  const rowH = 36;
  const colW = 200;
  const padL = 40;
  const svgW = 900;
  const svgH = flat.length * rowH + 40;

  return (
    <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="p-2">
      {flat.map((n, i) => {
        const x = padL + n.depth * colW;
        const y = 20 + i * rowH;
        const color = typeColors[n.type] || '#555';
        // line to parent
        let line = null;
        if (n.parentIdx >= 0) {
          const px = padL + flat[n.parentIdx].depth * colW + 80;
          const py = 20 + n.parentIdx * rowH + 14;
          line = <path d={`M${px},${py} C${px + 30},${py} ${x - 10},${y + 14} ${x},${y + 14}`} stroke={color} strokeWidth="1" fill="none" opacity="0.3" />;
        }
        const isSel = selectedId === n.id;
        return (
          <g key={n.id} onClick={() => onSelect(n)} className="cursor-pointer">
            {line}
            <rect x={x} y={y} width={160} height={28} rx={6} fill={isSel ? '#151a30' : '#0c1020'} stroke={isSel ? color : '#141830'} strokeWidth={isSel ? 1.5 : 0.5} />
            <circle cx={x + 12} cy={y + 14} r={4} fill={color} opacity={0.7} />
            <text x={x + 22} y={y + 18} fill="#c0c8e0" fontSize="11" fontFamily="'Noto Sans KR', sans-serif">{n.label.length > 18 ? n.label.slice(0, 18) + '…' : n.label}</text>
            {n.priority && <text x={x + 148} y={y + 18} fill={priorityColors[n.priority]} fontSize="8" fontFamily="monospace" textAnchor="end">{n.priority[0].toUpperCase()}</text>}
          </g>
        );
      })}
    </svg>
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
  const [activeTab, setActiveTab] = useState('prd');
  const [projectTitle, setProjectTitle] = useState('크몽 문의 자동 응대 시스템');
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
