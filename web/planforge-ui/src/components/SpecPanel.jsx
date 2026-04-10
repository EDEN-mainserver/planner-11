import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { callGemini } from "../utils/gemini";

// ── 레이아웃 상수
const ROOT_W = 140, ROOT_H = 56;
const FEAT_W = 240, FEAT_H = 96;
const SUB_W  = 180, SUB_H  = 40;
const H_GAP  = 60;
const V_GAP  = 8;
const F_GAP  = 24;
const PAD    = 48;

function colLX(d) {
  if (d === 0) return PAD;
  if (d === 1) return PAD + ROOT_W + H_GAP;
  return PAD + ROOT_W + H_GAP + FEAT_W + H_GAP + (d - 2) * (SUB_W + H_GAP);
}
function colRX(d) { return colLX(d) + (d === 0 ? ROOT_W : d === 1 ? FEAT_W : SUB_W); }
function cardH(d) { return d <= 0 ? ROOT_H : d === 1 ? FEAT_H : SUB_H; }

const P_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' };
function uid() { return Math.random().toString(36).slice(2, 7).toUpperCase(); }

function PriBars({ level }) {
  const c = P_COLORS[level] || '#e5e7eb';
  const n = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" className="shrink-0">
      {[{x:0,y:8,h:5},{x:4.5,y:5,h:8},{x:9,y:2,h:11}].map((b,i) => (
        <rect key={i} x={b.x} y={b.y} width="3.2" height={b.h} rx="0.7" fill={i<n?c:'#e5e7eb'}/>
      ))}
    </svg>
  );
}

// ── 서브트리 높이 계산 (재귀)
function calcHeight(node, depth) {
  const subs = node.sub_features || [];
  if (subs.length === 0) return cardH(depth);
  const childH = subs.reduce((s, c) => s + calcHeight(c, depth + 1), 0) + (subs.length - 1) * V_GAP;
  return Math.max(cardH(depth), childH);
}

// ── 트리 레이아웃 (재귀) → flat item 배열
function layoutNode(node, depth, startY, featPriority, path) {
  const h = cardH(depth);
  const totalH = calcHeight(node, depth);
  const cy = startY + totalH / 2;
  const items = [{ node, depth, y: cy - h / 2, cy, h, featPriority, path }];

  const subs = node.sub_features || [];
  if (subs.length > 0) {
    const childrenH = subs.reduce((s, c) => s + calcHeight(c, depth + 1), 0) + (subs.length - 1) * V_GAP;
    let childY = cy - childrenH / 2;
    for (const sub of subs) {
      const sh = calcHeight(sub, depth + 1);
      const { items: ci } = layoutNode(sub, depth + 1, childY, featPriority, [...path, sub.id]);
      items.push(...ci);
      childY += sh + V_GAP;
    }
  }
  return { items, nextY: startY + totalH + V_GAP };
}

// ── 경로로 자식 추가 (재귀)
function addChildAtPath(features, parentPath, newChild) {
  if (parentPath.length === 1) {
    return features.map(f =>
      f.id === parentPath[0]
        ? { ...f, sub_features: [...(f.sub_features || []), newChild] }
        : f
    );
  }
  return features.map(f =>
    f.id === parentPath[0]
      ? { ...f, sub_features: addChildAtPath(f.sub_features || [], parentPath.slice(1), newChild) }
      : f
  );
}

