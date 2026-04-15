// ── CardNewsTab — AI 카드뉴스 제작 (새 구조) ──
import { useState } from "react";
import { callGemini } from "../utils/gemini";

const TEMPLATE_KEY = 'eden_cn_template_v2';
const IG_KEY       = 'eden_cn_ig_v1';

const FONTS       = ['sans', 'serif', 'mono'];
const FONT_LABELS = { sans: '고딕', serif: '명조', mono: '모노' };
const FONT_CSS    = { sans: 'inherit', serif: 'Georgia, serif', mono: "'Courier New', monospace" };

const TONE_OPTIONS = [
  { value: 'professional', label: '전문적·신뢰감', icon: '🏢' },
  { value: 'friendly',     label: '친근한·편안한', icon: '😊' },
  { value: 'emotional',    label: '감성적·공감',   icon: '💜' },
  { value: 'humorous',     label: '유머러스·재밌는', icon: '😄' },
  { value: 'luxury',       label: '고급스러운',     icon: '👑' },
  { value: 'bold',         label: '강렬한·임팩트', icon: '🔥' },
];
const LAYOUT_OPTIONS = [
  { value: 'minimal',  label: '미니멀',      desc: '여백 중심' },
  { value: 'graphic',  label: '화려한',      desc: '그래픽 풍부' },
  { value: 'typo',     label: '타이포그래피', desc: '텍스트 중심' },
  { value: 'info',     label: '인포그래픽',  desc: '정보 시각화' },
  { value: 'balanced', label: '균형잡힌',    desc: '이미지+텍스트' },
];
const COLOR_OPTIONS = [
  { value: 'pastel', label: '파스텔',      desc: '부드러운' },
  { value: 'vivid',  label: '비비드',      desc: '선명한' },
  { value: 'mono',   label: '모노톤',      desc: '흑백' },
  { value: 'dark',   label: '다크',        desc: '고급스러운' },
  { value: 'brand',  label: '브랜드 컬러', desc: '그대로 사용' },
];
const TARGET_OPTIONS = [
  { value: 'teen',   label: '10-20대',  icon: '🧑' },
  { value: 'worker', label: '직장인',    icon: '💼' },
  { value: 'parent', label: '30-40대',  icon: '👨‍👩‍👧' },
  { value: 'mz',     label: 'MZ세대',   icon: '📱' },
  { value: 'all',    label: '전 연령',  icon: '🌍' },
];
const PURPOSE_OPTIONS = [
  { value: 'promo',    label: '제품 홍보',   icon: '🛍️' },
  { value: 'event',    label: '이벤트 안내', icon: '🎉' },
  { value: 'info',     label: '정보 제공',   icon: '💡' },
  { value: 'branding', label: '브랜딩',      icon: '✨' },
  { value: 'review',   label: '고객 후기',   icon: '⭐' },
];

function loadSaved() {
  try { return JSON.parse(localStorage.getItem(TEMPLATE_KEY)) || {}; } catch { return {}; }
}
function loadIg() {
  try { return JSON.parse(localStorage.getItem(IG_KEY)) || { accountId: '', accessToken: '', pageId: '', autoPost: false }; }
  catch { return { accountId: '', accessToken: '', pageId: '', autoPost: false }; }
}

// ── 옵션 칩 ──
function OptionChips({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button key={opt.value} type="button"
          onClick={() => onChange(value === opt.value ? '' : opt.value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
            ${value === opt.value ? 'border-pink-400 bg-pink-50 text-pink-700 shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}
        >
          {opt.icon && <span className="text-sm leading-none">{opt.icon}</span>}
          <span>{opt.label}</span>
          {opt.desc && <span className="text-gray-400 font-normal hidden sm:inline"> · {opt.desc}</span>}
        </button>
      ))}
    </div>
  );
}

// ── 섹션 헤더 ──
function SectionHeader({ num, title, desc }) {
  return (
    <div className="flex items-start gap-3 mb-3">
      <span className="w-5 h-5 rounded-full bg-pink-100 text-pink-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{num}</span>
      <div>
        <h4 className="text-sm font-bold text-gray-800">{title}</h4>
        {desc && <p className="text-[11px] text-gray-400 mt-0.5">{desc}</p>}
      </div>
    </div>
  );
}

// ── 에디터 폰트 목록 ──
const EDITOR_FONTS = [
  { value: '',                                        label: '기본 (브랜드)' },
  { value: 'system-ui, -apple-system, sans-serif',   label: '고딕 (Sans)' },
  { value: 'Georgia, serif',                          label: '명조 (Serif)' },
  { value: "'Courier New', monospace",                label: '모노 (Mono)' },
  { value: 'Impact, "Arial Narrow", sans-serif',      label: '임팩트 (Impact)' },
  { value: "'Arial Black', Gadget, sans-serif",       label: '굵은 고딕' },
];

const DEF_HL = { fontSize: 20, fontWeight: 'bold',   fontStyle: 'normal', textDecoration: 'none', color: null, fontFamily: '', textAlign: 'center' };
const DEF_BD = { fontSize: 13, fontWeight: 'normal', fontStyle: 'normal', textDecoration: 'none', color: null, fontFamily: '', textAlign: 'center' };

