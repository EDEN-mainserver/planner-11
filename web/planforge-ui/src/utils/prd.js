export const EMPTY_PRD = {
  overview: { one_liner: '', product_goal: '', background: '' },
  core_value: { problem: '', solution: '', differentiator: '' },
  target: { users: '', scenario: '' },
  metrics: { kpis: '', risks: '' },
  settings: { category: '', roles: [], devices: [] },
};

export const PRD_SECTIONS_DEF = [
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

export function fieldScore(val = '') {
  const len = val.trim().length;
  if (len === 0) return 0;
  if (len < 15) return 20;
  if (len < 40) return 45;
  if (len < 80) return 65;
  if (len < 160) return 85;
  return 100;
}

export function calcPrdPct(prd) {
  let sum = 0, count = 0;
  PRD_SECTIONS_DEF.forEach(sec => {
    sec.fields.forEach(f => { sum += fieldScore(prd[sec.key]?.[f.key]); count++; });
  });
  return count ? Math.round(sum / count) : 0;
}

export function pctColor(pct) {
  if (pct < 30) return '#EF4444';
  if (pct < 60) return '#F59E0B';
  if (pct < 85) return '#3B82F6';
  return '#7C3AED';
}
