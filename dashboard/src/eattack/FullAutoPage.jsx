// 풀가동화 콘텐츠 대시보드
// 관리자 설정 계정을 선택 → 파이프라인 실행 + 이력 조회

import { useState, useEffect, useCallback } from "react";
import { emitEAttackContext } from "./eattackContext";

const RUN_API = "/api/full-auto-run";
const HISTORY_API = "/api/full-auto-config";
const SECRET = import.meta.env.VITE_FULL_AUTO_SECRET || "";

// ─── localStorage 키 (AdminPage와 동일) ───
const USERS_KEY     = "eden_users_v1";
const igKey         = (u) => `eden_ig_${u}_v1`;
const threadsKey    = (u) => `eden_threads_${u}_v1`;
const fullAutoKey   = (u) => `eden_fullauto_${u}_v1`;

function loadLocalStorage(key) {
  try { return JSON.parse(localStorage.getItem(key)) || null; }
  catch { return null; }
}

// ─── 관리자 계정 목록 로드 ───
function loadAdminAccounts() {
  const users = loadLocalStorage(USERS_KEY) || [];
  return users.map((u) => {
    const ig = loadLocalStorage(igKey(u.username)) || {};
    const th = loadLocalStorage(threadsKey(u.username)) || {};
    const fa = loadLocalStorage(fullAutoKey(u.username)) || {};
    return {
      id: u.username,
      name: u.displayName,
      igAccountId: ig.accountId || "",
      igAccessToken: ig.accessToken || "",
      threadsUserId: th.userId || "",
      threadsAccessToken: th.accessToken || "",
      settings: {
        topics: fa.topics || "",
        brandName: fa.brandName || "",
        tone: fa.tone || "친근하고 전문적인",
        slideCount: fa.slideCount || 5,
        captionTemplate: fa.captionTemplate || "{title}\n\n{body}\n\n#마케팅 #자동화",
      },
    };
  });
}

