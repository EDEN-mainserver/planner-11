// ── 에덴캔버스 — 내부 디자인 에디터 ──
// 미리캔버스 기능명세서 기반: 멀티페이지, Undo/Redo, 리사이즈 핸들,
// 다중 선택, Ctrl+C/V, 정렬, Zoom, Stroke, 이탤릭/밑줄, 배경 이미지
import { useState, useRef, useEffect, useCallback } from "react";

// ── 캔버스 사이즈 카테고리 ──
const SIZE_CATEGORIES = [
  { category: "소셜미디어", sizes: [
    { label: "카드뉴스 1:1",    w: 1080, h: 1080, desc: "1080×1080 px" },
    { label: "SNS 세로 4:5",    w: 1080, h: 1350, desc: "1080×1350 px" },
    { label: "웹 포스터 세로",  w: 891,  h: 1260, desc: "891×1260 px"  },
    { label: "상세페이지",      w: 860,  h: 1100, desc: "860×1100 px"  },
    { label: "스토리 9:16",     w: 1080, h: 1920, desc: "1080×1920 px" },
  ]},
  { category: "문서", sizes: [
    { label: "프레젠테이션",    w: 1920, h: 1080, desc: "1920×1080 px" },
    { label: "인포그래픽 가로", w: 1920, h: 1080, desc: "1920×1080 px" },
    { label: "인포그래픽 세로", w: 800,  h: 2000, desc: "800×2000 px"  },
    { label: "A4 문서",         w: 794,  h: 1123, desc: "794×1123 px"  },
  ]},
  { category: "유튜브", sizes: [
    { label: "썸네일",          w: 1280, h: 720,  desc: "1280×720 px"  },
    { label: "영상 16:9",       w: 1920, h: 1080, desc: "1920×1080 px" },
    { label: "쇼츠 9:16",       w: 1080, h: 1920, desc: "1080×1920 px" },
    { label: "채널아트",        w: 2560, h: 1440, desc: "2560×1440 px" },
  ]},
  { category: "로고·명함", sizes: [
    { label: "로고/프로필",     w: 500,  h: 500,  desc: "500×500 px"   },
    { label: "명함 가로",       w: 355,  h: 204,  desc: "94×54 mm"     },
    { label: "명함 세로",       w: 204,  h: 355,  desc: "54×94 mm"     },
  ]},
];
const ALL_SIZES = SIZE_CATEGORIES.flatMap(c => c.sizes);

// ── 기본 템플릿 ──
const TEMPLATES = [
  { id: "blank",        name: "빈 캔버스",    previewBg: "#f3f4f6", bg: "#ffffff", elements: [] },
  { id: "dark_card",    name: "다크 카드",    previewBg: "#1a1a2e", bg: "#1a1a2e",
    elements: [
      { id:"t1", type:"text", x:60, y:120, w:680, h:80,  content:"제목을 입력하세요",            fontSize:44, color:"#ffffff", fontWeight:"700", fontStyle:"normal", textDecoration:"none", textAlign:"center", fontFamily:"sans-serif", opacity:1 },
      { id:"t2", type:"text", x:80, y:240, w:640, h:100, content:"내용을 입력하세요.\n클릭하여 편집하세요.", fontSize:20, color:"#aaaaaa", fontWeight:"400", fontStyle:"normal", textDecoration:"none", textAlign:"center", fontFamily:"sans-serif", opacity:1 },
    ]},
  { id: "light_card",   name: "라이트 카드",  previewBg: "#fef9f0", bg: "#fef9f0",
    elements: [
      { id:"r1", type:"rect", x:60, y:60,  w:680, h:6,   fill:"#f59e0b", strokeColor:"none", strokeWidth:0, borderRadius:3, opacity:1 },
      { id:"t1", type:"text", x:60, y:95,  w:680, h:70,  content:"제목을 입력하세요",      fontSize:40, color:"#1f2937", fontWeight:"800", fontStyle:"normal", textDecoration:"none", textAlign:"left", fontFamily:"sans-serif", opacity:1 },
      { id:"t2", type:"text", x:60, y:185, w:680, h:100, content:"여기에 내용을 입력하세요.", fontSize:18, color:"#6b7280", fontWeight:"400", fontStyle:"normal", textDecoration:"none", textAlign:"left", fontFamily:"sans-serif", opacity:1 },
    ]},
  { id: "quote",        name: "인용구",       previewBg: "#0f172a", bg: "#0f172a",
    elements: [
      { id:"t0", type:"text", x:60, y:70,  w:100, h:90,  content:"❝",                   fontSize:72, color:"#6366f1", fontWeight:"700", fontStyle:"normal", textDecoration:"none", textAlign:"left", fontFamily:"sans-serif", opacity:1 },
      { id:"t1", type:"text", x:60, y:180, w:680, h:140, content:"여기에 인용구를 입력하세요", fontSize:26, color:"#ffffff", fontWeight:"600", fontStyle:"italic",  textDecoration:"none", textAlign:"left", fontFamily:"sans-serif", opacity:1 },
      { id:"t2", type:"text", x:60, y:340, w:680, h:40,  content:"— 출처",                fontSize:16, color:"#94a3b8", fontWeight:"400", fontStyle:"normal", textDecoration:"none", textAlign:"left", fontFamily:"sans-serif", opacity:1 },
    ]},
  { id: "gradient_card",name: "그라디언트",   previewBg: "linear-gradient(135deg,#667eea,#764ba2)", bg: "#667eea",
    elements: [
      { id:"t1", type:"text", x:60, y:160, w:680, h:100, content:"제목을 입력하세요",   fontSize:48, color:"#ffffff", fontWeight:"800", fontStyle:"normal", textDecoration:"none", textAlign:"center", fontFamily:"sans-serif", opacity:1 },
      { id:"t2", type:"text", x:80, y:290, w:640, h:60,  content:"부제목을 입력하세요", fontSize:22, color:"rgba(255,255,255,0.8)", fontWeight:"400", fontStyle:"normal", textDecoration:"none", textAlign:"center", fontFamily:"sans-serif", opacity:1 },
    ]},
];

// ── 도형 clip-path 맵 ──
const SHAPE_CLIP = {
  triangle:        "polygon(50% 0%, 0% 100%, 100% 100%)",
  "triangle-down": "polygon(0% 0%, 100% 0%, 50% 100%)",
  "triangle-right":"polygon(0% 0%, 100% 50%, 0% 100%)",
  "triangle-left": "polygon(100% 0%, 0% 50%, 100% 100%)",
  diamond:         "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  parallelogram:   "polygon(20% 0%, 100% 0%, 80% 100%, 0% 100%)",
  pentagon:        "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
  hexagon:         "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)",
  octagon:         "polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)",
  "arrow-right":   "polygon(0% 20%, 65% 20%, 65% 0%, 100% 50%, 65% 100%, 65% 80%, 0% 80%)",
  "arrow-left":    "polygon(100% 20%, 35% 20%, 35% 0%, 0% 50%, 35% 100%, 35% 80%, 100% 80%)",
  "arrow-up":      "polygon(50% 0%, 100% 65%, 80% 65%, 80% 100%, 20% 100%, 20% 65%, 0% 65%)",
  "arrow-down":    "polygon(50% 100%, 100% 35%, 80% 35%, 80% 0%, 20% 0%, 20% 35%, 0% 35%)",
  "arrow-both":    "polygon(0% 50%, 20% 0%, 20% 30%, 80% 30%, 80% 0%, 100% 50%, 80% 100%, 80% 70%, 20% 70%, 20% 100%)",
  star:            "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  "star-6":        "polygon(50% 0%, 61% 25%, 93% 25%, 67% 45%, 78% 75%, 50% 58%, 22% 75%, 33% 45%, 7% 25%, 39% 25%)",
  cross:           "polygon(33% 0%, 67% 0%, 67% 33%, 100% 33%, 100% 67%, 67% 67%, 67% 100%, 33% 100%, 33% 67%, 0% 67%, 0% 33%, 33% 33%)",
  lightning:       "polygon(65% 0%, 35% 48%, 58% 48%, 35% 100%, 70% 52%, 47% 52%)",
  "speech-bubble": "polygon(0% 0%, 100% 0%, 100% 75%, 70% 75%, 55% 100%, 40% 75%, 0% 75%)",
};

