import { useState, useMemo } from "react";

/* ── 샘플 상품 데이터 ── */
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

/* 시드 기반 난수 (매 렌더마다 동일한 값) */
function seededRand(seed, min, max) {
  const x = Math.sin(seed + 1) * 10000;
  return min + Math.floor((x - Math.floor(x)) * (max - min + 1));
}

function buildRows() {
  return Array.from({ length: 20 }, (_, i) => {
    const r = (min, max) => seededRand(i * 37 + min, min, max);
    const grade  = GRADES[r(0, 2)];
    const name   = PRODUCT_NAMES[i % PRODUCT_NAMES.length];
    const opt    = OPTS[r(0, OPTS.length - 1)];
    const expId  = r(10000000, 99999999);
    const optId  = r(100000000, 999999999);
    const bc     = `88${r(10000000, 99999999)}${r(100, 999)}`;
    const stock  = r(0, 600);
    const price  = r(8900, 89000);
    const fee    = Math.round(price * 0.1);
    const margin = r(500, Math.floor(price * 0.35));
    const mr     = (margin / price * 100).toFixed(1);
    const roi    = (margin / (price - margin) * 100).toFixed(0);
    const roas   = (price / fee * 100).toFixed(0);
    const s7     = r(50000, 5000000);
    const s30    = s7 * r(3, 5);
    const qty    = r(10, 500);
    const win    = r(0, 1);
    const mlk    = r(200, 1500);
    return { grade, name, opt, expId, optId, bc, stock, price, fee, margin, mr, roi, roas, s7, s30, qty, win, mlk };
  });
}

const ROWS = buildRows();

const FILTER_TABS = [
  { key: 'all',      label: '전체',        count: 247, color: '#f97316' },
  { key: 'expid',    label: '노출ID변경',   count: 12,  color: '#3b82f6' },
  { key: 'match',    label: '타사매칭',     count: 8,   color: '#3b82f6' },
  { key: 'loser',    label: '아이템루저',   count: 31,  color: '#f97316' },
  { key: 'nobadge',  label: '뱃지없음',     count: 54,  color: '#3b82f6' },
  { key: 'return',   label: '반품',         count: 7,   color: '#ec4899' },
  { key: 'bundle',   label: '번들',         count: 19,  color: '#3b82f6' },
  { key: 'nopurch',  label: '구매정보없음', count: 23,  color: '#ef4444' },
  { key: 'noinput',  label: '매입정보없음', count: 41,  color: '#3b82f6' },
];

const COLS = ['등급','이미지','상품명','노출ID','옵션ID','바코드','판매링크',
  '구매관리','매입관리','밀크런','아이템위너','사이즈','쿠팡재고',
  '판매가','수수료','마진','마진율','ROI','ROAS','7일매출','30일매출','판매량'];

/* ── 토글 스위치 ── */
function Toggle({ checked, onChange }) {
  return (
    <div
      onClick={() => onChange(!checked)}
      className="relative cursor-pointer"
      style={{ width: 34, height: 18 }}
    >
      <div style={{
        width: 34, height: 18, borderRadius: 9,
        background: checked ? '#f97316' : '#d1d5db',
        transition: 'background .15s', position: 'relative'
      }}>
        <div style={{
          width: 14, height: 14, borderRadius: '50%', background: '#fff',
          position: 'absolute', top: 2, left: 2,
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform .15s',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)'
        }} />
      </div>
    </div>
  );
}

