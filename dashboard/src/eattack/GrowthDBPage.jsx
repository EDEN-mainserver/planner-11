import { useState, useEffect, useCallback } from "react";

/* ─────────────────────────────────────────────
   localStorage 키
───────────────────────────────────────────── */
const LS_SALES    = "eku_sales_data";
const LS_RANKINGS = "eku_ranking_data";
const LS_REVIEWS  = "eku_review_data";

const load = (key) => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } };
const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));

/* ─────────────────────────────────────────────
   마진 계산 로직 (쿠팡 로켓그로스 기준)
───────────────────────────────────────────── */
function calcMargin({ sellPrice, costPrice, width, length, height, weight }) {
  const sp = Number(sellPrice) || 0;
  const cp = Number(costPrice) || 0;
  const w  = Number(width)    || 0;
  const l  = Number(length)   || 0;
  const h  = Number(height)   || 0;
  const wt = Number(weight)   || 0;

  // 입출고비 (박스 부피 기준, 단위: mm → cm)
  const vol = (w / 10) * (l / 10) * (h / 10); // cm³
  const inOutFee = vol < 10000 ? 300 : vol < 50000 ? 500 : 700;

  // 배송비 (무게 기준 g)
  const shippingFee = wt < 500 ? 800 : wt < 1000 ? 1200 : wt < 2000 ? 1800 : 2500;

  // 판매수수료 (기본 10.8%)
  const commissionRate = 0.108;
  const commission = Math.round(sp * commissionRate);

  const totalCost = cp + inOutFee + shippingFee + commission;
  const margin = sp - totalCost;
  const marginRate = sp > 0 ? ((margin / sp) * 100).toFixed(1) : 0;
  const roas = cp > 0 ? (sp / cp).toFixed(2) : 0;

  return { inOutFee, shippingFee, commission, margin, marginRate, roas, totalCost };
}