// ─── 실행 이력 행 ───
function HistoryRow({ entry }) {
  const date = new Date(entry.startedAt).toLocaleString("ko-KR");
  const statusColor =
    entry.status === "success" ? "text-green-600 bg-green-50 border-green-100" :
    entry.status === "partial"  ? "text-yellow-600 bg-yellow-50 border-yellow-100" :
                                  "text-red-600 bg-red-50 border-red-100";
  const statusLabel =
    entry.status === "success" ? "성공" :
    entry.status === "partial"  ? "부분성공" : "실패";

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>
            {statusLabel}
          </span>
          <span className="text-xs text-gray-400">{date}</span>
          <span className="text-xs text-gray-300">·</span>
          <span className="text-xs text-gray-500">{entry.triggeredBy === "cron" ? "자동" : "수동"}</span>
        </div>
        <p className="text-sm font-medium text-gray-800 truncate">{entry.accountName || entry.accountId}</p>
        {entry.topic && <p className="text-xs text-gray-400 mt-0.5 truncate">주제: {entry.topic}</p>}
        {entry.error && <p className="text-xs text-red-500 mt-1 truncate">{entry.error}</p>}
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

// ─── 계정 상태 배지 ───
function StatusBadge({ ok, label }) {
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
      ok ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
    }`}>
      {label} {ok ? "✓" : "미설정"}
    </span>
  );
}

// ─── 메인 FullAutoPage ───
export default function FullAutoPage({ onBack }) {
  const [tab, setTab] = useState("accounts");
  const [accounts, setAccounts] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [running, setRunning] = useState(null); // 실행 중인 account.id
  const [toast, setToast] = useState(null);
  const [expandedAccount, setExpandedAccount] = useState(null); // 예약 일정 펼친 계정 id
  const [scheduleMap, setScheduleMap] = useState({}); // { [username]: [] }
  const [scheduleLoading, setScheduleLoading] = useState(null); // 로딩 중인 username

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    emitEAttackContext({
      page: "FullAutoPage",
      section: "풀가동화 콘텐츠",
      tab,
      status: running ? "실행 중" : "대기",
      summary: `현재 ${tab === "accounts" ? "계정 선택" : "실행 이력"} 탭입니다. 계정 ${accounts.length}개, 최근 이력 ${history.length}건.`,
    });
  }, [tab, running, accounts.length, history.length]);

  // 관리자 계정 로드 (localStorage)
  const refreshAccounts = useCallback(() => {
    setAccounts(loadAdminAccounts());
  }, []);

  // 실행 이력 로드 (Blob)
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetch(HISTORY_API, {
        headers: SECRET ? { Authorization: `Bearer ${SECRET}` } : {},
      });
      if (res.ok) {
        const data = await res.json();
        setHistory((data.history || []).slice(0, 50));
      }
    } catch {
      // 이력 로드 실패는 무시 (처음엔 없을 수 있음)
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAccounts();
    loadHistory();
  }, [refreshAccounts, loadHistory]);

  // 탭 변경 시 이력 새로고침
  useEffect(() => {
    if (tab === "history") loadHistory();
  }, [tab, loadHistory]);

  // 예약 일정 토글
  const toggleSchedules = async (accId) => {
    if (expandedAccount === accId) {
      setExpandedAccount(null);
      return;
    }
    setExpandedAccount(accId);
    if (scheduleMap[accId]) return; // 이미 로드됨
    setScheduleLoading(accId);
    try {
      const res = await fetch(`/api/schedule?username=${encodeURIComponent(accId)}`);
      const data = res.ok ? await res.json() : {};
      setScheduleMap(prev => ({ ...prev, [accId]: data.schedules || [] }));
    } catch {
      setScheduleMap(prev => ({ ...prev, [accId]: [] }));
    } finally {
      setScheduleLoading(null);
    }
  };

  // 수동 실행
  const handleRun = async (account) => {
    if (!account.igAccountId && !account.threadsUserId) {
      showToast("IG 또는 Threads 계정 정보가 없습니다. 관리자에서 설정해주세요.", "error");
      return;
    }
    if (!account.settings.topics) {
      showToast("토픽 키워드가 없습니다. 관리자에서 풀가동화 설정을 해주세요.", "error");
      return;
    }

    setRunning(account.id);
    try {
      const res = await fetch(RUN_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(SECRET ? { Authorization: `Bearer ${SECRET}` } : {}),
        },
        body: JSON.stringify({ account, triggeredBy: "manual" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "실행 실패");
      showToast("실행 완료!");
      setTab("history");
      await loadHistory();
    } catch (e) {
      showToast(e.message || "실행 실패", "error");
    } finally {
      setRunning(null);
    }
  };

  const TABS = [
    { key: "accounts", label: "계정 선택" },
    { key: "history",  label: "실행 이력" },
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
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500 mt-0.5 flex-shrink-0">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>
          </svg>
          <div className="text-xs text-amber-700">
            <span className="font-semibold">Vercel Hobby 플랜:</span> 크론 자동 실행은 하루 1회만 가능합니다.
            수동 "지금 실행"은 제한 없이 사용 가능합니다. 매시 자동 실행은 Pro 플랜이 필요합니다.
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

        {/* ── 탭1: 계정 선택 ── */}
        {tab === "accounts" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">
                관리자 → 소셜 계정 연동에서 설정한 계정으로 실행합니다
              </p>
              <button
                onClick={refreshAccounts}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
                </svg>
                새로고침
              </button>
            </div>

            {accounts.length === 0 ? (
              <div className="text-center py-16 text-gray-400 bg-white border border-dashed border-gray-200 rounded-2xl">
                <p className="text-sm mb-1">등록된 사용자가 없습니다</p>
                <p className="text-xs text-gray-300">관리자 → 사용자 관리에서 팀원을 추가하세요</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {accounts.map((acc) => {
                  const hasIg = !!(acc.igAccountId && acc.igAccessToken);
                  const hasTh = !!(acc.threadsUserId && acc.threadsAccessToken);
                  const hasSettings = !!acc.settings.topics;
                  const canRun = (hasIg || hasTh) && hasSettings;

                  return (
                    <div key={acc.id} className="bg-white border border-gray-200 rounded-2xl p-5">
                      {/* 사용자 정보 */}
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {acc.name?.charAt(0) || "?"}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{acc.name}</p>
                          <p className="text-[10px] text-gray-400">{acc.id}</p>
                        </div>
                      </div>

                      {/* 연동 상태 배지 */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <StatusBadge ok={hasIg} label="Instagram" />
                        <StatusBadge ok={hasTh} label="Threads" />
                        <StatusBadge ok={hasSettings} label="풀가동화 설정" />
                      </div>

                      {/* 설정 요약 */}
                      {hasSettings && (
                        <div className="bg-gray-50 rounded-lg px-3 py-2 mb-3 text-xs text-gray-500 space-y-0.5">
                          <p className="truncate"><span className="font-medium">토픽:</span> {acc.settings.topics}</p>
                          {acc.settings.brandName && (
                            <p className="truncate"><span className="font-medium">브랜드:</span> {acc.settings.brandName}</p>
                          )}
                          <p><span className="font-medium">슬라이드:</span> {acc.settings.slideCount}장</p>
                        </div>
                      )}

                      {/* 실행 버튼 */}
                      {!canRun ? (
                        <div className="text-xs text-gray-400 bg-gray-50 rounded-xl py-2.5 text-center">
                          {!hasIg && !hasTh ? "소셜 계정을 연동해주세요" : "풀가동화 설정이 필요합니다"}
                          <br />
                          <span className="text-[10px]">관리자 → 소셜 계정 연동</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRun(acc)}
                          disabled={running === acc.id}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white text-sm font-semibold hover:from-orange-600 hover:to-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                          {running === acc.id ? (
                            <>
                              <span className="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                              실행 중...
                            </>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>
                              </svg>
                              지금 실행
                            </>
                          )}
                        </button>
                      )}

                      {/* 예약 발행 일정 토글 */}
                      <button
                        onClick={() => toggleSchedules(acc.id)}
                        className={`mt-2 w-full py-2 text-xs font-semibold rounded-xl border transition-all flex items-center justify-center gap-1.5
                          ${expandedAccount === acc.id
                            ? "border-amber-300 bg-amber-50 text-amber-700"
                            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                        예약 발행 일정
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${expandedAccount === acc.id ? "rotate-180" : ""}`}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>

                      {/* 예약 발행 목록 */}
                      {expandedAccount === acc.id && (
                        <div className="mt-2 space-y-1.5">
                          {scheduleLoading === acc.id ? (
                            <div className="text-center py-3 text-xs text-gray-400">불러오는 중...</div>
                          ) : !scheduleMap[acc.id] || scheduleMap[acc.id].length === 0 ? (
                            <div className="text-center py-3 text-xs text-gray-400 bg-gray-50 rounded-xl border border-gray-100">
                              예약된 콘텐츠가 없습니다
                            </div>
                          ) : (
                            scheduleMap[acc.id]
                              .sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))
                              .map(p => (
                              <div key={p.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border
                                ${p.status === "pending" ? "bg-amber-50 border-amber-200" : p.status === "posted" ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                                <div className={`w-2 h-2 rounded-full flex-shrink-0
                                  ${p.status === "pending" ? "bg-amber-400 animate-pulse" : p.status === "posted" ? "bg-emerald-500" : "bg-red-400"}`} />
                                <span className="text-gray-500 flex-shrink-0 font-mono text-[11px]">
                                  {new Date(p.scheduledAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                                </span>
                                <span className="flex-1 text-gray-700 truncate">{p.text?.slice(0, 28)}{p.text?.length > 28 ? "..." : ""}</span>
                                <span className={`flex-shrink-0 font-semibold text-[11px]
                                  ${p.status === "pending" ? "text-amber-600" : p.status === "posted" ? "text-emerald-600" : "text-red-500"}`}>
                                  {p.status === "pending" ? "대기" : p.status === "posted" ? "완료" : "실패"}
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── 탭2: 실행 이력 ── */}
        {tab === "history" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500">크론/수동 실행 결과 (최근 50건)</p>
              <button
                onClick={loadHistory}
                className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
                </svg>
                새로고침
              </button>
            </div>

            {historyLoading ? (
              <div className="text-center py-16 text-gray-400 text-sm">불러오는 중...</div>
            ) : history.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm bg-white border border-dashed border-gray-200 rounded-2xl">
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
