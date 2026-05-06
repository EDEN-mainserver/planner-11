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

// 노드 타입별 스타일
const NS = {
  start:       { fill: '#111827',               text: '#ffffff', stroke: null,                   rx: 5  },
  section_top: { fill: '#7c3aed',               text: '#ffffff', stroke: null,                   rx: 6  },
  page:        { fill: 'rgba(124,58,237,0.13)', text: '#5b21b6', stroke: 'rgba(124,58,237,0.4)', rx: 6  },
  action:      { fill: '#ffffff',               text: '#374151', stroke: '#d4d4d4',              rx: 14 },
};

const EDGE_COLOR = '#c8c8c8';
const CROSS_EDGE_COLOR = '#a78bfa'; // 크로스 섹션 엣지 색상 (보라)

export default function FlowPanel({ specData, flowData, setFlowData }) {
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed]   = useState(0);
  const [stepMsg, setStepMsg]   = useState('');
  const timerRef = useRef(null);
  const [simOpen, setSimOpen]   = useState(false); // 시뮬레이터 모달
  const [simIdx, setSimIdx]     = useState(0);      // 현재 화면 인덱스
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

  // ── 섹션 하나를 specData 계층으로 결정론적 빌드 (AI 실패 시 폴백)
  const buildSectionFromSpec = (f, isFirst) => {
    const nodes = [], edges = [], subs = f.sub_features || [];
    let rowCursor = 0;
    const subLayout = subs.map(s => {
      const ssubs = s.sub_features || [];
      const height = Math.max(1, ssubs.length);
      const pageRow = rowCursor + Math.floor((height - 1) / 2);
      const startRow = rowCursor;
      rowCursor += height;
      return { s, ssubs, pageRow, startRow };
    });
    const secTopRow = Math.floor((Math.max(rowCursor, 1) - 1) / 2);
    if (isFirst) {
      nodes.push({ id: 'start', type: 'start', label: '시작', col: 0, row: secTopRow });
      edges.push({ from: 'start', to: f.id });
    }
    const lbl = t => t.length > 10 ? t.slice(0, 10) + '…' : t;
    nodes.push({ id: f.id, type: 'section_top', label: lbl(f.title), col: 1, row: secTopRow });
    subLayout.forEach(({ s, ssubs, pageRow, startRow }) => {
      nodes.push({ id: s.id, type: 'page', label: lbl(s.title), col: 2, row: pageRow });
      edges.push({ from: f.id, to: s.id });
      ssubs.forEach((ss, ssi) => {
        nodes.push({ id: ss.id, type: 'action', label: lbl(ss.title), col: 3, row: startRow + ssi });
        edges.push({ from: s.id, to: ss.id });
      });
    });
    return { featureId: f.id, featureTitle: f.title, nodes, edges };
  };

  // ── 섹션별 AI 생성 (UX 화면 여정 중심)
  const generate = async () => {
    if (!specData?.features?.length) { alert('먼저 기능명세서를 생성해주세요.'); return; }
    setLoading(true);
    setElapsed(0);
    setStepMsg('유저플로우 생성 준비 중...');
    // 1초마다 경과 시간 업데이트
    const startTime = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    const allSections = [];
    const total = specData.features.length;

    for (let fi = 0; fi < specData.features.length; fi++) {
      const f = specData.features[fi];
      const isFirst = fi === 0;
      setStepMsg(`섹션 생성 중 (${fi + 1}/${total}) — ${f.title}`);

      // 기능명세서 구조: 그룹(depth-2)과 항목(depth-3)으로 정리해 AI에 전달
      const specGroups = (f.sub_features || []).map(s => ({
        group: s.title,
        items: (s.sub_features || []).map(ss => ss.title),
      }));
      const specJson = JSON.stringify(specGroups, null, 2);

      const prompt = `당신은 시니어 UX 설계자입니다. 아래 기능명세서를 바탕으로 실제 사용자 경험 흐름을 JSON으로 설계하세요.

## 기능명: ${f.title}
## 기능 설명: ${f.description || ''}

## 기능명세서 (구현 참고):
${specJson}

## 핵심 변환 규칙: 명세서 → UX 화면
명세서의 "group"(구현 역할 그룹) → page 노드 (사용자가 보는 화면으로 번역)
명세서의 "item"(구현 항목) → action 노드 (사용자 행동/시스템 응답으로 번역)

번역 예시:
  group "사진 업로드 및 검증" → page: "사진 선택 화면"
  item  "사진 업로드 UI"     → action: "사진 선택"
  item  "이미지 유효성 검사"  → action: "유효성 오류 안내"
  item  "이미지 전송 API"    → action: "업로드 중"
  item  "업로드 실패 처리"   → action: "업로드 실패 안내"

  group "적합도 계산 및 시각화" → page: "적합도 결과 화면"
  item  "부위별 오차 계산"      → action: "부위별 수치 확인"
  item  "최종 적합도 산출"      → action: "적합도 점수 표시"
  item  "계산 오류 처리"        → action: "계산 오류 안내"

## 금지 사항 (반드시 준수)
❌ page label: API, DB, 큐잉, 전처리, 정규화, 검증 등 기술 용어 사용 금지
❌ action label: "~처리", "~로직", "~큐잉", "~API" 등 개발자 언어 금지
❌ 명세서 group/item 이름을 그대로 복사 금지 (반드시 사용자 언어로 번역)
❌ action 노드는 page당 최대 4개 (초과 금지)

## 출력 형식 (JSON만, 다른 텍스트 절대 금지):
{"nodes":[{"id":"string","type":"section_top|page|action","label":"10자이내","col":1,"row":0}],"edges":[{"from":"id","to":"id"}]}

## 노드 규칙:
1. section_top: id="${f.id}", col:1, label=이 기능의 메인 화면명
   ✅ 형식: "~화면" (예: "AI 분석 화면", "사이즈 결과 화면", "설정 화면")
2. page(col:2): 명세서 group 수에 맞게 2~4개
   ✅ 형식: 반드시 명사형 화면명 — "~화면", "~결과", "~로딩", "~안내 화면"
   ❌ 금지: "~하기", "~올리기", "~중", "~확인하기" 등 동사형/진행형 절대 금지
   ✅ 좋은 예: "사진 업로드 화면", "분석 로딩 화면", "결과 화면", "오류 안내 화면"
   ❌ 나쁜 예: "사진 올리기", "분석 중", "체형 확인하기", "다시 분석하기"
3. action(col:3): 명세서 item 번역, page당 2~4개, 성공+실패 포함
   ✅ 동사형/상태형 허용: "사진 선택", "분석 완료", "업로드 실패 안내"
4. row: 0부터, 같은 col 내 중복 없음, section_top row = col:2 중앙값
5. id: section_top="${f.id}", page="${f.id}_p1"~, action="${f.id}_p1_a1"~
${isFirst
  ? `6. start 노드: {"id":"start","type":"start","label":"시작","col":0,"row":section_top과 동일} + edge start→${f.id}`
  : `6. start 노드 없음`}
7. edges: section_top→page, page→action (섹션 내부만)`;

      let section = null;
      try {
        const text = await callGemini([{ role: 'user', content: prompt }], '');
        const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
        const m = cleaned.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]);
          if (Array.isArray(parsed.nodes) && parsed.nodes.length) {
            // page 노드 동사형 label 자동 교정: "~하기" / "~올리기" / "~중" → "~화면"
            const fixPageLabel = (label) => {
              if (!label) return label;
              if (label.endsWith('하기') || label.endsWith('올리기') || label.endsWith('보기'))
                return label.replace(/(하기|올리기|보기)$/, ' 화면');
              if (/중$/.test(label) && !label.endsWith('화면'))
                return label + ' 화면';
              return label;
            };
            // section_top id가 f.id와 다르면 강제 교정
            const nodes = parsed.nodes.map(n =>
              n.type === 'section_top' ? { ...n, id: f.id } :
              n.type === 'page'        ? { ...n, label: fixPageLabel(n.label) } : n
            );
            const edges = (parsed.edges || []).map(e => ({
              from: e.from === parsed.nodes.find(n => n.type === 'section_top')?.id ? f.id : e.from,
              to:   e.to   === parsed.nodes.find(n => n.type === 'section_top')?.id ? f.id : e.to,
            }));
            section = { featureId: f.id, featureTitle: f.title, nodes, edges };
          }
        }
      } catch { /* 파싱 실패 → 폴백 */ }

      allSections.push(section ?? buildSectionFromSpec(f, isFirst));
    }

    // ── 섹션 간 크로스 연결: AI가 각 섹션의 "완료 action → 다음 섹션 진입" 결정
    setStepMsg('섹션 간 흐름 연결 중...');
    let crossEdges = [];
    if (allSections.length > 1) {
      try {
        const sectionSummary = allSections.map(sec => ({
          featureId: sec.featureId,
          title: sec.featureTitle,
          actions: (sec.nodes || [])
            .filter(n => n.type === 'action')
            .map(n => ({ id: n.id, label: n.label })),
        }));
        const crossPrompt = `유저플로우의 섹션 간 화면 이동 경로를 결정하세요.

섹션 목록 (사용자가 경험하는 순서):
${JSON.stringify(sectionSummary, null, 2)}

각 섹션(마지막 제외)에서 다음 섹션으로 자연스럽게 이동하게 만드는 핵심 "완료/확인" action 1개를 선택하세요.
예: "분석 결과 확인" → 다음 섹션 시작, "추천 사이즈 표시" → 다음 섹션 시작

출력(JSON 배열만, 다른 텍스트 절대 금지):
[{"from":"actionId","to":"다음섹션featureId","label":"이동이유10자이내"}]

규칙:
- 반드시 현재 섹션의 action id 중에서 선택 (임의 id 생성 금지)
- to는 반드시 다음 섹션의 featureId
- 마지막 섹션은 포함하지 않음`;

        const crossText = await callGemini([{ role: 'user', content: crossPrompt }], '');
        const cleanedCross = crossText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
        const crossMatch = cleanedCross.match(/\[[\s\S]*\]/);
        if (crossMatch) {
          const parsed = JSON.parse(crossMatch[0]);
          if (Array.isArray(parsed)) crossEdges = parsed.filter(e => e.from && e.to);
        }
      } catch { /* 크로스 엣지 생성 실패 → 조용히 무시 */ }
    }

    clearInterval(timerRef.current);
    setFlowData({ sections: allSections, crossEdges });
    setLoading(false);
    setStepMsg('');
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

    // ── specData 계층 구조 기반 누락 엣지 자동 보완
    // (AI가 section_top→page, page→action 엣지를 빠뜨릴 경우 강제 추가)
    if (specData?.features) {
      for (const f of specData.features) {
        for (const s of (f.sub_features || [])) {
          const fromNode = allNodeMap[f.id];
          const toNode = allNodeMap[s.id];
          if (fromNode && toNode) {
            if (!bySource[fromNode.id]) bySource[fromNode.id] = { from: fromNode, targets: [] };
            if (!bySource[fromNode.id].targets.some(t => t.id === toNode.id)) {
              bySource[fromNode.id].targets.push({ ...toNode, isCross: false });
            }
          }
          for (const ss of (s.sub_features || [])) {
            const fromNode2 = allNodeMap[s.id];
            const toNode2 = allNodeMap[ss.id];
            if (fromNode2 && toNode2) {
              if (!bySource[fromNode2.id]) bySource[fromNode2.id] = { from: fromNode2, targets: [] };
              if (!bySource[fromNode2.id].targets.some(t => t.id === toNode2.id)) {
                bySource[fromNode2.id].targets.push({ ...toNode2, isCross: false });
              }
            }
          }
        }
      }
    }

    // ── flowData.crossEdges 기반 크로스 섹션 엣지 (AI 생성)
    if (flowData?.crossEdges?.length) {
      for (const e of flowData.crossEdges) {
        const fromNode = allNodeMap[e.from];
        const toNode   = allNodeMap[e.to];
        if (!fromNode || !toNode) continue;
        if (!bySource[fromNode.id]) bySource[fromNode.id] = { from: fromNode, targets: [] };
        if (!bySource[fromNode.id].targets.some(t => t.id === toNode.id)) {
          bySource[fromNode.id].targets.push({ ...toNode, isCross: true });
        }
      }
    }

    // ── leads_to 기반 크로스 섹션 엣지 자동 생성 (specData 기반 폴백)
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

    // bypass 레인: 실제 최대 컬럼 바로 오른쪽에 배치 (col:3 노드가 생기면 그 오른쪽으로 이동)
    const BYPASS_BASE = cx(maxColGlobal) + cw(maxColGlobal) + 24;
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
        {loading ? (
          /* ── 생성 중 로딩 UI */
          <div className="flex flex-col items-center gap-4">
            {/* 경과 시간 */}
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold tabular-nums text-purple-600">
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
              </span>
              <span className="text-sm text-gray-400">경과</span>
            </div>
            {/* 스피너 + 단계 메시지 */}
            <div className="flex items-center gap-2">
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#e9d5ff" strokeWidth="3"/>
                <path d="M12 2a10 10 0 0 1 10 10" stroke="#7c3aed" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              <span className="text-sm text-gray-600 font-medium">{stepMsg}</span>
            </div>
            {/* 진행 힌트 */}
            <p className="text-xs text-gray-400 text-center max-w-xs">
              기능 수에 따라 30초~2분 정도 소요됩니다
            </p>
          </div>
        ) : (
          /* ── 초기 상태 */
          <>
            <p className="text-gray-800 text-lg font-medium text-center">기능명세서 기반 유저플로우를 생성합니다</p>
            <p className="text-gray-500 text-sm text-center">AI가 기능별 사용자 흐름을 자동으로 시각화해드려요</p>
            <button onClick={generate}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors shadow-sm">
              ✨ 유저플로우 생성하기
            </button>
            {!specData?.features?.length && (
              <p className="text-xs text-amber-500">기능명세서 탭에서 먼저 기능명세서를 생성해주세요.</p>
            )}
          </>
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
          <button onClick={() => { setSimIdx(0); setSimOpen(true); }}
            className="text-xs font-medium text-purple-600 hover:text-purple-800 border border-purple-300 rounded-md px-2.5 py-0.5 hover:bg-purple-50 transition-colors flex items-center gap-1">
            ▶ 워크플로우 체험
          </button>
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

              {/* ── 섹션 간 수직 연결 (section_top → next section_top) */}
              {layout.sections.slice(0, -1).map((sec, si) => {
                const nextSec = layout.sections[si + 1];
                const fromTop = sec.positioned.find(n => n.type === 'section_top');
                const toTop   = nextSec?.positioned?.find(n => n.type === 'section_top');
                if (!fromTop || !toTop) return null;
                const x  = fromTop.cx;
                const y1 = fromTop.y + fromTop.h;
                const y2 = toTop.y;
                return (
                  <g key={`inter-${si}`}>
                    <line x1={x} y1={y1} x2={x} y2={y2 - ARROW + 1}
                      stroke={EDGE_COLOR} strokeWidth="1.1" />
                    <polygon points={`${x},${y2} ${x - ARROW / 2},${y2 - ARROW} ${x + ARROW / 2},${y2 - ARROW}`}
                      fill={EDGE_COLOR} />
                  </g>
                );
              })}

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

      {/* ── 워크플로우 시뮬레이터 모달 */}
      {simOpen && (() => {
        // 모든 page 노드를 순서대로 평탄화
        const screens = (flowData?.sections || []).flatMap(sec =>
          (sec.nodes || [])
            .filter(n => n.type === 'page')
            .map(page => {
              const actionIds = new Set(
                (sec.edges || []).filter(e => e.from === page.id).map(e => e.to)
              );
              const actions = (sec.nodes || [])
                .filter(n => actionIds.has(n.id))
                .map(n => {
                  const cross = (flowData?.crossEdges || []).find(c => c.from === n.id);
                  return { label: n.label, isCross: !!cross };
                });
              return { sectionTitle: sec.featureTitle, pageLabel: page.label, actions };
            })
        );
        const total  = screens.length;
        const cur    = screens[simIdx] || {};
        const pct    = total > 0 ? Math.round(((simIdx + 1) / total) * 100) : 0;

        // 섹션별 색상 (최대 8개)
        const SEC_COLORS = ['#7c3aed','#6d28d9','#5b21b6','#4c1d95','#7c3aed','#6d28d9','#5b21b6','#4c1d95'];
        // 어느 섹션에 속하는지
        const allSectionTitles = [...new Set(screens.map(s => s.sectionTitle))];
        const secColor = SEC_COLORS[allSectionTitles.indexOf(cur.sectionTitle) % SEC_COLORS.length];

        return (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-6"
            onClick={e => e.target === e.currentTarget && setSimOpen(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-[520px] flex flex-col overflow-hidden"
              style={{ maxHeight: '80vh' }}>

              {/* 헤더 */}
              <div className="px-6 pt-5 pb-4 flex items-center justify-between border-b border-gray-100">
                <div>
                  <p className="text-xs font-semibold text-purple-500 uppercase tracking-wide">워크플로우 체험</p>
                  <h2 className="text-base font-bold text-gray-900 mt-0.5">실제 사용자 흐름 미리보기</h2>
                </div>
                <button onClick={() => setSimOpen(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
              </div>

              {/* 진행 바 */}
              <div className="px-6 py-3 border-b border-gray-50">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-400 font-medium">진행률</span>
                  <span className="text-xs text-purple-600 font-semibold">{simIdx + 1} / {total} 화면</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%`, backgroundColor: secColor }} />
                </div>
                {/* 섹션 탭 */}
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {allSectionTitles.map((t) => (
                    <span key={t}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                        t === cur.sectionTitle
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-gray-100 text-gray-400'
                      }`}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              {/* 본문 */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {/* 섹션 태그 */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[11px] font-semibold text-white px-2.5 py-1 rounded-full"
                    style={{ backgroundColor: secColor }}>
                    {cur.sectionTitle}
                  </span>
                  {simIdx > 0 && screens[simIdx - 1].sectionTitle !== cur.sectionTitle && (
                    <span className="text-[10px] text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                      ↗ 화면 이동
                    </span>
                  )}
                </div>

                {/* 현재 화면명 */}
                <div className="bg-purple-50 border border-purple-200 rounded-xl px-5 py-4 mb-5">
                  <p className="text-[11px] text-purple-400 font-medium mb-1">현재 화면</p>
                  <p className="text-lg font-bold text-purple-800">{cur.pageLabel}</p>
                </div>

                {/* 이 화면에서 할 수 있는 것 */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2.5">이 화면에서 발생하는 행동</p>
                  <div className="flex flex-col gap-2">
                    {(cur.actions || []).map((a, ai) => (
                      <div key={ai}
                        className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-sm ${
                          a.isCross
                            ? 'bg-purple-50 border-purple-300 text-purple-700'
                            : 'bg-gray-50 border-gray-200 text-gray-700'
                        }`}>
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          a.isCross ? 'bg-purple-500' : 'bg-gray-400'
                        }`} />
                        <span className="font-medium">{a.label}</span>
                        {a.isCross && (
                          <span className="ml-auto text-[10px] text-purple-500 bg-purple-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            다음 섹션으로 이동 →
                          </span>
                        )}
                      </div>
                    ))}
                    {(!cur.actions || cur.actions.length === 0) && (
                      <p className="text-xs text-gray-400 italic">등록된 행동 없음</p>
                    )}
                  </div>
                </div>
              </div>

              {/* 푸터 (네비게이션) */}
              <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                <button
                  onClick={() => setSimIdx(i => Math.max(0, i - 1))}
                  disabled={simIdx === 0}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  ← 이전
                </button>

                <button onClick={() => { setSimIdx(0); }}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  처음으로
                </button>

                {simIdx < total - 1 ? (
                  <button
                    onClick={() => setSimIdx(i => Math.min(total - 1, i + 1))}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white rounded-xl transition-colors"
                    style={{ backgroundColor: secColor }}>
                    다음 →
                  </button>
                ) : (
                  <button onClick={() => setSimOpen(false)}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-gray-800 rounded-xl hover:bg-gray-700 transition-colors">
                    완료 ✓
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