// ── 메인 컴포넌트
export default function SpecPanel({ prd, specData, setSpecData }) {
  const [modal, setModal]       = useState(false);
  const [loading, setLoading]   = useState(false);
  const [detail, setDetail]     = useState(null); // { node, path, isSuggestion }
  const [suggestions, setSuggestions]     = useState([]);
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const [suggesting, setSuggesting]       = useState(false);
  const [menuPath, setMenuPath]   = useState(null);   // 열려있는 "+" 메뉴의 노드 path
  const [menuPos, setMenuPos]     = useState(null);   // { x, y } viewport 좌표
  const [directPath, setDirectPath] = useState(null);
  const [directTitle, setDirectTitle] = useState('');
  const [commentInput, setCommentInput] = useState('');
  const [rootMenuOpen, setRootMenuOpen] = useState(false);
  const [rootMenuPos, setRootMenuPos]   = useState(null);

  const containerRef = useRef(null);
  const [tx, setTx] = useState(0), [ty, setTy] = useState(0), [scale, setScale] = useState(1);
  const drag = useRef({ active:false, sx:0, sy:0, ox:0, oy:0 });

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.1 : 0.9;
    const rect = containerRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    setScale(s => {
      const ns = Math.min(2, Math.max(0.2, s * f));
      const r = ns / s;
      setTx(x => mx - r*(mx - x));
      setTy(y => my - r*(my - y));
      return ns;
    });
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive:false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const onBgDown = useCallback((e) => {
    if (e.button !== 0) return;
    drag.current = { active:true, sx:e.clientX, sy:e.clientY, ox:tx, oy:ty };
  }, [tx, ty]);
  const onBgMove = useCallback((e) => {
    if (!drag.current.active) return;
    setTx(drag.current.ox + (e.clientX - drag.current.sx));
    setTy(drag.current.oy + (e.clientY - drag.current.sy));
  }, []);
  const onBgUp = useCallback(() => { drag.current.active = false; }, []);

  const features = useMemo(() => specData?.features || [], [specData]);

  const allItems = useMemo(() => {
    const items = [];
    let y = PAD;
    for (const feat of features) {
      const fh = calcHeight(feat, 1);
      const { items: fi } = layoutNode(feat, 1, y, feat.priority, [feat.id]);
      items.push(...fi);
      y += fh + F_GAP;
    }
    return items;
  }, [features]);

  const maxDepth = useMemo(() => allItems.length ? Math.max(...allItems.map(i => i.depth)) : 1, [allItems]);
  const totalH   = useMemo(() => allItems.length ? Math.max(...allItems.map(i => i.y + i.h)) + PAD : 400, [allItems]);
  const totalW   = useMemo(() => colRX(maxDepth) + 280, [maxDepth]); // 280 = context menu space
  const rootCY   = totalH / 2;

  // ── 글로벌 클릭으로 메뉴 닫기
  useEffect(() => {
    const close = () => { setMenuPath(null); setMenuPos(null); setRootMenuOpen(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  // ── AI: 특정 노드에 하위 기능 생성
  const generateForNode = useCallback(async (parentPath) => {
    setMenuPath(null); setMenuPos(null);
    setSuggesting(true);
    const parentItem = allItems.find(i => i.path.join(',') === parentPath.join(','));
    const pn = parentItem?.node;
    const prompt = `기능 "${pn?.title}"에 추가할 새 하위 기능 1개를 JSON으로 생성하세요.
설명: ${pn?.description || pn?.detail || ''}
기존 하위 기능: ${(pn?.sub_features||[]).map(s=>s.title).join(', ')||'없음'}
PRD 핵심 가치: ${JSON.stringify(prd?.core_value||{})}
형식(JSON만): {"title":"기능명(10자 이내)","detail":"2~3문장 설명"}
한국어, 중복 없이.`;
    try {
      const text = await callGemini([{role:'user',content:prompt}], '');
      const m = text.match(/\{[\s\S]*?\}/);
      if (m) {
        const parsed = JSON.parse(m[0]);
        const newNode = { ...parsed, id:`SF-${uid()}`, sub_features:[], isNew:true };
        const sug = { parentPath, data: newNode };
        setSuggestions(prev => {
          const next = [...prev, sug];
          setSuggestionIdx(next.length - 1);
          return next;
        });
        // 생성 즉시 패널 오픈
        setDetail({ node: newNode, path:[...parentPath, newNode.id], isSuggestion:true });
      }
    } catch(e) { alert('생성 실패: '+e.message); }
    setSuggesting(false);
  }, [prd, allItems]);

  // ── AI: 모든 피처에 하위 기능 일괄 생성
  const generateAllSubs = useCallback(async () => {
    setRootMenuOpen(false);
    setSuggesting(true);
    const prompt = `다음 기능 목록에 각각 추가할 하위 기능 2개씩을 JSON으로 생성하세요.
기능 목록: ${JSON.stringify(features.map(f=>({id:f.id,title:f.title,existing:(f.sub_features||[]).map(s=>s.title)})))}
형식(JSON만): {"results":[{"featId":"F-001","subs":[{"title":"기능명","detail":"설명"}]}]}
한국어, 기존과 중복 없이.`;
    try {
      const text = await callGemini([{role:'user',content:prompt}], '');
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const { results } = JSON.parse(m[0]);
        const newSugs = [];
        for (const r of (results||[])) {
          const feat = features.find(f => f.id === r.featId);
          if (!feat) continue;
          for (const sub of (r.subs||[])) {
            newSugs.push({ parentPath:[feat.id], data:{ ...sub, id:`SF-${uid()}`, sub_features:[], isNew:true } });
          }
        }
        setSuggestions(prev => {
          const startIdx = prev.length;
          const next = [...prev, ...newSugs];
          setSuggestionIdx(startIdx);
          if (newSugs.length > 0) setDetail({ node:newSugs[0].data, path:[...newSugs[0].parentPath, newSugs[0].data.id], isSuggestion:true });
          return next;
        });
      }
    } catch(e) { alert('생성 실패: '+e.message); }
    setSuggesting(false);
  }, [features]);

  // ── 승인
  const approveCurrent = useCallback(() => {
    const sug = suggestions[suggestionIdx];
    if (!sug) return;
    setSpecData(prev => ({ ...prev, features: addChildAtPath(prev.features, sug.parentPath, { ...sug.data, isNew:false }) }));
    const rem = suggestions.filter((_,i) => i !== suggestionIdx);
    const ni = Math.min(suggestionIdx, Math.max(0, rem.length - 1));
    setSuggestions(rem); setSuggestionIdx(ni);
    if (rem.length > 0) setDetail({ node:rem[ni].data, path:[...rem[ni].parentPath, rem[ni].data.id], isSuggestion:true });
    else setDetail(null);
  }, [suggestions, suggestionIdx, setSpecData]);

  const rejectCurrent = useCallback(() => {
    const rem = suggestions.filter((_,i) => i !== suggestionIdx);
    const ni = Math.min(suggestionIdx, Math.max(0, rem.length - 1));
    setSuggestions(rem); setSuggestionIdx(ni);
    if (rem.length > 0) setDetail({ node:rem[ni].data, path:[...rem[ni].parentPath, rem[ni].data.id], isSuggestion:true });
    else setDetail(null);
  }, [suggestions, suggestionIdx]);

  const approveAll = useCallback(() => {
    setSpecData(prev => {
      let feats = prev.features;
      for (const sug of suggestions) feats = addChildAtPath(feats, sug.parentPath, { ...sug.data, isNew:false });
      return { ...prev, features: feats };
    });
    setSuggestions([]); setSuggestionIdx(0); setDetail(null);
  }, [suggestions, setSpecData]);

  const rejectAll = useCallback(() => { setSuggestions([]); setSuggestionIdx(0); setDetail(null); }, []);

  // ── 직접 추가
  const addDirect = useCallback(() => {
    if (!directTitle.trim() || !directPath) return;
    const newNode = { id:`SF-${uid()}`, title:directTitle.trim(), detail:'', sub_features:[], isNew:false };
    setSpecData(prev => ({ ...prev, features: addChildAtPath(prev.features, directPath, newNode) }));
    setDirectTitle(''); setDirectPath(null);
  }, [directTitle, directPath, setSpecData]);

  // ── 초기 생성
  const generate = async () => {
    setLoading(true);
    const prompt = `다음 PRD를 분석하여 기능명세서를 JSON으로 생성하세요.
PRD: ${JSON.stringify(prd)}
형식(JSON만):
{"features":[{"id":"F-001","title":"기능 제목","description":"2~3문장 설명","priority":"high|medium|low","sub_features":[{"id":"SF-001-1","title":"하위 기능","detail":"상세 설명","sub_features":[]}]}]}
규칙: features 3~6개, sub_features 2~4개, 한국어`;
    try {
      const text = await callGemini([{role:'user',content:prompt}], '');
      const m = text.match(/\{[\s\S]*\}/);
      if (m) { setSpecData(JSON.parse(m[0])); setModal(true); }
    } catch(e) { alert('생성 실패: '+e.message); }
    setLoading(false);
  };

  // suggestionIdx 변경 시 패널 동기화
  const currentSug = suggestions[suggestionIdx];
  useEffect(() => {
    if (currentSug && detail?.isSuggestion) {
      setDetail({ node:currentSug.data, path:[...currentSug.parentPath, currentSug.data.id], isSuggestion:true });
    }
  }, [suggestionIdx]); // eslint-disable-line

  // ── 빈 상태
  if (!specData) return (
    <div className="h-full flex flex-col bg-gray-50">
      <div className="px-5 py-3 bg-white border-b border-gray-200 shrink-0">
        <span className="font-semibold text-gray-800 text-sm">기능명세서</span>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <p className="text-gray-800 text-lg font-medium text-center">PRD 기반 기능명세서를 생성합니다</p>
        <p className="text-gray-500 text-sm text-center">AI가 핵심 요구사항을 분석하고 마인드맵으로 펼쳐드려요</p>
        <button onClick={generate} disabled={loading}
          className="px-6 py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm">
          {loading ? '생성 중...' : '✨ 기능명세서 생성하기'}
        </button>
      </div>
      {modal && specData && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-[340px] p-6 flex flex-col items-center gap-4">
            <p className="text-gray-800 text-lg font-medium">기능명세서 초안이 생성되었어요!</p>
            <p className="text-gray-500 text-sm">{specData.features.length}개의 핵심 기능이 생성되었습니다.</p>
            <button onClick={() => setModal(false)}
              className="w-full py-2 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700">
              기능명세서 보러가기
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="relative h-full flex flex-col bg-gray-50 overflow-hidden">

      {/* 헤더 */}
      <div className="px-5 py-2.5 bg-white border-b border-gray-200 shrink-0 flex items-center gap-3">
        <span className="font-semibold text-gray-800 text-sm">기능명세서</span>
        <span className="text-xs text-gray-400">{features.length}개 핵심 기능</span>
        <div className="flex items-center gap-1.5 ml-auto">
          <button onClick={() => setScale(s=>Math.min(2,+(s*1.2).toFixed(2)))}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-purple-600 font-bold">+</button>
          <span className="text-xs text-gray-400 w-9 text-center">{Math.round(scale*100)}%</span>
          <button onClick={() => setScale(s=>Math.max(0.2,+(s*0.85).toFixed(2)))}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-purple-600 font-bold">−</button>
          <button onClick={() => { setTx(0); setTy(0); setScale(1); }} className="text-xs text-gray-400 hover:text-purple-600 ml-1">↺</button>
          <div className="w-px h-4 bg-gray-200 mx-1"/>
          <button onClick={() => { setSpecData(null); setSuggestions([]); setDetail(null); }}
            className="text-xs text-gray-400 hover:text-purple-600">재생성</button>
        </div>
      </div>

      {/* 캔버스 */}
      <div ref={containerRef}
        className="flex-1 overflow-hidden relative"
        style={{ backgroundImage:'radial-gradient(circle, #D1D5DB 1px, transparent 1px)', backgroundSize:'24px 24px', backgroundColor:'#f3f4f6', cursor:'grab', userSelect:'none' }}
        onMouseDown={onBgDown} onMouseMove={onBgMove} onMouseUp={onBgUp} onMouseLeave={onBgUp}>

        <div style={{ transform:`translate(${tx}px,${ty}px) scale(${scale})`, transformOrigin:'0 0', position:'absolute', width:totalW, height:totalH }}>

          {/* SVG 연결선 */}
          <svg style={{ position:'absolute', top:0, left:0, width:totalW, height:totalH, pointerEvents:'none', overflow:'visible' }}>
            {allItems.filter(i=>i.depth===1).map(item => {
              const mx = (colRX(0)+colLX(1))/2;
              return <path key={`r${item.node.id}`}
                d={`M ${colRX(0)} ${rootCY} C ${mx} ${rootCY} ${mx} ${item.cy} ${colLX(1)} ${item.cy}`}
                stroke="#CBD5E1" strokeWidth="1.4" fill="none"/>;
            })}
            {allItems.filter(i=>i.depth>=2).map(item => {
              const pp = item.path.slice(0,-1);
              const par = allItems.find(p=>p.path.join(',')===pp.join(','));
              if (!par) return null;
              const mx = (colRX(par.depth)+colLX(item.depth))/2;
              return <path key={`p${item.path.join('-')}`}
                d={`M ${colRX(par.depth)} ${par.cy} C ${mx} ${par.cy} ${mx} ${item.cy} ${colLX(item.depth)} ${item.cy}`}
                stroke="#CBD5E1" strokeWidth="1.2" fill="none"/>;
            })}
          </svg>

          {/* 루트 노드 */}
          <div style={{ position:'absolute', top:rootCY-ROOT_H/2, left:colLX(0), width:ROOT_W, height:ROOT_H }}
            className="bg-white rounded-xl border border-gray-200 shadow-sm px-3 py-2 flex flex-col justify-between"
            onClick={e=>e.stopPropagation()}>
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 text-xs">📄</span>
              <span className="text-xs font-semibold text-gray-700 truncate">{(prd?.overview?.one_liner||'기능명세서').slice(0,16)}</span>
            </div>
            <span className="text-xs text-teal-500 font-medium">↗ PRD</span>
            {/* 루트 "+" */}
            <div style={{ position:'absolute', top:ROOT_H/2-12, left:ROOT_W+10 }} onClick={e=>e.stopPropagation()}>
              <button className="w-6 h-6 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:border-purple-400 hover:text-purple-600 shadow-sm text-sm"
                onClick={e => { e.stopPropagation(); const r=e.currentTarget.getBoundingClientRect(); setRootMenuPos({x:r.right+4,y:r.top}); setRootMenuOpen(o=>!o); setMenuPath(null); }}>
                +
              </button>
            </div>
          </div>

          {/* 모든 노드 */}
          {allItems.map(item => {
            const { node, depth, y, cy, featPriority, path } = item;
            const pathKey = path.join(',');
            const isNew = node.isNew || suggestions.some(s=>s.data.id===node.id);
            const priority = node.priority || featPriority;
            const plusX = colRX(depth) + 10;
            const plusY = cy - 12;

            return (
              <div key={pathKey} style={{ position:'absolute' }}>
                {depth === 1 ? (
                  // ── 피처 카드
                  <div style={{ position:'absolute', top:y, left:colLX(1), width:FEAT_W, height:FEAT_H }}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm p-3.5 cursor-default"
                    onClick={e=>e.stopPropagation()}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <PriBars level={node.priority}/>
                        <span className="font-semibold text-gray-900 text-sm truncate">{node.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button className="text-gray-300 hover:text-yellow-400 text-sm">☆</button>
                        <button className="w-6 h-6 shrink-0 rounded-md bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center text-xs"
                          onClick={e=>{e.stopPropagation();setDetail({node,path,isSuggestion:false});}}>↗</button>
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">{node.description}</p>
                  </div>
                ) : (
                  // ── 서브피처 카드 (depth >= 2, 무한)
                  <div style={{ position:'absolute', top:y, left:colLX(depth), width:SUB_W, height:SUB_H }}
                    className={`bg-white rounded-lg flex items-center gap-2 px-3 shadow-sm border cursor-default ${isNew?'border-teal-400':'border-gray-200'}`}
                    onClick={e=>e.stopPropagation()}>
                    <PriBars level={priority}/>
                    <span className="flex-1 text-xs font-medium text-gray-800 truncate">{node.title}</span>
                    {isNew && <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-teal-100 text-teal-600 shrink-0">신규</span>}
                    <button className="w-6 h-6 shrink-0 rounded-md bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center text-xs"
                      onClick={e=>{e.stopPropagation();setDetail({node,path,isSuggestion:false});}}>↗</button>
                  </div>
                )}

                {/* "+" 버튼 (모든 노드) */}
                <div style={{ position:'absolute', top:plusY, left:plusX }} onClick={e=>e.stopPropagation()}>
                  <button
                    className="w-6 h-6 rounded-full bg-white border border-gray-300 flex items-center justify-center text-gray-400 hover:border-purple-400 hover:text-purple-600 shadow-sm text-sm transition-colors"
                    onClick={e=>{
                      e.stopPropagation();
                      const r=e.currentTarget.getBoundingClientRect();
                      const isSame = menuPath?.join(',') === pathKey;
                      setMenuPath(isSame ? null : path);
                      setMenuPos(isSame ? null : {x:r.right+4, y:r.top});
                      setRootMenuOpen(false);
                    }}>
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 컨텍스트 메뉴 (fixed, 클리핑 없음) */}
      {menuPath && menuPos && (
        <div style={{ position:'fixed', top:menuPos.y, left:menuPos.x, zIndex:9999 }}
          className="bg-gray-800 text-white rounded-xl shadow-2xl py-1.5 w-44"
          onClick={e=>e.stopPropagation()}>
          <button onClick={() => generateForNode(menuPath)}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-white/10 text-left">
            <span className="text-purple-300">✦</span> 다음 항목 생성
          </button>
          <div className="mx-3 border-t border-white/10 my-1"/>
          <button onClick={() => { setMenuPath(null); setMenuPos(null); setDirectPath(menuPath); setDirectTitle(''); }}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-white/10 text-left">
            <span>✏</span> 직접 항목 추가
          </button>
        </div>
      )}

      {/* 루트 컨텍스트 메뉴 */}
      {rootMenuOpen && rootMenuPos && (
        <div style={{ position:'fixed', top:rootMenuPos.y, left:rootMenuPos.x, zIndex:9999 }}
          className="bg-gray-800 text-white rounded-xl shadow-2xl py-1.5 w-48"
          onClick={e=>e.stopPropagation()}>
          <button onClick={generateAllSubs}
            className="w-full flex items-center gap-2.5 px-4 py-2 text-xs hover:bg-white/10 text-left">
            <span className="text-purple-300">✦</span> 모든 하위 항목 생성
          </button>
        </div>
      )}

      {/* 직접 추가 다이얼로그 */}
      {directPath && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/20"
          onClick={() => setDirectPath(null)}>
          <div className="bg-white rounded-2xl shadow-xl p-6 w-80 flex flex-col gap-4"
            onClick={e=>e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-800">하위 기능 직접 추가</h3>
            <input value={directTitle} onChange={e=>setDirectTitle(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter')addDirect();if(e.key==='Escape')setDirectPath(null);}}
              placeholder="기능명 입력 후 Enter"
              className="text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-purple-400"
              autoFocus/>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>setDirectPath(null)} className="px-3 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg">취소</button>
              <button onClick={addDirect} className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 rounded-lg">추가</button>
            </div>
          </div>
        </div>
      )}

      {/* 상세 패널 */}
      {detail && (
        <div className="absolute inset-0 flex justify-end pointer-events-none z-40">
          <div className="w-[420px] h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col pointer-events-auto animate-slide-in">
            {/* 패널 헤더 */}
            <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-2.5 shrink-0">
              <button onClick={()=>setDetail(null)} className="text-gray-400 hover:text-gray-700 text-base w-6 h-6 flex items-center justify-center">✕</button>
              <nav className="flex items-center gap-1 text-xs min-w-0 flex-1 flex-wrap">
                {detail.path.map((id,i) => {
                  const it = allItems.find(a=>a.node.id===id);
                  const title = it?.node.title || (id===detail.node.id ? detail.node.title : id);
                  return (
                    <span key={id} className="flex items-center gap-1 min-w-0">
                      {i>0&&<span className="text-gray-300 shrink-0">/</span>}
                      <span className={`truncate max-w-[100px] ${i===detail.path.length-1?'text-gray-700 font-medium':'text-gray-400'}`}>{title}</span>
                    </span>
                  );
                })}
              </nav>
              <button className="text-gray-300 hover:text-yellow-400 shrink-0">☆</button>
              {detail.isSuggestion && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button onClick={rejectCurrent} className="px-3 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">거절</button>
                  <button onClick={approveCurrent} className="px-3 py-1 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700">승인</button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* 제목 섹션 */}
              <div className="px-7 py-6 border-b border-gray-100">
                {detail.node.isNew && <span className="inline-flex text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-600 mb-3">신규</span>}
                <h2 className="text-xl font-semibold text-gray-900 mb-5">{detail.node.title}</h2>
                <div className="flex items-center gap-3 flex-wrap text-xs mb-3">
                  <span className="text-gray-400">ID <span className="font-mono text-gray-500 ml-1">{detail.node.id}</span></span>
                  <span className="h-3 w-px bg-gray-200"/>
                  <span className="flex items-center gap-1 text-gray-400">상태
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium ml-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400"/>시작전
                    </span>
                  </span>
                  <span className="h-3 w-px bg-gray-200"/>
                  <span className="flex items-center gap-1.5 text-gray-400">중요도
                    <PriBars level={allItems.find(i=>i.node.id===detail.path[0])?.node.priority||'medium'}/>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-gray-400 shrink-0">사용자 역할</span>
                  <span className="px-1.5 py-0.5 rounded border border-gray-200 text-gray-600 font-medium">사용자</span>
                </div>
              </div>

              {/* 설명 */}
              <div className="px-7 py-5 border-b border-gray-100">
                <p className="text-sm text-gray-700 leading-relaxed">
                  {detail.node.detail || detail.node.description || '상세 설명이 없습니다.'}
                </p>
              </div>

              {/* 연결된 하위 기능 */}
              <div className="px-7 py-5 border-b border-gray-100">
                <h3 className="text-sm font-medium text-gray-400 mb-3">연결된 하위 기능</h3>
                {(detail.node.sub_features||[]).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {detail.node.sub_features.map(s=>(
                      <button key={s.id} onClick={()=>setDetail({node:s,path:[...detail.path,s.id],isSuggestion:false})}
                        className="text-xs bg-gray-50 hover:bg-purple-50 text-gray-600 hover:text-purple-700 px-2.5 py-1 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors">
                        {s.title}
                      </button>
                    ))}
                  </div>
                ) : <p className="text-sm text-gray-400">연결된 하위 기능이 없습니다.</p>}
              </div>

              {/* 코멘트 */}
              <div className="px-7 py-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-400">코멘트</h3>
                  <button className="text-xs text-gray-400 hover:text-gray-600">해결된 코멘트 보기</button>
                </div>
                <div className="flex gap-2 mb-4">
                  <input value={commentInput} onChange={e=>setCommentInput(e.target.value)}
                    placeholder="코멘트를 입력하세요..."
                    className="flex-1 h-10 px-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-100"/>
                  <button disabled={!commentInput.trim()} className="h-10 px-3 text-sm font-medium bg-gray-100 text-gray-400 rounded-lg disabled:opacity-50">등록</button>
                </div>
                <p className="text-sm text-gray-400 text-center py-6">코멘트가 없습니다.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 하단 플로팅 바 */}
      {suggestions.length > 0 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl shadow-xl px-3 py-1.5">
            <button onClick={() => { if(window.confirm('모두 승인하시겠습니까?')) approveAll(); }}
              className="px-2.5 py-1 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 shrink-0">일괄처리</button>
            <div className="w-px h-5 bg-gray-200"/>
            <button onClick={()=>setSuggestionIdx(i=>Math.max(0,i-1))} disabled={suggestionIdx===0}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30">‹</button>
            <div className="flex items-center gap-2 text-xs cursor-pointer"
              onClick={()=>currentSug&&setDetail({node:currentSug.data,path:[...currentSug.parentPath,currentSug.data.id],isSuggestion:true})}>
              <span className="text-gray-500 tabular-nums">{suggestionIdx+1} / {suggestions.length}</span>
              <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-teal-100 text-teal-600 shrink-0">신규</span>
              <span className="text-gray-500 truncate max-w-[120px]">{currentSug?.data.title}</span>
              <span className="text-gray-300">›</span>
            </div>
            <button onClick={()=>setSuggestionIdx(i=>Math.min(suggestions.length-1,i+1))} disabled={suggestionIdx===suggestions.length-1}
              className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-30">›</button>
            <div className="w-px h-5 bg-gray-200"/>
            <button onClick={rejectCurrent} className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">✕ 거절</button>
            <button onClick={approveCurrent} className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700">✓ 승인</button>
          </div>
        </div>
      )}

      {/* AI 생성 중 */}
      {suggesting && (
        <div className="absolute bottom-4 right-4 z-50 flex items-center gap-2 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-2.5">
          <span className="animate-spin text-purple-500">⟳</span>
          <span className="text-xs text-gray-600 font-medium">AI 생성 중...</span>
        </div>
      )}
    </div>
  );
}
