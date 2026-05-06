/**
 * PPT 디자인 템플릿 관리자
 * - PDF / HTML 업로드 → Gemini로 디자인 분석
 * - 여러 템플릿 저장 / 이름 설정 / 삭제 / 선택
 * - 선택된 템플릿을 onSelect(template) 으로 부모에 전달
 */
import { useState, useRef } from "react";

const LS_KEY = "eden_ppt_templates_v1";

// 기본 내장 템플릿 (삭제 불가)
const DEFAULT_TEMPLATE = {
  id: "__default__",
  name: "에덴 기본",
  type: "default",
  primaryColor: "#4F46E5",
  accentColor: "#7C3AED",
  backgroundColor: "#FFFFFF",
  titleColor: "#FFFFFF",
  fontStyle: "sans-serif",
  layoutStyle: "상단 컬러 바 + 불릿 리스트",
  styleDescription: "에덴 기본 보라 계열 디자인",
  slideCount: null,
};

function loadTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_KEY));
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}

function persistTemplates(list) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
}

// HTML 텍스트에서 디자인 분석 (Gemini 텍스트 모드)
async function analyzeHtml(htmlContent) {
  const prompt = `다음 HTML/CSS 코드에서 디자인 스타일 정보를 추출해서 JSON만 반환하세요. 설명 없이 JSON만.

\`\`\`html
${htmlContent.substring(0, 6000)}
\`\`\`

{
  "primaryColor": "메인 컬러 hex (예: #1B3A7A)",
  "accentColor": "강조 컬러 hex (예: #F4A300)",
  "backgroundColor": "배경 컬러 hex",
  "titleColor": "제목 텍스트 컬러 hex",
  "fontStyle": "폰트 계열 (예: sans-serif, 나눔고딕)",
  "layoutStyle": "레이아웃 패턴 한 줄",
  "styleDescription": "전체 디자인 스타일 한 줄 요약 (한국어)"
}`;

  const resp = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      history: [{ role: "user", content: prompt }],
      systemPrompt: "디자인 분석 전문가입니다. HTML/CSS에서 색상과 레이아웃 정보를 추출합니다. JSON만 반환하세요.",
    }),
  });
  if (!resp.ok) throw new Error("Gemini 분석 실패");
  const data = await resp.json();
  const match = data.text?.match(/\{[\s\S]*?\}/);
  if (!match) throw new Error("JSON 파싱 실패");
  return JSON.parse(match[0]);
}

// PDF base64 → Gemini Vision 분석
async function analyzePdf(base64) {
  const resp = await fetch("/api/parse-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pdfBase64: base64 }),
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.error || "PDF 분석 실패");
  }
  const data = await resp.json();
  return data.template;
}

// 색상 스와치
function Swatch({ color, label }) {
  return (
    <div className="flex items-center gap-1" title={label || color}>
      <div
        className="w-3.5 h-3.5 rounded-full border border-gray-300 shadow-sm flex-shrink-0"
        style={{ backgroundColor: color }}
      />
    </div>
  );
}

