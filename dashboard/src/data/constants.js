export const FLOW_SECTIONS = [
  { id: "sec-1", label: "트리거", color: "#059669", nodes: [{ id: "N-001", label: "5분 주기 트리거", type: "start" }]},
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

export const FLOW_EDGES = [
  { from: "N-001", to: "N-002" }, { from: "N-002", to: "N-003" },
  { from: "N-003", to: "N-011", label: "No" }, { from: "N-003", to: "N-004", label: "Yes" },
  { from: "N-004", to: "N-005" }, { from: "N-005", to: "N-006", label: "Yes" },
  { from: "N-005", to: "N-009", label: "No" }, { from: "N-006", to: "N-007" },
  { from: "N-007", to: "N-008", label: "통과" }, { from: "N-007", to: "N-006", label: "재생성" },
  { from: "N-008", to: "N-010" }, { from: "N-009", to: "N-010" }, { from: "N-010", to: "N-011" },
];

export const priorityColors = { critical: '#EF4444', high: '#F59E0B', medium: '#3B82F6', low: '#9CA3AF' };
export const typeColors = { root: '#7C3AED', requirement: '#3B82F6', feature: '#F59E0B', sub: '#6B7280' };