// ── 도형 카테고리 UI 정의 ──
const SHAPE_CATEGORIES = [
  { label:"기본 도형", items:[
    { key:"rect",          label:"사각형",     fill:"#6366f1", w:200, h:120, borderRadius:0 },
    { key:"rect-round",    label:"둥근 사각형",fill:"#8b5cf6", w:200, h:120, borderRadius:20 },
    { key:"circle",        label:"원",         fill:"#ec4899", w:130, h:130, borderRadius:9999 },
    { key:"ellipse",       label:"타원",       fill:"#f59e0b", w:200, h:120, borderRadius:9999 },
    { key:"triangle",      label:"삼각형",     fill:"#10b981", w:150, h:130, shape:"triangle" },
    { key:"triangle-down", label:"역삼각형",   fill:"#3b82f6", w:150, h:130, shape:"triangle-down" },
    { key:"diamond",       label:"마름모",     fill:"#f97316", w:150, h:150, shape:"diamond" },
    { key:"parallelogram", label:"평행사변형", fill:"#06b6d4", w:200, h:100, shape:"parallelogram" },
  ]},
  { label:"다각형", items:[
    { key:"pentagon",       label:"오각형",fill:"#6366f1", w:140, h:140, shape:"pentagon" },
    { key:"hexagon",        label:"육각형",fill:"#8b5cf6", w:150, h:130, shape:"hexagon" },
    { key:"octagon",        label:"팔각형",fill:"#ec4899", w:140, h:140, shape:"octagon" },
    { key:"triangle-right", label:"직각▶", fill:"#10b981", w:130, h:130, shape:"triangle-right" },
    { key:"triangle-left",  label:"직각◀", fill:"#3b82f6", w:130, h:130, shape:"triangle-left" },
  ]},
  { label:"화살표", items:[
    { key:"arrow-right", label:"→", fill:"#6366f1", w:200, h:100, shape:"arrow-right" },
    { key:"arrow-left",  label:"←", fill:"#8b5cf6", w:200, h:100, shape:"arrow-left" },
    { key:"arrow-up",    label:"↑", fill:"#ec4899", w:100, h:160, shape:"arrow-up" },
    { key:"arrow-down",  label:"↓", fill:"#f59e0b", w:100, h:160, shape:"arrow-down" },
    { key:"arrow-both",  label:"↔", fill:"#10b981", w:200, h:100, shape:"arrow-both" },
  ]},
  { label:"별·장식", items:[
    { key:"star",          label:"별",    fill:"#f59e0b", w:140, h:140, shape:"star" },
    { key:"star-6",        label:"6각별", fill:"#f97316", w:140, h:140, shape:"star-6" },
    { key:"cross",         label:"십자",  fill:"#ef4444", w:130, h:130, shape:"cross" },
    { key:"lightning",     label:"번개",  fill:"#eab308", w:110, h:160, shape:"lightning" },
    { key:"speech-bubble", label:"말풍선",fill:"#6366f1", w:200, h:140, shape:"speech-bubble" },
  ]},
  { label:"선", items:[
    { key:"line-h",      label:"가로선", fill:"#374151", w:300, h:4,   borderRadius:0 },
    { key:"line-v",      label:"세로선", fill:"#374151", w:4,   h:200, borderRadius:0 },
    { key:"line-thick",  label:"굵은선", fill:"#374151", w:300, h:12,  borderRadius:6 },
    { key:"line-dashed", label:"점선",   fill:"#9ca3af", w:300, h:4,   borderRadius:0, dashed:true },
  ]},
];

// ── 요소 기본값 ──
const DEFAULTS = {
  heading:{ type:"text", w:400, h:70,  content:"제목 텍스트", fontSize:40, color:"#1f2937", fontWeight:"700", fontStyle:"normal", textDecoration:"none", textAlign:"left",   fontFamily:"sans-serif", opacity:1 },
  body:   { type:"text", w:400, h:60,  content:"본문 텍스트", fontSize:20, color:"#374151", fontWeight:"400", fontStyle:"normal", textDecoration:"none", textAlign:"left",   fontFamily:"sans-serif", opacity:1 },
  caption:{ type:"text", w:300, h:40,  content:"캡션",        fontSize:13, color:"#9ca3af", fontWeight:"400", fontStyle:"normal", textDecoration:"none", textAlign:"center", fontFamily:"sans-serif", opacity:1 },
};

function shapeItemToDefault(item) {
  return {
    type:"rect", w:item.w, h:item.h, fill:item.fill,
    strokeColor:"none", strokeWidth:0,
    borderRadius: item.borderRadius ?? 0, opacity:1,
    ...(item.shape  ? { shape:item.shape }   : {}),
    ...(item.dashed ? { dashed:item.dashed } : {}),
  };
}

let _uid = 0;
const uid  = () => `el_${++_uid}_${Date.now()}`;
const pgId = () => `pg_${++_uid}_${Date.now()}`;
const newPage = (bg="#ffffff", elements=[], bgImage=null) => ({ id:pgId(), bg, bgImage, elements });

