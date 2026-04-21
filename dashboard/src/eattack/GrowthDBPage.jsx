import { useState, useMemo, useEffect, useCallback } from "react";
import { loadCoupangCreds } from "../pages/AdminPage";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/* ─────────────────────────────────────────────
   쿠팡 상품DB API 호출 (서버리스 프록시)
───────────────────────────────────────────── */
async function fetchCoupangProducts(creds, params = {}) {
  const resp = await fetch('/api/coupang-products', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accessKey: creds.accessKey,
      secretKey: creds.secretKey,
      vendorId:  creds.vendorId,
      endpoint:  'seller-products',
      params,
    }),
  });
  const json = await resp.json();
  if (!resp.ok) {
    const msg = json?.message || json?.error || `HTTP ${resp.status}`;
    throw new Error(`${resp.status}: ${msg}`);
  }
  if (json.error) throw new Error(json.error);
  return json;
}

/* ─────────────────────────────────────────────
   쿠팡 응답 → GrowthDB 행 변환
   seller-products: 가격/옵션은 sellerProductItems[0] 안에 중첩
───────────────────────────────────────────── */
function normalizeProduct(item) {
  // seller-products API: 옵션 정보가 sellerProductItems 배열 안에 있음
  const si    = (item.sellerProductItems || [])[0] || {};
  const price = si.salePrice || si.originalPrice || item.salePrice || item.originalPrice || 0;
  const cost  = si.supplyPrice || item.supplyPrice || 0;
  const fee   = Math.round(price * 0.108);
  const margin = price - cost - fee;
  const mr     = price > 0 ? (margin / price * 100).toFixed(1) : '0.0';
  const roi    = cost > 0 ? (margin / cost * 100).toFixed(0) : '0';
  const roas   = cost > 0 ? (price / cost).toFixed(1) : '0';
  // 이미지: images 배열 또는 단일 imageUrl
  const imageUrl = (item.images || [])[0]?.cdnPath || si.imageUrl || item.imageUrl || '';

  return {
    isReal:   true,
    grade:    GRADES[0],
    name:     item.sellerProductName || item.productName || '상품명 없음',
    opt:      si.itemName || item.itemName || '',
    expId:    item.sellerProductId || item.productId || '-',
    optId:    si.vendorItemId || item.vendorItemId || '-',
    bc:       si.barcode || item.barcode || '-',
    imageUrl,
    stock:    0, // vendor-inventory API로 별도 업데이트
    price,
    fee,
    margin,
    mr,
    roi,
    roas,
    s7:    0,
    s30:   0,
    qty:   0,
    win:   0,
    mlk:   0,
    raw:   item,
  };
}

/* ─────────────────────────────────────────────
   샘플 데이터
───────────────────────────────────────────── */
const PRODUCT_NAMES = [
  '쿠팡 로켓 그로스 데님 자켓 (남성용) 2024 신상',
  'A급 프리미엄 무선 블루투스 이어폰 노이즈캔슬링',
  '유기농 녹차 추출물 세럼 50ml 민감성 피부용',
  '스테인레스 텀블러 500ml 보온보냉 12시간',
  '고탄력 필라테스 레깅스 여성 운동복 세트',
  '캠핑 접이식 테이블 알루미늄 경량 휴대용',
  '국내산 흑마늘 진액 80ml × 30포 선물세트',
  '아동용 LED 운동화 야광 사이즈 150-230',
  '프리미엄 양면 테이프 다용도 방수 투명 10M',
  '반려동물 자동 급식기 스마트 타이머 3L',
  '대용량 수납 정리함 뚜껑형 패브릭 박스 40L',
  '모공케어 토너 히알루론산 수분 300ml',
  '다용도 주방 가위 스테인레스 분리형 세척가능',
  '컴팩트 미니 선풍기 USB 충전식 휴대용',
  '프리미엄 원두커피 200g 싱글오리진 에티오피아',
  '멀티 충전기 C타입 60W 고속 4포트',
  '기능성 메모리폼 목베개 여행용 U자형',
  '친환경 대나무 도마 항균 대형 40x30cm',
  '어린이 빅사이즈 수영 튜브 자동충기 세트',
  '에어팟 케이스 호환 실리콘 키링 패션 아이템',
];
const OPTS   = ['블랙','화이트','네이비','그레이','핑크','베이지','레드'];
const GRADES = [
  { label:'골드',   cls:'bg-yellow-50 text-yellow-700 border border-yellow-300' },
  { label:'실버',   cls:'bg-slate-100 text-slate-600 border border-slate-300' },
  { label:'브론즈', cls:'bg-red-50 text-red-700 border border-red-200' },
];

function seededRand(seed, min, max) {
  const x = Math.sin(seed + 1) * 10000;
  return min + Math.floor((x - Math.floor(x)) * (max - min + 1));
}

