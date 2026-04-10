import { useState, useRef, useEffect, useCallback } from "react";
import { callGemini, deepMergePrd } from "../utils/gemini";
import { IconSend } from "../components/Icons";
import PRDPanel from "../components/PRDPanel";
import SpecPanel from "../components/SpecPanel";
import FlowPanel from "../components/FlowPanel";

// ── PRD → 마크다운 변환
function prdToMarkdown(prd, title) {
  const s = (v) => v?.trim() || '(미작성)';
  return `# ${title}

## 📋 개요
- **한 줄 설명**: ${s(prd?.overview?.one_liner)}
- **제품 목표**: ${s(prd?.overview?.product_goal)}
- **배경**: ${s(prd?.overview?.background)}

## 💡 핵심 가치
- **문제**: ${s(prd?.core_value?.problem)}
- **해결책**: ${s(prd?.core_value?.solution)}
- **차별점**: ${s(prd?.core_value?.differentiator)}

## 🎯 타겟 및 시나리오
- **대상 사용자**: ${s(prd?.target?.users)}
- **핵심 시나리오**: ${s(prd?.target?.scenario)}

## 📊 지표 및 리스크
- **KPI**: ${s(prd?.metrics?.kpis)}
- **리스크**: ${s(prd?.metrics?.risks)}

## ⚙️ 프로젝트 설정
- **카테고리**: ${s(prd?.settings?.category)}
- **사용자 역할**: ${(prd?.settings?.roles || []).join(', ') || '(미작성)'}
- **기기**: ${(prd?.settings?.devices || []).join(', ') || '(미작성)'}
`;
}

