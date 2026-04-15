// ── CardNewsTab — AI 카드뉴스 제작 ──
// 브랜드 프로필 관리 · AI 슬라이드 생성 · 클릭 인라인 편집 · 예약 발행
import { useState } from "react";
import { callGemini } from "../utils/gemini";

const BRANDS_KEY    = 'eden_cn_brands';
const SCHEDULES_KEY = 'eden_cn_schedules';

const FONTS       = ['sans', 'serif', 'mono'];
const FONT_LABELS = { sans: '고딕', serif: '명조', mono: '모노' };
const FONT_CSS    = { sans: 'inherit', serif: 'Georgia, serif', mono: "'Courier New', monospace" };

function loadBrands() {
  try { return JSON.parse(localStorage.getItem(BRANDS_KEY)) || []; } catch { return []; }
}
function saveBrands(b) { localStorage.setItem(BRANDS_KEY, JSON.stringify(b)); }

// ── 슬라이드 카드 ──
function SlidePreview({ slide, brand, index, total, isSelected, onClick, onEditHeadline, onEditBody }) {
  const [editingField, setEditingField] = useState(null);
  const [editVal, setEditVal]           = useState('');

  const startEdit = (field, val, e) => {
    e.stopPropagation();
    setEditingField(field);
    setEditVal(val);
  };
  const commitEdit = () => {
    if (editingField === 'headline') onEditHeadline(editVal);
    else if (editingField === 'body') onEditBody(editVal);
    setEditingField(null);
  };

  const isLight = slide.bgStyle === 'light';
  const bgStyle = isLight
    ? { background: `${brand.color1}18` }
    : slide.bgStyle === 'solid'
      ? { background: brand.color1 }
      : { background: `linear-gradient(135deg, ${brand.color1} 0%, ${brand.color2} 100%)` };
  const tc = isLight ? brand.color1 : '#ffffff';

  return (
    <div
      onClick={onClick}
      style={{ ...bgStyle, aspectRatio: '1/1', fontFamily: FONT_CSS[brand.font || 'sans'] }}
      className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 select-none
        ${isSelected ? 'ring-2 ring-pink-500 ring-offset-2 shadow-xl' : 'hover:shadow-lg hover:scale-[1.01]'}`}
    >
      {/* 슬라이드 번호 */}
      <span className="absolute top-2 right-2.5 text-[9px] font-bold opacity-40" style={{ color: tc }}>
        {index + 1}/{total}
      </span>

      {/* 이모지 */}
      {slide.emoji && (
        <span className="absolute top-2 left-2.5 text-lg leading-none">{slide.emoji}</span>
      )}

      {/* 텍스트 */}
      <div className={`absolute inset-0 flex flex-col justify-center px-3 py-7
        ${slide.layout === 'left' ? 'items-start text-left' : 'items-center text-center'}`}>

        {editingField === 'headline' ? (
          <textarea autoFocus rows={2}
            className="w-full bg-white/20 rounded px-2 py-1 text-xs font-bold resize-none outline-none text-center"
            style={{ color: tc }}
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <p
            title="클릭하여 수정"
            className="text-xs font-bold leading-tight mb-1 cursor-text hover:opacity-75 transition-opacity"
            style={{ color: tc }}
            onClick={e => startEdit('headline', slide.headline, e)}
          >
            {slide.headline}
          </p>
        )}

        {slide.body && (editingField === 'body' ? (
          <textarea autoFocus rows={3}
            className="w-full bg-white/20 rounded px-2 py-1 text-[10px] resize-none outline-none text-center"
            style={{ color: tc }}
            value={editVal}
            onChange={e => setEditVal(e.target.value)}
            onBlur={commitEdit}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <p
            title="클릭하여 수정"
            className="text-[10px] leading-relaxed opacity-85 cursor-text hover:opacity-65 transition-opacity"
            style={{ color: tc }}
            onClick={e => startEdit('body', slide.body, e)}
          >
            {slide.body}
          </p>
        ))}
      </div>

      {/* 타입 라벨 */}
      <div className="absolute bottom-1.5 left-2.5 text-[8px] font-bold uppercase opacity-30" style={{ color: tc }}>
        {slide.type === 'cover' ? 'COVER' : slide.type === 'closing' ? 'END' : ''}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──
export default function CardNewsTab() {
  const [step, setStep]                 = useState('input'); // 'input' | 'generating' | 'editor'
  const [brands, setBrands]             = useState(loadBrands);
  const [showBrandForm, setShowBrandForm] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState(null); // 수정 중인 브랜드 id
  const [selectedBrandId, setSelectedBrandId] = useState(() => loadBrands()[0]?.id || null);
  const [topic, setTopic]               = useState('');
  const [slideCount, setSlideCount]     = useState(5);
  const [slides, setSlides]             = useState([]);
  const [selectedIdx, setSelectedIdx]   = useState(0);
  const [genError, setGenError]         = useState('');

  // 예약
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('18:00');
  const [schedChannels, setSchedChannels] = useState({ insta: true, facebook: false });
  const [scheduleSaved, setScheduleSaved] = useState(false);

  // 새 브랜드 폼
  const [newBrand, setNewBrand] = useState({ name: '', color1: '#7c3aed', color2: '#4f46e5', font: 'sans' });

  const selectedBrand = brands.find(b => b.id === selectedBrandId) || brands[0] || null;

  // ── 브랜드 추가 ──
  const addBrand = () => {
    if (!newBrand.name.trim()) return;
    const brand = { ...newBrand, id: Date.now().toString(), name: newBrand.name.trim() };
    const updated = [...brands, brand];
    setBrands(updated);
    saveBrands(updated);
    setSelectedBrandId(brand.id);
    setShowBrandForm(false);
    setNewBrand({ name: '', color1: '#7c3aed', color2: '#4f46e5', font: 'sans' });
  };

  const deleteBrand = (id) => {
    const updated = brands.filter(b => b.id !== id);
    setBrands(updated);
    saveBrands(updated);
    if (selectedBrandId === id) setSelectedBrandId(updated[0]?.id || null);
    if (editingBrandId === id) setEditingBrandId(null);
  };

  // ── 브랜드 수정 ──
  const startEditBrand = (e, brand) => {
    e.stopPropagation();
    setEditingBrandId(brand.id);
    setShowBrandForm(false);
    setNewBrand({ name: brand.name, color1: brand.color1, color2: brand.color2, font: brand.font || 'sans' });
  };

  const saveEditBrand = () => {
    if (!newBrand.name.trim()) return;
    const updated = brands.map(b =>
      b.id === editingBrandId ? { ...b, name: newBrand.name.trim(), color1: newBrand.color1, color2: newBrand.color2, font: newBrand.font } : b
    );
    setBrands(updated);
    saveBrands(updated);
    setEditingBrandId(null);
    setNewBrand({ name: '', color1: '#7c3aed', color2: '#4f46e5', font: 'sans' });
  };

  // ── AI 생성 ──
  const generateSlides = async () => {
    if (!topic.trim()) return;
    if (!selectedBrand) { setGenError('브랜드를 먼저 추가해주세요.'); return; }
    setStep('generating');
    setGenError('');

    const prompt = `너는 인스타그램 카드뉴스 전문 기획자야.
아래 정보로 카드뉴스 슬라이드 ${slideCount}장 구성을 JSON 배열로만 반환해줘.

브랜드명: ${selectedBrand.name}
브랜드 컬러: ${selectedBrand.color1}
주제: ${topic}

각 슬라이드 형식:
{"type":"cover"|"content"|"closing","headline":"짧고 강렬한 제목(15자이내)","body":"본문(content 슬라이드만,40자이내)","emoji":"관련이모지1개","layout":"center"|"left","bgStyle":"gradient"|"solid"|"light"}

첫 장은 cover, 마지막 장은 closing, 나머지는 content. body는 content 슬라이드에만 포함.
JSON 배열만 반환. 다른 텍스트 없이.`;

    try {
      const raw = await callGemini(
        [{ role: 'user', content: prompt }],
        '카드뉴스 슬라이드 기획 전문가. JSON 배열만 반환.'
      );
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('응답 파싱 실패');
      const parsed = JSON.parse(match[0]);
      const total  = Math.min(parsed.length, slideCount);
      const withIds = parsed.slice(0, slideCount).map((s, i) => ({ ...s, id: i + 1, total }));
      setSlides(withIds);
      setSelectedIdx(0);
      setStep('editor');
    } catch (e) {
      setGenError('생성 실패: ' + e.message);
      setStep('input');
    }
  };

  const updateSlide = (idx, field, value) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  // ── 예약 저장 ──
  const saveSchedule = () => {
    if (!scheduleDate) return;
    const list = JSON.parse(localStorage.getItem(SCHEDULES_KEY) || '[]');
    list.push({
      id: Date.now(),
      topic,
      brand: selectedBrand?.name,
      slideCount: slides.length,
      datetime: `${scheduleDate}T${scheduleTime}`,
      channels: Object.entries(schedChannels).filter(([, v]) => v).map(([k]) => k),
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(list));
    setScheduleSaved(true);
    setTimeout(() => setScheduleSaved(false), 3000);
  };

  // ══════════════════════════════════════
  // ── STEP: 입력 ──
  // ══════════════════════════════════════
  if (step === 'input') {
    return (
      <div className="p-6">

        {/* 브랜드 선택 */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold text-gray-700">브랜드 / 계정</h4>
            <button
              onClick={() => setShowBrandForm(v => !v)}
              className="text-xs font-semibold text-pink-600 hover:text-pink-700 flex items-center gap-1 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              새 브랜드 추가
            </button>
          </div>

          {brands.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-xl">
              등록된 브랜드가 없습니다.<br />위 버튼으로 브랜드를 추가해주세요.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {brands.map(b => (
                <div
                  key={b.id}
                  onClick={() => setSelectedBrandId(b.id)}
                  className={`relative group flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all
                    ${selectedBrandId === b.id ? 'border-pink-400 bg-pink-50' : 'border-gray-200 bg-white hover:border-gray-300'}
                    ${editingBrandId === b.id ? 'border-blue-400 bg-blue-50' : ''}`}
                >
                  <div className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm"
                    style={{ background: `linear-gradient(135deg, ${b.color1}, ${b.color2})` }} />
                  <span className={`text-xs font-semibold truncate flex-1 min-w-0
                    ${editingBrandId === b.id ? 'text-blue-700' : selectedBrandId === b.id ? 'text-pink-700' : 'text-gray-700'}`}>
                    {b.name}
                  </span>
                  {/* 호버 시 편집/삭제 버튼 */}
                  <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={e => startEditBrand(e, b)}
                      className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-500 flex items-center justify-center transition-colors"
                      title="수정"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z"/>
                      </svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteBrand(b.id); }}
                      className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500 text-[10px] flex items-center justify-center transition-colors"
                      title="삭제"
                    >×</button>
                  </div>
                </div>
              ))}
            </div>

          {/* ── 전체 너비 수정 폼 (그리드 밖) ── */}
          {editingBrandId && (() => {
            const editTarget = brands.find(b => b.id === editingBrandId);
            if (!editTarget) return null;
            return (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mt-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full shadow-sm flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${newBrand.color1}, ${newBrand.color2})` }} />
                    <h5 className="text-xs font-bold text-blue-700">"{editTarget.name}" 수정</h5>
                  </div>
                  <button
                    onClick={() => { setEditingBrandId(null); setNewBrand({ name: '', color1: '#7c3aed', color2: '#4f46e5', font: 'sans' }); }}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 왼쪽: 이름 + 색상 */}
                  <div className="space-y-2.5">
                    <input
                      type="text"
                      placeholder="브랜드 이름"
                      className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg outline-none focus:border-pink-400 bg-white"
                      value={newBrand.name}
                      onChange={e => setNewBrand(p => ({ ...p, name: e.target.value }))}
                    />
                    <div className="flex gap-2 items-center">
                      <label className="text-xs text-gray-500 w-16 flex-shrink-0">주색상</label>
                      <input type="color" className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5 bg-white flex-shrink-0"
                        value={newBrand.color1} onChange={e => setNewBrand(p => ({ ...p, color1: e.target.value }))} />
                      <input type="text" className="flex-1 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-lg outline-none focus:border-pink-400 bg-white"
                        value={newBrand.color1} onChange={e => setNewBrand(p => ({ ...p, color1: e.target.value }))} />
                    </div>
                    <div className="flex gap-2 items-center">
                      <label className="text-xs text-gray-500 w-16 flex-shrink-0">보조색상</label>
                      <input type="color" className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5 bg-white flex-shrink-0"
                        value={newBrand.color2} onChange={e => setNewBrand(p => ({ ...p, color2: e.target.value }))} />
                      <input type="text" className="flex-1 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-lg outline-none focus:border-pink-400 bg-white"
                        value={newBrand.color2} onChange={e => setNewBrand(p => ({ ...p, color2: e.target.value }))} />
                    </div>
                  </div>
                  {/* 오른쪽: 폰트 + 미리보기 */}
                  <div className="space-y-2.5">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1.5">폰트</label>
                      <div className="flex gap-1.5">
                        {FONTS.map(f => (
                          <button key={f}
                            onClick={() => setNewBrand(p => ({ ...p, font: f }))}
                            className={`flex-1 py-1.5 text-xs rounded-lg border transition-all
                              ${newBrand.font === f ? 'border-pink-400 bg-pink-50 text-pink-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}
                            style={{ fontFamily: FONT_CSS[f] }}
                          >
                            {FONT_LABELS[f]}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* 미리보기 */}
                    <div className="flex items-center gap-2 px-3 py-3 bg-white rounded-xl border border-gray-200">
                      <div className="w-7 h-7 rounded-full shadow-sm flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${newBrand.color1}, ${newBrand.color2})` }} />
                      <div>
                        <p className="text-[10px] text-gray-400 leading-none mb-0.5">미리보기</p>
                        <span className="text-sm font-bold text-gray-800" style={{ fontFamily: FONT_CSS[newBrand.font] }}>
                          {newBrand.name || '브랜드명'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={saveEditBrand}
                    className="flex-1 py-2.5 bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold rounded-xl transition-colors">
                    저장
                  </button>
                  <button onClick={() => { setEditingBrandId(null); setNewBrand({ name: '', color1: '#7c3aed', color2: '#4f46e5', font: 'sans' }); }}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold rounded-xl transition-colors">
                    취소
                  </button>
                </div>
              </div>
            );
          })()}


          {/* 새 브랜드 폼 */}
          {showBrandForm && (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mt-3">
              <h5 className="text-xs font-bold text-gray-600 mb-3">새 브랜드 등록</h5>
              <div className="space-y-2.5">
                <input
                  type="text"
                  placeholder="브랜드 이름 (예: 에덴, A클라이언트)"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-pink-400"
                  value={newBrand.name}
                  onChange={e => setNewBrand(p => ({ ...p, name: e.target.value }))}
                />
                <div className="flex gap-2 items-center">
                  <label className="text-xs text-gray-500 w-14 flex-shrink-0">주색상</label>
                  <input type="color" className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                    value={newBrand.color1} onChange={e => setNewBrand(p => ({ ...p, color1: e.target.value }))} />
                  <input type="text" className="flex-1 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-lg outline-none focus:border-pink-400"
                    value={newBrand.color1} onChange={e => setNewBrand(p => ({ ...p, color1: e.target.value }))} />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs text-gray-500 w-14 flex-shrink-0">보조색상</label>
                  <input type="color" className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5"
                    value={newBrand.color2} onChange={e => setNewBrand(p => ({ ...p, color2: e.target.value }))} />
                  <input type="text" className="flex-1 px-2 py-1.5 text-xs font-mono border border-gray-200 rounded-lg outline-none focus:border-pink-400"
                    value={newBrand.color2} onChange={e => setNewBrand(p => ({ ...p, color2: e.target.value }))} />
                </div>
                <div className="flex gap-2 items-center">
                  <label className="text-xs text-gray-500 w-14 flex-shrink-0">폰트</label>
                  <div className="flex gap-1.5">
                    {FONTS.map(f => (
                      <button key={f}
                        onClick={() => setNewBrand(p => ({ ...p, font: f }))}
                        className={`px-2.5 py-1 text-xs rounded-lg border transition-all
                          ${newBrand.font === f ? 'border-pink-400 bg-pink-50 text-pink-700 font-semibold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}
                        style={{ fontFamily: FONT_CSS[f] }}
                      >
                        {FONT_LABELS[f]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={addBrand}
                  className="flex-1 py-2 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold rounded-lg transition-colors">
                  추가
                </button>
                <button onClick={() => setShowBrandForm(false)}
                  className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-lg transition-colors">
                  취소
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 주제 입력 */}
        <div className="mb-4">
          <h4 className="text-sm font-bold text-gray-700 mb-2">카드뉴스 주제</h4>
          <textarea
            rows={3}
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-pink-400 resize-none leading-relaxed"
            placeholder="예: 신제품 오로라 립밤 출시, 1+1 이벤트 진행 중"
            value={topic}
            onChange={e => setTopic(e.target.value.slice(0, 100))}
          />
          <p className="text-xs text-gray-400 text-right mt-1">{topic.length}/100자</p>
        </div>

        {/* 슬라이드 수 */}
        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-700 mb-2">슬라이드 수</h4>
          <div className="flex gap-2">
            {[3, 4, 5, 6, 7].map(n => (
              <button key={n}
                onClick={() => setSlideCount(n)}
                className={`w-10 h-10 rounded-xl text-sm font-bold border-2 transition-all
                  ${slideCount === n ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>

        {genError && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
            {genError}
          </div>
        )}

        <button
          onClick={generateSlides}
          disabled={!topic.trim() || !selectedBrand}
          className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-pink-200"
        >
          ✨ AI 카드뉴스 생성하기
        </button>
      </div>
    );
  }

  // ══════════════════════════════════════
  // ── STEP: 생성 중 ──
  // ══════════════════════════════════════
  if (step === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg animate-pulse">
          <svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
        </div>
        <p className="text-sm font-semibold text-gray-700">AI가 카드뉴스를 기획 중입니다...</p>
        <p className="text-xs text-gray-400">슬라이드 {slideCount}장 구성 중</p>
      </div>
    );
  }

  // ══════════════════════════════════════
  // ── STEP: 에디터 ──
  // ══════════════════════════════════════
  const slide = slides[selectedIdx];
  if (!slide || !selectedBrand) return null;

  return (
    <div className="p-5">
      {/* 상단 바 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full shadow-sm flex-shrink-0"
            style={{ background: `linear-gradient(135deg, ${selectedBrand.color1}, ${selectedBrand.color2})` }} />
          <span className="text-sm font-bold text-gray-700">{selectedBrand.name}</span>
          <span className="text-xs text-gray-400">· {slides.length}장</span>
        </div>
        <button
          onClick={() => { setStep('input'); setSlides([]); }}
          className="text-xs font-semibold text-gray-400 hover:text-pink-600 transition-colors flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          다시 만들기
        </button>
      </div>

      <div className="grid grid-cols-[1fr,190px] gap-4">

        {/* ── 슬라이드 그리드 ── */}
        <div>
          <p className="text-[11px] text-gray-400 mb-2.5 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            텍스트를 클릭하면 바로 수정 가능합니다
          </p>
          <div className={`grid gap-2.5 ${slides.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {slides.map((s, i) => (
              <SlidePreview
                key={s.id}
                slide={s}
                brand={selectedBrand}
                index={i}
                total={slides.length}
                isSelected={selectedIdx === i}
                onClick={() => setSelectedIdx(i)}
                onEditHeadline={val => updateSlide(i, 'headline', val)}
                onEditBody={val => updateSlide(i, 'body', val)}
              />
            ))}
          </div>
        </div>

        {/* ── 우측 패널 ── */}
        <div className="space-y-3">

          {/* 배경 스타일 */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">
              슬라이드 {selectedIdx + 1} 배경
            </p>
            <div className="space-y-1.5">
              {[
                { key: 'gradient', label: '그라디언트' },
                { key: 'solid',    label: '단색' },
                { key: 'light',    label: '라이트' },
              ].map(s => (
                <button key={s.key}
                  onClick={() => updateSlide(selectedIdx, 'bgStyle', s.key)}
                  className={`w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all text-left
                    ${slide.bgStyle === s.key ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 텍스트 정렬 */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">정렬</p>
            <div className="flex gap-1.5">
              {[{ k: 'center', l: '가운데' }, { k: 'left', l: '왼쪽' }].map(({ k, l }) => (
                <button key={k}
                  onClick={() => updateSlide(selectedIdx, 'layout', k)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all
                    ${slide.layout === k ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* 전체 배경 일괄 변경 */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">전체 일괄 적용</p>
            <div className="space-y-1.5">
              {[
                { key: 'gradient', label: '전체 그라디언트' },
                { key: 'light',    label: '전체 라이트' },
              ].map(s => (
                <button key={s.key}
                  onClick={() => setSlides(prev => prev.map(sl => ({ ...sl, bgStyle: s.key })))}
                  className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700 transition-all text-left">
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 예약 발행 */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">예약 발행</p>
            <div className="space-y-2">
              <input type="date"
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-pink-400"
                value={scheduleDate}
                onChange={e => setScheduleDate(e.target.value)} />
              <input type="time"
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-pink-400"
                value={scheduleTime}
                onChange={e => setScheduleTime(e.target.value)} />
              <div className="space-y-1">
                {[{ key: 'insta', label: '📷 인스타그램' }, { key: 'facebook', label: '👍 페이스북' }].map(ch => (
                  <label key={ch.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox"
                      className="w-3.5 h-3.5 accent-pink-500"
                      checked={schedChannels[ch.key]}
                      onChange={e => setSchedChannels(p => ({ ...p, [ch.key]: e.target.checked }))} />
                    <span className="text-xs text-gray-600">{ch.label}</span>
                  </label>
                ))}
              </div>
              {scheduleSaved ? (
                <div className="w-full py-1.5 text-xs text-center font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg">
                  ✓ 예약 저장됨
                </div>
              ) : (
                <button
                  onClick={saveSchedule}
                  disabled={!scheduleDate}
                  className="w-full py-2 bg-gray-900 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors">
                  예약 등록
                </button>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