function buildSampleRows() {
  return Array.from({ length: 20 }, (_, i) => {
    const r = (min, max) => seededRand(i * 37 + min, min, max);
    const grade  = GRADES[r(0, 2)];
    const price  = r(8900, 89000);
    const fee    = Math.round(price * 0.1);
    const margin = r(500, Math.floor(price * 0.35));
    return {
      isReal: false,
      grade,
      name:   PRODUCT_NAMES[i % PRODUCT_NAMES.length],
      opt:    OPTS[r(0, OPTS.length - 1)],
      expId:  r(10000000, 99999999),
      optId:  r(100000000, 999999999),
      bc:     `88${r(10000000, 99999999)}${r(100, 999)}`,
      imageUrl: '',
      stock:  r(0, 600),
      price, fee, margin,
      mr:   (margin / price * 100).toFixed(1),
      roi:  (margin / (price - margin) * 100).toFixed(0),
      roas: (price / fee * 100).toFixed(0),
      s7:   r(50000, 5000000),
      s30:  r(150000, 20000000),
      qty:  r(10, 500),
      win:  r(0, 1),
      mlk:  r(200, 1500),
    };
  });
}

const SAMPLE_ROWS = buildSampleRows();

const FILTER_TABS = [
  { key:'all',     label:'전체',        color:'#f97316' },
  { key:'expid',   label:'노출ID변경',   color:'#3b82f6' },
  { key:'match',   label:'타사매칭',     color:'#3b82f6' },
  { key:'loser',   label:'아이템루저',   color:'#f97316' },
  { key:'nobadge', label:'뱃지없음',     color:'#3b82f6' },
  { key:'return',  label:'반품',         color:'#ec4899' },
  { key:'bundle',  label:'번들',         color:'#3b82f6' },
  { key:'nopurch', label:'구매정보없음', color:'#ef4444' },
  { key:'noinput', label:'매입정보없음', color:'#3b82f6' },
];

const COLS = ['등급','이미지','상품명','노출ID','옵션ID','바코드','판매링크',
  '구매관리','매입관리','밀크런','아이템위너','사이즈','쿠팡재고',
  '판매가','수수료','마진','마진율','ROI','ROAS','7일매출','30일매출','판매량'];

