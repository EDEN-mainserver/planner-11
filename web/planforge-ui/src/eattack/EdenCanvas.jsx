// ── 에덴캔버스 — 내부 디자인 에디터 ──
// 미리캔버스 기능명세서 기반: 캔버스 편집, 템플릿, 텍스트/요소/이미지 추가, PNG 다운로드
import { useState, useRef, useEffect, useCallback } from "react";

// ── 캔버스 사이즈 카테고리 ──
const SIZE_CATEGORIES = [
  {
    category: "소셜미디어",
    sizes: [
      { label: "카드뉴스 1:1",   w: 1080, h: 1080, desc: "1080×1080 px" },
      { label: "SNS 세로 4:5",   w: 1080, h: 1350, desc: "1080×1350 px" },
      { label: "웹 포스터 세로", w: 891,  h: 1260, desc: "891×1260 px"  },
      { label: "상세페이지",     w: 860,  h: 1100, desc: "860×1100 px"  },
      { label: "스토리 9:16",    w: 1080, h: 1920, desc: "1080×1920 px" },
    ],
  },
  {
    category: "문서",
    sizes: [
      { label: "프레젠테이션",   w: 1920, h: 1080, desc: "1920×1080 px" },
      { label: "인포그래픽 가로",w: 1920, h: 1080, desc: "1920×1080 px" },
      { label: "인포그래픽 세로",w: 800,  h: 2000, desc: "800×2000 px"  },
      { label: "A4 문서",        w: 794,  h: 1123, desc: "794×1123 px"  },
    ],
  },
  {
    category: "유튜브",
    sizes: [
      { label: "썸네일",         w: 1280, h: 720,  desc: "1280×720 px"  },
      { label: "영상 16:9",      w: 1920, h: 1080, desc: "1920×1080 px" },
      { label: "쇼츠 9:16",      w: 1080, h: 1920, desc: "1080×1920 px" },
      { label: "채널아트",       w: 2560, h: 1440, desc: "2560×1440 px" },
    ],
  },
  {
    category: "로고·명함",
    sizes: [
      { label: "로고/프로필",    w: 500,  h: 500,  desc: "500×500 px"   },
      { label: "명함 가로",      w: 355,  h: 204,  desc: "94×54 mm"     },
      { label: "명함 세로",      w: 204,  h: 355,  desc: "54×94 mm"     },
    ],
  },
];

// 평탄화 (기본값 참조용)
const ALL_SIZES = SIZE_CATEGORIES.flatMap(c => c.sizes);

