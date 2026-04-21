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
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  if (json.error) throw new Error(json.error);
  return json;
}

/* ─────────────────────────────────────────────
   쿠팡 응답 → GrowthDB 행 변환
───────────────────────────────────────────── */
function normalizeProduct(item) {
  const price  = item.salePrice || item.originalPrice || 0;
  const cost   = item.supplyPrice || 0;
  const fee    = Math.round(price * 0.108);
  const margin = price - cost - fee;
  const mr     = price > 0 ? (margin / price * 100).toFixed(1) : '0.0';
  const roi    = cost > 0 ? (margin / cost * 100).toFixed(0) : '0';
  const roas   = cost > 0 ? (price / cost).toFixed(1) : '0';

  return {
    isReal:   true,
    grade:    GRADES[0],
    name:     item.sellerProductName || item.productName || '상품명 없음',
    opt:      item.itemName || '',
    expId:    item.productId || '-',
    optId:    item.vendorItemId || '-',
    bc:       item.barcode || '-',
    imageUrl: item.imageUrl || '',
    stock:    item.stock ?? item.quantity ?? 0,
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

function EakuSidebar() {
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
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer font-semibold"
            style={{ background: '#E0F7FA', color: '#00838F' }}>
            <span className="text-base">📊</span><span>에쿠 GrowthDB</span>
          </div>
          {item('📦', '공급관리(SCM)', 'soon')}
          {item('📒', '판매장부', 'soon')}
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

function RealtimeProfitTab({ creds }) {
  const [days, setDays]             = useState('7');
  const [loading, setLoading]       = useState(false);
  const [data, setData]             = useState(null);
  const [error, setError]           = useState('');
  const [costMap, setCostMap]       = useState(loadCostMap);
  const [editCostId, setEditCostId] = useState(null);
  const [editCostVal, setEditCostVal] = useState('');

  const hasKey = !!(creds.accessKey && creds.secretKey && creds.vendorId);

  const fetchProfit = useCallback(async () => {
    if (!hasKey) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/coupang/profit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_key: creds.accessKey,
          secret_key: creds.secretKey,
          vendor_id:  creds.vendorId,
          cost_map:   costMap,
          days:       parseNum(days),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || '조회 실패');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [creds, costMap, days, hasKey]);

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

  return (
    <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
      {/* 컨트롤 바 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ProfitBadge color="green">● API 연결됨</ProfitBadge>
          <span className="text-xs text-gray-400">{creds.vendorId}</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={e => setDays(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-orange-400 bg-white">
            {[7, 14, 30, 60, 90].map(d => <option key={d} value={d}>최근 {d}일</option>)}
          </select>
          <button onClick={fetchProfit} disabled={loading}
            className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors">
            {loading ? '조회 중...' : '🔄 조회'}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
      )}

      {data && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '총 매출',  value: fmtNum(data.total_revenue),    unit: '원', color: 'text-gray-800' },
              { label: '순수익',   value: fmtNum(data.total_net_profit), unit: '원', color: data.total_net_profit >= 0 ? 'text-orange-600' : 'text-red-500' },
              { label: '순이익률', value: `${data.total_margin}%`,       unit: '',   color: data.total_margin >= 15 ? 'text-green-600' : data.total_margin >= 0 ? 'text-amber-600' : 'text-red-500' },
              { label: '총 주문',  value: fmtNum(data.order_count),      unit: '건', color: 'text-gray-800' },
            ].map((c, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className={`text-lg font-black tabular-nums ${c.color}`}>
                  {c.value}<span className="text-xs font-normal ml-0.5">{c.unit}</span>
                </p>
              </div>
            ))}
          </div>

          {data.missing_cost_count > 0 && (
            <div className="flex gap-2 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
              <span>⚠️</span>
              <p className="text-xs text-amber-700">
                <span className="font-bold">{data.missing_cost_count}개 상품</span> 원가 미입력.
                아래 표에서 원가를 클릭해 입력하면 정확한 순수익이 계산됩니다.
              </p>
            </div>
          )}

          {/* 상품별 테이블 */}
          <div>
            <h4 className="text-sm font-bold text-gray-700 mb-3">상품별 순수익</h4>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['상품명','판매가','원가','수량','매출','수수료','순수익','마진'].map(h => (
                      <th key={h} className={`py-2.5 px-3 text-gray-500 font-semibold whitespace-nowrap ${h === '상품명' ? 'text-left' : 'text-right'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-3 py-2.5 text-gray-700 font-medium max-w-[200px] truncate" title={item.item_name}>{item.item_name}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{fmtNum(item.sell_price)}</td>
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
                            {item.has_cost ? fmtNum(item.cost_price) : '입력 필요'}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{fmtNum(item.qty)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{fmtNum(item.revenue)}</td>
                      <td className="px-3 py-2.5 text-right text-red-400 tabular-nums">-{fmtNum(item.commission)}</td>
                      <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${item.has_cost ? (item.net_profit >= 0 ? 'text-orange-600' : 'text-red-500') : 'text-gray-300'}`}>
                        {item.has_cost ? fmtNum(item.net_profit) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {item.has_cost
                          ? <ProfitBadge color={item.margin >= 15 ? 'green' : item.margin >= 0 ? 'amber' : 'red'}>{item.margin}%</ProfitBadge>
                          : <span className="text-gray-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">원가 셀 클릭 → 직접 입력 (브라우저에 자동 저장)</p>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 text-center">
          <span className="text-3xl mb-3">📈</span>
          <p className="text-sm text-gray-500 font-medium">조회 버튼을 눌러 실시간 데이터를 가져오세요</p>
          <p className="text-xs text-gray-400 mt-1">매출·수수료는 쿠팡 API에서 자동으로 가져옵니다</p>
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   메인 컴포넌트
───────────────────────────────────────────── */
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
  const [mainTab, setMainTab]           = useState('products'); // 'products' | 'profit'
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [showReturn, setShowReturn]     = useState(false);
  const [showBundle, setShowBundle]     = useState(false);
  const [page, setPage]                 = useState(1);

  const [creds]               = useState(() => loadCoupangCreds());
  const [rows, setRows]       = useState(SAMPLE_ROWS);
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
      const data = await fetchCoupangProducts(creds, { maxPerPage: 50 });
      const items = data?.data?.content
        || data?.data?.vendorItems
        || data?.content
        || [];
      if (items.length > 0) {
        setRows(items.map(normalizeProduct));
        setIsReal(true);
      } else {
        setApiError('상품 데이터가 없거나 응답 형식이 다릅니다. 샘플 데이터를 표시합니다.');
        setRows(SAMPLE_ROWS);
        setIsReal(false);
      }
    } catch (e) {
      setApiError(`API 오류: ${e.message}. 샘플 데이터를 표시합니다.`);
      setRows(SAMPLE_ROWS);
      setIsReal(false);
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
      <EakuSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* ── 메인 탭 바 ── */}
        <div className="bg-white border-b border-gray-200 px-6 flex items-end">
          {[
            { key: 'products', label: '📊 상품DB' },
            { key: 'profit',   label: '📈 실시간 순수익' },
          ].map(t => (
            <button key={t.key} onClick={() => setMainTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                mainTab === t.key
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── 실시간 순수익 탭 ── */}
        {mainTab === 'profit' && (
          <RealtimeProfitTab creds={creds} />
        )}

        {/* ── 상품DB 탭 ── */}
        {mainTab === 'products' && (
          <>
            {/* 상태 배너 */}
            {!hasKey && (
              <div className="bg-orange-50 border-b border-orange-200 px-6 py-2 flex items-center gap-2">
                <span className="text-orange-500 text-sm">⚠️</span>
                <p className="text-xs text-orange-700">
                  샘플 데이터 표시 중 —
                  <strong className="mx-1">관리자 → 🛒 쿠팡 API</strong>에서 API 키를 설정하면 실제 상품 데이터를 불러옵니다.
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
      </div>
    </div>
  );
}
