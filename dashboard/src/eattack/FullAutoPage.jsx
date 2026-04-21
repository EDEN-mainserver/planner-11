// 풀가동화 콘텐츠 대시보드
// 계정 관리 / 자동화 설정 / 실행 이력 3탭 UI

import { useState, useEffect, useCallback } from "react";

const API_BASE = "/api/full-auto-config";
const RUN_API = "/api/full-auto-run";
const SECRET = import.meta.env.VITE_FULL_AUTO_SECRET || "";

// ─── 유틸 ───
function authHeaders() {
  return {
    "Content-Type": "application/json",
    ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}),
  };
}

// ─── 계정 카드 ───
function AccountCard({ account, onToggle, onDelete, onEdit }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-gray-900">{account.name || "이름 없음"}</p>
          <p className="text-xs text-gray-400 mt-0.5">ID: {account.id}</p>
        </div>
        {/* 자동화 ON/OFF 토글 */}
        <button
          onClick={() => onToggle(account.id, !account.enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            account.enabled ? "bg-orange-500" : "bg-gray-200"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              account.enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* IG 정보 */}
      <div className="text-xs text-gray-500 space-y-1">
        <div className="flex gap-2">
          <span className="font-medium text-pink-500">IG</span>
          <span className="truncate">{account.igAccountId || "—"}</span>
        </div>
        <div className="flex gap-2">
          <span className="font-medium text-gray-700">TH</span>
          <span className="truncate">{account.threadsUserId || "—"}</span>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex gap-2 mt-1">
        <button
          onClick={() => onEdit(account)}
          className="flex-1 text-xs py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all"
        >
          편집
        </button>
        <button
          onClick={() => onDelete(account.id)}
          className="flex-1 text-xs py-1.5 rounded-lg border border-red-100 text-red-500 hover:bg-red-50 transition-all"
        >
          삭제
        </button>
      </div>
    </div>
  );
}