// ── 기본 템플릿 ──
const TEMPLATES = [
  {
    id: "blank", name: "빈 캔버스", previewBg: "#f3f4f6",
    bg: "#ffffff", elements: [],
  },
  {
    id: "dark_card", name: "다크 카드", previewBg: "#1a1a2e",
    bg: "#1a1a2e",
    elements: [
      { id: "tpl_t1", type: "text", x: 60, y: 120, w: 680, h: 80,  content: "제목을 입력하세요",   fontSize: 44, color: "#ffffff", fontWeight: "700", textAlign: "center", fontFamily: "sans-serif", opacity: 1 },
      { id: "tpl_t2", type: "text", x: 80, y: 240, w: 640, h: 100, content: "내용을 입력하세요.\n클릭하여 편집하세요.", fontSize: 20, color: "#aaaaaa", fontWeight: "400", textAlign: "center", fontFamily: "sans-serif", opacity: 1 },
    ],
  },
  {
    id: "light_card", name: "라이트 카드", previewBg: "#fef9f0",
    bg: "#fef9f0",
    elements: [
      { id: "tpl_r1", type: "rect", x: 60, y: 60, w: 680, h: 6, fill: "#f59e0b", stroke: "none", strokeWidth: 0, borderRadius: 3, opacity: 1 },
      { id: "tpl_t1", type: "text", x: 60, y: 95,  w: 680, h: 70,  content: "제목을 입력하세요",  fontSize: 40, color: "#1f2937", fontWeight: "800", textAlign: "left", fontFamily: "sans-serif", opacity: 1 },
      { id: "tpl_t2", type: "text", x: 60, y: 185, w: 680, h: 100, content: "여기에 내용을 입력하세요.", fontSize: 18, color: "#6b7280", fontWeight: "400", textAlign: "left", fontFamily: "sans-serif", opacity: 1 },
    ],
  },
  {
    id: "quote", name: "인용구", previewBg: "#0f172a",
    bg: "#0f172a",
    elements: [
      { id: "tpl_t0", type: "text", x: 60, y: 70,  w: 100, h: 90,  content: "❝",              fontSize: 72, color: "#6366f1", fontWeight: "700", textAlign: "left", fontFamily: "sans-serif", opacity: 1 },
      { id: "tpl_t1", type: "text", x: 60, y: 180, w: 680, h: 140, content: "여기에 인용구를 입력하세요", fontSize: 26, color: "#ffffff", fontWeight: "600", textAlign: "left", fontFamily: "sans-serif", opacity: 1 },
      { id: "tpl_t2", type: "text", x: 60, y: 340, w: 680, h: 40,  content: "— 출처",          fontSize: 16, color: "#94a3b8", fontWeight: "400", textAlign: "left", fontFamily: "sans-serif", opacity: 1 },
    ],
  },
  {
    id: "gradient_card", name: "그라디언트", previewBg: "linear-gradient(135deg,#667eea,#764ba2)",
    bg: "#667eea",
    elements: [
      { id: "tpl_t1", type: "text", x: 60, y: 160, w: 680, h: 100, content: "제목을 입력하세요",   fontSize: 48, color: "#ffffff", fontWeight: "800", textAlign: "center", fontFamily: "sans-serif", opacity: 1 },
      { id: "tpl_t2", type: "text", x: 80, y: 290, w: 640, h: 60,  content: "부제목을 입력하세요", fontSize: 22, color: "rgba(255,255,255,0.8)", fontWeight: "400", textAlign: "center", fontFamily: "sans-serif", opacity: 1 },
    ],
  },
];

// 요소 기본값
const DEFAULTS = {
  heading:  { type: "text", w: 400, h: 70,  content: "제목 텍스트",   fontSize: 40, color: "#1f2937", fontWeight: "700", textAlign: "left",   fontFamily: "sans-serif", opacity: 1 },
  body:     { type: "text", w: 400, h: 60,  content: "본문 텍스트",   fontSize: 20, color: "#374151", fontWeight: "400", textAlign: "left",   fontFamily: "sans-serif", opacity: 1 },
  caption:  { type: "text", w: 300, h: 40,  content: "캡션",          fontSize: 13, color: "#9ca3af", fontWeight: "400", textAlign: "center", fontFamily: "sans-serif", opacity: 1 },
  rect:     { type: "rect", w: 200, h: 120, fill: "#6366f1", stroke: "none", strokeWidth: 0, borderRadius: 8,    opacity: 1 },
  circle:   { type: "rect", w: 120, h: 120, fill: "#ec4899", stroke: "none", strokeWidth: 0, borderRadius: 9999, opacity: 1 },
  line:     { type: "rect", w: 300, h: 4,   fill: "#374151", stroke: "none", strokeWidth: 0, borderRadius: 0,    opacity: 1 },
};

