import { useState } from "react";
import { callGemini } from "../utils/gemini";
import { relativeTime } from "../utils/storage";
import { IconArrowUp } from "../components/Icons";

export default function HomePage({ onStart, projects, onDelete, onLoad }) {
  const [idea, setIdea] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState(null);
  const [suggestedTopics, setSuggestedTopics] = useState([]);

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
            <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">PF</div>
            <div>
              <div className="text-xs font-bold text-gray-800">EDEN TEAM</div>
              <div className="text-xs text-purple-500 font-medium">STARTER</div>
            </div>
          </div>
        </div>
        <nav className="px-2 space-y-0.5">
          {['홈', '모든 프로젝트', '휴지통', '관리자', '플랜 및 결제', '알림함'].map((item, i) => (
            <div key={item} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${i === 0 ? 'bg-purple-50 text-purple-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}>
              <span className="text-base">{['🏠','📋','🗑️','⚙️','💳','🔔'][i]}</span>
              {item}
            </div>
          ))}
        </nav>
        <div className="px-4 mt-4">
          <div className="text-xs text-gray-400 font-medium mb-2">즐겨찾기</div>
          <p className="text-xs text-gray-300">즐겨찾기한 프로젝트가 없습니다.</p>
        </div>
        <div className="mt-auto px-4 py-3 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold">E</div>
            <span className="text-sm font-medium text-gray-700">EDEN TEAM</span>
          </div>
        </div>
      </aside>

      {/* 메인 */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center px-8"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, #ede9fe 0%, #f9fafb 60%)' }}>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">안녕하세요, EDEN TEAM님!</h1>
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
              <p className="text-sm text-gray-400 text-center mb-4">최근 사용한 프로젝트</p>
              <div className="grid grid-cols-2 gap-4">
                {projects.slice(0, 6).map(p => (
                  <div key={p.id}
                    className="relative bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:border-purple-300 hover:shadow-md transition-all group"
                    onMouseEnter={() => setHoveredId(p.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={() => onLoad(p)}>
                    <button
                      onClick={e => { e.stopPropagation(); onDelete(p.id); }}
                      className={`absolute top-2 left-2 w-6 h-6 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-xs font-bold transition-all hover:bg-red-500 hover:text-white z-10 ${hoveredId === p.id ? 'opacity-100' : 'opacity-0'}`}>
                      ✕
                    </button>
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
      </main>
    </div>
  );
}
