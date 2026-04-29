import { useState, useEffect } from "react";
import { callGemini } from "../utils/gemini";
import { relativeTime } from "../utils/storage";
import { IconArrowUp } from "../components/Icons";
import EAttackPage from "../eattack/EAttackPage";
import MoneyPage from "../eattack/MoneyPage";
import GrowthDBPage from "../eattack/GrowthDBPage";
import AdminPage from "./AdminPage";
import PricingPage from "./PricingPage";
import { getSession, clearSession } from "../eattack/LoginModal";
import { useSubscription } from "../hooks/useSubscription";

export default function HomePage({ onStart, projects, onDelete, onLoad, trash = [], onRestore, onPermanentDelete, onEmptyTrash }) {
  const [session, setSession] = useState(() => getSession());
  useEffect(() => {
    const handleSessionChange = (e) => setSession(e.detail || getSession());
    window.addEventListener("eden-session-change", handleSessionChange);
    return () => window.removeEventListener("eden-session-change", handleSessionChange);
  }, []);
  const { plan, usageCount, monthlyLimit, limitReached, loading: subLoading, isAdmin } = useSubscription();
  const [idea, setIdea] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [suggestedTopics, setSuggestedTopics] = useState([]);
  const [activePage, setActivePage] = useState('home'); // 'home' | 'projects' | 'trash' | 'admin' | 'pricing'
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const [permDeleteId, setPermDeleteId] = useState(null);
  const handleSuggest = async () => {
    setIsLoading(true);
    setSuggestedTopics([]);
    try {
      const text = await callGemini(
        [{ role: 'user', content: '창의적인 AI/SaaS 서비스 아이디어 4개를 JSON 배열로 줘. 각각 한 문장(20~40자). 예: ["배달 기사 전용 실시간 경로 최적화 앱", "..."]' }],
        '당신은 창의적인 스타트업 아이디어 생성기입니다. JSON 배열 형식으로만 답하세요. 다른 텍스트 없이 ["아이디어1","아이디어2","아이디어3","아이디어4"] 형태로만 출력하세요.'
      );
      const match = text.match(/\[[\s\S]*\]/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed)) setSuggestedTopics(parsed.slice(0, 4));
      }
    } catch (e) {
      console.error(e);
    }
    setIsLoading(false);
  };

  const handleStart = () => {
    if (!idea.trim()) return;
    onStart(idea.trim());
  };

  return (
    <div className="h-screen flex bg-gray-50" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* 사이드바 */}
      <aside className="w-52 shrink-0 bg-white border-r border-gray-200 flex flex-col py-4">
        <div className="px-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">ED</div>
            <div>
              <div className="text-xs font-bold text-gray-800">EDEN DASHBOARD</div>
              <div className="text-xs text-purple-500 font-medium">STARTER</div>
            </div>
          </div>
        </div>
        <nav className="px-2 space-y-0.5">
          {[
            { key: 'home',     label: '홈',          icon: '🏠' },
            { key: 'projects', label: '모든 프로젝트', icon: '📋' },
            { key: 'trash',    label: '휴지통',       icon: '🗑️', badge: trash.length },
            { key: 'admin',    label: '관리자',       icon: '⚙️' },
            { key: 'notif',    label: '알림함',       icon: '🔔' },
          ].map(item => (
            <div key={item.key}
              onClick={() => ['home','projects','trash','admin'].includes(item.key) && setActivePage(item.key)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors
                ${activePage === item.key ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
              <span className="text-base">{item.icon}</span>
              {item.label}
              {item.badge > 0 && (
                <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                  {item.badge}
                </span>
              )}
              {item.key === 'projects' && projects.length > 0 && !item.badge && (
                <span className="ml-auto text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">
                  {projects.length}
                </span>
              )}
            </div>
          ))}
        </nav>
        <div className="px-4 mt-4">
          <div className="text-xs text-gray-400 font-medium mb-2">즐겨찾기</div>
          <p className="text-xs text-gray-300">즐겨찾기한 프로젝트가 없습니다.</p>
        </div>
        {/* E-Attack 섹션 — PlanForge와 구분 */}
        <div className="px-2 mt-6 pt-4 border-t border-gray-200">
          <div className="px-2 mb-2">
            <div className="text-xs text-gray-400 font-medium">자동화</div>
          </div>
          <div
            onClick={() => setActivePage('eattack')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors
              ${activePage === 'eattack' ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            <span className="text-base">🚀</span>
            E-Attack
          </div>
          <div
            onClick={() => setActivePage('money')}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors
              ${activePage === 'money' ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
            <span className="text-base">💸</span>
            이걸 돈내고 써?
          </div>
        </div>
        {/* 관리자 전용 툴 섹션 */}
        {isAdmin && (
          <div className="px-2 mt-6 pt-4 border-t border-gray-200">
            <div className="px-2 mb-2">
              <div className="text-xs text-gray-400 font-medium">관리자 전용</div>
            </div>
            <div
              onClick={() => setActivePage('growthdb')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors
                ${activePage === 'growthdb' ? 'bg-orange-50 text-orange-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
              <span className="text-base">📊</span>
              에쿠 GrowthDB
            </div>
          </div>
        )}
        {/* 구독 상태 */}
        {!subLoading && (
          <div className="px-3 mx-2 mb-2 py-2.5 bg-gray-50 border border-gray-200 rounded-xl">
            {plan ? (
              <>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold text-gray-600">{plan.name}</span>
                  <button
                    onClick={() => setActivePage('pricing')}
                    className="text-[10px] text-purple-500 hover:text-purple-700 font-medium"
                  >
                    업그레이드
                  </button>
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${limitReached ? "bg-red-400" : "bg-purple-500"}`}
                      style={{ width: `${Math.min(100, (usageCount / monthlyLimit) * 100)}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${limitReached ? "text-red-500" : "text-gray-500"}`}>
                    {usageCount}/{monthlyLimit}
                  </span>
                </div>
                <p className="text-[10px] text-gray-400">이번 달 사용량</p>
              </>
            ) : (
              <button
                onClick={() => setActivePage('pricing')}
                className="w-full text-xs font-semibold text-purple-600 hover:text-purple-800 text-center py-0.5"
              >
                플랜 구독하기 →
              </button>
            )}
          </div>
        )}

        <div className="mt-auto px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold flex-shrink-0">
              {(session?.displayName || "E").charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-medium text-gray-700 flex-1 truncate">
              {session?.displayName || "EDEN TEAM"}
            </span>
            <button
              onClick={() => { clearSession(); window.location.reload(); }}
              title="로그아웃"
              className="w-6 h-6 flex items-center justify-center rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* 메인 */}
      <main className="flex-1 flex flex-col overflow-hidden">

        {/* ════ 모든 프로젝트 화면 ════ */}
        {activePage === 'projects' && (
          <div className="flex-1 overflow-y-auto px-10 py-8 bg-gray-50">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">모든 프로젝트</h2>
                <p className="text-sm text-gray-400 mt-0.5">총 {projects.length}개의 프로젝트</p>
              </div>
              <button onClick={() => setActivePage('home')}
                className="px-4 py-2 text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors">
                + 새 프로젝트
              </button>
            </div>

            {projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div className="text-4xl">📋</div>
                <p className="text-gray-500 text-sm">아직 프로젝트가 없습니다.</p>
                <button onClick={() => setActivePage('home')}
                  className="mt-2 px-5 py-2 text-sm font-semibold text-purple-600 border border-purple-200 rounded-xl hover:bg-purple-50 transition-colors">
                  첫 번째 프로젝트 시작하기
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-5">
                {projects.map(p => (
                  <div key={p.id}
                    className="relative bg-white border border-gray-200 rounded-2xl p-5 cursor-pointer hover:border-purple-300 hover:shadow-lg transition-all group"
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onLoad(p)}>

                    {/* 썸네일 */}
                    <div className="w-full h-28 bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl mb-4 flex items-center justify-center overflow-hidden">
                      {p.prd?.overview?.one_liner ? (
                        <p className="text-xs text-purple-400 font-medium px-4 text-center leading-relaxed line-clamp-3">
                          {p.prd.overview.one_liner}
                        </p>
                      ) : (
                        <div className="text-3xl opacity-30">📄</div>
                      )}
                    </div>

                    {/* 정보 */}
                    <p className="text-sm font-semibold text-gray-800 truncate">{p.title}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-gray-400">{relativeTime(p.updatedAt)}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-300">
                        {p.specData && <span className="px-1.5 py-0.5 bg-purple-50 text-purple-400 rounded-md font-medium">명세서</span>}
                        {p.flowData && <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-400 rounded-md font-medium">플로우</span>}
                      </div>
                    </div>

                    {/* 삭제 버튼 */}
                    {deleteConfirmId === p.id ? (
                      <div className="absolute inset-0 bg-white/95 rounded-2xl flex flex-col items-center justify-center gap-3 z-10"
                        onClick={e => e.stopPropagation()}>
                        <p className="text-sm font-medium text-gray-700">프로젝트를 삭제할까요?</p>
                        <div className="flex gap-2">
                          <button onClick={e => { e.stopPropagation(); onDelete(p.id); setDeleteConfirmId(null); }}
                            className="px-4 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors">
                            삭제
                          </button>
                          <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(null); }}
                            className="px-4 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={e => { e.stopPropagation(); setDeleteConfirmId(p.id); }}
                        className={`absolute top-3 right-3 w-7 h-7 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs transition-all hover:bg-red-100 hover:text-red-500 z-10 ${hoveredId === p.id ? 'opacity-100' : 'opacity-0'}`}>
                        🗑
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ 휴지통 화면 ════ */}
        {activePage === 'trash' && (
          <div className="flex-1 overflow-y-auto px-10 py-8 bg-gray-50">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800">휴지통</h2>
                <p className="text-sm text-gray-400 mt-0.5">삭제된 프로젝트는 30일 후 자동 영구 삭제됩니다.</p>
              </div>
              {trash.length > 0 && (
                <button onClick={onEmptyTrash}
                  className="px-4 py-2 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">
                  휴지통 비우기
                </button>
              )}
            </div>

            {trash.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <div className="text-4xl">🗑️</div>
                <p className="text-gray-400 text-sm">휴지통이 비어 있습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-5">
                {trash.map(p => (
                  <div key={p.id} className="relative bg-white border border-gray-200 rounded-2xl p-5 opacity-80 group"
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(null)}>
                    <div className="w-full h-24 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl mb-4 flex items-center justify-center">
                      <div className="text-3xl opacity-20">📄</div>
                    </div>
                    <p className="text-sm font-semibold text-gray-600 truncate">{p.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{relativeTime(p.deletedAt)} 삭제됨</p>

                    {/* 액션 버튼 */}
                    <div className={`absolute inset-0 bg-white/90 rounded-2xl flex items-center justify-center gap-2 transition-opacity ${hoveredId === p.id ? 'opacity-100' : 'opacity-0'}`}>
                      <button onClick={() => onRestore(p.id)}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors">
                        복원
                      </button>
                      {permDeleteId === p.id ? (
                        <div className="flex gap-1.5">
                          <button onClick={() => { onPermanentDelete(p.id); setPermDeleteId(null); }}
                            className="px-3 py-1.5 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg">확인</button>
                          <button onClick={() => setPermDeleteId(null)}
                            className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
                        </div>
                      ) : (
                        <button onClick={() => setPermDeleteId(p.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-red-500 border border-red-200 hover:bg-red-50 rounded-lg transition-colors">
                          영구 삭제
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════ 관리자 화면 ════ */}
        {activePage === 'admin' && (
          <AdminPage projects={projects} trash={trash} onLoad={onLoad} />
        )}

        {/* ════ E-Attack 화면 ════ */}
        {activePage === 'eattack' && (
          <EAttackPage onGoToPricing={() => setActivePage('pricing')} />
        )}

        {/* ════ 이걸 돈내고 써? 화면 ════ */}
        {activePage === 'money' && (
          <MoneyPage onBack={() => setActivePage('eattack')} />
        )}


        {/* ════ 가격/구독 화면 ════ */}
        {activePage === 'pricing' && (
          <PricingPage
            currentPlanId={plan?.id}
            onBack={() => setActivePage('eattack')}
          />
        )}

        {/* ════ 에쿠 GrowthDB ════ */}
        {activePage === 'growthdb' && (
          <GrowthDBPage />
        )}

        {/* ════ 홈 화면 ════ */}
        {activePage === 'home' && (
        <div className="flex-1 flex flex-col items-center justify-center px-8"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, #ede9fe 0%, #f9fafb 60%)' }}>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">안녕하세요, {session?.displayName || "EDEN TEAM"}님!</h1>
            <p className="text-xl text-gray-600">어떤 제품을 만들고 싶으신가요?</p>
          </div>

          {/* 입력 박스 */}
          <div className="w-full max-w-2xl bg-white rounded-2xl border border-purple-200 shadow-lg shadow-purple-100/50 p-3">
            <textarea value={idea} onChange={e => { setIdea(e.target.value); setSuggestedTopics([]); }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleStart(); }}}
              rows={4} placeholder="만들고자 하는 서비스 아이디어에 대해 간단하게 적어주세요."
              className="w-full text-sm text-gray-700 placeholder-gray-300 outline-none resize-none px-1 py-1 leading-relaxed" />
            <div className="flex items-center justify-between mt-1">
              <button onClick={handleSuggest} disabled={isLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50">
                {isLoading ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    추천 중...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 17A7 7 0 1010 3a7 7 0 000 14zm3.5-9.5V9h-1.25c-.17-.38-.43-.72-.75-.98V7a1.5 1.5 0 00-3 0v1.02c-.32.26-.58.6-.75.98H6.5V7.5h1V8a2.5 2.5 0 005 0v-.5h1zm-5.5 3a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z" />
                    </svg>
                    주제 추천 받기
                  </span>
                )}
              </button>
              <button onClick={handleStart} disabled={!idea.trim()}
                className="w-8 h-8 flex items-center justify-center bg-gray-900 text-white rounded-full hover:bg-gray-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors">
                <IconArrowUp />
              </button>
            </div>
          </div>

          {/* 추천 주제 카드 */}
          {suggestedTopics.length > 0 && (
            <div className="w-full max-w-2xl mt-3">
              <p className="text-xs text-gray-400 text-center mb-2">추천 주제를 선택하면 바로 시작됩니다</p>
              <div className="grid grid-cols-2 gap-2">
                {suggestedTopics.map((topic, i) => (
                  <button key={i} onClick={() => onStart(topic)}
                    className="text-left px-4 py-3 bg-white border border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 transition-all shadow-sm group">
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-700 leading-snug group-hover:text-purple-700">{topic}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 최근 프로젝트 */}
          {projects.length > 0 && (
            <div className="w-full max-w-2xl mt-12">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-400">최근 사용한 프로젝트</p>
                <button onClick={() => setActivePage('projects')}
                  className="text-xs text-purple-500 hover:text-purple-700 font-medium transition-colors">
                  모두 보기 →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {projects.slice(0, 4).map(p => (
                  <div key={p.id}
                    className="relative bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-purple-300 hover:shadow-md transition-all group"
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onLoad(p)}>
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteConfirmId(p.id); }}
                      className={`absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs transition-all hover:bg-red-100 hover:text-red-500 z-10 ${hoveredId === p.id ? 'opacity-100' : 'opacity-0'}`}>
                      🗑
                    </button>
                    {deleteConfirmId === p.id && (
                      <div className="absolute inset-0 bg-white/95 rounded-xl flex flex-col items-center justify-center gap-2 z-10"
                        onClick={e => e.stopPropagation()}>
                        <p className="text-xs font-medium text-gray-700">삭제할까요?</p>
                        <div className="flex gap-1.5">
                          <button onClick={e => { e.stopPropagation(); onDelete(p.id); setDeleteConfirmId(null); }}
                            className="px-3 py-1 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 rounded-lg">삭제</button>
                          <button onClick={e => { e.stopPropagation(); setDeleteConfirmId(null); }}
                            className="px-3 py-1 text-xs font-semibold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
                        </div>
                      </div>
                    )}
                    <div className="w-full h-24 bg-gradient-to-br from-purple-50 to-gray-100 rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                      {p.prd?.overview?.one_liner ? (
                        <p className="text-xs text-purple-400 font-medium px-3 text-center leading-relaxed line-clamp-3">
                          {p.prd.overview.one_liner}
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-1 opacity-20">
                          {[...Array(6)].map((_, i) => <div key={i} className="w-3 h-3 bg-gray-500 rounded-sm" />)}
                        </div>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-700 truncate">{p.title}</p>
                    <p className="text-xs text-gray-400 mt-1">{relativeTime(p.updatedAt)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}
      </main>
    </div>
  );
}