export default function PptTemplateManager({ onSelect }) {
  const [userTemplates, setUserTemplates] = useState(() => loadTemplates());
  const [selectedId, setSelectedId] = useState(() => {
    const saved = loadTemplates();
    return saved.length > 0 ? saved[0].id : "__default__";
  });
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // 업로드 후 이름 설정 대기 중인 템플릿
  const [pending, setPending] = useState(null); // { analysis, fileName, type }
  const [pendingName, setPendingName] = useState("");

  // 이름 수정 중
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");

  const pdfInputRef = useRef(null);
  const htmlInputRef = useRef(null);

  // 전체 목록 (기본 포함)
  const allTemplates = [DEFAULT_TEMPLATE, ...userTemplates];

  function select(id) {
    setSelectedId(id);
    const found = allTemplates.find(t => t.id === id) || DEFAULT_TEMPLATE;
    onSelect(found);
  }

  // 초기 선택 전달 (마운트 시)
  // → 부모 컴포넌트에서 useEffect 없이도 동작하도록 선택된 값을 즉시 전달
  // (onSelect는 setState이므로 렌더 중 호출 금지 → ref로 한 번만 실행)
  const initDone = useRef(false);
  if (!initDone.current) {
    initDone.current = true;
    const initial = allTemplates.find(t => t.id === selectedId) || DEFAULT_TEMPLATE;
    // 비동기 없이 바로 호출하면 렌더 중 setState가 되므로 setTimeout 0으로 지연
    setTimeout(() => onSelect(initial), 0);
  }

  // ── 파일 업로드 처리 ──
  async function handleFileChange(e, type) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (type === "pdf" && file.size > 3 * 1024 * 1024) {
      setUploadError("PDF 파일이 너무 큽니다 (최대 3MB).");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      let analysis;

      if (type === "pdf") {
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = ev => resolve(ev.target.result.split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        analysis = await analyzePdf(base64);
      } else {
        // HTML
        const text = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = ev => resolve(ev.target.result);
          reader.onerror = reject;
          reader.readAsText(file, "utf-8");
        });
        analysis = await analyzeHtml(text);
      }

      // 이름 입력 대기 단계로 전환
      setPending({ analysis, fileName: file.name, type });
      setPendingName(file.name.replace(/\.(pdf|html?)$/i, "").substring(0, 30));

    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  // 이름 확정 후 저장
  function savePending() {
    if (!pending || !pendingName.trim()) return;
    const newTpl = {
      id: `tpl-${Date.now()}`,
      name: pendingName.trim(),
      type: pending.type,
      ...pending.analysis,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    const next = [...userTemplates, newTpl];
    setUserTemplates(next);
    persistTemplates(next);
    select(newTpl.id);
    setPending(null);
    setPendingName("");
  }

  // 삭제
  function deleteTemplate(id) {
    const next = userTemplates.filter(t => t.id !== id);
    setUserTemplates(next);
    persistTemplates(next);
    if (selectedId === id) {
      select("__default__");
    }
  }

  // 이름 수정 저장
  function saveRename() {
    if (!editingName.trim()) return;
    const next = userTemplates.map(t =>
      t.id === editingId ? { ...t, name: editingName.trim() } : t
    );
    setUserTemplates(next);
    persistTemplates(next);
    if (selectedId === editingId) {
      const updated = next.find(t => t.id === editingId);
      if (updated) onSelect(updated);
    }
    setEditingId(null);
  }

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
          </svg>
          <span className="text-sm font-semibold text-blue-700">PPT 디자인 템플릿</span>
          <span className="text-xs text-blue-400">저장된 디자인을 선택하거나 새로 추가하세요</span>
        </div>
        {/* 추가 버튼 */}
        <div className="flex gap-1.5">
          <button
            onClick={() => pdfInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-blue-200 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            PDF
          </button>
          <button
            onClick={() => htmlInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white border border-blue-200 text-xs font-medium text-blue-600 hover:bg-blue-100 transition-colors disabled:opacity-50"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            HTML
          </button>
          <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden" onChange={e => handleFileChange(e, "pdf")} />
          <input ref={htmlInputRef} type="file" accept=".html,.htm" className="hidden" onChange={e => handleFileChange(e, "html")} />
        </div>
      </div>

      {/* 업로드 중 */}
      {uploading && (
        <div className="flex items-center gap-2 px-4 py-3 bg-blue-100 border-b border-blue-200">
          <div className="w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-blue-700 font-medium">Gemini가 디자인 분석 중...</span>
        </div>
      )}

      {/* 에러 */}
      {uploadError && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-200 text-xs text-red-600">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {uploadError}
          <button onClick={() => setUploadError("")} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* 이름 설정 대기 */}
      {pending && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
          <p className="text-xs font-semibold text-amber-700 mb-2">
            ✅ 분석 완료 — 템플릿 이름을 입력하세요
          </p>
          {/* 색상 미리보기 */}
          <div className="flex items-center gap-1.5 mb-2">
            {[pending.analysis?.primaryColor, pending.analysis?.accentColor, pending.analysis?.backgroundColor]
              .filter(Boolean)
              .map((c, i) => <Swatch key={i} color={c} />)
            }
            <span className="text-xs text-gray-500 ml-1">{pending.analysis?.styleDescription}</span>
          </div>
          <div className="flex gap-2">
            <input
              value={pendingName}
              onChange={e => setPendingName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && savePending()}
              autoFocus
              placeholder="템플릿 이름"
              className="flex-1 px-3 py-1.5 rounded-lg border border-amber-200 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400 bg-white"
            />
            <button
              onClick={savePending}
              disabled={!pendingName.trim()}
              className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 disabled:opacity-40 transition-colors"
            >
              저장
            </button>
            <button
              onClick={() => { setPending(null); setPendingName(""); }}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 bg-white transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 템플릿 목록 */}
      <div className="divide-y divide-blue-100">
        {allTemplates.map(tpl => {
          const isSelected = selectedId === tpl.id;
          const isDefault = tpl.id === "__default__";
          const isEditing = editingId === tpl.id;

          return (
            <div
              key={tpl.id}
              className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                isSelected ? "bg-blue-100" : "bg-white hover:bg-blue-50"
              }`}
            >
              {/* 선택 라디오 */}
              <button
                onClick={() => select(tpl.id)}
                className={`flex-shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                  isSelected ? "border-blue-600 bg-blue-600" : "border-gray-300 hover:border-blue-400"
                }`}
              >
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </button>

              {/* 색상 스와치 */}
              <div className="flex gap-1 flex-shrink-0">
                {[tpl.primaryColor, tpl.accentColor, tpl.backgroundColor]
                  .filter(Boolean)
                  .map((c, i) => <Swatch key={i} color={c} />)
                }
              </div>

              {/* 이름 (수정 가능) */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <div className="flex gap-1.5">
                    <input
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") saveRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                      className="flex-1 px-2 py-0.5 rounded border border-blue-300 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
                    />
                    <button onClick={saveRename} className="text-xs px-2 py-0.5 rounded bg-blue-600 text-white hover:bg-blue-700">저장</button>
                    <button onClick={() => setEditingId(null)} className="text-xs px-2 py-0.5 rounded border border-gray-200 text-gray-500 hover:bg-gray-50 bg-white">취소</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-semibold truncate ${isSelected ? "text-blue-700" : "text-gray-700"}`}>
                      {tpl.name}
                    </span>
                    {tpl.type && tpl.type !== "default" && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${
                        tpl.type === "pdf" ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"
                      }`}>
                        {tpl.type.toUpperCase()}
                      </span>
                    )}
                    {isDefault && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium flex-shrink-0">기본</span>
                    )}
                    {tpl.styleDescription && (
                      <span className="text-[10px] text-gray-400 truncate hidden sm:block">{tpl.styleDescription}</span>
                    )}
                  </div>
                )}
              </div>

              {/* 액션 버튼 */}
              {!isDefault && !isEditing && (
                <div className="flex gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => { setEditingId(tpl.id); setEditingName(tpl.name); }}
                    title="이름 수정"
                    className="p-1.5 rounded hover:bg-blue-200 text-blue-400 hover:text-blue-700 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    title="삭제"
                    className="p-1.5 rounded hover:bg-red-100 text-blue-400 hover:text-red-500 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
