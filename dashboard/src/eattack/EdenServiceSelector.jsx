/**
 * 에덴 서비스 선택기
 * - 서비스 목록 저장/관리 (이름, 설명, 가격)
 * - 체크박스로 다중 선택 → 부모에 텍스트 전달
 * - 추가/수정/삭제 지원
 */
import { useState, useEffect } from "react";

const LS_SERVICES_KEY = "eden_services_v1";
const LS_SELECTED_KEY = "eden_selected_services_v1";

const DEFAULT_SERVICES = [
  {
    id: "svc-default-1",
    name: "SNS 계정 운영",
    description: "인스타그램/페이스북 콘텐츠 기획·제작·운영",
    price: "월 150만원",
  },
  {
    id: "svc-default-2",
    name: "쇼츠/릴스 제작",
    description: "유튜브 쇼츠·인스타 릴스 월 8편 제작",
    price: "월 120만원",
  },
  {
    id: "svc-default-3",
    name: "퍼포먼스 마케팅",
    description: "Meta/Google 광고 운영 및 최적화",
    price: "광고비의 15%",
  },
  {
    id: "svc-default-4",
    name: "카드뉴스 제작",
    description: "AI 기반 카드뉴스 월 30건 제작",
    price: "월 80만원",
  },
];

function loadServices() {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_SERVICES_KEY));
    return Array.isArray(saved) && saved.length > 0 ? saved : DEFAULT_SERVICES;
  } catch {
    return DEFAULT_SERVICES;
  }
}

function persistServices(svcs) {
  try { localStorage.setItem(LS_SERVICES_KEY, JSON.stringify(svcs)); } catch {}
}

function loadSelectedIds(services) {
  try {
    const saved = JSON.parse(localStorage.getItem(LS_SELECTED_KEY));
    if (Array.isArray(saved)) return saved;
  } catch {}
  return services.map(s => s.id); // 기본: 전체 선택
}

function persistSelectedIds(ids) {
  try { localStorage.setItem(LS_SELECTED_KEY, JSON.stringify(ids)); } catch {}
}

// 선택된 서비스들을 제안서용 텍스트로 변환
function buildText(services, selectedIds) {
  return services
    .filter(s => selectedIds.includes(s.id))
    .map(s => {
      const price = s.price ? ` [${s.price}]` : "";
      const desc = s.description ? `: ${s.description}` : "";
      return `- ${s.name}${price}${desc}`;
    })
    .join("\n");
}

const EMPTY_FORM = { name: "", description: "", price: "" };