/* ─────────────────────────────────────────────
   공통 카드 컴포넌트
───────────────────────────────────────────── */
function StatCard({ label, value, sub, color = "purple" }) {
  const colors = {
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    blue:   "bg-blue-50 text-blue-700 border-blue-200",
    green:  "bg-green-50 text-green-700 border-green-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color]}`}>
      <div className="text-xs font-medium opacity-70 mb-1">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs opacity-60 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ─────────────────────────────────────────────
   판매량 추적 탭
───────────────────────────────────────────── */
function SalesTab({ data, onClear }) {
  const [search, setSearch] = useState("");

  const filtered = data.filter(d =>
    d.productName?.toLowerCase().includes(search.toLowerCase()) ||
    d.vendorItemId?.toString().includes(search)
  );

  const totalRevenue = data.reduce((s, d) => {
    const days = Object.values(d.saleSummaryByDate || {});
    return s + days.reduce((a, b) => a + (b.revenue || b.gmv || 0), 0);
  }, 0);

  const totalUnits = data.reduce((s, d) => {
    const days = Object.values(d.saleSummaryByDate || {});
    return s + days.reduce((a, b) => a + (b.units || b.orderCount || 0), 0);
  }, 0);

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="추적 상품" value={`${data.length}개`} color="purple" />
        <StatCard label="총 매출" value={`${(totalRevenue / 10000).toFixed(0)}만원`} color="blue" />
        <StatCard label="총 판매량" value={`${totalUnits.toLocaleString()}개`} color="green" />
      </div>

      {/* 검색 + 초기화 */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="상품명 또는 ID 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400"
        />
        {data.length > 0 && (
          <button onClick={onClear}
            className="px-3 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50">
            전체 삭제
          </button>
        )}
      </div>

      {/* 상품 목록 */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="text-5xl mb-4">📊</div>
          <p className="text-sm font-semibold text-gray-600 mb-1">수집된 판매 데이터가 없습니다</p>
          <p className="text-xs text-gray-400 mb-4 text-center leading-relaxed">
            에쿠 확장 프로그램 → 쿠팡 상품 페이지에서<br/>
            <strong className="text-orange-500">링크 수집(판매량)</strong> 버튼을 클릭하면 자동으로 여기에 표시됩니다.
          </p>
          <div className="flex items-center gap-2 text-xs text-orange-500 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2">
            <span>⚡</span>
            <span>확장 프로그램 → 수집 실행 → 자동 동기화</span>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item, i) => {
            const days = Object.entries(item.saleSummaryByDate || {});
            const totalRev = days.reduce((s, [, v]) => s + (v.revenue || v.gmv || 0), 0);
            const totalUnt = days.reduce((s, [, v]) => s + (v.units || v.orderCount || 0), 0);
            const latest   = days.sort((a, b) => b[0].localeCompare(a[0]))[0];

            return (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-purple-300 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{item.productName || "상품명 없음"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">ID: {item.vendorItemId} · 수집일: {item.collectedAt?.slice(0, 10) || "-"}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-blue-600">{(totalRev / 10000).toFixed(1)}만원</p>
                    <p className="text-xs text-gray-400">{totalUnt.toLocaleString()}개</p>
                  </div>
                </div>
                {latest && (
                  <div className="mt-2 pt-2 border-t border-gray-100 flex gap-4 text-xs text-gray-500">
                    <span>최근: {latest[0]}</span>
                    <span>매출: {((latest[1].revenue || latest[1].gmv || 0) / 10000).toFixed(1)}만원</span>
                    <span>판매: {(latest[1].units || latest[1].orderCount || 0)}개</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   랭킹 추적 탭
───────────────────────────────────────────── */
function RankingTab({ data, onClear }) {
  const grouped = data.reduce((acc, item) => {
    const key = item.keyword || "미분류";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="추적 키워드" value={`${Object.keys(grouped).length}개`} color="purple" />
        <StatCard label="추적 상품 수" value={`${data.length}개`} color="orange" />
      </div>

      <div className="flex justify-end">
        {data.length > 0 && (
          <button onClick={onClear} className="px-3 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50">
            전체 삭제
          </button>
        )}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="text-4xl mb-3">📈</div>
          <p className="text-sm font-medium">수집된 랭킹 데이터가 없습니다</p>
          <p className="text-xs mt-1">에쿠 확장 프로그램에서 링크 수집(랭킹)을 실행하세요</p>
        </div>
      ) : (
        Object.entries(grouped).map(([keyword, items]) => (
          <div key={keyword} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">{keyword}</span>
              <span className="text-xs text-gray-400">{items.length}개 상품</span>
            </div>
            <div className="space-y-2">
              {items.sort((a, b) => (a.rank || 999) - (b.rank || 999)).map((item, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                    ${item.rank <= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                    {item.rank || "-"}
                  </span>
                  <span className="flex-1 truncate text-gray-700">{item.productName || item.productId}</span>
                  <span className="text-xs text-gray-400 shrink-0">{item.collectedAt?.slice(0, 10)}</span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   리뷰 분석 탭
───────────────────────────────────────────── */
function ReviewTab({ data, onClear }) {
  const totalReviews = data.reduce((s, d) => s + (d.reviews?.length || 0), 0);
  const avgRating = data.length > 0
    ? (data.reduce((s, d) => {
        const reviews = d.reviews || [];
        const avg = reviews.length > 0 ? reviews.reduce((a, r) => a + (r.rating || 0), 0) / reviews.length : 0;
        return s + avg;
      }, 0) / data.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="분석 상품" value={`${data.length}개`} color="purple" />
        <StatCard label="총 리뷰 수" value={`${totalReviews.toLocaleString()}개`} color="blue" />
        <StatCard label="평균 별점" value={`${avgRating}점`} color="green" />
      </div>

      <div className="flex justify-end">
        {data.length > 0 && (
          <button onClick={onClear} className="px-3 py-2 text-xs text-red-500 border border-red-200 rounded-lg hover:bg-red-50">
            전체 삭제
          </button>
        )}
      </div>

      {data.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <div className="text-4xl mb-3">💬</div>
          <p className="text-sm font-medium">수집된 리뷰 데이터가 없습니다</p>
          <p className="text-xs mt-1">에쿠 확장 프로그램에서 리뷰 분석을 실행하세요</p>
        </div>
      ) : (
        data.map((item, i) => {
          const reviews = item.reviews || [];
          const ratingDist = [5,4,3,2,1].map(r => ({
            star: r,
            count: reviews.filter(rv => rv.rating === r).length
          }));
          const itemAvg = reviews.length > 0
            ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
            : 0;

          return (
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{item.productName || "상품명 없음"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">ID: {item.productId} · 리뷰 {reviews.length}개</p>
                </div>
                <div className="text-right">
                  <span className="text-xl font-bold text-yellow-500">★</span>
                  <span className="text-lg font-bold text-gray-800 ml-1">{itemAvg}</span>
                </div>
              </div>
              {/* 별점 분포 */}
              <div className="space-y-1">
                {ratingDist.map(({ star, count }) => (
                  <div key={star} className="flex items-center gap-2 text-xs">
                    <span className="w-4 text-right text-gray-500">{star}★</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-yellow-400 h-2 rounded-full transition-all"
                        style={{ width: reviews.length > 0 ? `${(count / reviews.length) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="w-6 text-gray-400">{count}</span>
                  </div>
                ))}
              </div>
              {/* 최근 리뷰 샘플 */}
              {reviews.slice(0, 3).map((rv, j) => (
                <div key={j} className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-600">
                  <span className="text-yellow-500">{"★".repeat(rv.rating || 0)}</span>
                  <span className="ml-1 text-gray-400">{rv.date}</span>
                  <p className="mt-0.5 line-clamp-2">{rv.text}</p>
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   마진 계산기 탭
───────────────────────────────────────────── */
function MarginTab() {
  const [form, setForm] = useState({
    sellPrice: "", costPrice: "", width: "", length: "", height: "", weight: ""
  });
  const [sim, setSim] = useState({ qty: "", perSale: "1", returnRate: "3" });
  const [result, setResult] = useState(null);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setSm = (k, v) => setSim(p => ({ ...p, [k]: v }));

  const calculate = () => {
    if (!form.sellPrice || !form.costPrice) return;
    setResult(calcMargin(form));
  };

  const simResult = result && sim.qty ? (() => {
    const q = Number(sim.qty);
    const p = Number(sim.perSale) || 1;
    const rr = Number(sim.returnRate) / 100;
    const returns = Math.floor(q * rr);
    const actualSales = q - returns;
    return {
      totalRevenue:    actualSales * Number(form.sellPrice),
      totalCost:       q * Number(form.costPrice),
      totalInOut:      q * result.inOutFee,
      totalShipping:   q * result.shippingFee,
      totalRetShip:    returns * result.shippingFee,
      totalCommission: actualSales * result.commission,
      netMargin:       actualSales * result.margin - returns * result.shippingFee,
    };
  })() : null;

  const Field = ({ label, k, placeholder }) => (
    <div>
      <label className="text-xs text-gray-500 font-medium">{label}</label>
      <input type="number" placeholder={placeholder}
        value={form[k]} onChange={e => set(k, e.target.value)}
        className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400"
      />
    </div>
  );

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* 입력 */}
      <div className="space-y-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">기본 정보</p>
          <Field label="판매가 (원)" k="sellPrice" placeholder="15000" />
          <Field label="원가 (원)" k="costPrice" placeholder="5000" />
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">상품 크기</p>
          <div className="grid grid-cols-3 gap-2">
            <Field label="가로 (mm)" k="width" placeholder="100" />
            <Field label="세로 (mm)" k="length" placeholder="200" />
            <Field label="높이 (mm)" k="height" placeholder="50" />
          </div>
          <Field label="무게 (g)" k="weight" placeholder="300" />
        </div>
        <button onClick={calculate}
          className="w-full py-2.5 bg-purple-600 text-white text-sm font-semibold rounded-xl hover:bg-purple-700 transition-colors">
          마진 계산
        </button>
      </div>

      {/* 결과 */}
      <div className="space-y-4">
        {result ? (
          <>
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
              <p className="text-sm font-semibold text-gray-700 mb-3">계산 결과</p>
              {[
                ["판매가",     `${Number(form.sellPrice).toLocaleString()}원`, "text-gray-800"],
                ["원가",       `${Number(form.costPrice).toLocaleString()}원`, "text-red-500"],
                ["입출고비",   `${result.inOutFee.toLocaleString()}원`,        "text-red-500"],
                ["배송비",     `${result.shippingFee.toLocaleString()}원`,     "text-red-500"],
                ["판매수수료", `${result.commission.toLocaleString()}원`,      "text-red-500"],
              ].map(([l, v, c]) => (
                <div key={l} className="flex justify-between text-sm">
                  <span className="text-gray-500">{l}</span>
                  <span className={`font-medium ${c}`}>{v}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-2 mt-2">
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-gray-700">순마진</span>
                  <span className={result.margin >= 0 ? "text-green-600" : "text-red-600"}>
                    {result.margin.toLocaleString()}원 ({result.marginRate}%)
                  </span>
                </div>
                <div className="flex justify-between text-xs mt-1">
                  <span className="text-gray-400">손익분기 ROAS</span>
                  <span className="text-gray-600">{result.roas}</span>
                </div>
              </div>
            </div>

            {/* 시뮬레이션 */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">판매 시뮬레이션</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["판매 수량", "qty", "100"],
                  ["개당 수량", "perSale", "1"],
                  ["반품률 %", "returnRate", "3"],
                ].map(([l, k, ph]) => (
                  <div key={k}>
                    <label className="text-xs text-gray-500">{l}</label>
                    <input type="number" placeholder={ph} value={sim[k]}
                      onChange={e => setSm(k, e.target.value)}
                      className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-purple-400"
                    />
                  </div>
                ))}
              </div>
              {simResult && (
                <div className="space-y-1 pt-2 border-t border-gray-100">
                  {[
                    ["총 매출",   `${simResult.totalRevenue.toLocaleString()}원`],
                    ["총 원가",   `${simResult.totalCost.toLocaleString()}원`],
                    ["총 반품배송비", `${simResult.totalRetShip.toLocaleString()}원`],
                    ["총 수수료", `${simResult.totalCommission.toLocaleString()}원`],
                  ].map(([l, v]) => (
                    <div key={l} className="flex justify-between text-xs">
                      <span className="text-gray-500">{l}</span>
                      <span className="text-gray-700">{v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-sm font-bold pt-1 border-t border-gray-100 mt-1">
                    <span className="text-gray-700">순수익</span>
                    <span className={simResult.netMargin >= 0 ? "text-green-600" : "text-red-600"}>
                      {simResult.netMargin.toLocaleString()}원
                    </span>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full py-20 text-gray-300">
            <div className="text-5xl mb-3">🧮</div>
            <p className="text-sm">왼쪽에 값을 입력하고 계산하세요</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   메인 GrowthDB 페이지
───────────────────────────────────────────── */
export default function GrowthDBPage() {
  const [tab, setTab]         = useState("sales");
  const [salesData, setSalesData]     = useState(() => load(LS_SALES));
  const [rankingData, setRankingData] = useState(() => load(LS_RANKINGS));
  const [reviewData, setReviewData]   = useState(() => load(LS_REVIEWS));
  const [syncMsg, setSyncMsg] = useState("");

  /* 에쿠 확장 프로그램에서 postMessage로 데이터 수신 */
  useEffect(() => {
    const handler = (e) => {
      if (e.data?.source !== "eku-extension") return;
      const { type, payload } = e.data;

      if (type === "SALES_DATA") {
        setSalesData(prev => {
          const exists = prev.findIndex(p => p.vendorItemId === payload.vendorItemId);
          const updated = exists >= 0
            ? prev.map((p, i) => i === exists ? { ...p, ...payload, collectedAt: new Date().toISOString() } : p)
            : [...prev, { ...payload, collectedAt: new Date().toISOString() }];
          save(LS_SALES, updated);
          return updated;
        });
        setSyncMsg(`판매 데이터 수신: ${payload.productName}`);
      }

      if (type === "RANKING_DATA") {
        setRankingData(prev => {
          const updated = [...prev, ...payload.map(p => ({ ...p, collectedAt: new Date().toISOString() }))];
          save(LS_RANKINGS, updated);
          return updated;
        });
        setSyncMsg(`랭킹 데이터 수신: ${payload.length}개`);
      }

      if (type === "REVIEW_DATA") {
        setReviewData(prev => {
          const exists = prev.findIndex(p => p.productId === payload.productId);
          const updated = exists >= 0
            ? prev.map((p, i) => i === exists ? { ...p, ...payload, collectedAt: new Date().toISOString() } : p)
            : [...prev, { ...payload, collectedAt: new Date().toISOString() }];
          save(LS_REVIEWS, updated);
          return updated;
        });
        setSyncMsg(`리뷰 데이터 수신: ${payload.productName}`);
      }

      setTimeout(() => setSyncMsg(""), 3000);
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const TABS = [
    { key: "sales",    label: "📊 판매량 추적", count: salesData.length },
    { key: "ranking",  label: "📈 랭킹 추적",   count: rankingData.length },
    { key: "review",   label: "💬 리뷰 분석",   count: reviewData.length },
    { key: "margin",   label: "🧮 마진계산기",  count: null },
  ];

  const totalTracking = salesData.length + rankingData.length + reviewData.length;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-800">에쿠 GrowthDB</h1>
            <p className="text-xs text-gray-400 mt-0.5">쿠팡 셀러 성장 데이터베이스 · 에쿠 확장 프로그램 연동</p>
          </div>
          <div className="flex items-center gap-3">
            {syncMsg && (
              <span className="text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full font-medium animate-pulse">
                ✓ {syncMsg}
              </span>
            )}
            <div className="text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full">
              총 {totalTracking}개 추적 중
            </div>
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 mt-4">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors
                ${tab === t.key
                  ? "bg-orange-500 text-white"
                  : "text-gray-500 hover:bg-gray-100"}`}>
              {t.label}
              {t.count !== null && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold
                  ${tab === t.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {tab === "sales"   && <SalesTab   data={salesData}   onClear={() => { setSalesData([]);   save(LS_SALES, []);    }} />}
        {tab === "ranking" && <RankingTab data={rankingData} onClear={() => { setRankingData([]); save(LS_RANKINGS, []); }} />}
        {tab === "review"  && <ReviewTab  data={reviewData}  onClear={() => { setReviewData([]);  save(LS_REVIEWS, []);  }} />}
        {tab === "margin"  && <MarginTab />}
      </div>

      {/* 연동 안내 */}
      <div className="bg-blue-50 border-t border-blue-100 px-8 py-3">
        <p className="text-xs text-blue-600">
          💡 에쿠 확장 프로그램에서 데이터 수집 후 자동으로 이 페이지에 동기화됩니다.
          데이터가 보이지 않으면 에쿠 팝업에서 기능을 실행해주세요.
        </p>
      </div>
    </div>
  );
}
