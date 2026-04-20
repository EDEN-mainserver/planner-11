// 유통 페이지 — 대표전용 툴
import { useState, useMemo, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ── 유틸 ──────────────────────────────────────────────────────
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '-';
  return Math.round(n).toLocaleString('ko-KR');
}
function num(v) {
  const n = parseFloat(String(v).replace(/,/g, ''));
  return isNaN(n) ? 0 : n;
}

// ── 공통 UI ───────────────────────────────────────────────────
function Field({ label, sub, value, onChange, unit = '원', type = 'number', placeholder = '0', hint }) {
  return (
    <div>
      <div className="flex items-baseline gap-1 mb-1">
        <label className="text-xs font-bold text-gray-700">{label}</label>
        {sub && <span className="text-[10px] text-gray-400">{sub}</span>}
      </div>
      <div className="relative">
        <input type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 pr-10 text-sm border border-gray-200 rounded-xl outline-none focus:border-orange-400 bg-white transition-colors" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{unit}</span>
      </div>
      {hint && <p className="text-[10px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

function Badge({ children, color = 'gray' }) {
  const cls = {
    green:  'bg-green-100 text-green-700',
    red:    'bg-red-100 text-red-600',
    amber:  'bg-amber-100 text-amber-700',
    orange: 'bg-orange-100 text-orange-700',
    gray:   'bg-gray-100 text-gray-600',
  }[color];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${cls}`}>{children}</span>;
}

// ── 순수익 체크기 (수동 계산) ─────────────────────────────────
function NetProfitTab() {
  const [sellPrice,  setSellPrice]  = useState('');
  const [costPrice,  setCostPrice]  = useState('');
  const [commission, setCommission] = useState('10.8');
  const [shipping,   setShipping]   = useState('3000');
  const [adCost,     setAdCost]     = useState('');
  const [etcCost,    setEtcCost]    = useState('');
  const [quantity,   setQuantity]   = useState('1');

  const result = useMemo(() => {
    const sp  = num(sellPrice);
    if (!sp) return null;
    const cp  = num(costPrice);
    const com = num(commission);
    const sh  = num(shipping);
    const ad  = num(adCost);
    const etc = num(etcCost);
    const qty = Math.max(1, num(quantity));

    const commAmt      = Math.round(sp * (com / 100));
    const unitProfit   = sp - cp - commAmt - sh - ad - etc;
    const revenue      = sp * qty;
    const totalCost    = cp * qty;
    const totalComm    = commAmt * qty;
    const totalShip    = sh * qty;
    const totalAd      = ad * qty;
    const totalEtc     = etc * qty;
    const totalExpense = totalCost + totalComm + totalShip + totalAd + totalEtc;
    const netProfit    = revenue - totalExpense;
    const margin       = sp > 0 ? ((netProfit / revenue) * 100).toFixed(1) : 0;

    return { sp, commAmt, unitProfit, revenue, totalCost, totalComm, totalShip, totalAd, totalEtc, totalExpense, netProfit, margin, qty };
  }, [sellPrice, costPrice, commission, shipping, adCost, etcCost, quantity]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h4 className="text-sm font-bold text-gray-700 mb-4">판매 정보 입력</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="판매가" value={sellPrice} onChange={setSellPrice} hint="쿠팡 실제 판매가" />
          <Field label="원가 (매입가)" value={costPrice} onChange={setCostPrice} hint="상품 구매 원가" />
          <Field label="쿠팡 수수료" sub="(기본 10.8%)" value={commission} onChange={setCommission} unit="%" hint="카테고리별 다름" />
          <Field label="배송비" sub="(건당)" value={shipping} onChange={setShipping} hint="마켓플레이스 판매자 부담" />
          <Field label="광고비" sub="(건당, 선택)" value={adCost} onChange={setAdCost} />
          <Field label="기타 비용" sub="(건당, 선택)" value={etcCost} onChange={setEtcCost} hint="포장비, 인건비 등" />
        </div>
        <div className="mt-4">
          <Field label="판매 수량" value={quantity} onChange={setQuantity} unit="개" hint="수량별 합산 수익 계산" />
        </div>
      </div>

      {result ? (
        <div className="space-y-2">
          <h4 className="text-sm font-bold text-gray-700 mb-3">
            계산 결과 {result.qty > 1 && <span className="text-orange-500">({fmt(result.qty)}개 기준)</span>}
          </h4>
          {[
            { label: '총 매출',           value: result.revenue,    positive: true },
            { label: '원가 합계',          value: -result.totalCost },
            { label: `쿠팡 수수료 (${commission}%)`, value: -result.totalComm, sub: `건당 ${fmt(result.commAmt)}원` },
            { label: '배송비',             value: -result.totalShip },
            ...(result.totalAd  > 0 ? [{ label: '광고비', value: -result.totalAd }]  : []),
            ...(result.totalEtc > 0 ? [{ label: '기타',   value: -result.totalEtc }] : []),
          ].map((row, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-4 rounded-xl bg-gray-50">
              <div>
                <span className="text-sm text-gray-600">{row.label}</span>
                {row.sub && <p className="text-[10px] text-gray-400">{row.sub}</p>}
              </div>
              <span className={`text-sm font-bold tabular-nums ${row.value < 0 ? 'text-red-500' : 'text-gray-800'}`}>
                {row.value < 0 ? '-' : ''}{fmt(Math.abs(row.value))} 원
              </span>
            </div>
          ))}
          <div className="border-t border-gray-200 pt-2 space-y-2">
            <div className="flex items-center justify-between py-2 px-4 rounded-xl bg-gray-50">
              <span className="text-sm text-gray-600">건당 순수익</span>
              <span className={`text-sm font-bold tabular-nums ${result.unitProfit < 0 ? 'text-red-500' : 'text-gray-800'}`}>{fmt(result.unitProfit)} 원</span>
            </div>
            <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-orange-50 border border-orange-100">
              <div>
                <span className="text-sm font-bold text-orange-700">{result.qty > 1 ? `순수익 (${fmt(result.qty)}개)` : '순수익'}</span>
                <p className="text-[11px] text-orange-500">순이익률 {result.margin}%</p>
              </div>
              <span className={`text-base font-black tabular-nums ${result.netProfit < 0 ? 'text-red-500' : 'text-orange-600'}`}>{fmt(result.netProfit)} 원</span>
            </div>
          </div>
          {result.netProfit < 0 && (
            <div className="flex gap-2 px-4 py-3 bg-red-50 border border-red-100 rounded-xl">
              <span>⚠️</span>
              <p className="text-xs text-red-600 font-medium">손실 발생. 판매가를 올리거나 원가를 낮춰야 합니다.</p>
            </div>
          )}
          {result.netProfit >= 0 && result.margin < 10 && (
            <div className="flex gap-2 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
              <span>💡</span>
              <p className="text-xs text-amber-700">순이익률 10% 미만. 쿠팡 권장 마진은 15~30%입니다.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
          <span className="text-3xl mb-3">🧮</span>
          <p className="text-sm text-gray-400">판매가를 입력하면 순수익이 계산됩니다</p>
        </div>
      )}
    </div>
  );
}

// ── 실시간 대시보드 ────────────────────────────────────────────
const COST_MAP_KEY = 'eden_coupang_cost_map';

function loadCostMap() {
  try { return JSON.parse(localStorage.getItem(COST_MAP_KEY)) || {}; } catch { return {}; }
}
function saveCostMap(map) {
  localStorage.setItem(COST_MAP_KEY, JSON.stringify(map));
}

function RealtimeTab() {
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [vendorId,  setVendorId]  = useState('');
  const [days,      setDays]      = useState('7');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [data,      setData]      = useState(null);
  const [error,     setError]     = useState('');
  const [costMap,   setCostMap]   = useState(loadCostMap);
  const [editCostId, setEditCostId] = useState(null);
  const [editCostVal, setEditCostVal] = useState('');

  const creds = { access_key: accessKey, secret_key: secretKey, vendor_id: vendorId };

  // 연결 테스트
  const handleConnect = async () => {
    if (!accessKey || !secretKey || !vendorId) {
      setError('Access Key, Secret Key, Vendor ID를 모두 입력하세요.'); return;
    }
    setConnecting(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/coupang/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || '연결 실패');
      setConnected(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  };

  // 데이터 조회
  const fetchProfit = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/coupang/profit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...creds, cost_map: costMap, days: num(days) }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail || '조회 실패');
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [accessKey, secretKey, vendorId, costMap, days]);

  // 원가 저장
  const saveCost = (vid) => {
    const updated = { ...costMap, [vid]: num(editCostVal) };
    setCostMap(updated);
    saveCostMap(updated);
    setEditCostId(null);
  };

  // ── 연결 전 화면
  if (!connected) return (
    <div className="p-6 space-y-6">
      <div>
        <h4 className="text-sm font-bold text-gray-700 mb-1">쿠팡 Wing API 연결</h4>
        <p className="text-xs text-gray-400 mb-4">
          쿠팡 Wing → 개발자센터 → API 키 발급 후 입력하세요.<br />
          키는 서버에만 전송되며 브라우저에 저장되지 않습니다.
        </p>
        <div className="space-y-3">
          <Field label="Access Key" value={accessKey} onChange={setAccessKey} type="text" unit="" placeholder="Access Key 입력" />
          <Field label="Secret Key" value={secretKey} onChange={setSecretKey} type="password" unit="" placeholder="Secret Key 입력" />
          <Field label="Vendor ID" sub="(판매자 ID)" value={vendorId} onChange={setVendorId} type="text" unit="" placeholder="A00xxxxxx" />
        </div>
        {error && <p className="mt-3 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
        <button onClick={handleConnect} disabled={connecting}
          className="mt-4 w-full py-3 bg-gradient-to-r from-orange-400 to-red-500 hover:from-orange-500 hover:to-red-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all shadow-md">
          {connecting ? '연결 중...' : '🔗 API 연결하기'}
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
        <p className="text-xs font-bold text-amber-700 mb-1">Wing API 키 발급 방법</p>
        <ol className="text-xs text-amber-600 space-y-1 list-decimal list-inside">
          <li>쿠팡 Wing (wing.coupang.com) 로그인</li>
          <li>우측 상단 계정 → 개발자 API</li>
          <li>Access Key / Secret Key 복사</li>
          <li>Vendor ID: URL의 vendorId 값</li>
        </ol>
      </div>
    </div>
  );

  // ── 연결 후 대시보드
  return (
    <div className="p-6 space-y-6">
      {/* 상단 컨트롤 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge color="green">● 연결됨</Badge>
          <span className="text-xs text-gray-400">{vendorId}</span>
        </div>
        <div className="flex items-center gap-2">
          <select value={days} onChange={e => setDays(e.target.value)}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-orange-400 bg-white">
            {[7,14,30,60,90].map(d => <option key={d} value={d}>최근 {d}일</option>)}
          </select>
          <button onClick={fetchProfit} disabled={loading}
            className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors">
            {loading ? '조회 중...' : '🔄 조회'}
          </button>
          <button onClick={() => setConnected(false)}
            className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg transition-colors">
            연결 해제
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}

      {/* 요약 카드 */}
      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: '총 매출',      value: fmt(data.total_revenue),     unit: '원', color: 'text-gray-800' },
              { label: '순수익',       value: fmt(data.total_net_profit),  unit: '원', color: data.total_net_profit >= 0 ? 'text-orange-600' : 'text-red-500' },
              { label: '순이익률',     value: `${data.total_margin}%`,     unit: '',   color: data.total_margin >= 15 ? 'text-green-600' : data.total_margin >= 0 ? 'text-amber-600' : 'text-red-500' },
              { label: '총 주문',      value: fmt(data.order_count),       unit: '건', color: 'text-gray-800' },
            ].map((c, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-400 mb-1">{c.label}</p>
                <p className={`text-lg font-black tabular-nums ${c.color}`}>{c.value}<span className="text-xs font-normal ml-0.5">{c.unit}</span></p>
              </div>
            ))}
          </div>

          {/* 원가 미입력 경고 */}
          {data.missing_cost_count > 0 && (
            <div className="flex gap-2 px-4 py-3 bg-amber-50 border border-amber-100 rounded-xl">
              <span>⚠️</span>
              <p className="text-xs text-amber-700">
                <span className="font-bold">{data.missing_cost_count}개 상품</span>의 원가가 입력되지 않았습니다.
                아래 표에서 원가를 입력하면 정확한 순수익을 계산합니다.
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
                    <th className="text-left px-4 py-2.5 text-gray-500 font-semibold">상품명</th>
                    <th className="text-right px-3 py-2.5 text-gray-500 font-semibold">판매가</th>
                    <th className="text-right px-3 py-2.5 text-gray-500 font-semibold">원가</th>
                    <th className="text-right px-3 py-2.5 text-gray-500 font-semibold">수량</th>
                    <th className="text-right px-3 py-2.5 text-gray-500 font-semibold">매출</th>
                    <th className="text-right px-3 py-2.5 text-gray-500 font-semibold">수수료</th>
                    <th className="text-right px-3 py-2.5 text-gray-500 font-semibold whitespace-nowrap">순수익</th>
                    <th className="text-right px-3 py-2.5 text-gray-500 font-semibold">마진</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, i) => (
                    <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-2.5 text-gray-700 font-medium max-w-[160px] truncate" title={item.item_name}>
                        {item.item_name}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{fmt(item.sell_price)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {editCostId === item.vendor_item_id ? (
                          <div className="flex items-center gap-1 justify-end">
                            <input autoFocus type="number" value={editCostVal}
                              onChange={e => setEditCostVal(e.target.value)}
                              onKeyDown={e => { if (e.key === 'Enter') saveCost(item.vendor_item_id); if (e.key === 'Escape') setEditCostId(null); }}
                              className="w-20 px-2 py-1 border border-orange-400 rounded-lg text-right outline-none" />
                            <button onClick={() => saveCost(item.vendor_item_id)} className="text-orange-500 hover:text-orange-700 font-bold">✓</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditCostId(item.vendor_item_id); setEditCostVal(String(item.cost_price || '')); }}
                            className={`tabular-nums hover:text-orange-600 transition-colors ${item.has_cost ? 'text-gray-600' : 'text-amber-500 underline decoration-dashed'}`}>
                            {item.has_cost ? fmt(item.cost_price) : '입력 필요'}
                          </button>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{fmt(item.qty)}</td>
                      <td className="px-3 py-2.5 text-right text-gray-600 tabular-nums">{fmt(item.revenue)}</td>
                      <td className="px-3 py-2.5 text-right text-red-400 tabular-nums">-{fmt(item.commission)}</td>
                      <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${item.has_cost ? (item.net_profit >= 0 ? 'text-orange-600' : 'text-red-500') : 'text-gray-300'}`}>
                        {item.has_cost ? fmt(item.net_profit) : '-'}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {item.has_cost ? (
                          <Badge color={item.margin >= 15 ? 'green' : item.margin >= 0 ? 'amber' : 'red'}>
                            {item.margin}%
                          </Badge>
                        ) : <span className="text-gray-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">원가 셀을 클릭하면 직접 입력할 수 있습니다. 입력값은 브라우저에 자동 저장됩니다.</p>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="flex flex-col items-center justify-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200 text-center">
          <span className="text-3xl mb-3">📊</span>
          <p className="text-sm text-gray-500 font-medium">조회 버튼을 눌러 실시간 데이터를 가져오세요</p>
          <p className="text-xs text-gray-400 mt-1">매출·수수료는 쿠팡 API에서 자동으로 가져옵니다</p>
        </div>
      )}
    </div>
  );
}