export default function EdenServiceSelector({ onChange }) {
  const [services, setServices] = useState(() => loadServices());
  const [selectedIds, setSelectedIds] = useState(() => loadSelectedIds(loadServices()));
  const [editingId, setEditingId] = useState(null);
  const [addingNew, setAddingNew] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  // 마운트 시 초기값 부모에 전달
  useEffect(() => {
    onChange(buildText(services, selectedIds));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function notify(svcs, selected) {
    onChange(buildText(svcs, selected));
  }

  function toggleSelect(id) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter(x => x !== id)
      : [...selectedIds, id];
    setSelectedIds(next);
    persistSelectedIds(next);
    notify(services, next);
  }

  function selectAll() {
    const ids = services.map(s => s.id);
    setSelectedIds(ids);
    persistSelectedIds(ids);
    notify(services, ids);
  }

  function selectNone() {
    setSelectedIds([]);
    persistSelectedIds([]);
    notify(services, []);
  }

  function handleAdd() {
    if (!form.name.trim()) return;
    const newSvc = {
      id: `svc-${Date.now()}`,
      name: form.name.trim(),
      description: form.description.trim(),
      price: form.price.trim(),
    };
    const nextSvcs = [...services, newSvc];
    const nextSelected = [...selectedIds, newSvc.id];
    setServices(nextSvcs);
    setSelectedIds(nextSelected);
    persistServices(nextSvcs);
    persistSelectedIds(nextSelected);
    notify(nextSvcs, nextSelected);
    setForm(EMPTY_FORM);
    setAddingNew(false);
  }

  function startEdit(svc) {
    setEditingId(svc.id);
    setForm({ name: svc.name, description: svc.description, price: svc.price });
    setAddingNew(false);
  }

  function handleSaveEdit() {
    const nextSvcs = services.map(s =>
      s.id === editingId
        ? { ...s, name: form.name.trim(), description: form.description.trim(), price: form.price.trim() }
        : s
    );
    setServices(nextSvcs);
    persistServices(nextSvcs);
    notify(nextSvcs, selectedIds);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleDelete(id) {
    if (!confirm("서비스를 삭제할까요?")) return;
    const nextSvcs = services.filter(s => s.id !== id);
    const nextSelected = selectedIds.filter(x => x !== id);
    setServices(nextSvcs);
    setSelectedIds(nextSelected);
    persistServices(nextSvcs);
    persistSelectedIds(nextSelected);
    notify(nextSvcs, nextSelected);
    if (editingId === id) { setEditingId(null); setForm(EMPTY_FORM); }
  }

  function cancelEdit() {
    setEditingId(null);
    setAddingNew(false);
    setForm(EMPTY_FORM);
  }

  const selectedCount = selectedIds.length;

  return (
    <div>
      {/* 라벨 + 전체/해제 */}
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-semibold text-gray-700">
          에덴의 서비스
          <span className="ml-1.5 text-xs font-normal text-gray-400">
            제안할 서비스를 선택하세요
          </span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-xs text-violet-600 font-medium">{selectedCount}개 선택</span>
          <button onClick={selectAll} className="text-xs text-gray-400 hover:text-gray-600 underline">전체</button>
          <button onClick={selectNone} className="text-xs text-gray-400 hover:text-gray-600 underline">해제</button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
        {services.length === 0 && !addingNew && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">
            등록된 서비스가 없습니다. 아래에서 추가해 주세요.
          </div>
        )}

        {services.map((svc, idx) => (
          <div key={svc.id} className={idx < services.length - 1 || addingNew ? "border-b border-gray-100" : ""}>
            {editingId === svc.id ? (
              /* ── 인라인 수정 폼 ── */
              <div className="px-4 py-3 bg-violet-50 space-y-2">
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="서비스명 *"
                  autoFocus
                  className="w-full px-3 py-1.5 rounded-lg border border-violet-200 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="서비스 설명 (옵션)"
                  className="w-full px-3 py-1.5 rounded-lg border border-violet-200 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                />
                <div className="flex gap-2">
                  <input
                    value={form.price}
                    onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                    placeholder="가격 (예: 월 150만원, 협의)"
                    className="flex-1 px-3 py-1.5 rounded-lg border border-violet-200 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                    onKeyDown={e => e.key === "Enter" && handleSaveEdit()}
                  />
                  <button
                    onClick={handleSaveEdit}
                    disabled={!form.name.trim()}
                    className="px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40 transition-colors"
                  >
                    저장
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              /* ── 서비스 행 ── */
              <div
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors group ${
                  selectedIds.includes(svc.id) ? "bg-violet-50/40" : ""
                }`}
                onClick={() => toggleSelect(svc.id)}
              >
                {/* 커스텀 체크박스 */}
                <div
                  className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                    selectedIds.includes(svc.id)
                      ? "bg-violet-600 border-violet-600"
                      : "border-gray-300 group-hover:border-violet-400"
                  }`}
                >
                  {selectedIds.includes(svc.id) && (
                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                      <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>

                {/* 서비스 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{svc.name}</span>
                    {svc.price && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium whitespace-nowrap">
                        {svc.price}
                      </span>
                    )}
                  </div>
                  {svc.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{svc.description}</p>
                  )}
                </div>

                {/* 수정/삭제 버튼 */}
                <div
                  className="flex gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    onClick={() => startEdit(svc)}
                    title="수정"
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(svc.id)}
                    title="삭제"
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      <path d="M10 11v6"/><path d="M14 11v6"/>
                      <path d="M9 6V4h6v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* ── 새 서비스 추가 폼 ── */}
        {addingNew && (
          <div className="px-4 py-3 bg-green-50 border-t border-green-100 space-y-2">
            <p className="text-xs font-semibold text-green-700">새 서비스 추가</p>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="서비스명 *"
              autoFocus
              className="w-full px-3 py-1.5 rounded-lg border border-green-200 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
            />
            <input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="서비스 설명"
              className="w-full px-3 py-1.5 rounded-lg border border-green-200 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
            />
            <div className="flex gap-2">
              <input
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="가격 (예: 월 150만원, 협의)"
                className="flex-1 px-3 py-1.5 rounded-lg border border-green-200 text-sm focus:outline-none focus:ring-1 focus:ring-green-400"
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
              <button
                onClick={handleAdd}
                disabled={!form.name.trim()}
                className="px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors"
              >
                추가
              </button>
              <button
                onClick={cancelEdit}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
            </div>
          </div>
        )}

        {/* ── 서비스 추가 버튼 ── */}
        {!addingNew && (
          <button
            onClick={() => { setAddingNew(true); setEditingId(null); setForm(EMPTY_FORM); }}
            className="w-full flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm text-gray-400 hover:text-violet-600 hover:bg-violet-50/50 transition-colors border-t border-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            서비스 추가
          </button>
        )}
      </div>

      {/* 선택된 서비스 미리보기 */}
      {selectedCount === 0 && (
        <p className="text-xs text-amber-600 mt-2 pl-1">⚠ 서비스를 하나 이상 선택해야 제안서를 생성할 수 있습니다.</p>
      )}
    </div>
  );
}