// ── JSON 파일 다운로드
function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── 텍스트 파일 다운로드
function downloadText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Excel HTML 다운로드 (Excel이 읽을 수 있는 HTML 테이블)
function downloadExcelHtml(html, filename) {
  const blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const CS  = 'border:1px solid #e5e7eb;padding:7px 12px;font-size:11px;vertical-align:top;font-family:"Apple SD Gothic Neo",sans-serif;color:#1f2937;';
const HS  = CS + 'background:#f9fafb;font-weight:700;color:#374151;';
const THS = CS + 'background:#1f2937;font-weight:700;color:#ffffff;';

const PRIO_EMOJI = { high: '🔴 높음', medium: '🟡 중간', low: '🟢 낮음' };
const PRIO_TXT   = { high: '높음',    medium: '중간',    low: '낮음'   };
const SEP50 = '='.repeat(50);

/* ── PRD 필드 헬퍼 */
function prdFields(prd, title, date) {
  const ov = prd?.overview || {};
  const cv = prd?.core_value || {};
  const tg = prd?.target || {};
  const mt = prd?.metrics || {};
  const st = prd?.settings || {};
  return { ov, cv, tg, mt, st,
    title, date,
    roles:   (st.roles   || []).join(', ') || '',
    devices: (st.devices || []).join(', ') || '',
  };
}

// ════════════════════════════════════
//  기능명세서 내보내기 포맷
// ════════════════════════════════════

function specToMarkdown(specData, prd, title) {
  const date = new Date().toISOString().split('T')[0];
  const { ov, cv, tg, mt, st, roles, devices } = prdFields(prd, title, date);

  let md = `# ${title}\n\n`;
  md += `| | |\n|---|---|\n`;
  md += `| **프로젝트 이름** | [${title}] |\n`;
  md += `| **프로젝트 관리자** | |\n`;
  md += `| **회사명** | |\n`;
  md += `| **날짜** | ${date} |\n\n`;
  md += `---\n## 1. 프로젝트 개요\n---\n`;
  if (st.category)       md += `### 카테고리\n> ${st.category}\n\n`;
  if (ov.one_liner)      md += `### 한 줄 정의\n${ov.one_liner}\n\n`;
  if (ov.background)     md += `### 배경\n${ov.background}\n\n`;
  if (cv.problem)        md += `### 사용자 문제\n${cv.problem}\n\n`;
  if (cv.solution)       md += `### 해결 방식\n${cv.solution}\n\n`;
  if (cv.differentiator) md += `### 차별점\n${cv.differentiator}\n\n`;
  if (tg.users)          md += `### 타겟 사용자\n${tg.users}\n\n`;
  if (tg.scenario)       md += `### 사용 시나리오\n${tg.scenario}\n\n`;
  if (ov.product_goal)   md += `### 제품 목표\n${ov.product_goal}\n\n`;
  if (mt.kpis)           md += `### 핵심 KPI\n${mt.kpis}\n\n`;
  if (mt.risks)          md += `### 리스크/이슈\n${mt.risks}\n\n`;
  if (roles)             md += `### 사용자 역할\n> ${roles}\n\n`;
  if (devices)           md += `### 디바이스 (기기)\n> ${devices}\n\n`;
  md += `## 2. 주요 기능 목록\n---\n\n`;

  let i = 1;
  for (const f of (specData?.features || [])) {
    const prio = PRIO_EMOJI[f.priority] || '🟡 중간';
    md += `## ${i}. ${f.title}\n`;
    md += `> **중요도**: ${prio} | **진행 상태**: ⚪ 시작전\n\n`;
    md += `${f.description || ''}\n\n`;
    const subs = f.sub_features || [];
    if (subs.length) {
      md += `**수용 기준:**\n\`\`\`\n`;
      subs.forEach((s, si) => { md += `${si + 1}. ○ ${s.detail || s.title}\n`; });
      md += `\`\`\`\n\n\n---\n\n\n`;
    } else {
      md += `\n---\n\n\n`;
    }
    i++;
  }
  return md;
}

function specToText(specData, prd, title) {
  const date = new Date().toISOString().split('T')[0];
  const { ov, cv, tg, mt, st, roles, devices } = prdFields(prd, title, date);

  let txt = `${title}\n${'='.repeat(Math.min(title.length + 2, 20))}\n\n`;
  txt += `프로젝트 이름: [${title}]\n프로젝트 관리자: \n회사명: \n날짜: ${date}\n\n${SEP50}\n\n`;
  txt += `1. 프로젝트 개요\n${'='.repeat(10)}\n\n\n`;
  if (st.category)       txt += `카테고리:\n${st.category}\n\n`;
  if (ov.one_liner)      txt += `한 줄 정의:\n${ov.one_liner}\n\n`;
  if (ov.background)     txt += `배경:\n${ov.background}\n\n`;
  if (cv.problem)        txt += `사용자 문제:\n${cv.problem}\n\n`;
  if (cv.solution)       txt += `해결 방식:\n${cv.solution}\n\n`;
  if (cv.differentiator) txt += `차별점:\n${cv.differentiator}\n\n`;
  if (tg.users)          txt += `타겟 사용자:\n${tg.users}\n\n`;
  if (tg.scenario)       txt += `사용 시나리오:\n${tg.scenario}\n\n`;
  if (ov.product_goal)   txt += `제품 목표:\n${ov.product_goal}\n\n`;
  if (mt.kpis)           txt += `핵심 KPI:\n${mt.kpis}\n\n`;
  if (mt.risks)          txt += `리스크/이슈:\n${mt.risks}\n\n`;
  if (roles)             txt += `사용자 역할:\n${roles}\n\n`;
  if (devices)           txt += `디바이스 (기기):\n${devices}\n\n`;
  txt += `${SEP50}\n\n2. 주요 기능 목록\n${'='.repeat(11)}\n\n\n`;

  let i = 1;
  for (const f of (specData?.features || [])) {
    const prio = PRIO_TXT[f.priority] || '중간';
    const underLen = Math.min(f.title.length * 2 + 4, 25);
    txt += `${i}. ${f.title}\n${'='.repeat(underLen)}\n`;
    txt += `[중요도: ${prio} | 상태: 시작전]\n\n`;
    txt += `${f.description || ''}\n\n`;
    const subs = f.sub_features || [];
    if (subs.length) {
      txt += `[수용 기준]\n`;
      subs.forEach((s, si) => { txt += `  ${si + 1}. ○ ${s.detail || s.title}\n`; });
    }
    txt += `\n\n${SEP50}\n\n`;
    i++;
  }
  return txt;
}

function specToExcelHtml(specData, prd, title) {
  const date = new Date().toISOString().split('T')[0];
  const { ov, cv, tg, mt, st, roles, devices } = prdFields(prd, title, date);
  const MS = 'border:1px solid #e5e7eb;padding:8px 12px;font-size:11px;font-family:sans-serif;';

  // 메타 헤더
  let body = `<table style="border-collapse:collapse;width:100%;margin-bottom:16px">`;
  body += `<tr><td colspan="2" style="${MS}background:#1f2937;color:#fff;font-size:16px;font-weight:700;padding:14px 16px;">도큐먼트 제목</td><td colspan="2" style="${MS}background:#f9fafb;font-size:14px;font-weight:600;">${title}</td></tr>`;
  body += `<tr><td style="${MS}font-weight:600;">프로젝트 이름</td><td style="${MS}">Project</td><td style="${MS}font-weight:600;">프로젝트 관리자</td><td style="${MS}">Admin</td></tr>`;
  body += `<tr><td style="${MS}font-weight:600;">날짜</td><td style="${MS}">${date}</td><td style="${MS}"></td><td style="${MS}"></td></tr>`;
  body += `</table>`;

  // PRD 개요 섹션
  body += `<table style="border-collapse:collapse;width:100%;margin-bottom:16px">`;
  body += `<tr><td colspan="2" style="${MS}background:#374151;color:#fff;font-weight:700;font-size:12px;">1. 프로덕트 요구사항 (PRD)</td></tr>`;
  const prdRows = [
    ['개요', ov.one_liner], ['핵심 목표', ov.product_goal],
    ['타겟', tg.users], ['시나리오', tg.scenario],
    ['역할', roles], ['디바이스 (기기)', devices],
    ['핵심 KPI', mt.kpis], ['리스크/이슈', mt.risks],
  ];
  for (const [k, v] of prdRows) {
    if (v) body += `<tr><td style="${MS}font-weight:600;width:140px;">${k}</td><td style="${MS}">${v}</td></tr>`;
  }
  body += `</table>`;

  // 기능 목록 테이블
  body += `<table style="border-collapse:collapse;width:100%">`;
  body += `<tr><td style="${THS}">요구사항 Requirement</td><td style="${THS}">기능 Feature</td><td style="${THS}">상세 기능 Detailed Spec</td><td style="${THS}">설명 및 상세 요구사항 Description</td></tr>`;
  let i = 1;
  for (const f of (specData?.features || [])) {
    const subs = f.sub_features || [];
    body += `<tr><td style="${CS}font-weight:600;">${i} ${f.title}</td><td style="${CS}"></td><td style="${CS}"></td><td style="${CS}">${f.description || ''}</td></tr>`;
    subs.forEach((s, si) => {
      body += `<tr><td style="${CS}"></td><td style="${CS}">${i}.${si + 1} ${s.title}</td><td style="${CS}"></td><td style="${CS}">${s.detail || ''}</td></tr>`;
      (s.sub_features || []).forEach((ss, ssi) => {
        body += `<tr><td style="${CS}"></td><td style="${CS}"></td><td style="${CS}">${i}.${si + 1}.${ssi + 1} ${ss.title}</td><td style="${CS}">${ss.detail || ''}</td></tr>`;
      });
    });
    i++;
  }
  body += `</table>`;

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body style="font-family:sans-serif;padding:20px">${body}</body></html>`;
}

// ════════════════════════════════════
//  유저플로우 내보내기 포맷
// ════════════════════════════════════

function flowToMarkdown(specData, prd, title) {
  const date = new Date().toISOString().split('T')[0];
  const { ov, cv, tg, mt, st, roles, devices } = prdFields(prd, title, date);

  let md = `# ${title} — 유저 플로우\n\n`;
  md += `| | |\n|---|---|\n`;
  md += `| **프로젝트 이름** | [${title}] |\n`;
  md += `| **프로젝트 관리자** | |\n`;
  md += `| **회사명** | |\n`;
  md += `| **날짜** | ${date} |\n\n`;
  md += `---\n## 1. 프로젝트 개요\n---\n`;
  if (st.category)     md += `### 카테고리\n> ${st.category}\n\n`;
  if (ov.one_liner)    md += `### 한 줄 정의\n${ov.one_liner}\n\n`;
  if (tg.users)        md += `### 타겟 사용자\n${tg.users}\n\n`;
  if (tg.scenario)     md += `### 사용 시나리오\n${tg.scenario}\n\n`;
  if (roles)           md += `### 사용자 역할\n> ${roles}\n\n`;
  if (devices)         md += `### 디바이스 (기기)\n> ${devices}\n\n`;
  md += `## 2. 유저 플로우\n---\n\n`;

  let i = 1;
  for (const f of (specData?.features || [])) {
    const prio = PRIO_EMOJI[f.priority] || '🟡 중간';
    md += `## ${i}. ${f.title}\n`;
    md += `> **중요도**: ${prio} | **진행 상태**: ⚪ 시작전\n\n`;
    md += `${f.description || ''}\n\n`;
    const subs = f.sub_features || [];
    if (subs.length) {
      md += `**흐름 단계:**\n\`\`\`\n`;
      subs.forEach((s, si) => {
        const nxt = s.leads_to ? ` → ${s.leads_to}` : '';
        md += `${si + 1}. ${s.title}${nxt}\n   ${s.detail || ''}\n`;
      });
      md += `\`\`\`\n\n\n---\n\n\n`;
    } else {
      md += `\n---\n\n\n`;
    }
    i++;
  }
  return md;
}

function flowToText(specData, prd, title) {
  const date = new Date().toISOString().split('T')[0];
  const { ov, tg, st, roles, devices } = prdFields(prd, title, date);

  let txt = `${title} — 유저 플로우\n${'='.repeat(Math.min(title.length + 8, 22))}\n\n`;
  txt += `프로젝트 이름: [${title}]\n프로젝트 관리자: \n회사명: \n날짜: ${date}\n\n${SEP50}\n\n`;
  txt += `1. 프로젝트 개요\n${'='.repeat(10)}\n\n\n`;
  if (st.category)   txt += `카테고리:\n${st.category}\n\n`;
  if (ov.one_liner)  txt += `한 줄 정의:\n${ov.one_liner}\n\n`;
  if (tg.users)      txt += `타겟 사용자:\n${tg.users}\n\n`;
  if (tg.scenario)   txt += `사용 시나리오:\n${tg.scenario}\n\n`;
  if (roles)         txt += `사용자 역할:\n${roles}\n\n`;
  if (devices)       txt += `디바이스 (기기):\n${devices}\n\n`;
  txt += `${SEP50}\n\n2. 유저 플로우\n${'='.repeat(9)}\n\n\n`;

  let i = 1;
  for (const f of (specData?.features || [])) {
    const prio = PRIO_TXT[f.priority] || '중간';
    const underLen = Math.min(f.title.length * 2 + 4, 25);
    txt += `${i}. ${f.title}\n${'='.repeat(underLen)}\n`;
    txt += `[중요도: ${prio} | 상태: 시작전]\n\n`;
    txt += `${f.description || ''}\n\n`;
    const subs = f.sub_features || [];
    if (subs.length) {
      txt += `[흐름 단계]\n`;
      subs.forEach((s, si) => {
        const nxt = s.leads_to ? ` -----> ${s.leads_to}` : '';
        txt += `  ${si + 1}. ${s.title}${nxt}\n     ${s.detail || ''}\n`;
      });
    }
    txt += `\n\n${SEP50}\n\n`;
    i++;
  }
  return txt;
}

function flowToExcelHtml(specData, prd, title) {
  const date = new Date().toISOString().split('T')[0];
  const { ov, tg, st, roles, devices } = prdFields(prd, title, date);
  const MS = 'border:1px solid #e5e7eb;padding:8px 12px;font-size:11px;font-family:sans-serif;';

  let body = `<table style="border-collapse:collapse;width:100%;margin-bottom:16px">`;
  body += `<tr><td colspan="2" style="${MS}background:#1f2937;color:#fff;font-size:16px;font-weight:700;padding:14px 16px;">도큐먼트 제목</td><td colspan="2" style="${MS}background:#f9fafb;font-size:14px;font-weight:600;">${title} — 유저 플로우</td></tr>`;
  body += `<tr><td style="${MS}font-weight:600;">프로젝트 이름</td><td style="${MS}">Project</td><td style="${MS}font-weight:600;">프로젝트 관리자</td><td style="${MS}">Admin</td></tr>`;
  body += `<tr><td style="${MS}font-weight:600;">날짜</td><td style="${MS}">${date}</td><td style="${MS}"></td><td style="${MS}"></td></tr>`;
  body += `</table>`;

  body += `<table style="border-collapse:collapse;width:100%;margin-bottom:16px">`;
  body += `<tr><td colspan="2" style="${MS}background:#374151;color:#fff;font-weight:700;font-size:12px;">1. 프로덕트 요구사항 (PRD)</td></tr>`;
  for (const [k, v] of [['개요', ov.one_liner], ['타겟', tg.users], ['시나리오', tg.scenario], ['역할', roles], ['디바이스 (기기)', devices]]) {
    if (v) body += `<tr><td style="${MS}font-weight:600;width:140px;">${k}</td><td style="${MS}">${v}</td></tr>`;
  }
  body += `</table>`;

  body += `<table style="border-collapse:collapse;width:100%">`;
  body += `<tr><td style="${THS}">섹션 Section</td><td style="${THS}">단계 Step</td><td style="${THS}">상세 설명 Detail</td><td style="${THS}">다음 섹션 Next</td></tr>`;
  let i = 1;
  for (const f of (specData?.features || [])) {
    const subs = f.sub_features || [];
    body += `<tr><td style="${CS}font-weight:600;" rowspan="${subs.length + 1}">${i}. ${f.title}<br/><span style="color:#6b7280;font-size:10px;">${f.description || ''}</span></td><td style="${CS}" colspan="3"></td></tr>`;
    subs.forEach((s, si) => {
      body += `<tr><td style="${CS}">${si + 1}. ${s.title}</td><td style="${CS}">${s.detail || ''}</td><td style="${CS}">${s.leads_to || '-'}</td></tr>`;
    });
    i++;
  }
  body += `</table>`;

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body style="font-family:sans-serif;padding:20px">${body}</body></html>`;
}

// ── SVG 요소를 PNG로 다운로드
async function downloadSvgAsPng(svgEl, filename) {
  const svgData = new XMLSerializer().serializeToString(svgEl);
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; });
  const canvas = document.createElement('canvas');
  canvas.width = svgEl.viewBox?.baseVal?.width || svgEl.clientWidth || 800;
  canvas.height = svgEl.viewBox?.baseVal?.height || svgEl.clientHeight || 600;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(url);
  const a = document.createElement('a');
  a.download = filename;
  a.href = canvas.toDataURL('image/png');
  a.click();
}

// ── 기능명세서 트리 SVG
function SpecTreePreview({ specData }) {
  const features = specData?.features || [];
  const NW = 150, NH = 30, GAP = 10, COL1 = 10, COL2 = 200, COL3 = 380;
  const nodes = [], lines = [];
  let y = 20;
  for (const f of features) {
    const subs = f.sub_features || [];
    const subCount = Math.max(1, subs.length);
    const fy = y + ((subCount * (NH + GAP)) - GAP) / 2 - NH / 2;
    nodes.push({ id: f.id, label: f.title, x: COL2, y: fy, color: '#ede9fe', stroke: '#7c3aed', text: '#5b21b6' });
    for (const s of subs) {
      nodes.push({ id: s.id, label: s.title, x: COL3, y, color: '#e0e7ff', stroke: '#6366f1', text: '#3730a3' });
      lines.push({ x1: COL2 + NW, y1: fy + NH / 2, x2: COL3, y2: y + NH / 2 });
      y += NH + GAP;
    }
    if (subs.length === 0) y += NH + GAP;
  }
  const H = Math.max(y + 20, 200);
  const W = COL3 + NW + 20;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ background: '#f9fafb', borderRadius: 8 }}>
      {/* 연결선 */}
      {lines.map((l, i) => (
        <path key={i} d={`M${l.x1},${l.y1} C${l.x1 + 30},${l.y1} ${l.x2 - 30},${l.y2} ${l.x2},${l.y2}`}
          fill="none" stroke="#d1d5db" strokeWidth="1.5" />
      ))}
      {/* 피처→서브 연결 */}
      {features.map((f, fi) => {
        const fn = nodes.find(n => n.id === f.id);
        if (!fn) return null;
        const sns = (f.sub_features || []).map(s => nodes.find(n => n.id === s.id)).filter(Boolean);
        return sns.map((sn, si) => (
          <path key={`${fi}-${si}`} d={`M${fn.x + NW},${fn.y + NH/2} C${fn.x + NW + 30},${fn.y + NH/2} ${sn.x - 30},${sn.y + NH/2} ${sn.x},${sn.y + NH/2}`}
            fill="none" stroke="#c4b5fd" strokeWidth="1.5" />
        ));
      })}
      {/* 노드 */}
      {nodes.map(n => (
        <g key={n.id}>
          <rect x={n.x} y={n.y} width={NW} height={NH} rx="6" fill={n.color} stroke={n.stroke} strokeWidth="1" />
          <text x={n.x + 8} y={n.y + NH / 2 + 4} fontSize="9.5" fill={n.text} fontFamily="sans-serif">
            {n.label.length > 17 ? n.label.slice(0, 17) + '…' : n.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── 유저플로우 섹션 SVG
function FlowPreview({ specData }) {
  const features = specData?.features || [];
  const SW = 160, SH_HEAD = 32, NODE_H = 26, GAP = 6, PAD = 12, COL_GAP = 28;
  const cols = [];
  let cx = 10;
  for (const f of features) {
    const subs = f.sub_features || [];
    const height = SH_HEAD + (subs.length * (NODE_H + GAP)) + PAD * 2;
    cols.push({ f, subs, x: cx, height });
    cx += SW + COL_GAP;
  }
  const W = cx + 10;
  const H = Math.max(...cols.map(c => c.height), 200) + 20;
  const colors = ['#f0fdf4', '#eff6ff', '#fef3c7', '#fdf4ff', '#fff7ed'];
  const strokes = ['#86efac', '#93c5fd', '#fcd34d', '#d8b4fe', '#fdba74'];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ background: '#f9fafb', borderRadius: 8 }}>
      {cols.map(({ f, subs, x, height }, ci) => (
        <g key={f.id}>
          <rect x={x} y={10} width={SW} height={height} rx="8" fill={colors[ci % 5]} stroke={strokes[ci % 5]} strokeWidth="1.5" />
          <rect x={x} y={10} width={SW} height={SH_HEAD} rx="8" fill={strokes[ci % 5]} />
          <rect x={x} y={10 + SH_HEAD - 8} width={SW} height={8} fill={strokes[ci % 5]} />
          <text x={x + 10} y={10 + SH_HEAD / 2 + 5} fontSize="10" fontWeight="bold" fill="#1f2937" fontFamily="sans-serif">
            {f.title.length > 16 ? f.title.slice(0, 16) + '…' : f.title}
          </text>
          {subs.map((s, si) => {
            const ny = 10 + SH_HEAD + PAD + si * (NODE_H + GAP);
            return (
              <g key={s.id}>
                <rect x={x + 8} y={ny} width={SW - 16} height={NODE_H} rx="5" fill="white" stroke={strokes[ci % 5]} strokeWidth="1" />
                <text x={x + 16} y={ny + NODE_H / 2 + 4} fontSize="9" fill="#374151" fontFamily="sans-serif">
                  {s.title.length > 15 ? s.title.slice(0, 15) + '…' : s.title}
                </text>
              </g>
            );
          })}
        </g>
      ))}
      {/* 섹션 간 leads_to 화살표 */}
      {cols.map(({ f, subs, x }, ci) => {
        if (ci >= cols.length - 1) return null;
        const nextCol = cols[ci + 1];
        return (
          <line key={`arr-${ci}`} x1={x + SW} y1={10 + H / 2} x2={nextCol.x} y2={10 + H / 2}
            stroke="#9ca3af" strokeWidth="1.5" markerEnd="url(#arr)" />
        );
      })}
      <defs>
        <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#9ca3af" />
        </marker>
      </defs>
    </svg>
  );
}

export default function EditorPage({ prd, setPrd, specData, setSpecData, flowData, setFlowData, projectTitle, setProjectTitle, onHome, aiScore, setAiScore }) {
  const [activeTab, setActiveTab]   = useState('prd');
  const [chatInput, setChatInput]   = useState('');
  const [messages, setMessages]     = useState([{ role: 'assistant', content: 'PRD가 생성되었습니다! 수정이 필요하면 말씀해주세요.' }]);
  const [isLoading, setIsLoading]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [suggestions, setSuggestions] = useState([]);

  // ── 우측 패널 상태
  const [rightPanel, setRightPanel] = useState(null); // 'export' | 'history' | 'comment' | null
  const [history, setHistory]       = useState([]); // { time, label }
  const [comments, setComments]     = useState([]); // { id, text, time, section }
  const [commentInput, setCommentInput] = useState('');
  const [commentSection, setCommentSection] = useState('전체');
  const [shareToast, setShareToast] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSubOpen, setExportSubOpen] = useState(false);
  const [exportModal, setExportModal] = useState(null); // { docType:'spec'|'flow', format:'xlsx'|'png'|'md'|'txt' }
  const svgPreviewRef = useRef(null);

  const chatEndRef   = useRef(null);
  const exportRef    = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // 외부 클릭으로 export 드롭다운 닫기
  useEffect(() => {
    const close = (e) => { if (exportRef.current && !exportRef.current.contains(e.target)) setExportOpen(false); };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, []);

  // 히스토리 자동 기록 (PRD 변경 시)
  useEffect(() => {
    setHistory(prev => {
      const label = prd?.overview?.one_liner ? `PRD 업데이트 — ${prd.overview.one_liner.slice(0, 20)}` : 'PRD 업데이트';
      const last = prev[0];
      if (last && Date.now() - last.ts < 3000) return prev; // 3초 내 중복 제거
      return [{ ts: Date.now(), time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }), label }, ...prev].slice(0, 30);
    });
  }, [prd]);

  // ── 내보내기 액션
  const handleExport = useCallback((type) => {
    setExportOpen(false);
    const safe = projectTitle.replace(/[/\\?%*:|"<>]/g, '-') || 'planforge';
    if (type === 'prd_md')   downloadText(prdToMarkdown(prd, projectTitle), `${safe}_PRD.md`);
    if (type === 'prd_json') downloadJSON({ prd }, `${safe}_PRD.json`);
    if (type === 'spec_json') downloadJSON({ specData }, `${safe}_기능명세서.json`);
    if (type === 'flow_json') downloadJSON({ flowData }, `${safe}_유저플로우.json`);
    if (type === 'full')     downloadJSON({ projectTitle, prd, specData, flowData, exportedAt: new Date().toISOString() }, `${safe}_전체패키지.json`);
  }, [prd, specData, flowData, projectTitle]);

  // ── 공유 (클립보드 복사)
  const handleShare = useCallback(async () => {
    const payload = JSON.stringify({ projectTitle, prd }, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
    } catch {
      const el = document.createElement('textarea');
      el.value = payload; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
    }
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2500);
  }, [projectTitle, prd]);

  // ── 코멘트 추가
  const addComment = useCallback(() => {
    if (!commentInput.trim()) return;
    setComments(prev => [{
      id: Date.now(), text: commentInput.trim(),
      section: commentSection,
      time: new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }),
    }, ...prev]);
    setCommentInput('');
  }, [commentInput, commentSection]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = useCallback(async (overrideText = null) => {
    const text = overrideText ?? chatInput.trim();
    if (!text || isLoading) return;
    setSuggestions([]);
    const userMsg = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    if (!overrideText) setChatInput('');
    setIsLoading(true);

    const systemPrompt = `당신은 PlanForge AI 어시스턴트입니다. 기존 PRD를 개선하고 보완합니다.

현재 PRD: ${JSON.stringify(prd, null, 2)}

규칙:
1. 매 답변마다 반드시 PRD에서 부족한 부분을 찾아 질문하세요 (한 번에 1~2개).
2. 매 답변마다 __PRD_UPDATE__ 블록을 포함하세요. 아직 모르는 필드는 빈 문자열로.
3. 매 답변마다 __SUGGESTIONS__ 블록을 포함하세요.
   - __SUGGESTIONS__ 은 AI가 방금 한 질문에 대한 [사용자 답변 후보] 3~4개입니다.
   - 사용자가 클릭하면 그 답변이 자동으로 전송됩니다.
   - 질문 내용과 맥락에 맞는 구체적인 답변 후보를 생성하세요.
   - 예: AI가 "타겟 사용자는?" 이라고 물으면 → ["소규모 쇼핑몰 운영자", "카카오톡으로 CS 업무를 보는 소상공인", "1인 기업/프리랜서", "직접 입력할게요"]
4. 한국어로 친근하게 답변하세요.
5. 답변 텍스트에서 블록 언급 금지.

__PRD_UPDATE__
{"overview":{"one_liner":"","product_goal":"","background":""},"core_value":{"problem":"","solution":"","differentiator":""},"target":{"users":"","scenario":""},"metrics":{"kpis":"","risks":""},"settings":{"category":"","roles":[],"devices":[]}}
__END_PRD_UPDATE__

__SUGGESTIONS__
["답변 후보 1","답변 후보 2","답변 후보 3","직접 입력할게요"]
__END_SUGGESTIONS__`;

    try {
      const responseText = await callGemini(newHistory.slice(-12), systemPrompt);
      const prdMatch = responseText.match(/__PRD_UPDATE__\s*([\s\S]*?)\s*__END_PRD_UPDATE__/);
      const sugMatch = responseText.match(/__SUGGESTIONS__\s*([\s\S]*?)\s*__END_SUGGESTIONS__/);
      let displayText = responseText
        .replace(/__PRD_UPDATE__[\s\S]*?__END_PRD_UPDATE__/, '')
        .replace(/__SUGGESTIONS__[\s\S]*?__END_SUGGESTIONS__/, '')
        .trim();
      if (prdMatch) { try { setPrd(prev => deepMergePrd(prev, JSON.parse(prdMatch[1].trim()))); } catch (e) {} }
      if (sugMatch) { try { const s = JSON.parse(sugMatch[1].trim()); if (Array.isArray(s)) setSuggestions(s.slice(0, 4)); } catch (e) {} }
      setMessages(prev => [...prev, { role: 'assistant', content: displayText || '업데이트되었습니다.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `오류: ${err.message}` }]);
    }
    setIsLoading(false);
  }, [chatInput, isLoading, messages, prd, setPrd]);

  const tabs = [{ id: 'prd', label: 'PRD' }, { id: 'spec', label: '기능명세서' }, { id: 'flow', label: '유저플로우' }];

  return (
    <div className="h-screen flex flex-col bg-gray-50" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <nav className="flex items-center px-4 h-12 border-b border-gray-200 bg-white shrink-0 gap-3 shadow-sm">
        <button onClick={onHome}
          className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold hover:bg-purple-700 transition-colors">
          PF
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <input value={projectTitle} onChange={e => setProjectTitle(e.target.value)}
          className="bg-transparent text-sm text-gray-700 font-medium w-56 outline-none focus:bg-purple-50 focus:ring-1 focus:ring-purple-200 rounded-lg px-2 py-1" />
        <div className="flex-1" />
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === t.id ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-2">
          {/* 프로필 아바타 */}
          <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white cursor-pointer hover:bg-purple-700 transition-colors shrink-0">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </div>

          {/* 코멘트 아이콘 */}
          <button onClick={() => setRightPanel(p => p === 'comment' ? null : 'comment')}
            title="전체 코멘트"
            className={`relative w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${rightPanel === 'comment' ? 'border-purple-400 bg-purple-50 text-purple-600' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {comments.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-purple-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none">
                {comments.length > 9 ? '9+' : comments.length}
              </span>
            )}
          </button>

          {/* 기록 아이콘 */}
          <button onClick={() => setRightPanel(p => p === 'history' ? null : 'history')}
            title="수정 기록"
            className={`w-8 h-8 rounded-full border flex items-center justify-center transition-colors ${rightPanel === 'history' ? 'border-purple-400 bg-purple-50 text-purple-600' : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/>
            </svg>
          </button>

          {/* 공유 버튼 */}
          <button onClick={handleShare}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-full transition-colors">
            공유
          </button>

          {/* 내보내기 드롭다운 */}
          <div ref={exportRef} className="relative">
            <button onClick={() => { setExportOpen(o => !o); setExportSubOpen(false); }}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-full transition-colors">
              내보내기
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 py-2">
                {/* 헤더 */}
                <div className="px-4 py-2">
                  <p className="text-sm font-semibold text-gray-800">내보내기</p>
                </div>
                <div className="h-px bg-gray-100 mx-2 mb-1" />

                {/* 프로젝트 내보내기 (서브메뉴) — 마우스가 버튼→서브메뉴 이동할 때 gap 없이 연결되도록 래퍼 기준 이벤트 사용 */}
                <div className="relative"
                  onMouseEnter={() => setExportSubOpen(true)}
                  onMouseLeave={() => setExportSubOpen(false)}>
                  <button className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors rounded-lg mx-0">
                    <span>프로젝트 내보내기</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6"/></svg>
                  </button>

                  {/* 왼쪽 서브메뉴 */}
                  {exportSubOpen && (
                    <div className="absolute right-full top-0 w-48 bg-white border border-gray-200 rounded-2xl shadow-xl z-50 py-2">
                      {[
                        { docType: 'spec', label: '기능명세서 내보내기' },
                        { docType: 'flow', label: '유저 플로우 내보내기' },
                      ].map(item => (
                        <button key={item.docType}
                          onClick={() => { setExportModal({ docType: item.docType, format: 'xlsx' }); setExportOpen(false); setExportSubOpen(false); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* 공유 토스트 */}
      {shareToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-fade-in">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
          클립보드에 복사됐어요!
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen ? (
          <div className="w-[300px] shrink-0 border-r border-gray-200 bg-white flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
              <button className="text-xs font-medium text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors">+ 새 채팅</button>
              <div className="flex-1" />
              <button onClick={() => setSidebarOpen(false)}
                className="text-gray-300 hover:text-gray-500 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${m.role === 'user' ? 'bg-gray-100 text-gray-500' : 'bg-purple-100 text-purple-600'}`}>
                    {m.role === 'user' ? 'J' : 'P'}
                  </div>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'bg-purple-500 text-white' : 'bg-white border border-gray-200 text-gray-700 shadow-sm'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold">P</div>
                  <div className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: d + 'ms' }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {suggestions.length > 0 && (
              <div className="px-3 pb-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-xs text-gray-400 font-medium">추천 답변</span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
                <div className="flex flex-col gap-1.5">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s)}
                      className="w-full text-left px-3 py-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700 transition-all flex items-center gap-2 group shadow-sm">
                      <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center text-xs shrink-0 group-hover:bg-purple-500 group-hover:text-white transition-colors font-bold">
                        {i + 1}
                      </span>
                      <span className="leading-snug">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-3 pb-3 pt-1">
              <div className="flex items-end gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-purple-300 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                  placeholder="PRD 수정을 요청하세요..." rows={1}
                  className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-300 outline-none resize-none" />
                <button onClick={() => sendMessage()} disabled={!chatInput.trim()}
                  className={`p-1.5 rounded-lg shrink-0 transition-all ${chatInput.trim() ? 'bg-purple-600 text-white hover:bg-purple-700' : 'text-gray-300'}`}>
                  <IconSend />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setSidebarOpen(true)}
            className="w-10 shrink-0 border-r border-gray-200 bg-white flex items-center justify-center text-gray-300 hover:text-purple-500 hover:bg-purple-50 transition-colors">
            💬
          </button>
        )}

        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 overflow-hidden">
            {activeTab === 'prd'  && <PRDPanel prd={prd} setPrd={setPrd} aiScore={aiScore} setAiScore={setAiScore} />}
            {activeTab === 'spec' && <SpecPanel prd={prd} specData={specData} setSpecData={setSpecData} />}
            {activeTab === 'flow' && <FlowPanel prd={prd} specData={specData} flowData={flowData} setFlowData={setFlowData} />}
          </div>

          {/* ── 기록 패널 */}
          {rightPanel === 'history' && (
            <div className="w-72 shrink-0 border-l border-gray-200 bg-white flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">수정 기록</span>
                <button onClick={() => setRightPanel(null)} className="text-gray-300 hover:text-gray-500 text-lg leading-none">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {history.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">아직 기록이 없어요.</p>
                ) : (
                  <div className="space-y-2">
                    {history.map((h, i) => (
                      <div key={h.ts} className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl ${i === 0 ? 'bg-purple-50 border border-purple-100' : 'bg-gray-50'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${i === 0 ? 'bg-purple-400' : 'bg-gray-300'}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-700 leading-snug truncate">{h.label}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{h.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 전체 코멘트 패널 */}
          {rightPanel === 'comment' && (
            <div className="w-80 shrink-0 border-l border-gray-200 bg-white flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <span className="text-sm font-semibold text-gray-700">전체 코멘트</span>
                <button onClick={() => setRightPanel(null)} className="text-gray-300 hover:text-gray-500 text-lg leading-none">✕</button>
              </div>

              {/* 코멘트 입력 */}
              <div className="px-3 py-3 border-b border-gray-100">
                <select value={commentSection} onChange={e => setCommentSection(e.target.value)}
                  className="w-full mb-2 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg text-gray-600 bg-gray-50 outline-none focus:border-purple-300">
                  {['전체', 'PRD 개요', '핵심 가치', '타겟 및 시나리오', '지표 및 리스크', '기능명세서', '유저플로우'].map(s => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <textarea value={commentInput} onChange={e => setCommentInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); }}}
                    placeholder="코멘트를 입력하세요..." rows={2}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none outline-none focus:border-purple-300 focus:ring-1 focus:ring-purple-100 placeholder-gray-300 text-gray-700" />
                  <button onClick={addComment} disabled={!commentInput.trim()}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors self-end ${commentInput.trim() ? 'bg-purple-600 text-white hover:bg-purple-700' : 'bg-gray-100 text-gray-300 cursor-not-allowed'}`}>
                    등록
                  </button>
                </div>
              </div>

              {/* 코멘트 목록 */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {comments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">아직 코멘트가 없어요.</p>
                ) : (
                  <div className="space-y-2.5">
                    {comments.map(c => (
                      <div key={c.id} className="bg-gray-50 rounded-xl px-3 py-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-semibold text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded-md">{c.section}</span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400">{c.time}</span>
                            <button onClick={() => setComments(prev => prev.filter(x => x.id !== c.id))}
                              className="text-gray-300 hover:text-red-400 text-xs leading-none transition-colors">✕</button>
                          </div>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed">{c.text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════
          내보내기 미리보기 모달
          ════════════════════════════════════════ */}
      {exportModal && (() => {
        const isSpec = exportModal.docType === 'spec';
        const docLabel = isSpec ? '기능명세서' : '유저 플로우';
        const safe = projectTitle.replace(/[/\\?%*:|"<>]/g, '-') || 'planforge';
        const fmt = exportModal.format;

        const formats = [
          { id: 'xlsx', label: '엑셀 (.xlsx)' },
          { id: 'png',  label: '이미지 (.png)' },
          { id: 'md',   label: '마크다운 (.md)' },
          { id: 'txt',  label: '텍스트 (.txt)' },
        ];

        const fmtDesc = {
          xlsx: '공유 문서, 산출물로 활용할 수 있는 엑셀 파일로 내보냅니다.',
          png:  '문서에 첨부 자료로 활용할 수 있는 이미지 파일로 내보냅니다.',
          md:   '문서 편집기나 협업 툴에서 바로 활용할 수 있는 마크다운 파일로 내보냅니다.',
          txt:  '간단히 복사·붙여넣기 하거나 기록용으로 활용할 수 있는 텍스트 파일을 내보냅니다.',
        };

        const handleDownload = async () => {
          if (fmt === 'xlsx') {
            const html = isSpec ? specToExcelHtml(specData, prd, projectTitle) : flowToExcelHtml(specData, prd, projectTitle);
            downloadExcelHtml(html, `${safe}_${docLabel}_${new Date().toISOString().split('T')[0]}.xls`);
          } else if (fmt === 'png') {
            const el = svgPreviewRef.current?.querySelector('svg');
            if (el) await downloadSvgAsPng(el, `${safe}_${docLabel}_${new Date().toISOString().split('T')[0]}.png`);
          } else if (fmt === 'md') {
            const md = isSpec ? specToMarkdown(specData, prd, projectTitle) : flowToMarkdown(specData, prd, projectTitle);
            downloadText(md, `${safe}_${docLabel}_${new Date().toISOString().split('T')[0]}.md`);
          } else if (fmt === 'txt') {
            const txt = isSpec ? specToText(specData, prd, projectTitle) : flowToText(specData, prd, projectTitle);
            downloadText(txt, `${safe}_${docLabel}_${new Date().toISOString().split('T')[0]}.txt`);
          }
        };

        // ── xlsx 미리보기 (PRD + 기능 테이블)
        const XlsxPreview = () => {
          const date = new Date().toISOString().split('T')[0];
          const ov = prd?.overview || {};
          const tg = prd?.target || {};
          const st = prd?.settings || {};
          const features = specData?.features || [];
          return (
            <div className="text-xs">
              {/* 메타 */}
              <table className="w-full border-collapse mb-4 text-xs">
                <tbody>
                  <tr>
                    <td colSpan={2} className="border border-gray-300 px-3 py-2 bg-gray-800 text-white font-bold text-sm">도큐먼트 제목</td>
                    <td colSpan={2} className="border border-gray-300 px-3 py-2 font-semibold text-gray-800">{projectTitle}</td>
                  </tr>
                  <tr><td className="border border-gray-200 px-3 py-1.5 font-semibold bg-gray-50">프로젝트 이름</td><td className="border border-gray-200 px-3 py-1.5">Project</td><td className="border border-gray-200 px-3 py-1.5 font-semibold bg-gray-50">프로젝트 관리자</td><td className="border border-gray-200 px-3 py-1.5">Admin</td></tr>
                  <tr><td className="border border-gray-200 px-3 py-1.5 font-semibold bg-gray-50">날짜</td><td className="border border-gray-200 px-3 py-1.5">{date}</td><td className="border border-gray-200 px-3 py-1.5 bg-gray-50" /><td className="border border-gray-200 px-3 py-1.5" /></tr>
                </tbody>
              </table>
              {/* PRD */}
              <table className="w-full border-collapse mb-4 text-xs">
                <tbody>
                  <tr><td colSpan={2} className="border border-gray-300 px-3 py-2 bg-gray-700 text-white font-bold">1. 프로덕트 요구사항 (PRD)</td></tr>
                  {[['개요', ov.one_liner],['핵심 목표', ov.product_goal],['타겟', tg.users],['역할', (st.roles||[]).join(', ')],['디바이스 (기기)', (st.devices||[]).join(', ')]].map(([k,v]) => v
                    ? <tr key={k}><td className="border border-gray-200 px-3 py-1.5 font-semibold bg-gray-50 w-28">{k}</td><td className="border border-gray-200 px-3 py-1.5 text-gray-700">{v}</td></tr>
                    : null)}
                </tbody>
              </table>
              {/* 기능 목록 */}
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    {(isSpec
                      ? ['요구사항 Requirement','기능 Feature','상세 기능 Detailed Spec','설명 및 상세 요구사항 Description']
                      : ['섹션 Section','단계 Step','상세 설명 Detail','다음 섹션 Next']
                    ).map(h => <th key={h} className="border border-gray-600 px-3 py-2 text-left font-semibold">{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {isSpec
                    ? features.flatMap((f, fi) => [
                        <tr key={f.id} className={fi % 2 === 0 ? '' : 'bg-gray-50'}><td className="border border-gray-200 px-3 py-1.5 font-semibold">{fi + 1}. {f.title}</td><td className="border border-gray-200 px-3 py-1.5" /><td className="border border-gray-200 px-3 py-1.5" /><td className="border border-gray-200 px-3 py-1.5 text-gray-500">{f.description}</td></tr>,
                        ...(f.sub_features||[]).flatMap((s, si) => [
                          <tr key={s.id}><td className="border border-gray-200 px-3 py-1.5" /><td className="border border-gray-200 px-3 py-1.5">{fi+1}.{si+1} {s.title}</td><td className="border border-gray-200 px-3 py-1.5" /><td className="border border-gray-200 px-3 py-1.5 text-gray-500">{s.detail}</td></tr>,
                          ...(s.sub_features||[]).map((ss, ssi) => <tr key={ss.id}><td className="border border-gray-200 px-3 py-1.5" /><td className="border border-gray-200 px-3 py-1.5" /><td className="border border-gray-200 px-3 py-1.5">{fi+1}.{si+1}.{ssi+1} {ss.title}</td><td className="border border-gray-200 px-3 py-1.5 text-gray-500">{ss.detail}</td></tr>)
                        ])
                      ])
                    : features.flatMap((f, fi) => [
                        <tr key={f.id} className="bg-gray-50"><td className="border border-gray-200 px-3 py-1.5 font-semibold">{fi+1}. {f.title}</td><td colSpan={3} className="border border-gray-200 px-3 py-1.5 text-gray-500">{f.description}</td></tr>,
                        ...(f.sub_features||[]).map((s, si) => <tr key={s.id}><td className="border border-gray-200 px-3 py-1.5" /><td className="border border-gray-200 px-3 py-1.5">{fi+1}.{si+1} {s.title}</td><td className="border border-gray-200 px-3 py-1.5 text-gray-500">{s.detail}</td><td className="border border-gray-200 px-3 py-1.5 text-purple-600">{s.leads_to||'-'}</td></tr>)
                      ])
                  }
                </tbody>
              </table>
            </div>
          );
        };

        // 미리보기 콘텐츠
        const renderPreview = () => {
          if (fmt === 'xlsx') return <XlsxPreview />;
          if (fmt === 'png') return (
            <div ref={svgPreviewRef}>
              {isSpec ? <SpecTreePreview specData={specData} /> : <FlowPreview specData={specData} />}
            </div>
          );
          const content = fmt === 'md'
            ? (isSpec ? specToMarkdown(specData, prd, projectTitle) : flowToMarkdown(specData, prd, projectTitle))
            : (isSpec ? specToText(specData, prd, projectTitle)     : flowToText(specData, prd, projectTitle));
          return (
            <div className="font-mono text-xs text-gray-700 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-xl p-4 border border-gray-200 overflow-x-auto">
              {content}
            </div>
          );
        };

        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6" onClick={e => e.target === e.currentTarget && setExportModal(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-[900px] max-h-[80vh] flex flex-col overflow-hidden">
              {/* 헤더 */}
              <div className="px-8 py-5 border-b border-gray-100 shrink-0">
                <h2 className="text-xl font-bold text-gray-900">내보내기 미리보기</h2>
              </div>

              {/* 바디 */}
              <div className="flex flex-1 overflow-hidden">
                {/* 왼쪽 탭 */}
                <div className="w-44 border-r border-gray-100 py-3 shrink-0">
                  {formats.map(f => (
                    <button key={f.id}
                      onClick={() => setExportModal(p => ({ ...p, format: f.id }))}
                      className={`w-full text-left px-6 py-3 text-sm transition-colors ${fmt === f.id ? 'bg-gray-100 font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* 오른쪽 미리보기 */}
                <div className="flex-1 overflow-y-auto p-8">
                  <p className="text-sm text-gray-400 mb-6">{fmtDesc[fmt]}</p>
                  {renderPreview()}
                </div>
              </div>

              {/* 푸터 */}
              <div className="flex justify-end gap-3 px-8 py-4 border-t border-gray-100 shrink-0">
                <button onClick={() => setExportModal(null)}
                  className="px-6 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                  닫기
                </button>
                <button onClick={handleDownload}
                  className="px-6 py-2 text-sm font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-xl transition-colors flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  다운로드
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