// ── 쿠팡 탭 (서브탭) ──────────────────────────────────────────
const COUPANG_SUBTABS = [
  { key: 'netprofit', label: '순수익 체크기', icon: '🧮' },
  { key: 'realtime',  label: '실시간 대시보드', icon: '📊' },
];

function CoupangTab() {
  const [sub, setSub] = useState('netprofit');
  return (
    <div>
      <div className="flex border-b border-gray-100 px-2 pt-2">
        {COUPANG_SUBTABS.map(t => (
          <button key={t.key} onClick={() => setSub(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all border-b-2 -mb-px ${
              sub === t.key ? 'border-orange-500 text-orange-600 bg-orange-50' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>
      {sub === 'netprofit' && <NetProfitTab />}
      {sub === 'realtime'  && <RealtimeTab />}
    </div>
  );
}

// ── 유통 메인 ─────────────────────────────────────────────────
const TABS = [
  { key: 'coupang', label: '쿠팡', icon: '🛒', gradient: 'from-orange-400 to-red-500', description: '쿠팡 수익 계산 및 실시간 대시보드' },
];

export default function DistributionPage({ onBack }) {
  const [activeTab, setActiveTab] = useState('coupang');
  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8 sm:py-12">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-md">
              <span className="text-base">🛒</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-800">유통</h3>
              <p className="text-sm text-gray-400">플랫폼을 선택하세요</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`relative text-left p-5 rounded-2xl border-2 transition-all duration-200 ${
                activeTab === tab.key ? 'border-orange-400 bg-orange-50 shadow-md' : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
              }`}>
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tab.gradient} flex items-center justify-center shadow-sm flex-shrink-0 text-lg`}>
                  {tab.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className={`text-sm font-bold ${activeTab === tab.key ? 'text-orange-700' : 'text-gray-800'}`}>{tab.label}</p>
                    {activeTab === tab.key && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">선택됨</span>}
                  </div>
                  <p className="text-xs text-gray-500">{tab.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="flex border-b border-gray-100">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                  activeTab === tab.key ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                <span>{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
          {activeTab === 'coupang' && <CoupangTab />}
        </div>
      </div>
    </div>
  );
}