/* ─────────────────────────────────────────────
   토글 스위치
───────────────────────────────────────────── */
function Toggle({ checked, onChange }) {
  return (
    <div onClick={() => onChange(!checked)} style={{ width:34, height:18, position:'relative', cursor:'pointer' }}>
      <div style={{
        width:34, height:18, borderRadius:9,
        background: checked ? '#f97316' : '#d1d5db', transition:'background .15s'
      }}>
        <div style={{
          width:14, height:14, borderRadius:'50%', background:'#fff',
          position:'absolute', top:2, left:2,
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          transition:'transform .15s', boxShadow:'0 1px 3px rgba(0,0,0,.2)'
        }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   내장 사이드바
───────────────────────────────────────────── */
function ChevronIcon({ open }) {
  return (
    <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"
      style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/>
    </svg>
  );
}

function EakuSidebar({ active = 'growthdb', onNavigate }) {
  const [open, setOpen] = useState({ rocket: true, sourcing: true, marketing: false, coupass: false, logistics: false, aitools: false });
  const tog = k => setOpen(p => ({ ...p, [k]: !p[k] }));
  const cat = (key, icon, label, children) => (
    <div className="mb-0.5">
      <div onClick={() => tog(key)} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer text-gray-700 hover:bg-gray-100 font-medium">
        <span className="text-base">{icon}</span>
        <span className="flex-1">{label}</span>
        <ChevronIcon open={open[key]} />
      </div>
      {open[key] && <div className="pl-2 mt-0.5 space-y-0.5">{children}</div>}
    </div>
  );
  const navItem = (key, icon, label) => {
    const isActive = active === key;
    return (
      <div key={key} onClick={() => onNavigate?.(key)}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors font-semibold"
        style={isActive ? { background: '#E0F7FA', color: '#00838F' } : { color: '#6b7280' }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#f3f4f6'; }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = ''; }}>
        <span className="text-base">{icon}</span><span style={isActive ? {} : { fontWeight: 400 }}>{label}</span>
      </div>
    );
  };
  const item = (icon, label, badge) => (
    <div key={label} className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer text-gray-400 hover:bg-gray-100">
      <span className="text-base">{icon}</span><span>{label}</span>
      {badge === 'new' && <span className="ml-auto text-xs px-1.5 py-0.5 rounded text-white font-medium" style={{ background: '#4CAF50' }}>new</span>}
      {badge === 'soon' && <span className="ml-auto text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">준비중</span>}
    </div>
  );
  return (
    <aside className="w-52 shrink-0 bg-white border-r border-gray-200 overflow-y-auto py-3">
      <div className="px-3 py-2">
        {cat('rocket', '🚀', '로켓그로스', <>
          {navItem('growthdb', '📊', '에쿠 GrowthDB')}
          {navItem('scm', '📦', '공급관리(SCM)')}
          {navItem('ledger', '📒', '판매장부')}
        </>)}
        {cat('sourcing', '🔍', '소싱분석', <>
          {item('🏷️', '카테고리소싱분석')}
          {item('🔑', '키워드소싱분석')}
          {item('📈', '상품경쟁력분석')}
          {item('📊', '키워드분석')}
        </>)}
        {cat('marketing', '📣', '마케팅', <>
          {item('📉', '쿠팡 랭킹추적')}
          {item('✏️', '상품명메이커')}
          {item('📢', '광고관리(소싱검증)')}
        </>)}
        {cat('coupass', '🛒', '쿠패스', <>
          {item('📋', '구매요청(그로스)')}
        </>)}
        {cat('logistics', '🚢', '해외물류', <>
          {item('📦', '배송대행현황')}
          {item('📄', '출고리스트')}
        </>)}
        {cat('aitools', '✨', 'AI 도구', <>
          {item('🪄', '나노바나나 이미지에디터')}
          {item('🐱', 'AI 소싱 챗', 'new')}
        </>)}
      </div>
    </aside>
  );
}

/* ─────────────────────────────────────────────
   실시간 순수익 탭
───────────────────────────────────────────── */
const COST_MAP_KEY = 'eden_coupang_cost_map';
function loadCostMap() {
  try { return JSON.parse(localStorage.getItem(COST_MAP_KEY)) || {}; } catch { return {}; }
}
function saveCostMap(map) {
  localStorage.setItem(COST_MAP_KEY, JSON.stringify(map));
}
function fmtNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return Math.round(n).toLocaleString('ko-KR');
}
function parseNum(v) {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

function ProfitBadge({ children, color = 'gray' }) {
  const cls = {
    green: 'bg-green-100 text-green-700',
    red:   'bg-red-100 text-red-600',
    amber: 'bg-amber-100 text-amber-700',
    gray:  'bg-gray-100 text-gray-600',
  }[color];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{children}</span>;
}

function RealtimeProfitTab({ creds, rows }) {
  const [costMap, setCostMap]       = useState(loadCostMap);
  const [editCostId, setEditCostId] = useState(null);
  const [editCostVal, setEditCostVal] = useState('');

  const hasKey = !!(creds.accessKey && creds.secretKey && creds.vendorId);

  const saveCost = (vid) => {
    const updated = { ...costMap, [vid]: parseNum(editCostVal) };
    setCostMap(updated);
    saveCostMap(updated);
    setEditCostId(null);
  };

  if (!hasKey) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <span className="text-4xl">🔑</span>
        <p className="text-sm font-semibold text-gray-700">쿠팡 API 키가 설정되지 않았습니다</p>
        <p className="text-xs text-gray-400">관리자 → 🛒 쿠팡 API 탭에서 API 키를 먼저 등록하세요</p>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <span className="text-3xl">📦</span>
        <p className="text-sm font-semibold text-gray-700">GrowthDB에서 상품을 먼저 수집하세요</p>
        <p className="text-xs text-gray-400">에쿠 GrowthDB → 상품DB 수집 버튼을 눌러주세요</p>
      </div>
    );
  }

  // 상품 데이터 기반 수익성 계산 (원가 입력 시 정확한 계산)
  const items = rows.map(row => {
    const vid       = String(row.optId);
    const costPrice = costMap[vid] ?? 0;
    const hasCost   = costPrice > 0;
    const qty       = row.qty || 0;
    const revenue   = row.price * qty;
    const commission = row.fee * qty;
    const unitProfit = hasCost ? (row.price - costPrice - row.fee) : (row.margin);
    const netProfit  = unitProfit * qty;
    const marginPct  = hasCost && row.price > 0
      ? parseFloat(((row.price - costPrice - row.fee) / row.price * 100).toFixed(1))
      : parseFloat(row.mr || 0);
    return {
      item_name:      row.name,
      vendor_item_id: vid,
      sell_price:     row.price,
      cost_price:     hasCost ? costPrice : 0,
      has_cost:       hasCost,
      qty,
      revenue,
      commission,
      net_profit:     netProfit,
      margin:         marginPct,
    };
  });

  const totalRevenue   = items.reduce((s, i) => s + i.revenue, 0);
  const profitItems    = items.filter(i => i.has_cost);
  const totalNetProfit = profitItems.reduce((s, i) => s + i.net_profit, 0);
  const totalMargin    = totalRevenue > 0
    ? parseFloat((profitItems.reduce((s,i) => s + i.net_profit, 0) / Math.max(profitItems.reduce((s,i) => s + i.revenue, 0), 1) * 100).toFixed(1))
    : 0;
  const totalQty         = items.reduce((s, i) => s + i.qty, 0);
  const missingCostCount = items.filter(i => !i.has_cost).length;
  const sortedItems      = [...items].sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-gray-800">📒 판매장부</h1>
          <p className="text-xs text-gray-400 mt-0.5">상품별 수익성 분석 · 원가 입력 시 정확한 마진 계산</p>
        </div>
        <ProfitBadge color="green">● {creds.vendorId} 연결됨</ProfitBadge>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: '총 매출 (추정)',  value: fmtNum(totalRevenue),   unit: '원', color: 'text-gray-800' },
          { label: '총 순수익',       value: fmtNum(totalNetProfit), unit: '원', color: totalNetProfit >= 0 ? 'text-orange-600' : 'text-red-500' },
          { label: '평균 마진율',     value: `${totalMargin}%`,      unit: '',   color: totalMargin >= 15 ? 'text-green-600' : totalMargin >= 0 ? 'text-amber-600' : 'text-red-500' },
          { label: '총 판매수량',     value: fmtNum(totalQty),       unit: '개', color: 'text-gray-800' },
        ].map((c, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className={`text-lg font-black tabular-nums ${c.color}`}>
              {c.value}<span className="text-xs font-normal ml-0.5">{c.unit}</span>
            </p>
          </div>
        ))}
      </div>

      {missingCostCount > 0 && (
        <div className="flex gap-2 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
          <span>⚠️</span>
          <p className="text-xs text-amber-700">
            <span className="font-bold">{missingCostCount}개 상품</span> 원가 미입력.
            아래 표에서 원가를 클릭해 입력하면 정확한 순수익이 계산됩니다.
          </p>
        </div>
      )}

      {/* 상품별 테이블 */}
      <div>
        <h4 className="text-sm font-bold text-gray-700 mb-3">상품별 수익성</h4>
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['상품명','판매가','원가','수량(30일)','매출','수수료','순수익','마진'].map(h => (
                  <th key={h} className={`py-2.5 px-3 text-gray-500 font-semibold whitespace-nowrap ${h === '상품명' ? 'text-left' : 'text-right'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item, i) => (
                <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                  <td className="px-3 py-2.5 text-gray-700 font-medium max-w-[200px] truncate" title={item.item_name}>{item.item_name}</td>
                  <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">₩{fmtNum(item.sell_price)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {editCostId === item.vendor_item_id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <input autoFocus type="number" value={editCostVal}
                          onChange={e => setEditCostVal(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveCost(item.vendor_item_id);
                            if (e.key === 'Escape') setEditCostId(null);
                          }}
                          className="w-20 px-2 py-1 border border-orange-400 rounded-lg text-right outline-none" />
                        <button onClick={() => saveCost(item.vendor_item_id)} className="text-orange-500 font-bold">✓</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditCostId(item.vendor_item_id); setEditCostVal(String(item.cost_price || '')); }}
                        className={`hover:text-orange-600 transition-colors ${item.has_cost ? 'text-gray-600' : 'text-amber-500 underline decoration-dashed'}`}>
                        {item.has_cost ? `₩${fmtNum(item.cost_price)}` : '입력 필요'}
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">
                    {item.qty > 0 ? fmtNum(item.qty) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">
                    {item.revenue > 0 ? `₩${fmtNum(item.revenue)}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right text-red-400 tabular-nums">
                    {item.commission > 0 ? `-₩${fmtNum(item.commission)}` : <span className="text-gray-300">—</span>}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${item.qty > 0 && item.has_cost ? (item.net_profit >= 0 ? 'text-orange-600' : 'text-red-500') : 'text-gray-300'}`}>
                    {item.qty > 0 && item.has_cost ? `₩${fmtNum(item.net_profit)}` : '—'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <ProfitBadge color={item.margin >= 15 ? 'green' : item.margin >= 0 ? 'amber' : 'red'}>
                      {item.margin}%
                    </ProfitBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">원가 셀 클릭 → 직접 입력 (브라우저에 자동 저장) · 수량은 에쿠 Extension 연동 시 자동 채워짐</p>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   메인 컴포넌트
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   공급관리(SCM) 페이지
───────────────────────────────────────────── */
const SCM_KEY = 'eden_scm_safety';
function loadSCMSafety() { try { return JSON.parse(localStorage.getItem(SCM_KEY)) || {}; } catch { return {}; } }
function saveSCMSafety(m) { localStorage.setItem(SCM_KEY, JSON.stringify(m)); }

function SCMPage({ rows, fmt }) {
  const [safety, setSafety]   = useState(loadSCMSafety);
  const [editId, setEditId]   = useState(null);
  const [editVal, setEditVal] = useState('');
  const [orderModal, setOrderModal] = useState(null); // { row, qty }
  const [orderQtyInput, setOrderQtyInput] = useState('');
  const [orders, setOrders]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('eden_scm_orders')) || []; } catch { return []; }
  });

  const saveSafety = (id, val) => {
    const n = Math.max(0, parseInt(val) || 0);
    const updated = { ...safety, [id]: n };
    setSafety(updated); saveSCMSafety(updated); setEditId(null);
  };

  const addOrder = () => {
    if (!orderModal) return;
    const qty = parseInt(orderQtyInput) || 0;
    if (qty <= 0) return;
    const newOrder = {
      id: Date.now(), productId: orderModal.optId, name: orderModal.name,
      qty, orderedAt: new Date().toISOString(), status: '발주완료',
    };
    const updated = [newOrder, ...orders];
    setOrders(updated);
    localStorage.setItem('eden_scm_orders', JSON.stringify(updated));
    setOrderModal(null); setOrderQtyInput('');
  };

  const scmRows = rows.map(r => {
    const safetyQty  = safety[r.optId] ?? 50;
    const dailyQty   = r.qty > 0 ? r.qty / 30 : 0;
    const daysLeft   = dailyQty > 0 ? Math.round(r.stock / dailyQty) : null;
    let status, statusBg, statusColor;
    if (r.stock < 10)              { status = '긴급';  statusBg = '#fef2f2'; statusColor = '#dc2626'; }
    else if (r.stock < safetyQty)  { status = '부족';  statusBg = '#fff7ed'; statusColor = '#ea580c'; }
    else if (r.stock < safetyQty * 2) { status = '주의'; statusBg = '#fffbeb'; statusColor = '#d97706'; }
    else                           { status = '충분';  statusBg = '#f0fdf4'; statusColor = '#16a34a'; }
    return { ...r, safetyQty, daysLeft, status, statusBg, statusColor };
  });

  const urgentCount  = scmRows.filter(r => r.status === '긴급' || r.status === '부족').length;
  const totalStock   = scmRows.reduce((s, r) => s + r.stock, 0);
  const totalValue   = scmRows.reduce((s, r) => s + r.stock * (r.price || 0), 0);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold text-gray-800 flex items-center gap-1.5">📦 공급관리(SCM)</h1>
          <p className="text-xs text-gray-400 mt-0.5">재고 현황 · 안전재고 설정 · 발주 관리</p>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="px-6 py-4 grid grid-cols-4 gap-3">
        {[
          { label: '총 상품', value: scmRows.length + '개', color: '#374151' },
          { label: '재고부족/긴급', value: urgentCount + '개', color: urgentCount > 0 ? '#dc2626' : '#16a34a' },
          { label: '총 재고 수량', value: fmt(totalStock) + '개', color: '#374151' },
          { label: '재고 자산 가치', value: '₩' + fmt(Math.round(totalValue)), color: '#00838F' },
        ].map((c, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400 mb-1">{c.label}</p>
            <p className="text-lg font-black tabular-nums" style={{ color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-hidden flex flex-col px-6 pb-4 gap-4">
        {/* 재고 현황 테이블 */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden flex-1">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-bold text-gray-700">재고 현황</span>
            <span className="text-xs text-gray-400">안전재고 셀 클릭 → 직접 수정 (자동 저장)</span>
          </div>
          <div className="overflow-auto flex-1">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 font-semibold text-[11px]"
                  style={{ position:'sticky', top:0, zIndex:10, background:'#fff7ed', borderBottom:'1px solid #fed7aa' }}>
                  <th className="px-3 py-2.5 text-left">상품명</th>
                  <th className="px-3 py-2.5 text-right">현재재고</th>
                  <th className="px-3 py-2.5 text-right">안전재고</th>
                  <th className="px-3 py-2.5 text-center">재고상태</th>
                  <th className="px-3 py-2.5 text-right">30일 판매수량</th>
                  <th className="px-3 py-2.5 text-right">예상소진일</th>
                  <th className="px-3 py-2.5 text-right">판매가</th>
                  <th className="px-3 py-2.5 text-center">발주</th>
                </tr>
              </thead>
              <tbody>
                {scmRows.map((row, i) => (
                  <tr key={i} className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        {row.imageUrl
                          ? <img src={row.imageUrl} alt="" className="w-7 h-7 rounded object-cover border border-gray-200 shrink-0"/>
                          : <div className="w-7 h-7 rounded border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-300 shrink-0 text-[10px]">🖼</div>}
                        <span className="truncate max-w-[180px] text-gray-800 font-medium" title={row.name}>{row.name}</span>
                      </div>
                    </td>
                    <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${row.stock < 10 ? 'text-red-600' : row.stock < row.safetyQty ? 'text-orange-600' : 'text-gray-700'}`}>
                      {fmt(row.stock)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {editId === row.optId ? (
                        <div className="flex items-center justify-end gap-1">
                          <input autoFocus type="number" value={editVal}
                            onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') saveSafety(row.optId, editVal); if (e.key === 'Escape') setEditId(null); }}
                            className="w-16 px-2 py-0.5 border border-orange-400 rounded text-right outline-none" />
                          <button onClick={() => saveSafety(row.optId, editVal)} className="text-orange-500 font-bold text-sm">✓</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditId(row.optId); setEditVal(String(row.safetyQty)); }}
                          className="text-gray-500 hover:text-orange-600 underline decoration-dashed transition-colors tabular-nums">
                          {fmt(row.safetyQty)}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: row.statusBg, color: row.statusColor }}>
                        {row.status}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">
                      {row.qty > 0 ? fmt(row.qty) + '개' : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {row.daysLeft !== null
                        ? <span className={row.daysLeft < 14 ? 'text-red-500 font-bold' : row.daysLeft < 30 ? 'text-orange-500' : 'text-gray-600'}>
                            {row.daysLeft}일
                          </span>
                        : <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">₩{fmt(row.price)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => { setOrderModal(row); setOrderQtyInput(''); }}
                        className="text-[11px] px-2.5 py-1 rounded text-white font-medium transition-opacity hover:opacity-80"
                        style={{ background: '#00BCD4' }}>
                        발주
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 발주 이력 */}
        {orders.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm shrink-0">
            <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">발주 이력</span>
              <button onClick={() => { setOrders([]); localStorage.removeItem('eden_scm_orders'); }}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors">초기화</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-500 text-[11px] border-b border-gray-100 bg-gray-50">
                    {['상품명','발주수량','발주일시','상태'].map(h => (
                      <th key={h} className={`px-4 py-2 font-semibold ${h==='상품명'?'text-left':'text-center'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orders.slice(0, 10).map(o => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 text-gray-700 font-medium truncate max-w-[220px]">{o.name}</td>
                      <td className="px-4 py-2 text-center font-bold text-gray-700">{fmt(o.qty)}개</td>
                      <td className="px-4 py-2 text-center text-gray-400">{new Date(o.orderedAt).toLocaleString('ko-KR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' })}</td>
                      <td className="px-4 py-2 text-center">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">{o.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* 발주 모달 */}
      {orderModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setOrderModal(null)}>
          <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-gray-800 mb-1">📦 발주하기</h3>
            <p className="text-xs text-gray-500 truncate mb-4">{orderModal.name}</p>
            <div className="mb-4">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>현재재고</span><span className="font-bold">{fmt(orderModal.stock)}개</span>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mb-3">
                <span>안전재고</span><span className="font-bold">{fmt(orderModal.safetyQty)}개</span>
              </div>
              <label className="text-xs text-gray-600 font-medium mb-1 block">발주 수량</label>
              <input autoFocus type="number" value={orderQtyInput} onChange={e => setOrderQtyInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addOrder()}
                placeholder="수량 입력"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-orange-400" />
            </div>
            <div className="flex gap-2">
              <button onClick={addOrder} className="flex-1 py-2 rounded-lg text-white text-sm font-bold" style={{ background:'#00BCD4' }}>발주 등록</button>
              <button onClick={() => setOrderModal(null)} className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm">취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   에쿠 Extension 판매 데이터 → s7 / s30 / qty 계산
   saleSummaryByDate: { "2026-04-20": { salesPrice, shippingPrice, quantity }, ... }
───────────────────────────────────────────── */
function calcSalesFromSummary(saleSummaryByDate) {
  if (!saleSummaryByDate || typeof saleSummaryByDate !== 'object') return { s7: 0, s30: 0, qty: 0 };
  const now   = new Date();
  let s7 = 0, s30 = 0, qty = 0;
  Object.entries(saleSummaryByDate).forEach(([dateStr, val]) => {
    const date     = new Date(dateStr);
    const diffDays = (now - date) / (1000 * 60 * 60 * 24);
    const revenue  = (val.salesPrice || 0) + (val.shippingPrice || 0);
    const q        = val.quantity || 0;
    if (diffDays <= 30) { s30 += revenue; qty += q; }
    if (diffDays <= 7)  { s7  += revenue; }
  });
  return { s7: Math.round(s7), s30: Math.round(s30), qty };
}

export default function GrowthDBPage() {
  const [activeSection, setActiveSection] = useState('growthdb'); // 'growthdb' | 'scm' | 'ledger'
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [showReturn, setShowReturn]     = useState(false);
  const [showBundle, setShowBundle]     = useState(false);
  const [page, setPage]                 = useState(1);

  const [creds]               = useState(() => loadCoupangCreds());
  const [rows, setRows]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [isReal, setIsReal]   = useState(false);

  // 에쿠 Extension 연동 상태
  const [extSynced, setExtSynced]         = useState(false);
  const [extSyncedAt, setExtSyncedAt]     = useState(null);
  const [rankingData, setRankingData]     = useState([]);

  const hasKey = !!(creds.accessKey && creds.secretKey && creds.vendorId);
  const fmt    = n => Number(n).toLocaleString();

  /* ── 에쿠 Extension postMessage 수신 ── */
  useEffect(() => {
    function handleExtMessage(e) {
      if (!e.data || e.data.source !== 'eku-extension') return;
      const { type, payload } = e.data;

      if (type === 'SALES_DATA' && payload?.vendorItemId && payload?.saleSummaryByDate) {
        const { s7, s30, qty } = calcSalesFromSummary(payload.saleSummaryByDate);
        const vid = String(payload.vendorItemId);
        setRows(prev => prev.map(row =>
          String(row.optId) === vid ? { ...row, s7, s30, qty } : row
        ));
        setExtSynced(true);
        setExtSyncedAt(new Date());
      }

      if (type === 'RANKING_DATA' && Array.isArray(payload)) {
        setRankingData(payload);
        setExtSynced(true);
        setExtSyncedAt(new Date());
      }

      // REVIEW_DATA는 향후 활용
    }
    window.addEventListener('message', handleExtMessage);
    return () => window.removeEventListener('message', handleExtMessage);
  }, []);

  const loadFromAPI = useCallback(async () => {
    if (!hasKey) return;
    setLoading(true);
    setApiError('');
    try {
      // 1단계: 상품 목록 (seller-products)
      const data = await fetchCoupangProducts(creds, { maxPerPage: 50 });
      const items = Array.isArray(data?.data) ? data.data
        : data?.data?.content
        || data?.data?.vendorItems
        || data?.content
        || [];

      if (items.length === 0) {
        const msg = data?.message || data?.code;
        setApiError(msg && msg !== 'SUCCESS' ? `응답 오류: ${msg}` : '등록된 상품이 없습니다.');
        setRows([]); setIsReal(false);
        setLoading(false); return;
      }

      const normalized = items.map(normalizeProduct);
      setRows(normalized);
      setIsReal(true);

      // 2단계: 재고 현황 (vendor-inventory) — 별도 호출 후 병합
      try {
        const invResp = await fetch('/api/coupang-products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessKey: creds.accessKey,
            secretKey: creds.secretKey,
            vendorId:  creds.vendorId,
            endpoint:  'vendor-inventory',
            params:    {},
          }),
        });
        if (invResp.ok) {
          const invData  = await invResp.json();
          const invItems = Array.isArray(invData?.data) ? invData.data
            : invData?.data?.content || invData?.content || [];
          if (invItems.length > 0) {
            const stockMap = {};
            invItems.forEach(inv => {
              const vid = String(inv.vendorItemId || inv.vendor_item_id || '');
              if (vid) stockMap[vid] = inv.quantity ?? inv.availableStock ?? inv.stockQuantity ?? 0;
            });
            setRows(prev => prev.map(row => ({
              ...row,
              stock: stockMap[String(row.optId)] ?? row.stock,
            })));
          }
        }
      } catch (invErr) {
        // 인벤토리 조회 실패해도 상품 기본 데이터는 유지
        console.warn('vendor-inventory 조회 실패:', invErr.message);
      }

    } catch (e) {
      setApiError(`API 오류: ${e.message}`);
      setRows([]); setIsReal(false);
    }
    setLoading(false);
  }, [creds, hasKey]);

  useEffect(() => { if (hasKey) loadFromAPI(); }, []);

  const filtered = useMemo(() =>
    rows.filter(r => !search || r.name.includes(search)),
    [rows, search]
  );

  const PER_PAGE   = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const pageRows   = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  return (
    <div className="flex-1 flex overflow-hidden bg-gray-50">
      <EakuSidebar active={activeSection} onNavigate={setActiveSection} />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── SCM 페이지 ── */}
        {activeSection === 'scm' && <SCMPage rows={rows} fmt={fmt} />}

        {/* ── 판매장부 (수익성 분석) ── */}
        {activeSection === 'ledger' && <RealtimeProfitTab creds={creds} rows={rows} />}

        {/* ── GrowthDB ── */}
        {activeSection === 'growthdb' && <>

        {/* ── 상품DB ── */}
        {true && (
          <>
            {/* 상태 배너 */}
            {!hasKey && (
              <div className="bg-orange-50 border-b border-orange-200 px-6 py-2 flex items-center gap-2">
                <span className="text-orange-500 text-sm">🔑</span>
                <p className="text-xs text-orange-700">
                  <strong className="mr-1">관리자 → 🛒 쿠팡 API</strong>에서 API 키를 설정하면 실제 상품 데이터를 불러옵니다.
                </p>
              </div>
            )}
            {hasKey && isReal && (
              <div className="bg-green-50 border-b border-green-200 px-6 py-2 flex items-center gap-2">
                <span className="text-green-500 text-sm">✅</span>
                <p className="text-xs text-green-700 font-medium">쿠팡 API 연동됨 — 실제 상품 데이터 표시 중</p>
                {extSynced && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 font-semibold ml-2">
                    🔌 에쿠 확장 연동됨 {extSyncedAt && `· ${extSyncedAt.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })}`}
                  </span>
                )}
                <button onClick={loadFromAPI} disabled={loading}
                  className="ml-auto text-xs px-2.5 py-1 rounded border border-green-300 text-green-600 hover:bg-green-100 disabled:opacity-50">
                  {loading ? '로딩 중…' : '새로고침'}
                </button>
              </div>
            )}
            {!hasKey && extSynced && (
              <div className="bg-orange-50 border-b border-orange-200 px-6 py-2 flex items-center gap-2">
                <span className="text-orange-500 text-sm">🔌</span>
                <p className="text-xs text-orange-700 font-medium">
                  에쿠 확장 연동됨 — 판매 데이터 수신 중
                  {extSyncedAt && <span className="text-orange-400 ml-1">({extSyncedAt.toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit' })})</span>}
                </p>
              </div>
            )}
            {apiError && (
              <div className="bg-red-50 border-b border-red-200 px-6 py-2">
                <p className="text-xs text-red-600">❌ {apiError}</p>
              </div>
            )}

            {/* 타이틀 행 */}
            <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h1 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                  <span>📊</span> 에쿠 GrowthDB
                  {isReal && <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-600 font-semibold">LIVE</span>}
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isReal ? `쿠팡 Wing API · ${rows.length}개 상품` : '샘플 데이터'}
                </p>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                  <Toggle checked={showReturn} onChange={setShowReturn} /><span>반품상품보기</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
                  <Toggle checked={showBundle} onChange={setShowBundle} /><span>번들상품보기</span>
                </label>
                <div className="w-px h-4 bg-gray-200" />
                <button onClick={hasKey ? loadFromAPI : undefined}
                  disabled={loading}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md text-white font-medium hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#00BCD4' }}>
                  {loading ? (
                    <svg className="animate-spin w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                    </svg>
                  )}
                  {hasKey ? '상품DB 수집' : '상품DB 수집 (키 필요)'}
                </button>
                <button className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">
                  허용스토어 설정
                </button>
              </div>
            </div>

            {/* 필터 탭 */}
            <div className="bg-white border-b border-gray-200 px-6 py-2.5 space-y-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {FILTER_TABS.map(t => {
                  const isOn = activeFilter === t.key;
                  const cnt  = t.key === 'all' ? filtered.length : 0;
                  return (
                    <button key={t.key} onClick={() => setActiveFilter(t.key)}
                      className="text-xs px-2.5 py-1.5 rounded-md border font-medium transition-all"
                      style={isOn
                        ? { background: t.color, borderColor: t.color, color: '#fff' }
                        : { background: 'white', borderColor: '#e5e7eb', color: '#6b7280' }}>
                      {t.label}
                      {t.key === 'all' && (
                        <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                          style={{ background: isOn ? 'rgba(255,255,255,.25)' : '#f3f4f6',
                                   color: isOn ? '#fff' : '#9ca3af' }}>
                          {cnt}
                        </span>
                      )}
                    </button>
                  );
                })}
                <div className="flex-1" />
                <button className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                  </svg>
                  DB 다운로드
                </button>
                <button className="text-xs px-2.5 py-1.5 rounded-md text-white font-medium"
                  style={{ background: '#d946a8' }}>매입정보 관리</button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <svg className="w-3 h-3 text-gray-300 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
                  </svg>
                  <input type="text" placeholder="Search…" value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="text-xs pl-6 pr-3 py-1.5 border border-gray-200 rounded-md
                      focus:outline-none focus:border-orange-400 w-36" />
                </div>
                <span className="ml-auto text-xs text-gray-400">총 {filtered.length}개 상품</span>
              </div>
            </div>

            {/* 데이터 테이블 */}
            <div className="flex-1 overflow-hidden flex flex-col px-6 py-3">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden flex-1">

                {loading && (
                  <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20 rounded-xl">
                    <div className="flex items-center gap-2 text-sm text-orange-600 font-medium">
                      <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                      </svg>
                      쿠팡 API에서 데이터를 가져오는 중…
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto overflow-y-auto flex-1" style={{ position:'relative' }}>
                  <table className="w-full text-xs text-left" style={{ borderCollapse:'collapse' }}>
                    <thead>
                      <tr className="text-gray-600 text-[11px]"
                        style={{ position:'sticky', top:0, zIndex:10,
                                 background:'#fff7ed', borderBottom:'1px solid #fed7aa' }}>
                        <th className="px-3 py-2.5 w-8">
                          <input type="checkbox" className="rounded accent-orange-500" />
                        </th>
                        {COLS.map(c => (
                          <th key={c} className="px-3 py-2.5 font-semibold whitespace-nowrap">{c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.length === 0 ? (
                        <tr>
                          <td colSpan={COLS.length + 1} className="text-center py-16 text-gray-400 text-sm">
                            상품이 없습니다
                          </td>
                        </tr>
                      ) : pageRows.map((row, i) => {
                        const mrNum    = parseFloat(row.mr);
                        const stockCls = row.stock < 10  ? 'text-red-500 font-bold'
                                       : row.stock < 50  ? 'text-orange-500 font-semibold'
                                       : 'text-gray-700';
                        const mrCls    = mrNum >= 20 ? 'text-green-600 font-semibold'
                                       : mrNum >= 10 ? 'text-orange-500'
                                       : 'text-red-500';
                        return (
                          <tr key={i} className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors">
                            <td className="px-3 py-2"><input type="checkbox" className="rounded accent-orange-500" /></td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${row.grade.cls}`}>
                                {row.grade.label}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {row.imageUrl ? (
                                <img src={row.imageUrl} alt="" className="w-9 h-9 rounded-lg border border-gray-200 object-cover" />
                              ) : (
                                <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-300">🖼</div>
                              )}
                            </td>
                            <td className="px-3 py-2" style={{ maxWidth:170 }}>
                              <p className="truncate text-gray-800 font-medium leading-snug" style={{ maxWidth:170 }}>{row.name}</p>
                              <p className="text-gray-400 text-[10px] mt-0.5 truncate">{row.opt}</p>
                            </td>
                            <td className="px-3 py-2 font-mono text-gray-500 text-[11px]">{row.expId}</td>
                            <td className="px-3 py-2 font-mono text-gray-500 text-[11px]">{row.optId}</td>
                            <td className="px-3 py-2 font-mono text-gray-400 text-[11px]">{row.bc}</td>
                            <td className="px-3 py-2"><a href="#" className="text-blue-500 hover:underline">링크🔗</a></td>
                            <td className="px-3 py-2">
                              <button className="text-[11px] px-2 py-0.5 rounded text-white font-medium"
                                style={{ background:'#00BCD4' }}>구매관리</button>
                            </td>
                            <td className="px-3 py-2">
                              <button className="text-[11px] px-2 py-0.5 rounded text-white font-medium"
                                style={{ background:'#d946a8' }}>매입관리</button>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {row.mlk ? `₩${fmt(row.mlk)}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {row.win ? <span className="text-green-500 font-bold">✓ 위너</span>
                                       : <span className="text-red-400">✗</span>}
                            </td>
                            <td className="px-3 py-2 text-gray-400">—</td>
                            <td className={`px-3 py-2 text-right ${stockCls}`}>{fmt(row.stock)}</td>
                            <td className="px-3 py-2 text-right font-semibold text-gray-800">₩{fmt(row.price)}</td>
                            <td className="px-3 py-2 text-right text-gray-500">₩{fmt(row.fee)}</td>
                            <td className={`px-3 py-2 text-right font-semibold ${row.margin > 0 ? 'text-green-600' : 'text-red-500'}`}>
                              ₩{fmt(row.margin)}
                            </td>
                            <td className={`px-3 py-2 text-right ${mrCls}`}>{row.mr}%</td>
                            <td className="px-3 py-2 text-right text-gray-600">{row.roi}%</td>
                            <td className="px-3 py-2 text-right text-gray-600">{row.roas}{row.isReal ? 'x' : '%'}</td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {row.s7 ? `₩${fmt(row.s7)}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {row.s30 ? `₩${fmt(row.s30)}` : '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {row.qty ? fmt(row.qty) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 페이지네이션 */}
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50 shrink-0">
                  <span className="text-xs text-gray-400">
                    {filtered.length === 0 ? '0개' :
                      `${(page-1)*PER_PAGE+1}–${Math.min(page*PER_PAGE, filtered.length)} / ${filtered.length}개`}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 disabled:opacity-30">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                      </svg>
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i+1).map(p => (
                      <button key={p} onClick={() => setPage(p)}
                        className="w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition-colors"
                        style={page===p ? { background:'#f97316', color:'#fff' } : { color:'#6b7280' }}>
                        {p}
                      </button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                      className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 disabled:opacity-30">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
        </> /* growthdb section end */}
      </div>
    </div>
  );
}