// ── 슬라이드 전체 편집 모달 ──
function SlideEditorModal({ slides, brand, initialIdx, onClose, onUpdateSlide }) {
  const initSlide = (s) => ({
    ...s,
    headlineStyle: s.headlineStyle ? { ...DEF_HL, ...s.headlineStyle } : { ...DEF_HL },
    bodyStyle:     s.bodyStyle     ? { ...DEF_BD, ...s.bodyStyle }     : { ...DEF_BD },
    bgImage: s.bgImage || null,
  });

  const [idx,   setIdx]  = useState(initialIdx);
  const [slide, setSlide] = useState(() => initSlide(slides[initialIdx]));
  const [activeField, setActiveField] = useState('headline');

  const curStyle    = activeField === 'headline' ? slide.headlineStyle : slide.bodyStyle;
  const styleKey    = activeField === 'headline' ? 'headlineStyle' : 'bodyStyle';
  const setStyle    = (updates) => setSlide(p => ({ ...p, [styleKey]: { ...p[styleKey], ...updates } }));

  const getSlideFont = (style) => style.fontFamily || FONT_CSS[brand.font || 'sans'];

  const getBg = (s) => {
    if (s.bgImage) return { backgroundImage: `url(${s.bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    if (s.bgStyle === 'light')  return { background: `${brand.color1}18` };
    if (s.bgStyle === 'solid')  return { background: brand.color1 };
    return { background: `linear-gradient(135deg, ${brand.color1} 0%, ${brand.color2} 100%)` };
  };
  const tc = (!slide.bgImage && slide.bgStyle === 'light') ? brand.color1 : '#ffffff';

  const saveAndNav = (nextIdx) => {
    onUpdateSlide(idx, slide);
    if (nextIdx !== null && nextIdx !== idx) {
      setIdx(nextIdx);
      setSlide(initSlide(slides[nextIdx]));
      setActiveField('headline');
    }
  };
  const handleClose = () => { onUpdateSlide(idx, slide); onClose(); };

  const handleBgImage = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setSlide(p => ({ ...p, bgImage: ev.target.result }));
    reader.readAsDataURL(file); e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-start justify-center overflow-y-auto py-4 px-3"
      onClick={handleClose}>
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl overflow-hidden shadow-2xl my-auto"
        onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">슬라이드 {idx + 1} 편집</span>
            <span className="text-[11px] text-white/40">/ {slides.length}장</span>
          </div>
          <button onClick={handleClose}
            className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* ── 슬라이드 미리보기 ── */}
        <div className="relative w-full" style={{ aspectRatio: '1/1', ...getBg(slide), fontFamily: getSlideFont(slide.headlineStyle) }}>
          {slide.bgImage && <div className="absolute inset-0 bg-black/25 z-0" />}
          {slide.emoji && <span className="absolute top-3 left-4 text-3xl leading-none z-10">{slide.emoji}</span>}
          <span className="absolute top-3 right-4 text-[10px] font-bold opacity-40 z-10" style={{ color: tc }}>{idx + 1}/{slides.length}</span>
          <div className="absolute bottom-2 left-3 text-[9px] font-bold uppercase opacity-30 z-10" style={{ color: tc }}>
            {slide.type === 'cover' ? 'COVER' : slide.type === 'closing' ? 'END' : ''}
          </div>
          <div className={`absolute inset-0 z-10 flex flex-col justify-center px-5 py-10 gap-2
            ${slide.layout === 'left' ? 'items-start' : 'items-center'}`}>
            <textarea rows={2}
              value={slide.headline}
              onChange={e => setSlide(p => ({ ...p, headline: e.target.value }))}
              onFocus={() => setActiveField('headline')}
              className="w-full bg-transparent resize-none outline-none leading-snug placeholder:opacity-40 transition-all"
              style={{
                color: slide.headlineStyle.color || tc,
                fontSize: `${slide.headlineStyle.fontSize}px`,
                fontWeight: slide.headlineStyle.fontWeight,
                fontStyle: slide.headlineStyle.fontStyle,
                textDecoration: slide.headlineStyle.textDecoration,
                fontFamily: getSlideFont(slide.headlineStyle),
                textAlign: slide.headlineStyle.textAlign,
                borderBottom: activeField === 'headline' ? '1px dashed rgba(255,255,255,0.5)' : '1px dashed transparent',
              }}
              placeholder="제목"
            />
            <textarea rows={3}
              value={slide.body || ''}
              onChange={e => setSlide(p => ({ ...p, body: e.target.value }))}
              onFocus={() => setActiveField('body')}
              className="w-full bg-transparent resize-none outline-none leading-relaxed placeholder:opacity-30 transition-all"
              style={{
                color: slide.bodyStyle.color || tc,
                fontSize: `${slide.bodyStyle.fontSize}px`,
                fontWeight: slide.bodyStyle.fontWeight,
                fontStyle: slide.bodyStyle.fontStyle,
                textDecoration: slide.bodyStyle.textDecoration,
                fontFamily: getSlideFont(slide.bodyStyle),
                textAlign: slide.bodyStyle.textAlign,
                borderBottom: activeField === 'body' ? '1px dashed rgba(255,255,255,0.4)' : '1px dashed transparent',
              }}
              placeholder={slide.type === 'content' ? '본문' : ''}
            />
          </div>
        </div>

        {/* ── 텍스트 툴바 ── */}
        <div className="bg-gray-800 border-t border-white/10 px-4 py-3 space-y-3">
          {/* 제목/본문 탭 */}
          <div className="flex gap-1">
            {[['headline','제목'], ['body','본문']].map(([f, l]) => (
              <button key={f} onClick={() => setActiveField(f)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${activeField === f ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/60'}`}>
                {l}
              </button>
            ))}
          </div>

          {/* 폰트 + 크기 */}
          <div className="flex items-center gap-2">
            <select value={curStyle.fontFamily}
              onChange={e => setStyle({ fontFamily: e.target.value })}
              className="flex-1 min-w-0 px-2 py-1.5 text-xs bg-gray-700 text-white border border-white/10 rounded-lg outline-none">
              {EDITOR_FONTS.map(f => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button onClick={() => setStyle({ fontSize: Math.max(8, curStyle.fontSize - 1) })}
                className="w-7 h-7 rounded-md bg-gray-700 hover:bg-gray-600 text-white text-base flex items-center justify-center transition-colors">−</button>
              <span className="w-8 text-center text-xs font-mono text-white tabular-nums">{curStyle.fontSize}</span>
              <button onClick={() => setStyle({ fontSize: Math.min(72, curStyle.fontSize + 1) })}
                className="w-7 h-7 rounded-md bg-gray-700 hover:bg-gray-600 text-white text-base flex items-center justify-center transition-colors">+</button>
            </div>
          </div>

          {/* B / I / U + 색상 + 정렬 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Bold */}
            <button onClick={() => setStyle({ fontWeight: curStyle.fontWeight === 'bold' ? 'normal' : 'bold' })}
              className={`w-8 h-8 rounded-lg text-sm font-black transition-all ${curStyle.fontWeight === 'bold' ? 'bg-white text-gray-900' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>B</button>
            {/* Italic */}
            <button onClick={() => setStyle({ fontStyle: curStyle.fontStyle === 'italic' ? 'normal' : 'italic' })}
              className={`w-8 h-8 rounded-lg text-sm italic font-bold transition-all ${curStyle.fontStyle === 'italic' ? 'bg-white text-gray-900' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>I</button>
            {/* Underline */}
            <button onClick={() => setStyle({ textDecoration: curStyle.textDecoration === 'underline' ? 'none' : 'underline' })}
              className={`w-8 h-8 rounded-lg text-sm underline font-bold transition-all ${curStyle.textDecoration === 'underline' ? 'bg-white text-gray-900' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>U</button>
            {/* Strikethrough */}
            <button onClick={() => setStyle({ textDecoration: curStyle.textDecoration === 'line-through' ? 'none' : 'line-through' })}
              className={`w-8 h-8 rounded-lg text-sm line-through font-bold transition-all ${curStyle.textDecoration === 'line-through' ? 'bg-white text-gray-900' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>S</button>

            <div className="w-px h-6 bg-white/15 mx-0.5" />

            {/* 글자색 */}
            <label className="relative w-8 h-8 rounded-lg overflow-hidden cursor-pointer flex-shrink-0 bg-gray-700 hover:bg-gray-600 transition-colors" title="글자 색상">
              <span className="absolute inset-0 flex items-center justify-center text-sm font-black" style={{ color: curStyle.color || tc, textShadow: '0 0 4px rgba(0,0,0,0.9)' }}>A</span>
              <div className="absolute bottom-0 left-0 right-0 h-1.5 rounded-b-lg" style={{ background: curStyle.color || tc }} />
              <input type="color" className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                value={curStyle.color || tc} onChange={e => setStyle({ color: e.target.value })} />
            </label>

            {/* 글자색 리셋 */}
            {curStyle.color && (
              <button onClick={() => setStyle({ color: null })}
                className="w-8 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 text-white/60 text-[10px] transition-colors flex items-center justify-center" title="색상 초기화">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
              </button>
            )}

            <div className="w-px h-6 bg-white/15 mx-0.5" />

            {/* 정렬 */}
            {[
              { val: 'left',   d: 'M3 6h18M3 12h12M3 18h15' },
              { val: 'center', d: 'M3 6h18M6 12h12M4 18h16' },
              { val: 'right',  d: 'M3 6h18M9 12h12M6 18h15' },
            ].map(a => (
              <button key={a.val} onClick={() => setStyle({ textAlign: a.val })}
                className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${curStyle.textAlign === a.val ? 'bg-white text-gray-900' : 'bg-gray-700 text-white hover:bg-gray-600'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d={a.d}/></svg>
              </button>
            ))}
          </div>
        </div>

        {/* ── 배경 패널 ── */}
        <div className="bg-gray-800 border-t border-white/10 px-4 py-3">
          <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">배경</p>
          <div className="flex items-center flex-wrap gap-2">
            {[{ k: 'gradient', l: '그라디언트' }, { k: 'solid', l: '단색' }, { k: 'light', l: '라이트' }].map(s => (
              <button key={s.k}
                onClick={() => setSlide(p => ({ ...p, bgStyle: s.k, bgImage: null }))}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all
                  ${slide.bgStyle === s.k && !slide.bgImage ? 'border-white/60 bg-white/20 text-white' : 'border-white/15 text-white/50 hover:border-white/35 hover:text-white/80'}`}>
                {s.l}
              </button>
            ))}
            <div className="w-px h-5 bg-white/15" />
            {/* 배경 이미지 추가 */}
            <label className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border cursor-pointer transition-all
              ${slide.bgImage ? 'border-pink-400/70 bg-pink-500/20 text-pink-300' : 'border-white/15 text-white/50 hover:border-white/35 hover:text-white/80'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
              </svg>
              {slide.bgImage ? '이미지 변경' : '배경 이미지'}
              <input type="file" accept="image/*" className="hidden" onChange={handleBgImage} />
            </label>
            {slide.bgImage && (
              <button onClick={() => setSlide(p => ({ ...p, bgImage: null }))}
                className="px-2.5 py-1 text-xs text-red-400/80 hover:text-red-300 border border-red-400/20 hover:border-red-400/50 rounded-lg transition-all">
                이미지 제거
              </button>
            )}
          </div>
        </div>

        {/* ── 이모지 + 레이아웃 ── */}
        <div className="bg-gray-800 border-t border-white/10 px-4 py-3 flex items-end gap-4">
          <div className="flex-shrink-0">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">이모지</p>
            <input type="text" className="w-14 px-2 py-1.5 bg-gray-700 border border-white/10 rounded-lg text-white text-lg outline-none text-center"
              value={slide.emoji || ''} onChange={e => setSlide(p => ({ ...p, emoji: e.target.value }))}
              placeholder="🌟" maxLength={2} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">레이아웃</p>
            <div className="flex gap-1.5">
              {[{ k: 'center', l: '가운데' }, { k: 'left', l: '왼쪽' }].map(({ k, l }) => (
                <button key={k} onClick={() => setSlide(p => ({ ...p, layout: k }))}
                  className={`px-2.5 py-1 text-xs rounded-lg border transition-all
                    ${slide.layout === k ? 'border-white/60 bg-white/20 text-white' : 'border-white/15 text-white/50 hover:border-white/35'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">타입</p>
            <div className="flex gap-1.5">
              {[{ k: 'cover', l: 'COVER' }, { k: 'content', l: '내용' }, { k: 'closing', l: 'END' }].map(({ k, l }) => (
                <button key={k} onClick={() => setSlide(p => ({ ...p, type: k }))}
                  className={`px-2 py-1 text-[10px] rounded-lg border transition-all
                    ${slide.type === k ? 'border-white/60 bg-white/20 text-white' : 'border-white/15 text-white/40 hover:border-white/30'}`}>
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── 네비게이션 + 저장 ── */}
        <div className="bg-gray-900 border-t border-white/10 px-4 py-3">
          <div className="flex items-center gap-2 mb-2.5">
            <button onClick={() => idx > 0 && saveAndNav(idx - 1)} disabled={idx === 0}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold disabled:opacity-25 transition-all flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <div className="flex gap-1.5 justify-center flex-1">
              {slides.map((_, i) => (
                <button key={i} onClick={() => saveAndNav(i)}
                  className={`rounded-full transition-all ${i === idx ? 'w-5 h-2 bg-white' : 'w-2 h-2 bg-white/25 hover:bg-white/50'}`} />
              ))}
            </div>
            <button onClick={() => idx < slides.length - 1 && saveAndNav(idx + 1)} disabled={idx === slides.length - 1}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold disabled:opacity-25 transition-all flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>
          <button onClick={handleClose}
            className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            저장 및 닫기
          </button>
        </div>

      </div>
    </div>
  );
}

// ── 슬라이드 카드 ──
function SlidePreview({ slide, brand, index, total, isSelected, onClick, onEditHeadline, onEditBody }) {
  const [editingField, setEditingField] = useState(null);
  const [editVal, setEditVal] = useState('');

  const startEdit = (field, val, e) => { e.stopPropagation(); setEditingField(field); setEditVal(val); };
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
    <div onClick={onClick}
      style={{ ...bgStyle, aspectRatio: '1/1', fontFamily: FONT_CSS[brand.font || 'sans'] }}
      className={`relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 select-none
        ${isSelected ? 'ring-2 ring-pink-500 ring-offset-2 shadow-xl' : 'hover:shadow-lg hover:scale-[1.01]'}`}
    >
      <span className="absolute top-2 right-2.5 text-[9px] font-bold opacity-40" style={{ color: tc }}>{index + 1}/{total}</span>
      {slide.emoji && <span className="absolute top-2 left-2.5 text-lg leading-none">{slide.emoji}</span>}
      <div className={`absolute inset-0 flex flex-col justify-center px-3 py-7 ${slide.layout === 'left' ? 'items-start text-left' : 'items-center text-center'}`}>
        {editingField === 'headline' ? (
          <textarea autoFocus rows={2} className="w-full bg-white/20 rounded px-2 py-1 text-xs font-bold resize-none outline-none text-center" style={{ color: tc }}
            value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onClick={e => e.stopPropagation()} />
        ) : (
          <p title="클릭하여 수정" className="text-xs font-bold leading-tight mb-1 cursor-text hover:opacity-75 transition-opacity" style={{ color: tc }}
            onClick={e => startEdit('headline', slide.headline, e)}>{slide.headline}</p>
        )}
        {slide.body && (editingField === 'body' ? (
          <textarea autoFocus rows={3} className="w-full bg-white/20 rounded px-2 py-1 text-[10px] resize-none outline-none text-center" style={{ color: tc }}
            value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={commitEdit} onClick={e => e.stopPropagation()} />
        ) : (
          <p title="클릭하여 수정" className="text-[10px] leading-relaxed opacity-85 cursor-text hover:opacity-65 transition-opacity" style={{ color: tc }}
            onClick={e => startEdit('body', slide.body, e)}>{slide.body}</p>
        ))}
      </div>
      <div className="absolute bottom-1.5 left-2.5 text-[8px] font-bold uppercase opacity-30" style={{ color: tc }}>
        {slide.type === 'cover' ? 'COVER' : slide.type === 'closing' ? 'END' : ''}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──
export default function CardNewsTab() {
  const saved = loadSaved();

  // 브랜드 / 스타일
  const [brandName,   setBrandName]   = useState(saved.brandName   || '');
  const [color1,      setColor1]      = useState(saved.color1      || '#7c3aed');
  const [color2,      setColor2]      = useState(saved.color2      || '#4f46e5');
  const [font,        setFont]        = useState(saved.font        || 'sans');
  const [tone,        setTone]        = useState(saved.tone        || '');
  const [layoutStyle, setLayoutStyle] = useState(saved.layoutStyle || '');
  const [colorScheme, setColorScheme] = useState(saved.colorScheme || '');
  const [target,      setTarget]      = useState(saved.target      || '');
  const [purpose,     setPurpose]     = useState(saved.purpose     || '');
  const [slideCount,  setSlideCount]  = useState(saved.slideCount  || 5);

  // 참고 이미지
  const [refImages, setRefImages] = useState(saved.refImages || []);

  // 인스타그램 API
  const [igConfig, setIgConfig] = useState(loadIg());

  // 템플릿 미리보기
  const [templateSlides,  setTemplateSlides]  = useState(saved.templateSlides || []);
  const [isGenTemplate,   setIsGenTemplate]   = useState(false);
  const [modalIdx,        setModalIdx]        = useState(null); // 확대 모달 슬라이드 인덱스

  // 카드뉴스 생성
  const [topic,       setTopic]       = useState('');
  const [step,        setStep]        = useState('setup');
  const [slides,      setSlides]      = useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [genError,    setGenError]    = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const brand = { name: brandName || '브랜드', color1, color2, font };

  // ── 참고 이미지 업로드 ──
  const handleRefUpload = (e) => {
    const files = Array.from(e.target.files);
    const remaining = 6 - refImages.length;
    files.slice(0, remaining).forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => setRefImages(p => [...p, ev.target.result]);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // ── 템플릿 생성 ──
  const generateTemplate = async () => {
    setIsGenTemplate(true);
    setGenError('');
    const label = (arr, v) => arr.find(o => o.value === v)?.label || v;
    const prompt = `너는 인스타그램 카드뉴스 전문 디자이너야.
아래 설정으로 카드뉴스 디자인 템플릿을 설계해줘.

브랜드: ${brandName || '브랜드'}
톤/분위기: ${label(TONE_OPTIONS, tone)}
레이아웃: ${label(LAYOUT_OPTIONS, layoutStyle)}
색감: ${label(COLOR_OPTIONS, colorScheme)}
타겟: ${label(TARGET_OPTIONS, target)}
목적: ${label(PURPOSE_OPTIONS, purpose)}
${refImages.length > 0 ? `참고 이미지 ${refImages.length}장 첨부 (스타일 참고)` : ''}

응답 형식 (JSON만, 다른 텍스트 없이):
{
  "color1": "#주색상hex",
  "color2": "#보조색상hex",
  "font": "sans|serif|mono",
  "slides": [
    {"type":"cover","headline":"커버 예시 제목","emoji":"🌟","layout":"center","bgStyle":"gradient"},
    {"type":"content","headline":"내용 예시 제목","body":"본문 예시 텍스트입니다.","emoji":"💡","layout":"center","bgStyle":"gradient"},
    {"type":"content","headline":"두 번째 내용","body":"추가 내용 예시입니다.","emoji":"✨","layout":"center","bgStyle":"light"},
    {"type":"closing","headline":"마무리 문구","emoji":"👏","layout":"center","bgStyle":"solid"}
  ]
}`;
    try {
      const raw = await callGemini([{ role: 'user', content: prompt }], '카드뉴스 디자인 전문가. JSON만 반환.');
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('응답 파싱 실패');
      const parsed = JSON.parse(match[0]);
      if (parsed.color1) setColor1(parsed.color1);
      if (parsed.color2) setColor2(parsed.color2);
      if (parsed.font)   setFont(parsed.font);
      if (parsed.slides?.length) {
        setTemplateSlides(parsed.slides.map((s, i) => ({ ...s, id: i + 1, total: parsed.slides.length })));
      }
    } catch (e) {
      setGenError('템플릿 생성 실패: ' + e.message);
    } finally {
      setIsGenTemplate(false);
    }
  };

  // ── 카드뉴스 생성 ──
  const generateSlides = async () => {
    if (!topic.trim()) return;
    setStep('generating');
    setGenError('');
    const label = (arr, v) => arr.find(o => o.value === v)?.label || '';
    const prompt = `너는 인스타그램 카드뉴스 전문 기획자야.
아래 정보로 카드뉴스 슬라이드 ${slideCount}장 구성을 JSON 배열로만 반환해줘.

브랜드명: ${brandName || '브랜드'}
브랜드 컬러: ${color1}
톤/분위기: ${label(TONE_OPTIONS, tone)}
타겟: ${label(TARGET_OPTIONS, target)}
목적: ${label(PURPOSE_OPTIONS, purpose)}
주제: ${topic}

각 슬라이드 형식:
{"type":"cover"|"content"|"closing","headline":"짧고 강렬한 제목(15자이내)","body":"본문(content 슬라이드만,40자이내)","emoji":"관련이모지1개","layout":"center"|"left","bgStyle":"gradient"|"solid"|"light"}

첫 장은 cover, 마지막 장은 closing, 나머지는 content. body는 content 슬라이드에만 포함.
JSON 배열만 반환. 다른 텍스트 없이.`;
    try {
      const raw = await callGemini([{ role: 'user', content: prompt }], '카드뉴스 슬라이드 기획 전문가. JSON 배열만 반환.');
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('응답 파싱 실패');
      const parsed = JSON.parse(match[0]);
      setSlides(parsed.slice(0, slideCount).map((s, i) => ({ ...s, id: i + 1, total: Math.min(parsed.length, slideCount) })));
      setSelectedIdx(0);
      setStep('editor');
    } catch (e) {
      setGenError('생성 실패: ' + e.message);
      setStep('setup');
    }
  };

  const updateSlide = (idx, field, value) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  // ── 전체 저장 ──
  const saveAll = () => {
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify({
      brandName, color1, color2, font, tone, layoutStyle, colorScheme, target, purpose,
      slideCount, refImages, templateSlides, savedAt: new Date().toISOString(),
    }));
    localStorage.setItem(IG_KEY, JSON.stringify(igConfig));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  // ══ 생성 중 ══
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

  // ══ 에디터 ══
  if (step === 'editor') {
    const slide = slides[selectedIdx];
    if (!slide) return null;
    return (
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full shadow-sm flex-shrink-0" style={{ background: `linear-gradient(135deg, ${brand.color1}, ${brand.color2})` }} />
            <span className="text-sm font-bold text-gray-700">{brand.name}</span>
            <span className="text-xs text-gray-400">· {slides.length}장</span>
          </div>
          <button onClick={() => { setStep('setup'); setSlides([]); }}
            className="text-xs font-semibold text-gray-400 hover:text-pink-600 transition-colors flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m15 18-6-6 6-6"/></svg>
            다시 만들기
          </button>
        </div>
        <div className="grid grid-cols-[1fr,190px] gap-4">
          <div>
            <p className="text-[11px] text-gray-400 mb-2.5 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              텍스트를 클릭하면 바로 수정 가능합니다
            </p>
            <div className={`grid gap-2.5 ${slides.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {slides.map((s, i) => (
                <SlidePreview key={s.id} slide={s} brand={brand} index={i} total={slides.length}
                  isSelected={selectedIdx === i} onClick={() => setSelectedIdx(i)}
                  onEditHeadline={val => updateSlide(i, 'headline', val)}
                  onEditBody={val => updateSlide(i, 'body', val)} />
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">슬라이드 {selectedIdx + 1} 배경</p>
              <div className="space-y-1.5">
                {[{ key: 'gradient', label: '그라디언트' }, { key: 'solid', label: '단색' }, { key: 'light', label: '라이트' }].map(s => (
                  <button key={s.key} onClick={() => updateSlide(selectedIdx, 'bgStyle', s.key)}
                    className={`w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all text-left
                      ${slide.bgStyle === s.key ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">정렬</p>
              <div className="flex gap-1.5">
                {[{ k: 'center', l: '가운데' }, { k: 'left', l: '왼쪽' }].map(({ k, l }) => (
                  <button key={k} onClick={() => updateSlide(selectedIdx, 'layout', k)}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-all
                      ${slide.layout === k ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">전체 일괄 적용</p>
              <div className="space-y-1.5">
                {[{ key: 'gradient', label: '전체 그라디언트' }, { key: 'light', label: '전체 라이트' }].map(s => (
                  <button key={s.key} onClick={() => setSlides(prev => prev.map(sl => ({ ...sl, bgStyle: s.key })))}
                    className="w-full px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:border-pink-300 hover:bg-pink-50 hover:text-pink-700 transition-all text-left">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ══ 설정 (setup) ══
  return (
    <div className="p-6 space-y-7">

      {/* ── 1. 템플릿 미리보기 ── */}
      <div>
        <SectionHeader num="1" title="템플릿 미리보기" desc="스타일 설정 후 '템플릿 생성하기'를 누르면 미리보기가 업데이트됩니다" />
        {templateSlides.length > 0 ? (
          <>
            <p className="text-[11px] text-gray-400 mb-2 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              슬라이드를 클릭하면 크게 보고 수정할 수 있습니다
            </p>
            <div className="flex gap-2.5 overflow-x-auto pb-2 -mx-1 px-1">
              {templateSlides.map((s, i) => (
                <div key={i} className="flex-shrink-0 group relative cursor-pointer" style={{ width: '96px' }}
                  onClick={() => setModalIdx(i)}>
                  <SlidePreview slide={s} brand={brand} index={i} total={templateSlides.length}
                    isSelected={false} onClick={() => {}} onEditHeadline={() => {}} onEditBody={() => {}} />
                  {/* 호버 오버레이 */}
                  <div className="absolute inset-0 rounded-xl bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="h-28 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 bg-gray-50">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-300">
              <rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/>
              <rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>
            </svg>
            <p className="text-xs text-gray-400">아직 생성된 템플릿이 없습니다</p>
          </div>
        )}
      </div>

      {/* ── 2. 스타일 설정 ── */}
      <div>
        <SectionHeader num="2" title="템플릿 스타일 설정" desc="원하는 카드뉴스 스타일을 선택하세요. 여러 항목을 조합할수록 더 정확한 결과를 얻을 수 있습니다" />
        <div className="space-y-4 bg-gray-50 border border-gray-100 rounded-2xl p-4">

          {/* 브랜드 기본 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">브랜드 기본</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input type="text" placeholder="브랜드명 입력"
                className="px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-pink-400 bg-white"
                value={brandName} onChange={e => setBrandName(e.target.value)} />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex-shrink-0 shadow-sm" style={{ background: `linear-gradient(135deg, ${color1}, ${color2})` }} />
                <input type="color" className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5 bg-white flex-shrink-0" value={color1} onChange={e => setColor1(e.target.value)} title="주색상" />
                <input type="color" className="w-8 h-8 rounded-lg cursor-pointer border border-gray-200 p-0.5 bg-white flex-shrink-0" value={color2} onChange={e => setColor2(e.target.value)} title="보조색상" />
                <div className="flex gap-1">
                  {FONTS.map(f => (
                    <button key={f} onClick={() => setFont(f)}
                      className={`px-2 py-1 text-xs rounded-lg border transition-all ${font === f ? 'border-pink-400 bg-pink-50 text-pink-700 font-semibold' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'}`}
                      style={{ fontFamily: FONT_CSS[f] }}>
                      {FONT_LABELS[f]}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 톤/분위기 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">톤 / 분위기</p>
            <OptionChips options={TONE_OPTIONS} value={tone} onChange={setTone} />
          </div>

          {/* 레이아웃 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">레이아웃 스타일</p>
            <OptionChips options={LAYOUT_OPTIONS} value={layoutStyle} onChange={setLayoutStyle} />
          </div>

          {/* 색감 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">색감 계열</p>
            <OptionChips options={COLOR_OPTIONS} value={colorScheme} onChange={setColorScheme} />
          </div>

          {/* 타겟 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">타겟 고객</p>
            <OptionChips options={TARGET_OPTIONS} value={target} onChange={setTarget} />
          </div>

          {/* 목적 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">콘텐츠 목적</p>
            <OptionChips options={PURPOSE_OPTIONS} value={purpose} onChange={setPurpose} />
          </div>

          {/* 슬라이드 수 */}
          <div>
            <p className="text-xs font-bold text-gray-600 mb-2">슬라이드 수</p>
            <div className="flex flex-wrap gap-2">
              {[3, 4, 5, 6, 7, 8, 10].map(n => (
                <button key={n} onClick={() => setSlideCount(n)}
                  className={`w-9 h-9 rounded-xl text-sm font-bold border-2 transition-all
                    ${slideCount === n ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-gray-200 text-gray-600 hover:border-gray-300 bg-white'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ── 템플릿 생성하기 버튼 ── */}
      <button onClick={generateTemplate} disabled={isGenTemplate}
        className="w-full py-3.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-purple-200 flex items-center justify-center gap-2">
        {isGenTemplate ? (
          <>
            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
            </svg>
            AI가 템플릿 디자인 중...
          </>
        ) : <>🎨 템플릿 생성하기</>}
      </button>

      {/* ── 3. 참고 레퍼런스 ── */}
      <div>
        <SectionHeader num="3" title="참고 레퍼런스" desc="원하는 디자인 스타일의 이미지를 업로드하면 AI가 참고하여 템플릿을 만들어드립니다 (최대 6장)" />
        {refImages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {refImages.map((src, idx) => (
              <div key={idx} className="relative group w-20 h-20 rounded-xl overflow-hidden border border-gray-200 shadow-sm flex-shrink-0">
                <img src={src} alt={`ref${idx}`} className="w-full h-full object-cover" />
                <button onClick={() => setRefImages(p => p.filter((_, i) => i !== idx))}
                  className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity leading-none">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {refImages.length < 6 && (
          <label className="flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 border-dashed border-gray-200 hover:border-pink-300 cursor-pointer transition-colors group bg-white">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400 group-hover:text-pink-500 transition-colors flex-shrink-0">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-600 group-hover:text-pink-600 transition-colors">이미지 업로드</p>
              <p className="text-xs text-gray-400">{refImages.length}/6장 · 여러 장 동시 선택 가능</p>
            </div>
            <input type="file" accept="image/*" multiple className="hidden" onChange={handleRefUpload} />
          </label>
        )}
      </div>

      {/* ── 4. 인스타그램 API ── */}
      <div>
        <SectionHeader num="4" title="인스타그램 자동 업로드" desc="생성된 카드뉴스를 인스타그램에 자동으로 게시하기 위한 API 설정입니다" />
        <div className="space-y-3 bg-gray-50 border border-gray-100 rounded-2xl p-4">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">인스타그램 비즈니스 계정 ID</label>
            <input type="text" placeholder="예: 17841400000000000"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-pink-400 bg-white font-mono"
              value={igConfig.accountId} onChange={e => setIgConfig(p => ({ ...p, accountId: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">액세스 토큰 (Access Token)</label>
            <input type="password" placeholder="EAAxxxxxxxxxxxxxxx..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-pink-400 bg-white font-mono"
              value={igConfig.accessToken} onChange={e => setIgConfig(p => ({ ...p, accessToken: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1.5">Facebook 페이지 ID <span className="font-normal text-gray-400">(선택)</span></label>
            <input type="text" placeholder="페이지 ID (필요한 경우 입력)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-pink-400 bg-white font-mono"
              value={igConfig.pageId || ''} onChange={e => setIgConfig(p => ({ ...p, pageId: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-pink-500"
              checked={igConfig.autoPost} onChange={e => setIgConfig(p => ({ ...p, autoPost: e.target.checked }))} />
            <span className="text-xs text-gray-700 font-medium">카드뉴스 생성 후 자동으로 인스타그램에 게시</span>
          </label>
          <p className="text-[11px] text-gray-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 leading-relaxed">
            🔒 API 키는 브라우저 로컬에만 저장되며, 외부 서버로 전송되지 않습니다.
          </p>
        </div>
      </div>

      {genError && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">{genError}</div>
      )}

      {/* ── 템플릿 슬라이드 편집 모달 ── */}
      {modalIdx !== null && templateSlides.length > 0 && (
        <SlideEditorModal
          slides={templateSlides}
          brand={brand}
          initialIdx={modalIdx}
          onClose={() => setModalIdx(null)}
          onUpdateSlide={(i, updated) =>
            setTemplateSlides(prev => prev.map((s, idx) => idx === i ? updated : s))
          }
        />
      )}

      {/* ── 저장 버튼 ── */}
      <button onClick={saveAll}
        className={`w-full py-3.5 text-sm font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2
          ${saveSuccess ? 'bg-emerald-500 text-white shadow-emerald-200' : 'bg-gray-900 hover:bg-gray-700 text-white shadow-gray-200'}`}>
        {saveSuccess ? '✓ 저장 완료!' : '💾 저장하기'}
      </button>

      {/* ── 카드뉴스 만들기 ── */}
      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-sm font-bold text-gray-800 mb-1">카드뉴스 만들기</h4>
        <p className="text-xs text-gray-400 mb-3">저장한 템플릿으로 카드뉴스를 바로 생성합니다</p>
        <textarea rows={3}
          className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl outline-none focus:border-pink-400 resize-none leading-relaxed"
          placeholder="예: 신제품 오로라 립밤 출시, 1+1 이벤트 진행 중"
          value={topic} onChange={e => setTopic(e.target.value.slice(0, 100))} />
        <p className="text-xs text-gray-400 text-right mt-1 mb-3">{topic.length}/100자</p>
        <button onClick={generateSlides} disabled={!topic.trim()}
          className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-pink-200">
          ✨ AI 카드뉴스 생성하기
        </button>
      </div>

    </div>
  );
}
