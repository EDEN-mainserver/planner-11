import { useState } from "react";
import { PRESET_PROVIDERS, loadAiKeys, saveAiKeys } from "../../utils/aiKeys";
import Field from "./Field";

export default function AiApiTab() {
  // 저장된 키 목록 (배열). 없으면 빈 배열.
  const [keys, setKeys] = useState(() => loadAiKeys());
  // 추가 패널: null | 'pick' (프리셋 선택) | 'custom' (직접 입력)
  const [addMode, setAddMode] = useState(null);
  const [customForm, setCustomForm] = useState({ id: '', name: '', apiKey: '', model: '' });
  // 비밀 보기 토글
  const [showKey, setShowKey] = useState({});

  const configuredIds = keys.map(k => k.id);
  const availablePresets = PRESET_PROVIDERS.filter(p => !configuredIds.includes(p.id));

  const update = (id, field, value) => {
    setKeys(prev => {
      const next = prev.map(k => k.id === id ? { ...k, [field]: value } : k);
      saveAiKeys(next);
      return next;
    });
  };

  const addPreset = (preset) => {
    setKeys(prev => {
      const next = [...prev, {
        id: preset.id,
        name: preset.name,
        apiKey: '',
        model: preset.defaultModel,
        enabled: true,
        custom: false,
      }];
      saveAiKeys(next);
      return next;
    });
    setAddMode(null);
  };

  const addCustom = () => {
    const id = customForm.id.trim() || `custom_${Date.now()}`;
    if (keys.some(k => k.id === id)) { alert('이미 존재하는 ID입니다'); return; }
    if (!customForm.name.trim()) { alert('이름을 입력하세요'); return; }
    setKeys(prev => {
      const next = [...prev, {
        id,
        name: customForm.name.trim(),
        apiKey: customForm.apiKey,
        model: customForm.model,
        enabled: true,
        custom: true,
      }];
      saveAiKeys(next);
      return next;
    });
    setCustomForm({ id: '', name: '', apiKey: '', model: '' });
    setAddMode(null);
  };

  const remove = (id) => {
    if (!confirm('이 프로바이더를 삭제할까요?')) return;
    setKeys(prev => {
      const next = prev.filter(k => k.id !== id);
      saveAiKeys(next);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-800">AI API 키</h3>
          <p className="text-xs text-gray-400 mt-0.5">키 입력 즉시 자동 저장 · 대시보드 전체 AI 기능에 바로 적용</p>
        </div>
        <button
          onClick={() => setAddMode(addMode ? null : 'pick')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14"/><path d="M12 5v14"/>
          </svg>
          프로바이더 추가
        </button>
      </div>

      {/* 추가 패널 */}
      {addMode === 'pick' && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-indigo-700">프로바이더 선택</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {availablePresets.map(p => (
              <button
                key={p.id}
                onClick={() => addPreset(p)}
                className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50 transition-all text-left"
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                  style={{ background: p.color }}>
                  {p.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-800">{p.name}</p>
                  <p className="text-[10px] text-gray-400">{p.desc}</p>
                </div>
              </button>
            ))}
            <button
              onClick={() => setAddMode('custom')}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-dashed border-gray-300 rounded-xl hover:border-indigo-300 transition-all"
            >
              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-lg flex-shrink-0">+</div>
              <div>
                <p className="text-xs font-semibold text-gray-600">직접 입력</p>
                <p className="text-[10px] text-gray-400">커스텀 프로바이더</p>
              </div>
            </button>
          </div>
          {availablePresets.length === 0 && (
            <p className="text-xs text-indigo-500">모든 프리셋 프로바이더가 이미 추가되었습니다.</p>
          )}
          <button onClick={() => setAddMode(null)} className="text-xs text-gray-400 hover:text-gray-600">취소</button>
        </div>
      )}

      {addMode === 'custom' && (
        <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-bold text-gray-700">커스텀 프로바이더 추가</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="이름 *" value={customForm.name} onChange={v => setCustomForm(p => ({ ...p, name: v }))} placeholder="예: Mistral" />
            <Field label="ID (영문, 선택)" value={customForm.id} onChange={v => setCustomForm(p => ({ ...p, id: v }))} placeholder="예: mistral" mono />
            <Field label="API 키" type="password" value={customForm.apiKey} onChange={v => setCustomForm(p => ({ ...p, apiKey: v }))} placeholder="API 키 입력" mono />
            <Field label="기본 모델" value={customForm.model} onChange={v => setCustomForm(p => ({ ...p, model: v }))} placeholder="예: mistral-large-latest" mono />
          </div>
          <div className="flex gap-2">
            <button onClick={addCustom} className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700">추가</button>
            <button onClick={() => setAddMode(null)} className="px-4 py-2 border border-gray-200 text-gray-500 text-xs rounded-lg hover:bg-gray-50">취소</button>
          </div>
        </div>
      )}

      {/* 등록된 프로바이더 카드 목록 */}
      {keys.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-200">
          <span className="text-3xl mb-3">🤖</span>
          <p className="text-sm text-gray-500 font-medium">아직 등록된 AI 프로바이더가 없습니다</p>
          <p className="text-xs text-gray-400 mt-1">위의 '프로바이더 추가' 버튼을 눌러 시작하세요</p>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map(entry => {
            const preset = PRESET_PROVIDERS.find(p => p.id === entry.id);
            const color = preset?.color || '#6B7280';
            const bgColor = preset?.bgColor || '#F9FAFB';
            const icon = preset?.icon || entry.name?.charAt(0) || '?';
            const models = preset?.models || [];
            const keyHint = preset?.keyHint || '';
            const isVisible = showKey[entry.id];

            return (
              <div key={entry.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                {/* 카드 헤더 */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100"
                  style={{ background: `linear-gradient(to right, ${bgColor}, #fff)` }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-black flex-shrink-0"
                    style={{ background: color }}>
                    {icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-800">{entry.name}</p>
                      {entry.custom && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">커스텀</span>
                      )}
                    </div>
                    {preset && <p className="text-[11px] text-gray-400">{preset.desc}</p>}
                  </div>
                  {/* 활성 뱃지 */}
                  {entry.apiKey && entry.enabled ? (
                    <span className="text-[10px] font-bold bg-green-100 text-green-600 border border-green-200 rounded-full px-2.5 py-1">✓ 활성</span>
                  ) : (
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-400 border border-gray-200 rounded-full px-2.5 py-1">미설정</span>
                  )}
                  {/* 활성화 토글 */}
                  <label className="flex items-center gap-1.5 cursor-pointer ml-1">
                    <span className="text-[10px] text-gray-400">활성화</span>
                    <div className="relative"
                      onClick={() => update(entry.id, 'enabled', !entry.enabled)}>
                      <div className="w-9 h-5 rounded-full transition-colors"
                        style={{ background: entry.enabled ? color : '#D1D5DB' }}>
                        <div className="w-4 h-4 bg-white rounded-full absolute top-0.5 shadow transition-transform"
                          style={{ left: entry.enabled ? '18px' : '2px' }} />
                      </div>
                    </div>
                  </label>
                  {/* 삭제 */}
                  <button onClick={() => remove(entry.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                    </svg>
                  </button>
                </div>

                {/* 카드 바디 */}
                <div className="p-5 space-y-3">
                  {/* API 키 입력 */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">API 키</label>
                    <div className="flex gap-2">
                      <input
                        type={isVisible ? 'text' : 'password'}
                        value={entry.apiKey || ''}
                        onChange={e => update(entry.id, 'apiKey', e.target.value)}
                        placeholder={preset?.keyPlaceholder || 'API 키 입력'}
                        className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-indigo-400 bg-white transition-colors font-mono"
                      />
                      <button
                        onClick={() => setShowKey(prev => ({ ...prev, [entry.id]: !isVisible }))}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 text-xs transition-all flex-shrink-0"
                      >
                        {isVisible ? '숨기기' : '보기'}
                      </button>
                    </div>
                    {keyHint && <p className="text-[11px] text-gray-400 mt-1">📎 {keyHint}</p>}
                  </div>

                  {/* 모델 선택 */}
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">모델</label>
                    {models.length > 0 ? (
                      <select
                        value={entry.model || preset?.defaultModel || ''}
                        onChange={e => update(entry.id, 'model', e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-indigo-400 bg-white font-mono"
                      >
                        {models.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    ) : (
                      <input
                        value={entry.model || ''}
                        onChange={e => update(entry.id, 'model', e.target.value)}
                        placeholder="모델명 입력"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-indigo-400 bg-white font-mono"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-[11px] text-gray-400">
        🔒 API 키는 브라우저 로컬스토리지에 저장됩니다. 입력 즉시 자동 저장되며 새로고침 후에도 유지됩니다.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════
// 탭 3: 쿠팡 API 설정
// ═══════════════════════════════════════════
