import { useState, useRef, useEffect, useCallback } from "react";

/* ═══════════════════════════════════════════
   DATA (v2와 동일, 색상만 업데이트)
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
  { id: "sec-1", label: "트리거", color: "#059669", nodes: [
    { id: "N-001", label: "5분 주기 트리거", type: "start" },
  ]},
  { id: "sec-2", label: "수집 및 분류", color: "#3B82F6", nodes: [
    { id: "N-002", label: "크몽 메시지함\n스크래핑", type: "action" },
    { id: "N-003", label: "새 문의\n있는가?", type: "decision" },
    { id: "N-004", label: "AI 문의\n유형 분류", type: "action" },
    { id: "N-005", label: "자동 응대\n가능?", type: "decision" },
  ]},
  { id: "sec-3", label: "응대 처리", color: "#7C3AED", nodes: [
    { id: "N-006", label: "맞춤 응답\n생성", type: "action" },
    { id: "N-007", label: "응답\n검증?", type: "decision" },
    { id: "N-008", label: "크몽 메시지\n발송", type: "action" },
    { id: "N-009", label: "담당자\n슬랙 알림", type: "action" },
  ]},
  { id: "sec-4", label: "기록 및 완료", color: "#D97706", nodes: [
    { id: "N-010", label: "구글 시트\n로그 기록", type: "action" },
    { id: "N-011", label: "사이클 완료\n대기", type: "end" },
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

/* 라이트 테마 색상 */
const priorityColors = { critical: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#9CA3AF' };
const typeColors = { root: '#7C3AED', requirement: '#3B82F6', feature: '#F59E0B', sub: '#6B7280' };
const nodeColors = { start: '#059669', end: '#059669', action: '#7C3AED', decision: '#D97706', error: '#DC2626' };

/* ═══════════════════════════════════════════
   ICONS
   ═══════════════════════════════════════════ */
const Icon = ({ d, size = 14 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
const IconSend = () => <Icon d="M22 2L11 13M22 2L15 22L11 13L2 9L22 2Z" size={15} />;

/* ═══════════════════════════════════════════
   EDIT FIELD (인라인 편집)
   ═══════════════════════════════════════════ */
function EditField({ value, onChange, multiline = false, className = "" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef(null);

  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  const commit = () => { onChange(draft); setEditing(false); };

  if (!editing) {
    return (
      <span onClick={() => { setDraft(value); setEditing(true); }}
        className={`cursor-text rounded px-1 py-0.5 hover:bg-purple-50 hover:ring-1 hover:ring-purple-200 transition-all ${className}`}>
        {value || <span className="text-gray-300 italic">편집...</span>}
      </span>
    );
  }
  return multiline ? (
    <textarea ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => e.key === 'Escape' && setEditing(false)}
      className={`bg-white border border-purple-300 rounded px-2 py-1 outline-none text-gray-800 resize-none w-full ring-2 ring-purple-100 ${className}`} rows={3} />
  ) : (
    <input ref={ref} value={draft} onChange={e => setDraft(e.target.value)}
      onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
      className={`bg-white border border-purple-300 rounded px-2 py-1 outline-none text-gray-800 w-full ring-2 ring-purple-100 ${className}`} />
  );
}

/* ═══════════════════════════════════════════
   PRD PANEL
   ═══════════════════════════════════════════ */
const PRD_SECTIONS = [
  { key: 'overview', label: '개요', icon: '📋', fields: [
    { key: 'one_liner', label: '한 줄 설명', multiline: false },
    { key: 'product_goal', label: '제품 목표', multiline: true },
    { key: 'background', label: '배경', multiline: true },
  ]},
  { key: 'core_value', label: '핵심 가치', icon: '💡', fields: [
    { key: 'problem', label: '문제', multiline: true },
    { key: 'solution', label: '해결책', multiline: true },
    { key: 'differentiator', label: '차별점', multiline: true },
  ]},
  { key: 'target', label: '타겟 및 시나리오', icon: '🎯', fields: [
    { key: 'users', label: '대상 사용자', multiline: true },
    { key: 'scenario', label: '핵심 시나리오', multiline: true },
  ]},
  { key: 'metrics', label: '지표 및 리스크', icon: '📊', fields: [
    { key: 'kpis', label: 'KPI', multiline: true },
    { key: 'risks', label: '리스크', multiline: true },
  ]},
];

function PRDPanel({ prd, setPrd }) {
  const [openSections, setOpenSections] = useState({ overview: true, core_value: true, target: false, metrics: false });

  const total = PRD_SECTIONS.length;
  const filled = PRD_SECTIONS.filter(s => {
    return s.fields.every(f => prd[s.key]?.[f.key]?.trim());
  }).length;
  const pct = Math.round((filled / total) * 100);

  const toggle = (key) => setOpenSections(p => ({ ...p, [key]: !p[key] }));
  const update = (sKey, fKey, val) => setPrd(p => ({ ...p, [sKey]: { ...p[sKey], [fKey]: val } }));

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 상단 헤더 */}
      <div className="px-6 py-3 bg-white border-b border-gray-200 shrink-0 flex items-center gap-3">
        <span className="font-semibold text-gray-800 text-sm">PRD</span>
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-gray-400 font-mono">{pct}%</span>
      </div>

      {/* 카드 목록 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {PRD_SECTIONS.map(sec => (
          <div key={sec.key} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <button
              onClick={() => toggle(sec.key)}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-purple-50 transition-colors group">
              <span className="text-base">{sec.icon}</span>
              <span className="font-medium text-gray-800 text-sm flex-1">{sec.label}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5"
                style={{ transform: openSections[sec.key] ? 'rotate(180deg)' : 'rotate(0)', transition: '0.15s' }}>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {openSections[sec.key] && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                {sec.fields.map(f => (
                  <div key={f.key} className="pt-3">
                    <div className="text-xs font-medium text-purple-600 uppercase tracking-wide mb-1">{f.label}</div>
                    <EditField
                      value={prd[sec.key]?.[f.key] || ''}
                      onChange={val => update(sec.key, f.key, val)}
                      multiline={f.multiline}
                      className="text-sm text-gray-700 leading-relaxed block w-full"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* 설정 카드 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-base">⚙️</span>
            <span className="font-medium text-gray-800 text-sm">프로젝트 설정</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 bg-purple-50 text-purple-700 text-xs rounded-full border border-purple-200">{prd.settings?.category}</span>
            {prd.settings?.roles?.map(r => (
              <span key={r} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">{r}</span>
            ))}
            {prd.settings?.devices?.map(d => (
              <span key={d} className="px-2.5 py-1 bg-blue-50 text-blue-600 text-xs rounded-full border border-blue-200">{d}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   SPEC TREE NODE
   ═══════════════════════════════════════════ */
function SpecTreeNode({ node, depth = 0, selectedId, onSelect }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedId === node.id;
  const color = typeColors[node.type] || '#6B7280';

  return (
    <div>
      <div
        className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer transition-all ${isSelected ? 'bg-purple-50 ring-1 ring-purple-200' : 'hover:bg-gray-50'}`}
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
        onClick={() => onSelect(node)}>
        {hasChildren ? (
          <button onClick={e => { e.stopPropagation(); setOpen(!open); }}
            className="w-4 h-4 flex items-center justify-center shrink-0">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3"
              style={{ transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: '0.15s' }}>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ) : <div className="w-4 h-4 flex items-center justify-center shrink-0"><div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} /></div>}
        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: color, opacity: 0.7 }} />
        <span className="text-sm text-gray-700 truncate flex-1">{node.label}</span>
        {node.priority && (
          <span className="text-xs font-mono px-1.5 py-0.5 rounded-full shrink-0"
            style={{ background: (priorityColors[node.priority] || '#555') + '15', color: priorityColors[node.priority] || '#555' }}>
            {node.priority[0].toUpperCase()}
          </span>
        )}
      </div>
      {open && hasChildren && node.children.map(c => (
        <SpecTreeNode key={c.id} node={c} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════
   SPEC GRAPH VIEW (가로 마인드맵)
   ═══════════════════════════════════════════ */
function SpecGraphView({ onSelect, selectedId }) {
  const flat = [];
  const flatten = (node, depth = 0, parentIdx = -1) => {
    const idx = flat.length;
    flat.push({ ...node, depth, parentIdx, idx });
    (node.children || []).forEach(c => flatten(c, depth + 1, idx));
  };
  flatten(SPEC_TREE);

  const rowH = 38;
  const colW = 210;
  const padL = 20;
  const svgH = flat.length * rowH + 40;
  const svgW = 920;

  return (
    <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="p-2">
      {flat.map((n, i) => {
        const x = padL + n.depth * colW;
        const y = 20 + i * rowH;
        const color = typeColors[n.type] || '#6B7280';
        let line = null;
        if (n.parentIdx >= 0) {
          const px = padL + flat[n.parentIdx].depth * colW + 90;
          const py = 20 + n.parentIdx * rowH + 14;
          line = <path d={`M${px},${py} C${px + 28},${py} ${x - 8},${y + 14} ${x},${y + 14}`}
            stroke={color} strokeWidth="1.2" fill="none" opacity="0.3" />;
        }
        const isSel = selectedId === n.id;
        return (
          <g key={n.id} onClick={() => onSelect(n)} className="cursor-pointer">
            {line}
            <rect x={x} y={y} width={170} height={28} rx={7}
              fill={isSel ? '#F5F3FF' : '#FFFFFF'}
              stroke={isSel ? color : '#E5E7EB'}
              strokeWidth={isSel ? 1.5 : 1} />
            <circle cx={x + 13} cy={y + 14} r={4} fill={color} opacity={0.8} />
            <text x={x + 24} y={y + 18} fill="#374151" fontSize="11" fontFamily="'Noto Sans KR', sans-serif">
              {n.label.length > 18 ? n.label.slice(0, 18) + '…' : n.label}
            </text>
            {n.priority && (
              <text x={x + 158} y={y + 18} fill={priorityColors[n.priority]} fontSize="8" fontFamily="monospace" textAnchor="end">
                {n.priority[0].toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* ═══════════════════════════════════════════
   SPEC PANEL
   ═══════════════════════════════════════════ */
function SpecPanel() {
  const [view, setView] = useState('tree');
  const [selected, setSelected] = useState(null);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="flex items-center gap-2 px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <span className="font-semibold text-gray-800 text-sm">기능명세서</span>
        <div className="flex-1" />
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button onClick={() => setView('tree')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${view === 'tree' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            트리 뷰
          </button>
          <button onClick={() => setView('graph')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${view === 'graph' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            그래프 뷰
          </button>
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className={`${selected ? 'w-[45%]' : 'w-full'} overflow-y-auto border-r border-gray-200 py-2 bg-white transition-all`}>
          {view === 'tree' ? (
            <div className="px-2">
              <SpecTreeNode node={SPEC_TREE} selectedId={selected?.id} onSelect={setSelected} />
            </div>
          ) : (
            <SpecGraphView onSelect={setSelected} selectedId={selected?.id} />
          )}
        </div>
        {selected && (
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs font-medium text-purple-500 uppercase tracking-wider">{selected.type} · {selected.id}</div>
                <div className="text-base font-semibold text-gray-800 mt-0.5">{selected.label}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-gray-300 hover:text-gray-500 text-lg mt-0.5">✕</button>
            </div>
            {selected.priority && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ background: (priorityColors[selected.priority]) + '18', color: priorityColors[selected.priority], border: `1px solid ${priorityColors[selected.priority]}30` }}>
                  {selected.priority}
                </span>
                {selected.specId && (
                  <span className="text-xs font-mono text-purple-600 px-2 py-0.5 rounded-full bg-purple-50 border border-purple-200">
                    {selected.specId}
                  </span>
                )}
              </div>
            )}
            {selected.children && selected.children.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">하위 항목 ({selected.children.length})</div>
                {selected.children.map(c => (
                  <button key={c.id} onClick={() => setSelected(c)}
                    className="w-full text-left px-3 py-2 mb-1 rounded-lg bg-white border border-gray-200 hover:border-purple-300 hover:bg-purple-50 transition-all flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: typeColors[c.type] }} />
                    <span className="text-sm text-gray-700">{c.label}</span>
                    {c.priority && (
                      <span className="text-xs font-mono ml-auto" style={{ color: priorityColors[c.priority] }}>
                        {c.priority[0].toUpperCase()}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
            <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-purple-500 border border-dashed border-purple-200 rounded-lg hover:bg-purple-50 transition-colors">
              <span>+</span> 하위 항목 추가
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   FLOW PANEL — 가로 마인드맵
   ═══════════════════════════════════════════ */
function FlowPanel() {
  const [versions] = useState(FLOW_VERSIONS);
  const [selectedNode, setSelectedNode] = useState(null);

  /* 가로 배치: 섹션 = 컬럼, 노드 = 행 */
  const nodeW = 136;
  const nodeH = 52;
  const colW = 220;    // 컬럼 너비 (노드 + 여백)
  const rowH = 82;     // 행 높이 (노드 + 세로 여백)
  const padL = 40;
  const padT = 90;     // 섹션 헤더 높이 + 여백

  const allNodes = {};
  FLOW_SECTIONS.forEach((sec, si) => {
    sec.nodes.forEach((n, ni) => {
      allNodes[n.id] = {
        ...n,
        secIdx: si,
        nodeIdx: ni,
        cx: padL + si * colW + nodeW / 2,
        cy: padT + ni * rowH + nodeH / 2,
        x: padL + si * colW,
        y: padT + ni * rowH,
      };
    });
  });

  const maxNodes = Math.max(...FLOW_SECTIONS.map(s => s.nodes.length));
  const svgW = padL + FLOW_SECTIONS.length * colW + 60;
  const svgH = padT + maxNodes * rowH + nodeH + 20;

  const getNodeFill = (type, isSel) => {
    const base = { start: '#ECFDF5', end: '#ECFDF5', action: '#F5F3FF', decision: '#FFFBEB', error: '#FEF2F2' };
    const selBase = { start: '#D1FAE5', end: '#D1FAE5', action: '#EDE9FE', decision: '#FEF3C7', error: '#FEE2E2' };
    return isSel ? (selBase[type] || '#F5F3FF') : (base[type] || '#F5F3FF');
  };
  const getNodeStroke = (type, isSel) => {
    const base = { start: '#059669', end: '#059669', action: '#7C3AED', decision: '#D97706', error: '#DC2626' };
    const c = base[type] || '#7C3AED';
    return isSel ? c : c + '60';
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* 상단 바 */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <span className="font-semibold text-gray-800 text-sm">유저플로우</span>
        <div className="flex-1" />
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-100 border border-emerald-400 inline-block" />시작/끝
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-md bg-purple-100 border border-purple-400 inline-block" />액션
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-amber-100 border border-amber-400 inline-block" style={{ transform: 'rotate(45deg)' }} />분기
          </span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 메인 캔버스 — 가로 마인드맵 */}
        <div className="flex-1 overflow-auto bg-white"
          style={{ backgroundImage: 'radial-gradient(circle, #E5E7EB 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
          <svg width={svgW} height={svgH} className="min-w-full">

            {/* 섹션 컬럼 배경 */}
            {FLOW_SECTIONS.map((sec, si) => (
              <g key={sec.id}>
                <rect
                  x={padL + si * colW - 10} y={20}
                  width={colW} height={svgH - 30}
                  rx={12} fill={sec.color + '08'} stroke={sec.color + '30'} strokeWidth="1" strokeDasharray="5 3"
                />
                {/* 섹션 레이블 */}
                <rect x={padL + si * colW + nodeW / 2 - 44} y={28} width={88} height={24} rx={12} fill={sec.color} />
                <text
                  x={padL + si * colW + nodeW / 2} y={44}
                  textAnchor="middle" fill="#fff" fontSize="11" fontFamily="'Noto Sans KR', sans-serif" fontWeight="600">
                  {sec.label}
                </text>
              </g>
            ))}

            {/* 엣지 */}
            {FLOW_EDGES.map((e, i) => {
              const from = allNodes[e.from];
              const to = allNodes[e.to];
              if (!from || !to) return null;

              const sameCol = from.secIdx === to.secIdx;
              let d, midX, midY;

              if (sameCol) {
                /* 같은 컬럼 내 세로 연결 */
                const x1 = from.cx, y1 = from.y + nodeH;
                const x2 = to.cx, y2 = to.y;
                midX = (x1 + x2) / 2;
                midY = (y1 + y2) / 2;
                d = `M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`;
              } else if (from.secIdx < to.secIdx) {
                /* 왼쪽 → 오른쪽 */
                const x1 = from.x + nodeW, y1 = from.cy;
                const x2 = to.x, y2 = to.cy;
                midX = (x1 + x2) / 2;
                midY = (y1 + y2) / 2;
                d = `M${x1},${y1} C${midX},${y1} ${midX},${y2} ${x2},${y2}`;
              } else {
                /* 역방향 (루프) — 위로 우회 */
                const x1 = from.cx, y1 = from.y;
                const x2 = to.cx, y2 = to.y;
                const loopY = Math.min(y1, y2) - 30;
                midX = (x1 + x2) / 2;
                midY = loopY;
                d = `M${x1},${y1} C${x1},${loopY} ${x2},${loopY} ${x2},${y2}`;
              }

              const isBackward = from.secIdx > to.secIdx;
              const strokeColor = isBackward ? '#F59E0B' : '#C4B5FD';
              const strokeDash = isBackward ? '5 3' : 'none';

              /* 화살표 방향 계산 */
              let arrowX = to.cx, arrowY = to.y;
              let arrowAngle = -90;
              if (!sameCol && from.secIdx < to.secIdx) {
                arrowX = to.x; arrowY = to.cy; arrowAngle = 180;
              } else if (isBackward) {
                arrowX = to.cx; arrowY = to.y; arrowAngle = -90;
              }

              return (
                <g key={i}>
                  <path d={d} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeDasharray={strokeDash} />
                  {/* 화살표 */}
                  <circle cx={arrowX} cy={arrowY} r={3} fill={strokeColor} />
                  {e.label && (
                    <g>
                      <rect x={midX - 18} y={midY - 8} width={36} height={14} rx={4} fill="white" stroke={strokeColor + '60'} strokeWidth="0.5" />
                      <text x={midX} y={midY + 3} textAnchor="middle" fill="#7C3AED" fontSize="9" fontFamily="monospace">{e.label}</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* 노드 */}
            {Object.values(allNodes).map(n => {
              const isSel = selectedNode === n.id;
              const fill = getNodeFill(n.type, isSel);
              const stroke = getNodeStroke(n.type, isSel);
              const strokeW = isSel ? 2 : 1;

              if (n.type === 'decision') {
                const cx = n.cx, cy = n.cy;
                const hw = nodeW / 2 - 4, hh = nodeH / 2;
                return (
                  <g key={n.id} onClick={() => setSelectedNode(isSel ? null : n.id)} className="cursor-pointer">
                    <polygon
                      points={`${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh} ${cx - hw},${cy}`}
                      fill={fill} stroke={stroke} strokeWidth={strokeW}
                    />
                    {n.label.split('\n').map((line, li) => (
                      <text key={li} x={cx} y={cy - 4 + li * 13} textAnchor="middle"
                        fill="#92400E" fontSize="10" fontFamily="'Noto Sans KR', sans-serif">{line}</text>
                    ))}
                  </g>
                );
              }
              if (n.type === 'start' || n.type === 'end') {
                return (
                  <g key={n.id} onClick={() => setSelectedNode(isSel ? null : n.id)} className="cursor-pointer">
                    <rect x={n.x} y={n.y} width={nodeW} height={nodeH} rx={nodeH / 2}
                      fill={fill} stroke={stroke} strokeWidth={strokeW} />
                    {n.label.split('\n').map((line, li) => (
                      <text key={li} x={n.cx} y={n.cy - 4 + li * 14} textAnchor="middle"
                        fill="#065F46" fontSize="10" fontFamily="'Noto Sans KR', sans-serif">{line}</text>
                    ))}
                  </g>
                );
              }
              return (
                <g key={n.id} onClick={() => setSelectedNode(isSel ? null : n.id)} className="cursor-pointer">
                  <rect x={n.x} y={n.y} width={nodeW} height={nodeH} rx={10}
                    fill={fill} stroke={stroke} strokeWidth={strokeW} />
                  {n.label.split('\n').map((line, li) => (
                    <text key={li} x={n.cx} y={n.cy - 4 + li * 14} textAnchor="middle"
                      fill="#4C1D95" fontSize="10" fontFamily="'Noto Sans KR', sans-serif">{line}</text>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>

        {/* 오른쪽 사이드패널 */}
        <div className="w-[200px] shrink-0 border-l border-gray-200 bg-white overflow-y-auto">
          <div className="px-3 py-3 border-b border-gray-100">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">유저플로우</div>
            <button className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors">
              <span>+</span> 새 플로우
            </button>
          </div>

          {/* 버전 */}
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">버전</div>
            {versions.map(v => (
              <div key={v.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${v.active ? 'bg-purple-50 text-purple-700' : 'text-gray-500'}`}>
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
                <span className="flex-1 font-medium">{v.name}</span>
                <span className="text-gray-400">{v.date}</span>
              </div>
            ))}
            <button className="w-full mt-1.5 px-2 py-1.5 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg hover:border-purple-300 hover:text-purple-500 transition-colors">
              수정본 만들기
            </button>
          </div>

          {/* 섹션 목록 */}
          <div className="px-3 py-2">
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">섹션</div>
            {FLOW_SECTIONS.map(sec => (
              <div key={sec.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors mb-0.5 group">
                <div className="w-2 h-2 rounded-sm shrink-0" style={{ background: sec.color }} />
                <span className="text-xs text-gray-600 flex-1">{sec.label}</span>
                <span className="text-xs text-gray-300 group-hover:text-gray-400">{sec.nodes.length}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   CHAT MESSAGE
   ═══════════════════════════════════════════ */
function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2 ${isUser ? 'flex-row-reverse' : ''} mb-3`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isUser ? 'bg-gray-100 text-gray-500' : 'bg-purple-100 text-purple-600'}`}>
        {isUser ? 'J' : 'P'}
      </div>
      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[13px] leading-relaxed ${isUser ? 'bg-purple-500 text-white' : 'bg-white border border-gray-200 text-gray-700 shadow-sm'}`}>
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
  const [messages, setMessages] = useState([{
    role: 'assistant',
    content: '안녕하세요! PlanForge AI입니다. PRD, 기능명세서, 유저플로우에 대해 질문하거나 수정을 요청해주세요.'
  }]);
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
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
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
    <div className="h-screen flex flex-col bg-gray-50" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* NAV */}
      <nav className="flex items-center px-4 h-12 border-b border-gray-200 bg-white shrink-0 gap-3 shadow-sm">
        {/* 로고 */}
        <div className="flex items-center gap-1.5">
          <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm">PF</div>
          <span className="font-bold text-gray-800 text-sm hidden sm:block">PlanForge</span>
        </div>

        {/* 구분선 */}
        <div className="w-px h-5 bg-gray-200" />

        {/* 프로젝트 제목 */}
        <input
          value={projectTitle}
          onChange={e => setProjectTitle(e.target.value)}
          className="bg-transparent text-sm text-gray-700 font-medium w-56 outline-none focus:bg-purple-50 focus:ring-1 focus:ring-purple-200 rounded-lg px-2 py-1 transition-all"
          placeholder="프로젝트 이름"
        />

        <div className="flex-1" />

        {/* 탭 */}
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === t.id ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 액션 버튼들 */}
        <div className="flex items-center gap-1 ml-2">
          <button className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">코멘트</button>
          <button className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">기록</button>
          <button className="px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">공유</button>
          <button className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-sm">내보내기</button>
        </div>
      </nav>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden">
        {/* CHAT SIDEBAR */}
        {sidebarOpen ? (
          <div className="w-[320px] shrink-0 border-r border-gray-200 bg-white flex flex-col shadow-sm">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors">
                + 새 채팅
              </button>
              <div className="flex-1" />
              <button onClick={() => setSidebarOpen(false)}
                className="text-gray-300 hover:text-gray-500 text-sm w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">✕</button>
            </div>

            {/* 빠른 액션 */}
            {messages.length <= 1 && (
              <div className="px-3 py-2.5 space-y-1.5 border-b border-gray-100">
                {quickActions.map((q, i) => (
                  <button key={i} onClick={() => setChatInput(q)}
                    className="w-full text-left px-3 py-2 text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700 transition-all">
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto px-3 py-3">
              {messages.map((m, i) => <ChatMessage key={i} msg={m} />)}
              {isLoading && (
                <div className="flex gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold shrink-0">P</div>
                  <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 flex gap-1 shadow-sm">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: d + 'ms' }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* 입력창 */}
            <div className="px-3 pb-3 pt-1">
              <div className="flex items-end gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-purple-300 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
                <button className="text-gray-300 hover:text-gray-500 p-0.5 shrink-0 transition-colors">📎</button>
                <textarea
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                  placeholder="메시지 입력..."
                  rows={1}
                  className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-300 outline-none resize-none"
                />
                <button onClick={sendMessage} disabled={!chatInput.trim()}
                  className={`p-1.5 rounded-lg shrink-0 transition-all ${chatInput.trim() ? 'bg-purple-600 text-white hover:bg-purple-700' : 'text-gray-300'}`}>
                  <IconSend />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1.5 px-1 text-xs text-gray-300">
                <span>실행 모드</span><span>·</span><span className="text-purple-400">claude-sonnet</span>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setSidebarOpen(true)}
            className="w-10 shrink-0 border-r border-gray-200 bg-white flex items-center justify-center text-gray-300 hover:text-purple-500 hover:bg-purple-50 transition-colors">
            💬
          </button>
        )}

        {/* DOCUMENT PANEL */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'prd' && <PRDPanel prd={prd} setPrd={setPrd} />}
          {activeTab === 'spec' && <SpecPanel />}
          {activeTab === 'flow' && <FlowPanel />}
        </div>
      </div>
    </div>
  );
}