/* ── 메인 컴포넌트 ── */
export default function GrowthDBPage() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [search, setSearch]             = useState('');
  const [showReturn, setShowReturn]     = useState(false);
  const [showBundle, setShowBundle]     = useState(false);
  const [page, setPage]                 = useState(1);
  const [perPage]                       = useState(20);

  const fmt = n => Number(n).toLocaleString();

  const filtered = useMemo(() =>
    ROWS.filter(r => !search || r.name.includes(search)),
    [search]
  );

  const totalPages = Math.ceil(filtered.length / perPage);
  const pageRows   = filtered.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">

      {/* ── 타이틀 행 ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
            <span>📊</span> 에쿠 GrowthDB
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">로켓그로스 상품 DB 통합 관리</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* 반품 토글 */}
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <Toggle checked={showReturn} onChange={setShowReturn} />
            <span>반품상품보기</span>
          </label>
          {/* 번들 토글 */}
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <Toggle checked={showBundle} onChange={setShowBundle} />
            <span>번들상품보기</span>
          </label>
          <div className="w-px h-4 bg-gray-200" />
          {/* 상품DB 수집 */}
          <button className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md text-white font-medium hover:opacity-90"
            style={{ background: '#00BCD4' }}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            상품DB 수집
          </button>
          <button className="text-xs px-3 py-1.5 rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50">
            허용스토어 설정
          </button>
        </div>
      </div>

      {/* ── 필터 탭 + 컨트롤 ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-2.5 space-y-2">

        {/* 필터 탭 */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {FILTER_TABS.map(t => {
            const isOn = activeFilter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveFilter(t.key)}
                className="text-xs px-2.5 py-1.5 rounded-md border font-medium transition-all"
                style={isOn
                  ? { background: t.color, borderColor: t.color, color: '#fff' }
                  : { background: 'white', borderColor: '#e5e7eb', color: '#6b7280' }
                }
              >
                {t.label}
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ background: isOn ? 'rgba(255,255,255,.25)' : '#f3f4f6',
                           color: isOn ? '#fff' : '#9ca3af' }}>
                  {t.count}
                </span>
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
            style={{ background: '#d946a8' }}>
            매입정보 관리
          </button>
        </div>

        {/* 테이블 컨트롤 */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <svg className="w-3 h-3 text-gray-300 absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/>
            </svg>
            <input
              type="text" placeholder="Search…" value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="text-xs pl-6 pr-3 py-1.5 border border-gray-200 rounded-md focus:outline-none focus:border-orange-400 w-36"
            />
          </div>
          <select className="text-xs px-2 py-1.5 border border-gray-200 rounded-md text-gray-600 focus:outline-none">
            <option>20 / page</option>
            <option>50 / page</option>
            <option>100 / page</option>
          </select>
          <button className="flex items-center gap-1 text-xs px-2 py-1.5 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
            컬럼선택
          </button>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            높이고정
            <label className="flex items-center gap-0.5 cursor-pointer">
              <input type="radio" name="rh" defaultChecked className="accent-orange-500" /> Y
            </label>
            <label className="flex items-center gap-0.5 cursor-pointer">
              <input type="radio" name="rh" className="accent-orange-500" /> N
            </label>
          </div>
          <span className="ml-auto text-xs text-gray-400">총 {filtered.length}개 상품</span>
        </div>
      </div>

      {/* ── 데이터 테이블 ── */}
      <div className="flex-1 overflow-hidden flex flex-col px-6 py-3">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden flex-1">
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="w-full text-xs text-left" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="text-gray-600 text-[11px]"
                  style={{ position: 'sticky', top: 0, zIndex: 10,
                           background: '#fff7ed', borderBottom: '1px solid #fed7aa' }}>
                  <th className="px-3 py-2.5 w-8">
                    <input type="checkbox" className="rounded accent-orange-500" />
                  </th>
                  {COLS.map(c => (
                    <th key={c} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row, i) => {
                  const mrNum    = parseFloat(row.mr);
                  const stockCls = row.stock < 10  ? 'text-red-500 font-bold'
                                 : row.stock < 50  ? 'text-orange-500 font-semibold'
                                 : 'text-gray-700';
                  const mrCls    = mrNum >= 20 ? 'text-green-600 font-semibold'
                                 : mrNum >= 10 ? 'text-orange-500'
                                 : 'text-red-500';
                  return (
                    <tr key={i}
                      className="border-b border-gray-100 hover:bg-orange-50/30 transition-colors">
                      <td className="px-3 py-2">
                        <input type="checkbox" className="rounded accent-orange-500" />
                      </td>
                      {/* 등급 */}
                      <td className="px-3 py-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${row.grade.cls}`}>
                          {row.grade.label}
                        </span>
                      </td>
                      {/* 이미지 */}
                      <td className="px-3 py-2">
                        <div className="w-9 h-9 rounded-lg border border-gray-200 bg-gray-100 flex items-center justify-center text-gray-300">
                          🖼
                        </div>
                      </td>
                      {/* 상품명 */}
                      <td className="px-3 py-2" style={{ maxWidth: 170 }}>
                        <p className="truncate text-gray-800 font-medium leading-snug" style={{ maxWidth: 170 }}>
                          {row.name}
                        </p>
                        <p className="text-gray-400 text-[10px] mt-0.5 truncate">{row.opt}</p>
                      </td>
                      {/* 노출ID */}
                      <td className="px-3 py-2 font-mono text-gray-500 text-[11px]">{row.expId}</td>
                      {/* 옵션ID */}
                      <td className="px-3 py-2 font-mono text-gray-500 text-[11px]">{row.optId}</td>
                      {/* 바코드 */}
                      <td className="px-3 py-2 font-mono text-gray-400 text-[11px]">{row.bc}</td>
                      {/* 판매링크 */}
                      <td className="px-3 py-2">
                        <a href="#" className="text-blue-500 hover:underline">링크🔗</a>
                      </td>
                      {/* 구매관리 */}
                      <td className="px-3 py-2">
                        <button className="text-[11px] px-2 py-0.5 rounded text-white font-medium"
                          style={{ background: '#00BCD4' }}>구매관리</button>
                      </td>
                      {/* 매입관리 */}
                      <td className="px-3 py-2">
                        <button className="text-[11px] px-2 py-0.5 rounded text-white font-medium"
                          style={{ background: '#d946a8' }}>매입관리</button>
                      </td>
                      {/* 밀크런 */}
                      <td className="px-3 py-2 text-right text-gray-600">₩{fmt(row.mlk)}</td>
                      {/* 아이템위너 */}
                      <td className="px-3 py-2 text-center">
                        {row.win
                          ? <span className="text-green-500 font-bold">✓ 위너</span>
                          : <span className="text-red-400">✗</span>}
                      </td>
                      {/* 사이즈 */}
                      <td className="px-3 py-2 text-gray-400">—</td>
                      {/* 쿠팡재고 */}
                      <td className={`px-3 py-2 text-right ${stockCls}`}>{fmt(row.stock)}</td>
                      {/* 판매가 */}
                      <td className="px-3 py-2 text-right font-semibold text-gray-800">₩{fmt(row.price)}</td>
                      {/* 수수료 */}
                      <td className="px-3 py-2 text-right text-gray-500">₩{fmt(row.fee)}</td>
                      {/* 마진 */}
                      <td className={`px-3 py-2 text-right font-semibold ${row.margin > 0 ? 'text-green-600' : 'text-red-500'}`}>
                        ₩{fmt(row.margin)}
                      </td>
                      {/* 마진율 */}
                      <td className={`px-3 py-2 text-right ${mrCls}`}>{row.mr}%</td>
                      {/* ROI */}
                      <td className="px-3 py-2 text-right text-gray-600">{row.roi}%</td>
                      {/* ROAS */}
                      <td className="px-3 py-2 text-right text-gray-600">{row.roas}%</td>
                      {/* 7일매출 */}
                      <td className="px-3 py-2 text-right text-gray-700">₩{fmt(row.s7)}</td>
                      {/* 30일매출 */}
                      <td className="px-3 py-2 text-right text-gray-700">₩{fmt(row.s30)}</td>
                      {/* 판매량 */}
                      <td className="px-3 py-2 text-right text-gray-700">{fmt(row.qty)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-100 bg-gray-50 shrink-0">
            <span className="text-xs text-gray-400">
              {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} / {filtered.length}개
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 disabled:opacity-30"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7"/>
                </svg>
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p}
                  onClick={() => setPage(p)}
                  className="w-7 h-7 flex items-center justify-center rounded text-xs font-medium transition-colors"
                  style={page === p
                    ? { background: '#f97316', color: '#fff' }
                    : { color: '#6b7280' }}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-200 text-gray-400 disabled:opacity-30"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" stroke-width={2} d="M9 5l7 7-7 7"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