let _uid = 0;
const uid = () => `el_${++_uid}_${Date.now()}`;

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────
export default function EdenCanvas({ onBack }) {
  const [canvasSize, setCanvasSize] = useState(ALL_SIZES[0]);
  const [bg, setBg]                 = useState("#ffffff");
  const [elements, setElements]     = useState([]);
  const [selected, setSelected]     = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [sideTab, setSideTab]       = useState("template");
  const [showSizeMenu, setShowSizeMenu] = useState(false);

  const canvasRef   = useRef(null);
  const containerRef = useRef(null);
  const dragRef     = useRef(null); // { id, startX, startY, origX, origY }
  const [scale, setScale] = useState(0.7);

  // ── 컨테이너 크기에 맞게 scale 계산 ──
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const { clientWidth, clientHeight } = containerRef.current;
      const sx = (clientWidth  - 80) / canvasSize.w;
      const sy = (clientHeight - 80) / canvasSize.h;
      setScale(Math.min(sx, sy, 1));
    };
    update();
    const obs = new ResizeObserver(update);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [canvasSize]);

  // ── 템플릿 적용 ──
  const applyTemplate = (tpl) => {
    setBg(tpl.bg);
    setElements(tpl.elements.map(e => ({ ...e, id: uid() })));
    setSelected(null);
    setEditingId(null);
  };

  // ── 요소 추가 ──
  const addElement = (defaults) => {
    const id = uid();
    const el = {
      ...defaults, id,
      x: Math.round(canvasSize.w / 2 - defaults.w / 2),
      y: Math.round(canvasSize.h / 2 - defaults.h / 2),
    };
    setElements(prev => [...prev, el]);
    setSelected(id);
  };

  // ── 이미지 업로드 ──
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const id = uid();
      setElements(prev => [...prev, {
        id, type: "image",
        x: 50, y: 50, w: 400, h: 300,
        src: ev.target.result, opacity: 1,
      }]);
      setSelected(id);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── 드래그 시작 ──
  const onElMouseDown = (e, id) => {
    if (editingId === id) return;
    e.stopPropagation();
    setSelected(id);
    const el = elements.find(el => el.id === id);
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: el.x, origY: el.y };
  };

  // ── 드래그 이동 (전역) ──
  const onMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / scale;
    const dy = (e.clientY - dragRef.current.startY) / scale;
    setElements(prev => prev.map(el =>
      el.id === dragRef.current.id
        ? { ...el, x: dragRef.current.origX + dx, y: dragRef.current.origY + dy }
        : el
    ));
  }, [scale]);

  const onMouseUp = useCallback(() => { dragRef.current = null; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup",  onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup",  onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // ── 캔버스 빈 공간 클릭 → 선택 해제 ──
  const onCanvasClick = (e) => {
    if (e.target === canvasRef.current) {
      setSelected(null);
      setEditingId(null);
    }
  };

  // ── 요소 속성 변경 ──
  const updateEl = (id, patch) =>
    setElements(prev => prev.map(el => el.id === id ? { ...el, ...patch } : el));

  // ── 선택된 요소 삭제 ──
  const deleteSelected = useCallback(() => {
    if (!selected) return;
    setElements(prev => prev.filter(el => el.id !== selected));
    setSelected(null);
  }, [selected]);

  // ── 레이어 순서 변경 ──
  const moveLayer = (id, dir) => {
    setElements(prev => {
      const idx = prev.findIndex(el => el.id === id);
      const arr = [...prev];
      if (dir === "up"   && idx < arr.length - 1) [arr[idx], arr[idx+1]] = [arr[idx+1], arr[idx]];
      if (dir === "down" && idx > 0)               [arr[idx], arr[idx-1]] = [arr[idx-1], arr[idx]];
      return arr;
    });
  };

  // ── 키보드 Delete ──
  useEffect(() => {
    const handler = (e) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selected && !editingId) {
        deleteSelected();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, editingId, deleteSelected]);

  // ── PNG 다운로드 ──
  const downloadPNG = async () => {
    const offscreen = document.createElement("canvas");
    offscreen.width  = canvasSize.w;
    offscreen.height = canvasSize.h;
    const ctx = offscreen.getContext("2d");

    // 배경
    ctx.fillStyle = bg.startsWith("linear") ? "#ffffff" : bg;
    ctx.fillRect(0, 0, offscreen.width, offscreen.height);

    for (const el of elements) {
      ctx.globalAlpha = el.opacity ?? 1;
      if (el.type === "rect") {
        ctx.fillStyle = el.fill;
        if (el.borderRadius > 0) {
          rrectPath(ctx, el.x, el.y, el.w, el.h, Math.min(el.borderRadius, el.w/2, el.h/2));
          ctx.fill();
        } else {
          ctx.fillRect(el.x, el.y, el.w, el.h);
        }
      } else if (el.type === "text") {
        ctx.fillStyle   = el.color;
        ctx.font        = `${el.fontWeight} ${el.fontSize}px ${el.fontFamily || "sans-serif"}`;
        ctx.textAlign   = el.textAlign || "left";
        ctx.textBaseline = "top";
        const xPos = el.textAlign === "center" ? el.x + el.w / 2
                   : el.textAlign === "right"  ? el.x + el.w
                   : el.x;
        const lines  = el.content.split("\n");
        const lineH  = el.fontSize * 1.4;
        lines.forEach((line, i) => ctx.fillText(line, xPos, el.y + i * lineH));
      } else if (el.type === "image" && el.src) {
        await new Promise(resolve => {
          const img = new Image();
          img.onload  = () => { ctx.drawImage(img, el.x, el.y, el.w, el.h); resolve(); };
          img.onerror = resolve;
          img.src     = el.src;
        });
      }
      ctx.globalAlpha = 1;
    }

    const link      = document.createElement("a");
    link.download   = "에덴캔버스.png";
    link.href       = offscreen.toDataURL("image/png");
    link.click();
  };

  // helper: 둥근 사각형 path
  function rrectPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y); ctx.arcTo(x+w, y,   x+w, y+r,   r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x,   y+h, x,   y+h-r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x,   y,   x+r, y,   r);
    ctx.closePath();
  }

  const selectedEl = elements.find(e => e.id === selected);

  return (
    <div className="flex flex-col h-full bg-gray-100 select-none">
      {/* ── 상단 툴바 ── */}
      <TopBar
        onBack={onBack}
        canvasSize={canvasSize}
        showSizeMenu={showSizeMenu}
        setShowSizeMenu={setShowSizeMenu}
        onSelectSize={(s) => { setCanvasSize(s); setShowSizeMenu(false); }}
        onDownload={downloadPNG}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── 좌측 사이드바 ── */}
        <Sidebar
          active={sideTab}
          setActive={setSideTab}
          onApplyTemplate={applyTemplate}
          onAddElement={addElement}
          onImageUpload={handleImageUpload}
          bg={bg}
          setBg={setBg}
        />

        {/* ── 캔버스 영역 ── */}
        <div
          ref={containerRef}
          className="flex-1 flex items-center justify-center overflow-auto bg-[#e5e7eb] p-8"
          onClick={() => setShowSizeMenu(false)}
        >
          <div style={{ transform: `scale(${scale})`, transformOrigin: "center center" }}>
            <div
              ref={canvasRef}
              onClick={onCanvasClick}
              style={{
                width:    canvasSize.w,
                height:   canvasSize.h,
                background: bg,
                position: "relative",
                boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
                overflow: "hidden",
                cursor:   "default",
                flexShrink: 0,
              }}
            >
              {elements.map(el => (
                <CanvasElement
                  key={el.id}
                  el={el}
                  selected={selected === el.id}
                  editing={editingId === el.id}
                  onMouseDown={(e) => onElMouseDown(e, el.id)}
                  onDoubleClick={() => el.type === "text" && setEditingId(el.id)}
                  onBlur={() => setEditingId(null)}
                  onChange={(content) => updateEl(el.id, { content })}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── 우측 속성 패널 ── */}
        {selectedEl && (
          <PropertiesPanel
            el={selectedEl}
            onChange={(patch) => updateEl(selected, patch)}
            onDelete={deleteSelected}
            onMoveLayer={(dir) => moveLayer(selected, dir)}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 상단 툴바
// ─────────────────────────────────────────────
function TopBar({ onBack, canvasSize, showSizeMenu, setShowSizeMenu, onSelectSize, onDownload }) {
  return (
    <div className="flex items-center gap-3 px-4 h-13 bg-white border-b border-gray-200 flex-shrink-0 z-20" style={{ minHeight: 52 }}>
      {/* 뒤로 */}
      <button
        onClick={onBack}
        className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all flex-shrink-0"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>

      {/* 로고 */}
      <div className="flex items-center gap-2 mr-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/>
            <path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/>
          </svg>
        </div>
        <span className="font-bold text-gray-800 text-sm">에덴캔버스</span>
      </div>

      <div className="h-5 w-px bg-gray-200" />

      {/* 캔버스 크기 선택 */}
      <div className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setShowSizeMenu(!showSizeMenu); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
          </svg>
          {canvasSize.label}
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
        {showSizeMenu && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden"
            style={{ maxHeight: "70vh", overflowY: "auto" }}>
            {SIZE_CATEGORIES.map((cat, ci) => (
              <div key={cat.category}>
                {ci > 0 && <div className="h-px bg-gray-100 mx-3" />}
                <div className="px-3 pt-2.5 pb-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{cat.category}</p>
                </div>
                {cat.sizes.map(s => (
                  <button
                    key={s.label}
                    onClick={() => onSelectSize(s)}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors hover:bg-gray-50
                      ${canvasSize.label === s.label ? "bg-violet-50 text-violet-600" : "text-gray-700"}`}
                  >
                    <span className={`text-xs font-medium ${canvasSize.label === s.label ? "text-violet-600" : ""}`}>{s.label}</span>
                    <span className="text-[10px] text-gray-400">{s.desc}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1" />

      {/* 다운로드 */}
      <button
        onClick={onDownload}
        className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
      >
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
  { key: "template", label: "템플릿", icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg> },
  { key: "text",     label: "텍스트", icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg> },
  { key: "element",  label: "요소",   icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg> },
  { key: "photo",    label: "사진",   icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
];

function Sidebar({ active, setActive, onApplyTemplate, onAddElement, onImageUpload, bg, setBg }) {
  const fileRef = useRef(null);

  return (
    <div className="flex h-full flex-shrink-0">
      {/* 아이콘 탭 레일 */}
      <div className="w-14 bg-white border-r border-gray-200 flex flex-col items-center pt-3 gap-1">
        {SIDE_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            title={t.label}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all text-[10px] font-medium
              ${active === t.key ? "bg-violet-100 text-violet-600" : "text-gray-400 hover:bg-gray-100 hover:text-gray-600"}`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {/* 패널 내용 */}
      <div className="w-48 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
        {/* 탭 헤더 */}
        <div className="px-3 py-3 border-b border-gray-100">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
            {SIDE_TABS.find(t => t.key === active)?.label}
          </p>
        </div>

        <div className="p-3 space-y-2">

          {/* 템플릿 탭 */}
          {active === "template" && (
            <>
              <p className="text-[10px] text-gray-400 mb-2">클릭하면 캔버스에 적용됩니다</p>
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => onApplyTemplate(tpl)}
                  className="w-full rounded-xl overflow-hidden border-2 border-transparent hover:border-violet-400 transition-all group"
                >
                  <div
                    className="w-full h-20 flex items-center justify-center text-xs font-bold text-white/80"
                    style={{ background: tpl.previewBg }}
                  >
                    {tpl.name}
                  </div>
                </button>
              ))}

              {/* 배경색 */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 mb-2">배경 색상</p>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bg.startsWith("#") ? bg : "#ffffff"}
                    onChange={(e) => setBg(e.target.value)}
                    className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                  />
                  <span className="text-xs text-gray-500">{bg}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {["#ffffff","#000000","#1a1a2e","#0f172a","#fef9f0","#f0fdf4","#eff6ff","#fdf4ff"].map(c => (
                    <button
                      key={c}
                      onClick={() => setBg(c)}
                      style={{ background: c, border: bg === c ? "2px solid #7c3aed" : "1.5px solid #e5e7eb" }}
                      className="w-6 h-6 rounded-md transition-all hover:scale-110"
                    />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* 텍스트 탭 */}
          {active === "text" && (
            <>
              <button onClick={() => onAddElement(DEFAULTS.heading)}
                className="w-full text-left px-3 py-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all group">
                <p className="font-bold text-gray-800 text-base">제목 추가</p>
                <p className="text-[10px] text-gray-400 mt-0.5">40px · Bold</p>
              </button>
              <button onClick={() => onAddElement(DEFAULTS.body)}
                className="w-full text-left px-3 py-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all group">
                <p className="text-gray-700 text-sm">본문 추가</p>
                <p className="text-[10px] text-gray-400 mt-0.5">20px · Regular</p>
              </button>
              <button onClick={() => onAddElement(DEFAULTS.caption)}
                className="w-full text-left px-3 py-3 rounded-xl border border-gray-200 hover:border-violet-300 hover:bg-violet-50 transition-all group">
                <p className="text-gray-400 text-xs">캡션 추가</p>
                <p className="text-[10px] text-gray-400 mt-0.5">13px · Regular</p>
              </button>
            </>
          )}

          {/* 요소 탭 */}
          {active === "element" && (
            <>
              <p className="text-[10px] text-gray-400 mb-1">도형</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => onAddElement(DEFAULTS.rect)}
                  className="h-16 rounded-xl border border-gray-200 hover:border-violet-300 flex flex-col items-center justify-center gap-1 transition-all hover:bg-violet-50">
                  <div className="w-8 h-5 rounded bg-violet-400" />
                  <span className="text-[10px] text-gray-500">사각형</span>
                </button>
                <button onClick={() => onAddElement(DEFAULTS.circle)}
                  className="h-16 rounded-xl border border-gray-200 hover:border-violet-300 flex flex-col items-center justify-center gap-1 transition-all hover:bg-violet-50">
                  <div className="w-7 h-7 rounded-full bg-pink-400" />
                  <span className="text-[10px] text-gray-500">원</span>
                </button>
              </div>
              <button onClick={() => onAddElement(DEFAULTS.line)}
                className="w-full h-12 rounded-xl border border-gray-200 hover:border-violet-300 flex flex-col items-center justify-center gap-1 transition-all hover:bg-violet-50">
                <div className="w-16 h-0.5 bg-gray-600 rounded" />
                <span className="text-[10px] text-gray-500">선</span>
              </button>
            </>
          )}

          {/* 사진 탭 */}
          {active === "photo" && (
            <>
              <p className="text-[10px] text-gray-400 mb-2">로컬 파일에서 불러오기</p>
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 py-6 rounded-xl border-2 border-dashed border-gray-300 hover:border-violet-400 hover:bg-violet-50 transition-all text-gray-400 hover:text-violet-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span className="text-xs font-medium">이미지 업로드</span>
                <span className="text-[10px]">JPG, PNG, GIF, WEBP</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onImageUpload}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 캔버스 요소
// ─────────────────────────────────────────────
function CanvasElement({ el, selected, editing, onMouseDown, onDoubleClick, onBlur, onChange }) {
  const textRef = useRef(null);

  useEffect(() => {
    if (editing && textRef.current) {
      textRef.current.focus();
      // 커서 끝으로
      const range = document.createRange();
      range.selectNodeContents(textRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
  }, [editing]);

  const baseStyle = {
    position:  "absolute",
    left:      el.x,
    top:       el.y,
    width:     el.w,
    height:    el.h,
    opacity:   el.opacity ?? 1,
    cursor:    editing ? "text" : "move",
    boxSizing: "border-box",
    outline:   selected ? "2px solid #7c3aed" : "none",
    outlineOffset: "1px",
    userSelect: editing ? "text" : "none",
  };

  // ── 도형 ──
  if (el.type === "rect") {
    return (
      <div
        style={{
          ...baseStyle,
          background:   el.fill,
          borderRadius: el.borderRadius,
        }}
        onMouseDown={onMouseDown}
      />
    );
  }

  // ── 이미지 ──
  if (el.type === "image") {
    return (
      <img
        src={el.src}
        alt=""
        draggable={false}
        style={{ ...baseStyle, objectFit: "cover" }}
        onMouseDown={onMouseDown}
      />
    );
  }

  // ── 텍스트 ──
  if (el.type === "text") {
    return (
      <div
        ref={textRef}
        contentEditable={editing}
        suppressContentEditableWarning
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        onBlur={(e) => {
          onChange(e.currentTarget.innerText);
          onBlur();
        }}
        style={{
          ...baseStyle,
          fontSize:   el.fontSize,
          color:      el.color,
          fontWeight: el.fontWeight,
          textAlign:  el.textAlign,
          fontFamily: el.fontFamily || "sans-serif",
          lineHeight: 1.4,
          whiteSpace: "pre-wrap",
          wordBreak:  "break-word",
          overflow:   "hidden",
          display:    "flex",
          alignItems: "flex-start",
          padding:    2,
        }}
      >
        {el.content}
      </div>
    );
  }

  return null;
}

// ─────────────────────────────────────────────
// 우측 속성 패널
// ─────────────────────────────────────────────
function PropertiesPanel({ el, onChange, onDelete, onMoveLayer }) {
  return (
    <div className="w-52 bg-white border-l border-gray-200 overflow-y-auto flex-shrink-0">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">속성</p>
        <button
          onClick={onDelete}
          className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors rounded"
          title="삭제 (Delete)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-4">

        {/* 공통: 위치·크기 */}
        <Section label="위치 / 크기">
          <div className="grid grid-cols-2 gap-2">
            {[["X", "x"], ["Y", "y"], ["W", "w"], ["H", "h"]].map(([label, key]) => (
              <label key={key} className="flex flex-col gap-1">
                <span className="text-[10px] text-gray-400">{label}</span>
                <input
                  type="number"
                  value={Math.round(el[key])}
                  onChange={(e) => onChange({ [key]: Number(e.target.value) })}
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:border-violet-400 focus:outline-none"
                />
              </label>
            ))}
          </div>
        </Section>

        {/* 공통: 불투명도 */}
        <Section label="불투명도">
          <div className="flex items-center gap-2">
            <input
              type="range" min={0} max={1} step={0.01}
              value={el.opacity ?? 1}
              onChange={(e) => onChange({ opacity: Number(e.target.value) })}
              className="flex-1 accent-violet-600"
            />
            <span className="text-xs text-gray-500 w-8 text-right">{Math.round((el.opacity ?? 1) * 100)}%</span>
          </div>
        </Section>

        {/* 텍스트 전용 속성 */}
        {el.type === "text" && (
          <>
            <Section label="폰트 크기">
              <div className="flex items-center gap-2">
                <input
                  type="number" min={6} max={200}
                  value={el.fontSize}
                  onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded-lg focus:border-violet-400 focus:outline-none"
                />
                <span className="text-[10px] text-gray-400">px</span>
              </div>
            </Section>

            <Section label="폰트 굵기">
              <div className="flex gap-1">
                {[["400","보통"],["600","굵게"],["700","더굵게"],["800","최굵게"]].map(([v, l]) => (
                  <button key={v} onClick={() => onChange({ fontWeight: v })}
                    className={`flex-1 py-1 text-[10px] rounded-lg border transition-all ${el.fontWeight === v ? "bg-violet-100 border-violet-400 text-violet-600 font-bold" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </Section>

            <Section label="정렬">
              <div className="flex gap-1">
                {[
                  ["left",   <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="17" y1="18" x2="3" y2="18"/></svg>],
                  ["center", <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="17" y1="12" x2="7" y2="12"/><line x1="19" y1="18" x2="5" y2="18"/></svg>],
                  ["right",  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="12" x2="9" y2="12"/><line x1="21" y1="18" x2="7" y2="18"/></svg>],
                ].map(([val, icon]) => (
                  <button key={val} onClick={() => onChange({ textAlign: val })}
                    className={`flex-1 py-1.5 flex items-center justify-center rounded-lg border transition-all ${el.textAlign === val ? "bg-violet-100 border-violet-400 text-violet-600" : "border-gray-200 text-gray-400 hover:bg-gray-50"}`}>
                    {icon}
                  </button>
                ))}
              </div>
            </Section>

            <Section label="글자 색상">
              <div className="flex items-center gap-2">
                <input type="color" value={el.color}
                  onChange={(e) => onChange({ color: e.target.value })}
                  className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                />
                <span className="text-xs text-gray-500">{el.color}</span>
              </div>
            </Section>
          </>
        )}

        {/* 도형 전용 속성 */}
        {el.type === "rect" && (
          <>
            <Section label="채우기 색상">
              <div className="flex items-center gap-2">
                <input type="color" value={el.fill.startsWith("#") ? el.fill : "#6366f1"}
                  onChange={(e) => onChange({ fill: e.target.value })}
                  className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                />
                <span className="text-xs text-gray-500">{el.fill}</span>
              </div>
            </Section>
            <Section label="모서리 둥글기">
              <div className="flex items-center gap-2">
                <input type="range" min={0} max={100} value={el.borderRadius === 9999 ? 100 : el.borderRadius}
                  onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
                  className="flex-1 accent-violet-600"
                />
                <span className="text-xs text-gray-500 w-6 text-right">{el.borderRadius === 9999 ? "●" : el.borderRadius}</span>
              </div>
            </Section>
          </>
        )}

        {/* 레이어 순서 */}
        <Section label="레이어">
          <div className="flex gap-2">
            <button onClick={() => onMoveLayer("up")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
              앞으로
            </button>
            <button onClick={() => onMoveLayer("down")}
              className="flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-all">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
              뒤로
            </button>
          </div>
        </Section>

      </div>
    </div>
  );
}

// 속성 섹션 wrapper
function Section({ label, children }) {
  return (
    <div>
      <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-1.5">{label}</p>
      {children}
    </div>
  );
}
