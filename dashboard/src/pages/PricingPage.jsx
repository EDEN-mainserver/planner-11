import { useState } from "react";
import { PLANS, PLAN_ORDER } from "../config/plans";
import { getSession } from "../utils/authSession";

const BASE = import.meta.env.VITE_API_BASE || "";

const FEATURE_LABELS = [
  { key: "text",      label: "글/블로그 생성" },
  { key: "image",     label: "카드뉴스 생성" },
  { key: "instagram", label: "인스타그램 자동 게시" },
  { key: "video",     label: "영상(숏폼) 생성" },
  { key: "crawling",  label: "크롤링" },
  { key: "fullAuto",  label: "풀가동화 (전체 자동화)" },
  { key: "growthdb",  label: "에쿠 GrowthDB" },
];

const PLAN_COLORS = {
  basic:    { bg: "bg-blue-50",   border: "border-blue-200",   btn: "bg-blue-600 hover:bg-blue-700",   badge: "bg-blue-100 text-blue-700",   ring: "ring-blue-300" },
  standard: { bg: "bg-purple-50", border: "border-purple-300", btn: "bg-purple-600 hover:bg-purple-700", badge: "bg-purple-100 text-purple-700", ring: "ring-purple-400" },
  premium:  { bg: "bg-orange-50", border: "border-orange-200", btn: "bg-orange-500 hover:bg-orange-600", badge: "bg-orange-100 text-orange-700", ring: "ring-orange-300" },
};

function loadPortOne() {
  if (window.PortOne) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://cdn.portone.io/v2/browser-sdk.es6-esm.min.js";
    s.type = "module";
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export default function PricingPage({ currentPlanId, onBack }) {
  const [paying, setPaying] = useState(null);
  const [result, setResult] = useState(null);
  const session = getSession();

  const handleSubscribe = async (planId) => {
    if (!session?.username) {
      alert("로그인이 필요합니다.");
      return;
    }
    const storeId = import.meta.env.VITE_PORTONE_STORE_ID;
    if (!storeId) {
      alert("결제 설정이 완료되지 않았습니다. 관리자에게 문의하세요.");
      return;
    }

    setPaying(planId);
    try {
      const prepResp = await fetch(`${BASE}/api/payment/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.username, planId }),
      });
      if (!prepResp.ok) throw new Error("결제 준비 실패");
      const { paymentId, planName, amount } = await prepResp.json();

      await loadPortOne();
      const response = await window.PortOne.requestPayment({
        storeId,
        paymentId,
        orderName: planName,
        totalAmount: amount,
        currency: "CURRENCY_KRW",
        channelKey: import.meta.env.VITE_PORTONE_CHANNEL_KEY || "",
        customer: { fullName: session.displayName || session.username },
      });

      if (response.code) throw new Error(response.message || "결제 취소");

      const confirmResp = await fetch(`${BASE}/api/payment/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentId: response.paymentId }),
      });
      if (!confirmResp.ok) throw new Error("결제 검증 실패");

      setResult({ ok: true, planId });
    } catch (e) {
      setResult({ ok: false, message: e.message });
    }
    setPaying(null);
  };

  if (result?.ok) {
    const plan = PLANS[result.planId];
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 bg-gray-50">
        <div className="text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{plan.name} 구독 완료!</h2>
          <p className="text-gray-500 mb-6">월 {plan.monthlyLimit}회 생성을 이제 사용하실 수 있어요.</p>
          <button onClick={onBack}
            className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors">
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 px-6 py-10">
      <div className="max-w-5xl mx-auto">
        {onBack && (
          <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
            뒤로가기
          </button>
        )}

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">플랜 선택</h1>
          <p className="text-gray-500 text-base">매월 자동 갱신 · 언제든지 취소 가능</p>
        </div>

        {result?.ok === false && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 text-center">
            {result.message || "결제 중 오류가 발생했습니다. 다시 시도해주세요."}
          </div>
        )}

        {/* 플랜 카드 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const c = PLAN_COLORS[planId];
            const isCurrent = currentPlanId === planId;
            const isPopular = planId === "standard";

            return (
              <div
                key={planId}
                className={`relative bg-white border-2 rounded-2xl p-6 flex flex-col transition-all
                  ${isCurrent ? `${c.border} ring-2 ${c.ring}` : "border-gray-200 hover:border-gray-300 hover:shadow-lg"}`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full">인기</span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4">
                    <span className={`${c.badge} text-xs font-bold px-3 py-1 rounded-full`}>현재 플랜</span>
                  </div>
                )}

                <div className="mb-4">
                  <span className={`inline-block ${c.badge} text-xs font-bold px-2.5 py-1 rounded-lg mb-3`}>
                    {plan.name}
                  </span>
                  <div className="flex items-end gap-1">
                    <span className="text-3xl font-bold text-gray-900">
                      {plan.price.toLocaleString()}원
                    </span>
                    <span className="text-gray-400 text-sm mb-1">/월</span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">월 {plan.monthlyLimit}회 생성</p>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {FEATURE_LABELS.map(({ key, label }) => {
                    const allowed = plan.features[key];
                    return (
                      <li key={key} className={`flex items-center gap-2 text-sm ${allowed ? "text-gray-700" : "text-gray-300"}`}>
                        {allowed ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 flex-shrink-0">
                            <path d="M20 6 9 17l-5-5"/>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                            <path d="M18 6 6 18M6 6l12 12"/>
                          </svg>
                        )}
                        {label}
                      </li>
                    );
                  })}
                </ul>

                <button
                  onClick={() => handleSubscribe(planId)}
                  disabled={!!paying || isCurrent}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all text-white
                    ${isCurrent ? "bg-gray-200 text-gray-400 cursor-not-allowed" : `${c.btn} disabled:opacity-50 disabled:cursor-not-allowed`}`}
                >
                  {paying === planId ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      결제 중...
                    </span>
                  ) : isCurrent ? "현재 이용 중" : "구독하기"}
                </button>
              </div>
            );
          })}
        </div>

        <p className="text-center text-xs text-gray-400">
          결제는 PortOne(아임포트)를 통해 안전하게 처리됩니다. · 카드/토스페이/카카오페이 지원
        </p>
      </div>
    </div>
  );
}