// resize handle 위치 8개
const HANDLES = ["nw","n","ne","e","se","s","sw","w"];

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
export default function EdenCanvas({ onBack }) {
  const [canvasSize, setCanvasSize] = useState(ALL_SIZES[0]);
  const [pages, setPages]           = useState([newPage()]);
  const [pageIdx, setPageIdx]       = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);  // 다중 선택
  const [editingId, setEditingId]   = useState(null);
  const [sideTab, setSideTab]       = useState("template");
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [manualZoom, setManualZoom] = useState(null); // null = auto

  // ── Undo / Redo ──
  const histRef = useRef([]);
  const futRef  = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const saveHistory = useCallback(() => {
    histRef.current = [...histRef.current.slice(-49), JSON.stringify(pages)];
    futRef.current  = [];
    setCanUndo(true); setCanRedo(false);
  }, [pages]);

  const undo = () => {
    if (!histRef.current.length) return;
    const prev = histRef.current.pop();
    futRef.current = [JSON.stringify(pages), ...futRef.current.slice(0,49)];
    const restored = JSON.parse(prev);
    setPages(restored);
    setPageIdx(i => Math.min(i, restored.length-1));
    setSelectedIds([]); setCanUndo(histRef.current.length>0); setCanRedo(true);
  };

  const redo = () => {
    if (!futRef.current.length) return;
    const next = futRef.current.shift();
    histRef.current = [...histRef.current.slice(-49), JSON.stringify(pages)];
    const restored = JSON.parse(next);
    setPages(restored);
    setPageIdx(i => Math.min(i, restored.length-1));
    setSelectedIds([]); setCanRedo(futRef.current.length>0); setCanUndo(true);
  };

  // ── 현재 페이지 편의 접근 ──
  const curPage  = pages[pageIdx] ?? pages[0];
  const elements = curPage.elements;
  const bg       = curPage.bg;
  const bgImage  = curPage.bgImage;

  const patchPage = useCallback((idx, patch) => {
    setPages(prev => prev.map((p,i) => i===idx ? {...p,...patch} : p));
  }, []);

  const setElements = useCallback((updater) => {
    setPages(prev => prev.map((p,i) => {
      if (i !== pageIdx) return p;
      return {...p, elements: typeof updater==="function" ? updater(p.elements) : updater};
    }));
  }, [pageIdx]);

  const setBg    = useCallback((color)  => patchPage(pageIdx, {bg: color}),    [pageIdx, patchPage]);
  const setBgImg = useCallback((src)    => patchPage(pageIdx, {bgImage: src}),  [pageIdx, patchPage]);

  // ── scale 계산 ──
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const dragRef      = useRef(null);   // { ids[], startX, startY, origPositions }
  const resizeRef    = useRef(null);   // { id, handle, startX, startY, origEl }
  const clipboardRef = useRef(null);   // copied element
  const [baseScale, setBaseScale] = useState(0.7);

  const scale = manualZoom !== null ? manualZoom : baseScale;

  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const {clientWidth, clientHeight} = containerRef.current;
      setBaseScale(Math.min((clientWidth-80)/canvasSize.w, (clientHeight-80)/canvasSize.h, 1));
    };
    update();
    const obs = new ResizeObserver(update);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [canvasSize]);

  // ── 페이지 관리 ──
  const addPage = () => {
    saveHistory();
    const pg = newPage();
    setPages(prev => [...prev, pg]);
    setPageIdx(pages.length);
    setSelectedIds([]);
  };
  const duplicatePage = () => {
    saveHistory();
    const clone = {...curPage, id:pgId(), elements:curPage.elements.map(e=>({...e,id:uid()}))};
    setPages(prev => { const n=[...prev]; n.splice(pageIdx+1,0,clone); return n; });
    setPageIdx(pageIdx+1);
    setSelectedIds([]);
  };
  const deletePage = () => {
    if (pages.length<=1) return;
    saveHistory();
    setPages(prev => prev.filter((_,i)=>i!==pageIdx));
    setPageIdx(i => Math.max(0, i-1));
    setSelectedIds([]);
  };

  // ── 템플릿 적용 ──
  const applyTemplate = (tpl) => {
    saveHistory();
    patchPage(pageIdx, {bg:tpl.bg, bgImage:null, elements:tpl.elements.map(e=>({...e,id:uid()}))});
    setSelectedIds([]); setEditingId(null);
  };

  // ── 요소 추가 ──
  const addElement = (defaults) => {
    saveHistory();
    const id = uid();
    const el = {...defaults, id,
      x: Math.round(canvasSize.w/2 - defaults.w/2),
      y: Math.round(canvasSize.h/2 - defaults.h/2),
    };
    setElements(prev => [...prev, el]);
    setSelectedIds([id]);
  };

  // ── 이미지 업로드 ──
  const handleImageUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      saveHistory();
      const id = uid();
      setElements(prev => [...prev, {id, type:"image", x:50, y:50, w:400, h:300, src:ev.target.result, opacity:1, strokeColor:"none", strokeWidth:0}]);
      setSelectedIds([id]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── 배경 이미지 업로드 ──
  const handleBgImageUpload = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { saveHistory(); setBgImg(ev.target.result); };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── 드래그 ──
  const onElMouseDown = (e, id) => {
    if (editingId === id) return;
    e.stopPropagation();

    if (e.shiftKey) {
      // 다중 선택 토글
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i=>i!==id) : [...prev,id]);
      return;
    }

    const ids = selectedIds.includes(id) ? selectedIds : [id];
    if (!selectedIds.includes(id)) setSelectedIds([id]);

    const origPositions = {};
    elements.forEach(el => { if (ids.includes(el.id)) origPositions[el.id] = {x:el.x, y:el.y}; });
    dragRef.current = {ids, startX:e.clientX, startY:e.clientY, origPositions};
  };

  // ── 리사이즈 시작 ──
  const onResizeStart = (e, handle, id) => {
    e.stopPropagation();
    const el = elements.find(el=>el.id===id);
    if (!el) return;
    resizeRef.current = {id, handle, startX:e.clientX, startY:e.clientY, origEl:{...el}};
  };

  const onMouseMove = useCallback((e) => {
    if (resizeRef.current) {
      const {id, handle, startX, startY, origEl} = resizeRef.current;
      const dx = (e.clientX - startX) / scale;
      const dy = (e.clientY - startY) / scale;
      const MIN = 10;
      let {x, y, w, h} = origEl;

      if (handle.includes("e")) w = Math.max(MIN, origEl.w + dx);
      if (handle.includes("s")) h = Math.max(MIN, origEl.h + dy);
      if (handle.includes("w")) { w = Math.max(MIN, origEl.w - dx); x = origEl.x + origEl.w - w; }
      if (handle.includes("n")) { h = Math.max(MIN, origEl.h - dy); y = origEl.y + origEl.h - h; }

      setElements(prev => prev.map(el => el.id===id ? {...el, x:Math.round(x), y:Math.round(y), w:Math.round(w), h:Math.round(h)} : el));
      return;
    }
    if (dragRef.current) {
      const dx = (e.clientX - dragRef.current.startX) / scale;
      const dy = (e.clientY - dragRef.current.startY) / scale;
      setElements(prev => prev.map(el => {
        if (!dragRef.current.ids.includes(el.id)) return el;
        const orig = dragRef.current.origPositions[el.id];
        return {...el, x: orig.x+dx, y: orig.y+dy};
      }));
    }
  }, [scale, setElements]);

  const onMouseUp = useCallback(() => {
    if (dragRef.current || resizeRef.current) saveHistory();
    dragRef.current   = null;
    resizeRef.current = null;
  }, [saveHistory]);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",   onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",   onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // ── 빈 캔버스 클릭 ──
  const onCanvasClick = (e) => {
    if (e.target === canvasRef.current) { setSelectedIds([]); setEditingId(null); }
  };

  // ── 요소 속성 변경 ──
  const updateEl = (id, patch) => {
    setElements(prev => prev.map(el => el.id===id ? {...el,...patch} : el));
  };

  // ── 요소 삭제 ──
  const deleteSelected = useCallback(() => {
    if (!selectedIds.length) return;
    saveHistory();
    setElements(prev => prev.filter(el => !selectedIds.includes(el.id)));
    setSelectedIds([]);
  }, [selectedIds, saveHistory, setElements]);

  // ── 레이어 순서 ──
  const moveLayer = (id, dir) => {
    setElements(prev => {
      const idx = prev.findIndex(el=>el.id===id);
      const arr = [...prev];
      if (dir==="up"   && idx<arr.length-1) [arr[idx],arr[idx+1]]=[arr[idx+1],arr[idx]];
      if (dir==="down" && idx>0)            [arr[idx],arr[idx-1]]=[arr[idx-1],arr[idx]];
      return arr;
    });
  };

  // ── 정렬 ──
  const alignEl = (id, dir) => {
    const el = elements.find(e=>e.id===id); if (!el) return;
    saveHistory();
    let patch = {};
    if (dir==="left")     patch = {x:0};
    if (dir==="right")    patch = {x:canvasSize.w - el.w};
    if (dir==="top")      patch = {y:0};
    if (dir==="bottom")   patch = {y:canvasSize.h - el.h};
    if (dir==="center-h") patch = {x:Math.round((canvasSize.w - el.w)/2)};
    if (dir==="center-v") patch = {y:Math.round((canvasSize.h - el.h)/2)};
    updateEl(id, patch);
  };

  // ── 복사 / 붙여넣기 ──
  const copyEl = useCallback(() => {
    const id = selectedIds[0]; if (!id) return;
    const el = elements.find(e=>e.id===id);
    if (el) clipboardRef.current = el;
  }, [selectedIds, elements]);

  const pasteEl = useCallback(() => {
    const src = clipboardRef.current; if (!src) return;
    saveHistory();
    const id = uid();
    const newEl = {...src, id, x: src.x+20, y: src.y+20};
    setElements(prev => [...prev, newEl]);
    setSelectedIds([id]);
  }, [saveHistory, setElements]);

  // ── 키보드 단축키 ──
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag==="INPUT"||tag==="TEXTAREA"||document.activeElement?.contentEditable==="true") return;
      if ((e.key==="Delete"||e.key==="Backspace") && selectedIds.length && !editingId) deleteSelected();
      if ((e.ctrlKey||e.metaKey) && e.key==="z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey||e.metaKey) && (e.key==="y"||(e.key==="z"&&e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.ctrlKey||e.metaKey) && e.key==="c") { e.preventDefault(); copyEl(); }
      if ((e.ctrlKey||e.metaKey) && e.key==="v") { e.preventDefault(); pasteEl(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, editingId, deleteSelected, copyEl, pasteEl]);

  // ── PNG 다운로드 ──
  const downloadPNG = async () => {
    const offscreen = document.createElement("canvas");
    offscreen.width  = canvasSize.w;
    offscreen.height = canvasSize.h;
    const ctx = offscreen.getContext("2d");

    // 배경
    if (bgImage) {
      await new Promise(resolve => {
        const img = new Image(); img.onload = ()=>{ ctx.drawImage(img,0,0,canvasSize.w,canvasSize.h); resolve(); }; img.onerror=resolve; img.src=bgImage;
      });
    } else {
      ctx.fillStyle = bg.startsWith("linear") ? "#ffffff" : bg;
      ctx.fillRect(0,0,offscreen.width,offscreen.height);
    }

    for (const el of elements) {
      ctx.globalAlpha = el.opacity ?? 1;
      if (el.type==="rect") {
        ctx.fillStyle = el.fill;
        if (el.shape && SHAPE_CLIP[el.shape]) {
          drawShapeOnCanvas(ctx, el.shape, el.x, el.y, el.w, el.h);
          ctx.fill();
        } else if (el.dashed) {
          ctx.fillRect(el.x, el.y, el.w, el.h);
        } else if ((el.borderRadius??0) > 0) {
          rrectPath(ctx, el.x, el.y, el.w, el.h, Math.min(el.borderRadius, el.w/2, el.h/2)); ctx.fill();
        } else {
          ctx.fillRect(el.x, el.y, el.w, el.h);
        }
        // stroke
        if (el.strokeWidth>0 && el.strokeColor && el.strokeColor!=="none") {
          ctx.strokeStyle = el.strokeColor;
          ctx.lineWidth   = el.strokeWidth;
          if ((el.borderRadius??0)>0) { rrectPath(ctx,el.x,el.y,el.w,el.h,Math.min(el.borderRadius,el.w/2,el.h/2)); ctx.stroke(); }
          else ctx.strokeRect(el.x,el.y,el.w,el.h);
        }
      } else if (el.type==="text") {
        ctx.fillStyle    = el.color;
        ctx.font         = `${el.fontStyle||"normal"} ${el.fontWeight} ${el.fontSize}px ${el.fontFamily||"sans-serif"}`;
        ctx.textAlign    = el.textAlign||"left";
        ctx.textBaseline = "top";
        const xPos = el.textAlign==="center" ? el.x+el.w/2 : el.textAlign==="right" ? el.x+el.w : el.x;
        el.content.split("\n").forEach((line,i) => ctx.fillText(line, xPos, el.y+i*el.fontSize*1.4));
      } else if (el.type==="image" && el.src) {
        await new Promise(resolve => {
          const img = new Image(); img.onload=()=>{ ctx.drawImage(img,el.x,el.y,el.w,el.h); resolve(); }; img.onerror=resolve; img.src=el.src;
        });
        if (el.strokeWidth>0 && el.strokeColor && el.strokeColor!=="none") {
          ctx.strokeStyle=el.strokeColor; ctx.lineWidth=el.strokeWidth;
          ctx.strokeRect(el.x,el.y,el.w,el.h);
        }
      }
      ctx.globalAlpha = 1;
    }
    const link = document.createElement("a");
    link.download = `에덴캔버스_${pageIdx+1}페이지.png`;
    link.href     = offscreen.toDataURL("image/png");
    link.click();
  };

  function rrectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r);
    ctx.closePath();
  }
  function drawShapeOnCanvas(ctx, shape, x, y, w, h) {
    const clipStr = SHAPE_CLIP[shape]; if (!clipStr) return;
    const pts = clipStr.replace("polygon(","").replace(")","").split(",").map(p=>{
      const [px,py]=p.trim().split(" ");
      return [x+parseFloat(px)/100*w, y+parseFloat(py)/100*h];
    });
    ctx.beginPath(); ctx.moveTo(pts[0][0],pts[0][1]);
    pts.slice(1).forEach(([px,py])=>ctx.lineTo(px,py)); ctx.closePath();
  }

  // 단일 선택 요소
  const selectedEl = selectedIds.length===1 ? elements.find(e=>e.id===selectedIds[0]) : null;

  return (
    <div className="flex flex-col h-full bg-gray-100 select-none">
      <TopBar
        onBack={onBack}
        canvasSize={canvasSize}
        showSizeMenu={showSizeMenu}
        setShowSizeMenu={setShowSizeMenu}
        onSelectSize={(s)=>{setCanvasSize(s); setShowSizeMenu(false); setManualZoom(null);}}
        onDownload={downloadPNG}
        canUndo={canUndo} onUndo={undo}
        canRedo={canRedo} onRedo={redo}
        pageCount={pages.length} pageIdx={pageIdx}
        onAddPage={addPage} onDuplicatePage={duplicatePage} onDeletePage={deletePage}
        scale={scale} baseScale={baseScale}
        manualZoom={manualZoom} setManualZoom={setManualZoom}
      />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          active={sideTab} setActive={setSideTab}
          onApplyTemplate={applyTemplate}
          onAddElement={addElement}
          onImageUpload={handleImageUpload}
          onBgImageUpload={handleBgImageUpload}
          bg={bg} bgImage={bgImage}
          setBg={(c)=>{saveHistory(); setBg(c);}}
          onRemoveBgImage={()=>{saveHistory(); setBgImg(null);}}
          pages={pages} pageIdx={pageIdx}
          setPageIdx={(i)=>{setPageIdx(i); setSelectedIds([]); setEditingId(null);}}
          canvasSize={canvasSize}
          onAddPage={addPage} onDuplicatePage={duplicatePage} onDeletePage={deletePage}
        />

        {/* 캔버스 영역 */}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-auto bg-[#e5e7eb] p-8"
          onClick={()=>setShowSizeMenu(false)}
        >
          <div style={{transform:`scale(${scale})`, transformOrigin:"center center"}}>
            <div
              ref={canvasRef}
              onClick={onCanvasClick}
              style={{
                width:canvasSize.w, height:canvasSize.h,
                background: bgImage ? `url(${bgImage}) center/cover no-repeat` : bg,
                position:"relative", boxShadow:"0 8px 40px rgba(0,0,0,0.22)",
                overflow:"hidden", cursor:"default", flexShrink:0,
              }}
            >
              {elements.map(el => (
                <CanvasElement
                  key={el.id}
                  el={el}
                  selected={selectedIds.includes(el.id)}
                  isSingleSelected={selectedIds.length===1 && selectedIds[0]===el.id}
                  editing={editingId===el.id}
                  onMouseDown={(e)=>onElMouseDown(e, el.id)}
                  onResizeStart={(e,h)=>onResizeStart(e,h,el.id)}
                  onDoubleClick={()=>el.type==="text"&&setEditingId(el.id)}
                  onBlur={()=>setEditingId(null)}
                  onChange={(content)=>updateEl(el.id,{content})}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 우측 속성 패널 */}
        {(selectedEl || selectedIds.length>1) && (
          <PropertiesPanel
            el={selectedEl}
            multiCount={selectedIds.length}
            onChange={(patch)=>updateEl(selectedIds[0], patch)}
            onDelete={deleteSelected}
            onMoveLayer={(dir)=>moveLayer(selectedIds[0], dir)}
            onAlign={(dir)=>alignEl(selectedIds[0], dir)}
            onCopy={copyEl}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 상단 툴바
// ─────────────────────────────────────────────
function TopBar({ onBack, canvasSize, showSizeMenu, setShowSizeMenu, onSelectSize, onDownload,
  canUndo, onUndo, canRedo, onRedo,
  pageCount, pageIdx, onAddPage, onDuplicatePage, onDeletePage,
  scale, baseScale, manualZoom, setManualZoom }) {

  const zoomPct = Math.round(scale*100);
  const zoomIn  = () => setManualZoom(Math.min(2.0, (manualZoom??baseScale)+0.1));
  const zoomOut = () => setManualZoom(Math.max(0.1, (manualZoom??baseScale)-0.1));
  const zoomFit = () => setManualZoom(null);

  return (
    <div className="flex items-center gap-1.5 px-3 bg-white border-b border-gray-200 flex-shrink-0 z-20" style={{minHeight:52}}>
      {/* 뒤로 */}
      <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all flex-shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>

      {/* 로고 */}
      <div className="flex items-center gap-1.5 mr-1">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
            <path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
          </svg>
        </div>
        <span className="font-bold text-gray-800 text-sm">에덴캔버스</span>
      </div>

      <div className="h-5 w-px bg-gray-200"/>

      {/* Undo / Redo */}
      <button onClick={onUndo} disabled={!canUndo} title="실행 취소 (Ctrl+Z)"
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${canUndo?"text-gray-600 hover:bg-gray-100":"text-gray-300 cursor-not-allowed"}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
      </button>
      <button onClick={onRedo} disabled={!canRedo} title="다시 실행 (Ctrl+Y)"
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${canRedo?"text-gray-600 hover:bg-gray-100":"text-gray-300 cursor-not-allowed"}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>
      </button>

      <div className="h-5 w-px bg-gray-200"/>

      {/* 페이지 관리 */}
      <button onClick={onAddPage} title="새 페이지 추가"
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-all">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <button onClick={onDuplicatePage} title="페이지 복제"
        className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-all">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/></svg>
      </button>
      <button onClick={onDeletePage} disabled={pageCount<=1} title="페이지 삭제"
        className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${pageCount>1?"text-gray-600 hover:bg-red-50 hover:text-red-400":"text-gray-300 cursor-not-allowed"}`}>
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
      <span className="text-xs text-gray-400 font-medium px-1">{pageIdx+1}/{pageCount}</span>

      <div className="h-5 w-px bg-gray-200"/>

      {/* 캔버스 크기 */}
      <div className="relative">
        <button onClick={(e)=>{e.stopPropagation();setShowSizeMenu(!showSizeMenu);}}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all font-medium">
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
          {canvasSize.label}
          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
        {showSizeMenu && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden" style={{maxHeight:"70vh",overflowY:"auto"}}>
            {SIZE_CATEGORIES.map((cat,ci) => (
              <div key={cat.category}>
                {ci>0 && <div className="h-px bg-gray-100 mx-3"/>}
                <div className="px-3 pt-2.5 pb-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{cat.category}</p>
                </div>
                {cat.sizes.map(s => (
                  <button key={s.label} onClick={()=>onSelectSize(s)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors hover:bg-gray-50 ${canvasSize.label===s.label?"bg-violet-50":""}`}>
                    <span className={`text-xs font-medium ${canvasSize.label===s.label?"text-violet-600":"text-gray-700"}`}>{s.label}</span>
                    <span className="text-[10px] text-gray-400">{s.desc}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-5 w-px bg-gray-200"/>

      {/* Zoom 컨트롤 */}
      <div className="flex items-center gap-0.5">
        <button onClick={zoomOut} title="축소"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-all text-sm font-bold">−</button>
        <button onClick={zoomFit} title="화면에 맞추기"
          className="min-w-[46px] h-7 px-1 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-all font-medium tabular-nums">
          {zoomPct}%
        </button>
        <button onClick={zoomIn} title="확대"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 transition-all text-sm font-bold">+</button>
      </div>

      <div className="flex-1"/>

      {/* PNG 저장 */}
      <button onClick={onDownload}
        className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm">
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        PNG 저장
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// 좌측 사이드바
// ─────────────────────────────────────────────
const SIDE_TABS = [
  { key:"pages",    label:"페이지",  icon:<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="8" height="18" rx="1"/><rect x="14" y="3" width="8" height="18" rx="1"/></svg> },
  { key:"template", label:"템플릿",  icon:<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
  { key:"text",     label:"텍스트",  icon:<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> },
  { key:"element",  label:"요소",    icon:<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg> },
  { key:"photo",    label:"사진",    icon:<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
];

function Sidebar({ active, setActive, onApplyTemplate, onAddElement, onImageUpload, onBgImageUpload,
  bg, bgImage, setBg, onRemoveBgImage,
  pages, pageIdx, setPageIdx, canvasSize, onAddPage, onDuplicatePage, onDeletePage }) {
  const fileRef   = useRef(null);
  const bgImgRef  = useRef(null);

  return (
    <div className="flex h-full flex-shrink-0">
      {/* 아이콘 레일 */}
      <div className="w-14 bg-white border-r border-gray-200 flex flex-col items-center pt-3 gap-1">
        {SIDE_TABS.map(t => (
          <button key={t.key} onClick={()=>setActive(t.key)} title={t.label}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all
              ${active===t.key?"bg-violet-100 text-violet-600":"text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}>
            {t.icon}
          </button>
        ))}
      </div>

      {/* 패널 */}
      <div className="w-48 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
        <div className="px-3 py-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {SIDE_TABS.find(t=>t.key===active)?.label}
          </p>
        </div>
        <div className="p-3 space-y-2">

          {/* 페이지 탭 */}
          {active==="pages" && (
            <>
              <div className="flex gap-1.5 mb-3">
                <button onClick={onAddPage}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600 transition-all font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  추가
                </button>
                <button onClick={onDuplicatePage}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600 transition-all font-medium">
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/></svg>
                  복제
                </button>
                <button onClick={onDeletePage} disabled={pages.length<=1}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] bg-gray-50 border rounded-lg transition-all font-medium
                    ${pages.length>1?"text-gray-600 border-gray-200 hover:bg-red-50 hover:border-red-300 hover:text-red-500":"text-gray-300 border-gray-100 cursor-not-allowed"}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  삭제
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {pages.map((page,i) => {
                  const thumbW = 80;
                  const thumbH = Math.round(thumbW*canvasSize.h/canvasSize.w);
                  const s = thumbW/canvasSize.w;
                  return (
                    <button key={page.id} onClick={()=>setPageIdx(i)} className="flex flex-col items-center gap-1 group">
                      <div style={{width:thumbW, height:thumbH, position:"relative", overflow:"hidden", borderRadius:6,
                          outline: i===pageIdx?"2px solid #7c3aed":"1.5px solid #e5e7eb",
                          background: page.bgImage ? `url(${page.bgImage}) center/cover no-repeat` : page.bg, flexShrink:0}}>
                        {page.elements.map(el=><ThumbElement key={el.id} el={el} scale={s}/>)}
                      </div>
                      <span className={`text-[10px] font-medium ${i===pageIdx?"text-violet-600":"text-gray-400"}`}>{i+1}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* 템플릿 탭 */}
          {active==="template" && (
            <>
              <p className="text-[10px] text-gray-400 mb-2">클릭하면 현재 페이지에 적용</p>
              {TEMPLATES.map(tpl => (
                <button key={tpl.id} onClick={()=>onApplyTemplate(tpl)}
                  className="w-full rounded-xl overflow-hidden border-2 border-transparent hover:border-violet-400 transition-all">
                  <div className="w-full h-20 flex items-center justify-center text-xs font-bold text-white/80"
                    style={{background:tpl.previewBg}}>{tpl.name}</div>
                </button>
              ))}

              {/* 배경색 */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 mb-2">배경 색상</p>
                <div className="flex items-center gap-2">
                  <input type="color" value={bg.startsWith("#")?bg:"#ffffff"} onChange={(e)=>setBg(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5"/>
                  <span className="text-xs text-gray-500">{bg}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["#ffffff","#000000","#1a1a2e","#0f172a","#fef9f0","#f0fdf4","#eff6ff","#fdf4ff"].map(c=>(
                    <button key={c} onClick={()=>setBg(c)}
                      style={{background:c, border:bg===c?"2px solid #7c3aed":"1.5px solid #e5e7eb"}}
                      className="w-6 h-6 rounded-md transition-all hover:scale-110"/>
                  ))}
                </div>
              </div>

              {/* 배경 이미지 */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 mb-2">배경 이미지</p>
                {bgImage ? (
                  <div className="space-y-2">
                    <div className="w-full h-20 rounded-lg overflow-hidden border border-gray-200">
                      <img src={bgImage} alt="bg" className="w-full h-full object-cover"/>
                    </div>
                    <button onClick={onRemoveBgImage}
                      className="w-full py-1.5 text-[10px] text-red-400 border border-red-200 rounded-lg hover:bg-red-50 transition-all">
                      이미지 제거
                    </button>
                  </div>
                ) : (
                  <button onClick={()=>bgImgRef.current?.click()}
                    className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl border-2 border-dashed border-gray-300 hover:border-violet-400 hover:bg-violet-50 transition-all text-gray-400 hover:text-violet-500 text-xs">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    배경 이미지 업로드
                  </button>
                )}
                <input ref={bgImgRef} type="file" accept="image/*" className="hidden" onChange={onBgImageUpload}/>
              </div>
            </>
          )}

          {/* 텍스트 탭 */}
          {active==="text" && (
            <>
              <button onClick={()=>onAddElement(DEFAULTS.heading)}
                className="w-full text-left px-3 py-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all">
                <p className="font-bold text-gray-800 text-base">제목 추가</p>
                <p className="text-[10px] text-gray-400 mt-0.5">40px · Bold</p>
              </button>
              <button onClick={()=>onAddElement(DEFAULTS.body)}
                className="w-full text-left px-3 py-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all">
                <p className="text-gray-700 text-sm">본문 추가</p>
                <p className="text-[10px] text-gray-400 mt-0.5">20px · Regular</p>
              </button>
              <button onClick={()=>onAddElement(DEFAULTS.caption)}
                className="w-full text-left px-3 py-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all">
                <p className="text-gray-400 text-xs">캡션 추가</p>
                <p className="text-[10px] text-gray-400 mt-0.5">13px · Regular</p>
              </button>
            </>
          )}

          {/* 요소 탭 */}
          {active==="element" && (
            <div className="space-y-4">
              {SHAPE_CATEGORIES.map(cat=>(
                <div key={cat.label}>
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2">{cat.label}</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {cat.items.map(item=>(
                      <ShapeButton key={item.key} item={item} onAdd={()=>onAddElement(shapeItemToDefault(item))}/>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 사진 탭 */}
          {active==="photo" && (
            <>
              <p className="text-[10px] text-gray-400 mb-2">로컬 파일에서 불러오기</p>
              <button onClick={()=>fileRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-violet-400 hover:bg-violet-50 transition-all text-gray-400 hover:text-violet-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span className="text-xs font-medium">이미지 업로드</span>
                <span className="text-[10px]">JPG, PNG, GIF, WEBP</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImageUpload}/>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 도형 선택 버튼 ──
function ShapeButton({ item, onAdd }) {
  const isLine   = item.h<=12;
  const hasShape = item.shape && SHAPE_CLIP[item.shape];
  const isCircle = item.borderRadius===9999;
  const previewW = isLine ? 40 : 28;
  const previewH = isLine ? (item.h>=12?8:item.h<=4?3:item.h) : (item.h>=item.w?28:Math.round(28*item.h/item.w));
  const previewStyle = {
    width:previewW, height:previewH,
    background: item.dashed ? `repeating-linear-gradient(90deg,${item.fill} 0 5px,transparent 5px 8px)` : item.fill,
    borderRadius: isCircle?9999:hasShape?0:(item.borderRadius?Math.min(item.borderRadius*0.2,4):0),
    ...(hasShape?{clipPath:SHAPE_CLIP[item.shape]}:{}),
    flexShrink:0,
  };
  return (
    <button onClick={onAdd}
      className="h-16 rounded-xl border border-gray-200 hover:border-violet-300 flex flex-col items-center justify-center gap-1.5 transition-all hover:bg-violet-50 px-1">
      <div style={previewStyle}/>
      <span className="text-[9px] text-gray-500 leading-tight text-center">{item.label}</span>
    </button>
  );
}

// ── 썸네일 경량 렌더러 ──
function ThumbElement({ el, scale }) {
  const s = { position:"absolute", left:el.x*scale, top:el.y*scale, width:el.w*scale, height:el.h*scale, opacity:el.opacity??1, pointerEvents:"none" };
  if (el.type==="rect") {
    const tShape  = el.shape && SHAPE_CLIP[el.shape] ? {clipPath:SHAPE_CLIP[el.shape],borderRadius:0} : {borderRadius:el.borderRadius*scale};
    const tDashed = el.dashed ? {background:`repeating-linear-gradient(90deg,${el.fill} 0 6px,transparent 6px 10px)`} : {background:el.fill};
    const tStroke = (el.strokeWidth>0&&el.strokeColor&&el.strokeColor!=="none") ? {outline:`${el.strokeWidth*scale}px solid ${el.strokeColor}`,outlineOffset:`${-el.strokeWidth*scale}px`} : {};
    return <div style={{...s,...tDashed,...tShape,...tStroke}}/>;
  }
  if (el.type==="image") return <img src={el.src} alt="" draggable={false} style={{...s,objectFit:"cover"}}/>;
  if (el.type==="text")  return (
    <div style={{...s, fontSize:el.fontSize*scale, color:el.color, fontWeight:el.fontWeight,
      fontStyle:el.fontStyle||"normal", textDecoration:el.textDecoration||"none",
      textAlign:el.textAlign, fontFamily:el.fontFamily, lineHeight:1.4, whiteSpace:"pre-wrap",
      wordBreak:"break-word", overflow:"hidden"}}>{el.content}</div>
  );
  return null;
}

// ─────────────────────────────────────────────
// 캔버스 요소 + 리사이즈 핸들
// ─────────────────────────────────────────────
function CanvasElement({ el, selected, isSingleSelected, editing, onMouseDown, onResizeStart, onDoubleClick, onBlur, onChange }) {
  const textRef = useRef(null);
  useEffect(()=>{
    if (editing && textRef.current) {
      textRef.current.focus();
      const range = document.createRange(); range.selectNodeContents(textRef.current); range.collapse(false);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
    }
  },[editing]);

  // 래퍼 div가 위치·선택 아웃라인 담당
  const wrapperStyle = {
    position:"absolute", left:el.x, top:el.y, width:el.w, height:el.h,
    opacity:el.opacity??1,
    outline: selected?"2px solid #7c3aed":"none", outlineOffset:"1px",
  };

  // 내부 요소는 100%×100%, position 없음
  const innerBase = {
    width:"100%", height:"100%",
    cursor: editing?"text":"move",
    boxSizing:"border-box",
    userSelect: editing?"text":"none",
  };

  let inner = null;
  if (el.type==="rect") {
    const shapeStyle  = el.shape && SHAPE_CLIP[el.shape] ? {clipPath:SHAPE_CLIP[el.shape],borderRadius:0} : {borderRadius:el.borderRadius};
    const dashedStyle = el.dashed ? {background:`repeating-linear-gradient(90deg,${el.fill} 0 12px,transparent 12px 20px)`,borderRadius:0} : {background:el.fill};
    const strokeStyle = (el.strokeWidth>0&&el.strokeColor&&el.strokeColor!=="none") ? {boxShadow:`inset 0 0 0 ${el.strokeWidth}px ${el.strokeColor}`} : {};
    inner = <div style={{...innerBase,...dashedStyle,...shapeStyle,...strokeStyle}} onMouseDown={onMouseDown}/>;
  } else if (el.type==="image") {
    const strokeStyle = (el.strokeWidth>0&&el.strokeColor&&el.strokeColor!=="none") ? {boxShadow:`inset 0 0 0 ${el.strokeWidth}px ${el.strokeColor}`} : {};
    inner = <img src={el.src} alt="" draggable={false} style={{...innerBase,objectFit:"cover",display:"block",...strokeStyle}} onMouseDown={onMouseDown}/>;
  } else if (el.type==="text") {
    inner = (
      <div ref={textRef} contentEditable={editing} suppressContentEditableWarning
        onMouseDown={onMouseDown} onDoubleClick={onDoubleClick}
        onBlur={(e)=>{onChange(e.currentTarget.innerText); onBlur();}}
        style={{...innerBase, fontSize:el.fontSize, color:el.color, fontWeight:el.fontWeight,
          fontStyle:el.fontStyle||"normal", textDecoration:el.textDecoration||"none",
          textAlign:el.textAlign, fontFamily:el.fontFamily||"sans-serif", lineHeight:1.4,
          whiteSpace:"pre-wrap", wordBreak:"break-word", overflow:"hidden",
          display:"flex", alignItems:"flex-start", padding:2}}>
        {el.content}
      </div>
    );
  }

  if (!inner) return null;

  return (
    <div style={wrapperStyle}>
      {inner}
      {isSingleSelected && !editing && HANDLES.map(h=>(
        <ResizeHandle key={h} handle={h} onMouseDown={(e)=>onResizeStart(e,h)}/>
      ))}
    </div>
  );
}

// ── 리사이즈 핸들 점 ──
function ResizeHandle({ handle, onMouseDown }) {
  const isN = handle.includes("n"), isS = handle.includes("s");
  const isW = handle.includes("w"), isE = handle.includes("e");
  const isPureN = handle==="n", isPureS=handle==="s", isPureW=handle==="w", isPureE=handle==="e";

  const cursorMap = {nw:"nw-resize",n:"n-resize",ne:"ne-resize",e:"e-resize",se:"se-resize",s:"s-resize",sw:"sw-resize",w:"w-resize"};

  const style = {
    position:"absolute",
    width:8, height:8,
    background:"#7c3aed",
    border:"1.5px solid white",
    borderRadius:2,
    cursor:cursorMap[handle],
    pointerEvents:"auto",
    zIndex:10,
    // 위치
    ...(isN&&!isPureN ? {top:-4} : isS&&!isPureS ? {bottom:-4} : isPureN||isPureS ? {top:"50%",transform:"translateY(-50%)"} : {}),
    ...(isS&&isPureS ? {top:"auto",bottom:-4,transform:"none"} : {}),
    ...(isW&&!isPureW ? {left:-4} : isE&&!isPureE ? {right:-4} : isPureW||isPureE ? {left:"50%",transform:"translateX(-50%)"} : {}),
    ...(isPureN ? {top:-4,transform:"translateX(-50%)",left:"50%"} : {}),
    ...(isPureS ? {bottom:-4,transform:"translateX(-50%)",left:"50%"} : {}),
    ...(isPureW ? {left:-4,transform:"translateY(-50%)",top:"50%"} : {}),
    ...(isPureE ? {right:-4,transform:"translateY(-50%)",top:"50%"} : {}),
    ...(handle==="nw" ? {top:-4,left:-4,transform:"none"} : {}),
    ...(handle==="ne" ? {top:-4,right:-4,left:"auto",transform:"none"} : {}),
    ...(handle==="sw" ? {bottom:-4,left:-4,top:"auto",transform:"none"} : {}),
    ...(handle==="se" ? {bottom:-4,right:-4,top:"auto",left:"auto",transform:"none"} : {}),
  };

  return <div style={style} onMouseDown={(e)=>{e.stopPropagation();onMouseDown(e);}}/>;
}

// ─────────────────────────────────────────────
// 우측 속성 패널
// ─────────────────────────────────────────────
function PropertiesPanel({ el, multiCount, onChange, onDelete, onMoveLayer, onAlign, onCopy }) {
  if (!el) {
    // 다중 선택 상태
    return (
      <div className="w-52 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{multiCount}개 선택됨</p>
          <button onClick={onDelete} className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors rounded">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
        <div className="p-4">
          <p className="text-[10px] text-gray-400 text-center">Shift+클릭으로 추가 선택<br/>Delete로 삭제</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-52 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">속성</p>
        <div className="flex items-center gap-1">
          {/* 복사 */}
          <button onClick={onCopy} title="복사 (Ctrl+C)" className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-500 transition-colors rounded">
            <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M4 16H3a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v1"/></svg>
          </button>
          {/* 삭제 */}
          <button onClick={onDelete} title="삭제 (Delete)" className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors rounded">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
      <div className="p-4 space-y-4">

        {/* 위치/크기 */}
        <Section label="위치 / 크기">
          <div className="grid grid-cols-2 gap-2">
            {[["X","x"],["Y","y"],["W","w"],["H","h"]].map(([label,key])=>(
              <label key={key} className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400">{label}</span>
                <input type="number" value={Math.round(el[key])} onChange={(e)=>onChange({[key]:Number(e.target.value)})}
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:border-violet-400 focus:outline-none"/>
              </label>
            ))}
          </div>
        </Section>

        {/* 정렬 */}
        <Section label="정렬">
          <div className="grid grid-cols-3 gap-1">
            {[
              ["left",    "↤", "왼쪽"],
              ["center-h","↔", "가운데"],
              ["right",   "↦", "오른쪽"],
              ["top",     "↥", "위"],
              ["center-v","↕", "중간"],
              ["bottom",  "↧", "아래"],
            ].map(([dir,icon,tip])=>(
              <button key={dir} onClick={()=>onAlign(dir)} title={tip}
                className="py-1.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600 transition-all">
                {icon}
              </button>
            ))}
          </div>
        </Section>

        {/* 불투명도 */}
        <Section label="불투명도">
          <div className="flex items-center gap-2">
            <input type="range" min={0} max={1} step={0.01} value={el.opacity??1}
              onChange={(e)=>onChange({opacity:Number(e.target.value)})}
              className="flex-1 accent-violet-600"/>
            <span className="text-xs text-gray-500 w-8 text-right">{Math.round((el.opacity??1)*100)}%</span>
          </div>
        </Section>

        {/* 텍스트 속성 */}
        {el.type==="text" && <>
          <Section label="폰트 크기">
            <div className="flex items-center gap-2">
              <input type="number" min={6} max={300} value={el.fontSize} onChange={(e)=>onChange({fontSize:Number(e.target.value)})}
                className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:border-violet-400 focus:outline-none"/>
              <span className="text-[10px] text-gray-400">px</span>
            </div>
          </Section>
          <Section label="스타일">
            <div className="flex gap-1">
              {/* 굵기 */}
              <button onClick={()=>onChange({fontWeight:el.fontWeight==="700"?"400":"700"})}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm font-bold transition-all ${el.fontWeight==="700"||el.fontWeight==="800"?"bg-violet-100 border-violet-400 text-violet-600":"border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                B
              </button>
              {/* 이탤릭 */}
              <button onClick={()=>onChange({fontStyle:el.fontStyle==="italic"?"normal":"italic"})}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm italic font-medium transition-all ${el.fontStyle==="italic"?"bg-violet-100 border-violet-400 text-violet-600":"border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                I
              </button>
              {/* 밑줄 */}
              <button onClick={()=>onChange({textDecoration:el.textDecoration==="underline"?"none":"underline"})}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm underline font-medium transition-all ${el.textDecoration==="underline"?"bg-violet-100 border-violet-400 text-violet-600":"border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                U
              </button>
              {/* 취소선 */}
              <button onClick={()=>onChange({textDecoration:el.textDecoration==="line-through"?"none":"line-through"})}
                className={`w-8 h-8 flex items-center justify-center rounded-lg border text-sm line-through font-medium transition-all ${el.textDecoration==="line-through"?"bg-violet-100 border-violet-400 text-violet-600":"border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                S
              </button>
            </div>
          </Section>
          <Section label="텍스트 정렬">
            <div className="flex gap-1">
              {[
                ["left",  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/></svg>],
                ["center",<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="12" x2="7" y2="12"/><line x1="19" y1="18" x2="5" y2="18"/></svg>],
                ["right", <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="7" y2="18"/></svg>],
              ].map(([val,icon])=>(
                <button key={val} onClick={()=>onChange({textAlign:val})}
                  className={`flex-1 py-1.5 flex items-center justify-center rounded-lg border transition-all ${el.textAlign===val?"bg-violet-100 border-violet-400 text-violet-600":"border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                  {icon}
                </button>
              ))}
            </div>
          </Section>
          <Section label="글자 색상">
            <div className="flex items-center gap-2">
              <input type="color" value={el.color} onChange={(e)=>onChange({color:e.target.value})}
                className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5"/>
              <span className="text-xs text-gray-500">{el.color}</span>
            </div>
          </Section>
        </>}

        {/* 도형 속성 */}
        {el.type==="rect" && <>
          <Section label="채우기 색상">
            <div className="flex items-center gap-2">
              <input type="color" value={el.fill?.startsWith("#")?el.fill:"#6366f1"} onChange={(e)=>onChange({fill:e.target.value})}
                className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5"/>
              <span className="text-xs text-gray-500 truncate">{el.fill}</span>
            </div>
          </Section>
          {!el.shape && (
            <Section label="모서리 둥글기">
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={100} value={el.borderRadius===9999?100:el.borderRadius}
                  onChange={(e)=>onChange({borderRadius:Number(e.target.value)})}
                  className="flex-1 accent-violet-600"/>
                <span className="text-xs text-gray-500 w-6 text-right">{el.borderRadius===9999?"●":el.borderRadius}</span>
              </div>
            </Section>
          )}
          {el.shape && (
            <Section label="도형">
              <div className="px-2 py-1.5 bg-gray-50 rounded-lg text-xs text-gray-500 text-center">{el.shape}</div>
            </Section>
          )}
        </>}

        {/* 이미지 속성 */}
        {el.type==="image" && (
          <Section label="이미지">
            <div className="w-full h-16 rounded-lg overflow-hidden border border-gray-200">
              <img src={el.src} alt="" className="w-full h-full object-cover"/>
            </div>
          </Section>
        )}

        {/* 테두리 (도형·이미지 공통) */}
        {(el.type==="rect"||el.type==="image") && (
          <Section label="테두리">
            <div className="flex items-center gap-2 mb-2">
              <input type="color" value={el.strokeColor&&el.strokeColor!=="none"?el.strokeColor:"#000000"}
                onChange={(e)=>onChange({strokeColor:e.target.value, strokeWidth:el.strokeWidth>0?el.strokeWidth:2})}
                className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5"/>
              <span className="text-xs text-gray-500 flex-1">{el.strokeColor==="none"?"없음":el.strokeColor}</span>
              {el.strokeColor&&el.strokeColor!=="none" && (
                <button onClick={()=>onChange({strokeColor:"none",strokeWidth:0})}
                  className="text-[10px] text-gray-400 hover:text-red-400 transition-colors">제거</button>
              )}
            </div>
            {el.strokeColor&&el.strokeColor!=="none" && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-10">두께</span>
                <input type="range" min={1} max={20} value={el.strokeWidth??2}
                  onChange={(e)=>onChange({strokeWidth:Number(e.target.value)})}
                  className="flex-1 accent-violet-600"/>
                <span className="text-xs text-gray-500 w-5 text-right">{el.strokeWidth??2}</span>
              </div>
            )}
          </Section>
        )}

        {/* 레이어 */}
        <Section label="레이어">
          <div className="flex gap-2">
            {[["up","앞으로","m18 15-6-6-6 6"],["down","뒤로","m6 9 6 6 6-6"]].map(([dir,label,path])=>(
              <button key={dir} onClick={()=>onMoveLayer(dir)}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d={path}/></svg>
                {label}
              </button>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1.5">{label}</p>
      {children}
    </div>
  );
}
