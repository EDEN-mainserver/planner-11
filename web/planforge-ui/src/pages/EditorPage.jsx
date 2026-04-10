import { useState, useRef, useEffect, useCallback } from "react";
import { callGemini, deepMergePrd } from "../utils/gemini";
import { IconSend } from "../components/Icons";
import PRDPanel from "../components/PRDPanel";
import SpecPanel from "../components/SpecPanel";
import FlowPanel from "../components/FlowPanel";

export default function EditorPage({ prd, setPrd, projectTitle, setProjectTitle, onHome, aiScore, setAiScore }) {
  const [activeTab, setActiveTab]   = useState('prd');
  const [chatInput, setChatInput]   = useState('');
  const [messages, setMessages]     = useState([{ role: 'assistant', content: 'PRD가 생성되었습니다! 수정이 필요하면 말씀해주세요.' }]);
  const [isLoading, setIsLoading]   = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [specData, setSpecData]     = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const chatEndRef = useRef(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const sendMessage = useCallback(async (overrideText = null) => {
    const text = overrideText ?? chatInput.trim();
    if (!text || isLoading) return;
    setSuggestions([]);
    const userMsg = { role: 'user', content: text };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    if (!overrideText) setChatInput('');
    setIsLoading(true);

    const systemPrompt = `당신은 PlanForge AI 어시스턴트입니다. 기존 PRD를 개선하고 보완합니다.

현재 PRD: ${JSON.stringify(prd, null, 2)}

규칙:
1. 매 답변마다 반드시 PRD에서 부족한 부분을 찾아 질문하세요 (한 번에 1~2개).
2. 매 답변마다 __PRD_UPDATE__ 블록을 포함하세요. 아직 모르는 필드는 빈 문자열로.
3. 매 답변마다 __SUGGESTIONS__ 블록을 포함하세요.
   - __SUGGESTIONS__ 은 AI가 방금 한 질문에 대한 [사용자 답변 후보] 3~4개입니다.
   - 사용자가 클릭하면 그 답변이 자동으로 전송됩니다.
   - 질문 내용과 맥락에 맞는 구체적인 답변 후보를 생성하세요.
   - 예: AI가 "타겟 사용자는?" 이라고 물으면 → ["소규모 쇼핑몰 운영자", "카카오톡으로 CS 업무를 보는 소상공인", "1인 기업/프리랜서", "직접 입력할게요"]
4. 한국어로 친근하게 답변하세요.
5. 답변 텍스트에서 블록 언급 금지.

__PRD_UPDATE__
{"overview":{"one_liner":"","product_goal":"","background":""},"core_value":{"problem":"","solution":"","differentiator":""},"target":{"users":"","scenario":""},"metrics":{"kpis":"","risks":""},"settings":{"category":"","roles":[],"devices":[]}}
__END_PRD_UPDATE__

__SUGGESTIONS__
["답변 후보 1","답변 후보 2","답변 후보 3","직접 입력할게요"]
__END_SUGGESTIONS__`;

    try {
      const responseText = await callGemini(newHistory.slice(-12), systemPrompt);
      const prdMatch = responseText.match(/__PRD_UPDATE__\s*([\s\S]*?)\s*__END_PRD_UPDATE__/);
      const sugMatch = responseText.match(/__SUGGESTIONS__\s*([\s\S]*?)\s*__END_SUGGESTIONS__/);
      let displayText = responseText
        .replace(/__PRD_UPDATE__[\s\S]*?__END_PRD_UPDATE__/, '')
        .replace(/__SUGGESTIONS__[\s\S]*?__END_SUGGESTIONS__/, '')
        .trim();
      if (prdMatch) { try { setPrd(prev => deepMergePrd(prev, JSON.parse(prdMatch[1].trim()))); } catch (e) {} }
      if (sugMatch) { try { const s = JSON.parse(sugMatch[1].trim()); if (Array.isArray(s)) setSuggestions(s.slice(0, 4)); } catch (e) {} }
      setMessages(prev => [...prev, { role: 'assistant', content: displayText || '업데이트되었습니다.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `오류: ${err.message}` }]);
    }
    setIsLoading(false);
  }, [chatInput, isLoading, messages, prd, setPrd]);

  const tabs = [{ id: 'prd', label: 'PRD' }, { id: 'spec', label: '기능명세서' }, { id: 'flow', label: '유저플로우' }];

  return (
    <div className="h-screen flex flex-col bg-gray-50" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      <nav className="flex items-center px-4 h-12 border-b border-gray-200 bg-white shrink-0 gap-3 shadow-sm">
        <button onClick={onHome}
          className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold hover:bg-purple-700 transition-colors">
          PF
        </button>
        <div className="w-px h-5 bg-gray-200" />
        <input value={projectTitle} onChange={e => setProjectTitle(e.target.value)}
          className="bg-transparent text-sm text-gray-700 font-medium w-56 outline-none focus:bg-purple-50 focus:ring-1 focus:ring-purple-200 rounded-lg px-2 py-1" />
        <div className="flex-1" />
        <div className="flex bg-gray-100 rounded-xl p-1 gap-0.5">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === t.id ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <button className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors shadow-sm">내보내기</button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen ? (
          <div className="w-[300px] shrink-0 border-r border-gray-200 bg-white flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
              <button className="text-xs font-medium text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg hover:bg-purple-100 transition-colors">+ 새 채팅</button>
              <div className="flex-1" />
              <button onClick={() => setSidebarOpen(false)}
                className="text-gray-300 hover:text-gray-500 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${m.role === 'user' ? 'bg-gray-100 text-gray-500' : 'bg-purple-100 text-purple-600'}`}>
                    {m.role === 'user' ? 'J' : 'P'}
                  </div>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'bg-purple-500 text-white' : 'bg-white border border-gray-200 text-gray-700 shadow-sm'}`}>
                    {m.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold">P</div>
                  <div className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: d + 'ms' }} />
                    ))}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {suggestions.length > 0 && (
              <div className="px-3 pb-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-xs text-gray-400 font-medium">추천 답변</span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
                <div className="flex flex-col gap-1.5">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => sendMessage(s)}
                      className="w-full text-left px-3 py-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-xl hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700 transition-all flex items-center gap-2 group shadow-sm">
                      <span className="w-4 h-4 rounded-full bg-purple-100 text-purple-500 flex items-center justify-center text-xs shrink-0 group-hover:bg-purple-500 group-hover:text-white transition-colors font-bold">
                        {i + 1}
                      </span>
                      <span className="leading-snug">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-3 pb-3 pt-1">
              <div className="flex items-end gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:border-purple-300 focus-within:ring-2 focus-within:ring-purple-100 transition-all">
                <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
                  placeholder="PRD 수정을 요청하세요..." rows={1}
                  className="flex-1 bg-transparent text-sm text-gray-700 placeholder-gray-300 outline-none resize-none" />
                <button onClick={() => sendMessage()} disabled={!chatInput.trim()}
                  className={`p-1.5 rounded-lg shrink-0 transition-all ${chatInput.trim() ? 'bg-purple-600 text-white hover:bg-purple-700' : 'text-gray-300'}`}>
                  <IconSend />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button onClick={() => setSidebarOpen(true)}
            className="w-10 shrink-0 border-r border-gray-200 bg-white flex items-center justify-center text-gray-300 hover:text-purple-500 hover:bg-purple-50 transition-colors">
            💬
          </button>
        )}

        <div className="flex-1 overflow-hidden">
          {activeTab === 'prd'  && <PRDPanel prd={prd} setPrd={setPrd} aiScore={aiScore} setAiScore={setAiScore} />}
          {activeTab === 'spec' && <SpecPanel prd={prd} specData={specData} setSpecData={setSpecData} />}
          {activeTab === 'flow' && <FlowPanel />}
        </div>
      </div>
    </div>
  );
}