// ─── 계정 편집 모달 ───
function AccountModal({ account, onSave, onClose }) {
  const blank = {
    id: "",
    name: "",
    igAccountId: "",
    igAccessToken: "",
    threadsUserId: "",
    threadsAccessToken: "",
    enabled: true,
    settings: {
      topics: "",
      brandName: "",
      tone: "친근하고 전문적인",
      slideCount: 5,
      captionTemplate: "{title}\n\n{body}\n\n#마케팅 #자동화",
    },
  };
  const [form, setForm] = useState(account ? { ...blank, ...account, settings: { ...blank.settings, ...(account.settings || {}) } } : blank);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const setSetting = (key, val) => setForm((f) => ({ ...f, settings: { ...f.settings, [key]: val } }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="p-6">
          <h3 className="font-bold text-gray-900 text-lg mb-4">
            {account ? "계정 편집" : "계정 추가"}
          </h3>

          <div className="space-y-3">
            {!account && (
              <label className="block">
                <span className="text-xs font-medium text-gray-500">계정 ID (고유값)</span>
                <input
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="account_001"
                  value={form.id}
                  onChange={(e) => set("id", e.target.value)}
                />
              </label>
            )}
            <label className="block">
              <span className="text-xs font-medium text-gray-500">팀원 이름</span>
              <input
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                placeholder="홍길동"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </label>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-pink-500 mb-2">Instagram</p>
              <label className="block mb-2">
                <span className="text-xs font-medium text-gray-500">Account ID</span>
                <input
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="17841400000000000"
                  value={form.igAccountId}
                  onChange={(e) => set("igAccountId", e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500">Access Token</span>
                <input
                  type="password"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="EAAxxxxxxx..."
                  value={form.igAccessToken}
                  onChange={(e) => set("igAccessToken", e.target.value)}
                />
              </label>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">Threads</p>
              <label className="block mb-2">
                <span className="text-xs font-medium text-gray-500">User ID</span>
                <input
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="1234567890"
                  value={form.threadsUserId}
                  onChange={(e) => set("threadsUserId", e.target.value)}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500">Access Token</span>
                <input
                  type="password"
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="THRxxxxxxx..."
                  value={form.threadsAccessToken}
                  onChange={(e) => set("threadsAccessToken", e.target.value)}
                />
              </label>
            </div>

            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-semibold text-gray-700 mb-2">콘텐츠 설정</p>
              <label className="block mb-2">
                <span className="text-xs font-medium text-gray-500">토픽 키워드 (쉼표 구분)</span>
                <input
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="마케팅 자동화, SNS 운영, 디지털 마케팅"
                  value={form.settings.topics}
                  onChange={(e) => setSetting("topics", e.target.value)}
                />
              </label>
              <label className="block mb-2">
                <span className="text-xs font-medium text-gray-500">브랜드명</span>
                <input
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="에덴 에이전트"
                  value={form.settings.brandName}
                  onChange={(e) => setSetting("brandName", e.target.value)}
                />
              </label>
              <label className="block mb-2">
                <span className="text-xs font-medium text-gray-500">톤앤매너</span>
                <input
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  placeholder="친근하고 전문적인"
                  value={form.settings.tone}
                  onChange={(e) => setSetting("tone", e.target.value)}
                />
              </label>
              <label className="block mb-2">
                <span className="text-xs font-medium text-gray-500">슬라이드 수</span>
                <input
                  type="number"
                  min={1}
                  max={10}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  value={form.settings.slideCount}
                  onChange={(e) => setSetting("slideCount", Number(e.target.value))}
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-500">캡션 템플릿</span>
                <textarea
                  rows={3}
                  className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                  placeholder="{title}\n\n{body}\n\n#마케팅 #자동화"
                  value={form.settings.captionTemplate}
                  onChange={(e) => setSetting("captionTemplate", e.target.value)}
                />
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-all"
            >
              취소
            </button>
            <button
              onClick={() => onSave(form)}
              className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-all"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 실행 이력 행 ───
function HistoryRow({ entry }) {
  const date = new Date(entry.startedAt).toLocaleString("ko-KR");
  const statusColor = entry.status === "success" ? "text-green-600 bg-green-50" :
    entry.status === "partial" ? "text-yellow-600 bg-yellow-50" : "text-red-600 bg-red-50";
  const statusLabel = entry.status === "success" ? "성공" : entry.status === "partial" ? "부분성공" : "실패";

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusColor}`}>
            {statusLabel}
          </span>
          <span className="text-xs text-gray-400">{date}</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-500">{entry.triggeredBy === "cron" ? "자동" : "수동"}</span>
        </div>
        <p className="text-sm font-medium text-gray-800 truncate">{entry.accountName || entry.accountId}</p>
        {entry.error && (
          <p className="text-xs text-red-500 mt-1 truncate">{entry.error}</p>
        )}
      </div>
      {entry.igPermalink && (
        <a
          href={entry.igPermalink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-pink-500 hover:underline whitespace-nowrap"
        >
          IG 링크 →
        </a>
      )}
    </div>
  );
}

// ─── 메인 FullAutoPage ───
export default function FullAutoPage({ onBack }) {
  const [tab, setTab] = useState("accounts");
  const [accounts, setAccounts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(null); // 현재 실행중인 accountId
  const [modalAccount, setModalAccount] = useState(undefined); // undefined=닫힘, null=신규, object=편집
  const [toast, setToast] = useState(null);

  // 토스트 표시
  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 설정 로드
  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API_BASE, { headers: { Authorization: `Bearer ${SECRET}` } });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAccounts(data.accounts || []);
      setHistory((data.history || []).slice(0, 50));
    } catch (e) {
      showToast(e.message || "설정 로드 실패", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  // 계정 저장 (추가/편집)
  const handleSaveAccount = async (form) => {
    try {
      const res = await fetch(API_BASE, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ account: form }),
      });
      if (!res.ok) throw new Error(await res.text());
      setModalAccount(undefined);
      showToast("저장 완료");
      loadConfig();
    } catch (e) {
      showToast(e.message || "저장 실패", "error");
    }
  };

  // 계정 삭제
  const handleDeleteAccount = async (id) => {
    if (!confirm("계정을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(API_BASE, {
        method: "DELETE",
        headers: authHeaders(),
        body: JSON.stringify({ accountId: id }),
      });
      if (!res.ok) throw new Error(await res.text());
      showToast("삭제 완료");
      loadConfig();
    } catch (e) {
      showToast(e.message || "삭제 실패", "error");
    }
  };

  // 자동화 ON/OFF 토글
  const handleToggle = async (id, enabled) => {
    const acc = accounts.find((a) => a.id === id);
    if (!acc) return;
    await handleSaveAccount({ ...acc, enabled });
  };

  // 수동 실행
  const handleRun = async (accountId) => {
    setRunning(accountId);
    try {
      const res = await fetch(RUN_API, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ accountId, triggeredBy: "manual" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "실행 실패");
      showToast("실행 완료!");
      setTab("history");
      loadConfig();
    } catch (e) {
      showToast(e.message || "실행 실패", "error");
    } finally {
      setRunning(null);
    }
  };

  const TABS = [
    { key: "accounts", label: "계정 관리" },
    { key: "history", label: "실행 이력" },
  ];

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 sm:px-10 py-8 sm:py-12">

        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-8">
          <button
            onClick={onBack}
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6"/>
            </svg>
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-900">풀가동화 콘텐츠</h2>
            <p className="text-sm text-gray-400">크롤링 → 기획 → 이미지 생성 → IG/Threads 자동 발행</p>
          </div>
        </div>

        {/* Hobby 플랜 안내 배너 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 mt-0.5 flex-shrink-0">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
          <div className="text-xs text-amber-700">
            <span className="font-semibold">Vercel Hobby 플랜:</span> 크론 자동 실행은 하루 1회만 가능합니다. 수동 "지금 실행" 버튼은 제한 없이 사용 가능합니다. 매시 자동 실행은 Pro 플랜이 필요합니다.
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 탭1: 계정 관리 */}
        {tab === "accounts" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">팀원별 Instagram + Threads 계정을 관리합니다</p>
              <button
                onClick={() => setModalAccount(null)}
                className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                </svg>
                계정 추가
              </button>
            </div>

            {loading ? (
              <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm">아직 등록된 계정이 없습니다</p>
                <button
                  onClick={() => setModalAccount(null)}
                  className="mt-3 text-orange-500 text-sm hover:underline"
                >
                  첫 계정 추가하기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {accounts.map((acc) => (
                  <div key={acc.id}>
                    <AccountCard
                      account={acc}
                      onToggle={handleToggle}
                      onDelete={handleDeleteAccount}
                      onEdit={(a) => setModalAccount(a)}
                    />
                    {/* 지금 실행 버튼 */}
                    <button
                      onClick={() => handleRun(acc.id)}
                      disabled={running === acc.id}
                      className="mt-2 w-full py-2 rounded-xl border border-orange-200 text-orange-500 text-sm font-medium hover:bg-orange-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                    >
                      {running === acc.id ? (
                        <>
                          <span className="animate-spin inline-block w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full" />
                          실행 중...
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
                          </svg>
                          지금 실행
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 탭2: 실행 이력 */}
        {tab === "history" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">크론/수동 실행 결과 (최근 50건)</p>
              <button
                onClick={loadConfig}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
                </svg>
                새로고침
              </button>
            </div>

            {loading ? (
              <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                아직 실행 이력이 없습니다
              </div>
            ) : (
              <div className="space-y-3">
                {history.map((entry, i) => (
                  <HistoryRow key={entry.runId || i} entry={entry} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 계정 편집/추가 모달 */}
      {modalAccount !== undefined && (
        <AccountModal
          account={modalAccount}
          onSave={handleSaveAccount}
          onClose={() => setModalAccount(undefined)}
        />
      )}

      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3 rounded-xl shadow-lg text-sm font-medium text-white z-50 transition-all ${
          toast.type === "error" ? "bg-red-500" : "bg-gray-900"
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
