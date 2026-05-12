import { useState } from "react";
import Field from "./Field";
import { loadCoupangCreds } from "../../utils/coupang";
import { saveCoupangCreds } from "../../services/admin/coupang";

export default function CoupangTab() {
  const [creds, setCreds] = useState(() => loadCoupangCreds());
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const set = (k, v) => setCreds(p => ({ ...p, [k]: v }));

  const handleSave = () => {
    saveCoupangCreds(creds);
    setSaved(true);
    setTestResult(null);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTest = async () => {
    if (!creds.accessKey || !creds.secretKey || !creds.vendorId) {
      setTestResult({ ok: false, msg: 'Access Key, Secret Key, Vendor ID를 모두 입력하세요.' });
      return;
    }
    setTesting(true);
    setTestResult(null);

    // Vercel 함수 → DigitalOcean 고정IP → 쿠팡 API
    try {
      const resp = await fetch('/api/coupang-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessKey: creds.accessKey,
          secretKey: creds.secretKey,
          vendorId:  creds.vendorId,
          endpoint:  'connect',
        }),
      });
      const json = await resp.json();
      if (resp.ok) {
        setTestResult({ ok: true, msg: json.message || '연결 성공!' });
      } else {
        const msg = json?.error || json?.detail || `HTTP ${resp.status}`;
        setTestResult({ ok: false, msg: `❌ ${msg}` });
      }
    } catch (e) {
      setTestResult({ ok: false, msg: `❌ 연결 실패: ${e.message}` });
    }
    setTesting(false);
  };

  const connected = !!(creds.accessKey && creds.secretKey && creds.vendorId);

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100"
          style={{ background: 'linear-gradient(to right, #fff7ed, #fff)' }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-lg font-bold"
            style={{ background: '#f97316' }}>C</div>
          <div>
            <p className="text-sm font-bold text-gray-800">쿠팡 Wing Open API</p>
            <p className="text-xs text-gray-400">GrowthDB 실시간 상품 데이터 연동</p>
          </div>
          {connected && (
            <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-600
              border border-green-200 rounded-full px-2.5 py-1">✓ 설정됨</span>
          )}
        </div>

        {/* 입력 폼 */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700 leading-relaxed">
            <strong>발급 경로:</strong> 쿠팡 Wing → 설정 → 개발자 오픈 API →
            <a href="https://wing.coupang.com" target="_blank" rel="noreferrer"
              className="underline ml-1">wing.coupang.com</a>
          </div>

          <Field label="Access Key" value={creds.accessKey || ''} onChange={v => set('accessKey', v)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" mono />
          <Field label="Secret Key" type="password" value={creds.secretKey || ''} onChange={v => set('secretKey', v)}
            placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX" mono />
          <Field label="Vendor ID (판매자 ID)" value={creds.vendorId || ''} onChange={v => set('vendorId', v)}
            placeholder="A00000000" mono />

          {/* 결과 */}
          {testResult && (
            <div className={`p-3 rounded-xl text-xs font-medium ${
              testResult.ok ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-600 border border-red-200'}`}>
              {testResult.ok ? '✅ ' : '❌ '}{testResult.msg}
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <button onClick={handleTest} disabled={testing}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg border
                border-orange-300 text-orange-600 hover:bg-orange-50 disabled:opacity-50 transition-all">
              {testing ? (
                <svg className="animate-spin w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
              ) : '🔌'}
              연결 테스트
            </button>
            <button onClick={handleSave}
              className={`px-5 py-2 text-xs font-bold rounded-lg transition-all text-white ${
                saved ? 'bg-green-500' : 'bg-orange-500 hover:bg-orange-600'}`}>
              {saved ? '✓ 저장됨' : '저장'}
            </button>
          </div>
        </div>
      </div>

      <p className="text-[11px] text-gray-400">
        🔒 API 키는 브라우저 로컬스토리지에 저장됩니다. Secret Key는 서버에서만 사용됩니다.
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════
// 탭: 구글 회원 DB
// ═══════════════════════════════════════════
