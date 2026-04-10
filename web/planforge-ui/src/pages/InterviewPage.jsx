import { useState, useRef, useEffect, useCallback } from "react";
import { callGemini, deepMergePrd } from "../utils/gemini";
import InterviewQuestionCard from "../components/InterviewQuestionCard";
import FreeTextInput from "../components/FreeTextInput";
import PrdPreview from "../components/PrdPreview";

export default function InterviewPage({ initialIdea, prd, setPrd, onComplete, onScoreUpdate }) {
  const [messages, setMessages]   = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiScore, setAiScore]     = useState(0);
  const [qCount, setQCount]       = useState(0);
  const chatEndRef   = useRef(null);
  const initialized  = useRef(false);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const isHighScore = aiScore >= 75;
  const isMidScore  = aiScore >= 40;
  const isTired     = qCount >= 7;

  const INTERVIEW_SYSTEM = `당신은 PlanForge AI 어시스턴트입니다. 사용자의 아이디어를 듣고 PRD에 필요한 정보를 체계적으로 수집합니다.

사용자 초기 아이디어: "${initialIdea}"
현재 PRD: ${JSON.stringify(prd)}

규칙:
1. 매 답변마다 반드시 __QUESTION__, __PRD_UPDATE__, __SCORE__ 블록을 모두 포함하세요.
2. 질문은 한 번에 하나씩. **반드시 복수선택형(multiple_choice)으로** 출제하세요. 옵션은 3~4개 + 마지막에 반드시 "직접 입력" 옵션을 포함하세요. 주관식(open_text)은 이름/브랜드명처럼 선택지를 제시할 수 없는 경우에만 사용하세요.
3. 빈약하거나 비어있는 핵심 필드(one_liner, problem, solution, users, kpis)를 우선적으로 채우는 방향으로 질문하세요.
4. 답변 텍스트에서 블록 언급 금지.
5. 한국어로 친근하게 대화하세요.

__SCORE__ 형식 (PRD 완성도를 0~100 사이 정수로 평가):
__SCORE__
45
__END_SCORE__

평가 기준:
- one_liner(한 줄 설명), problem(핵심 문제), solution(해결책): 각 20점 (핵심)
- users(타겟 사용자), kpis(성공 지표): 각 10점
- differentiator(차별점), scenario(사용 시나리오), risks(위험 요소): 각 5점 (선택)
- 내용이 구체적이고 충분할수록 높은 점수. 막연하거나 짧으면 절반 이하.

__QUESTION__ 형식:
__QUESTION__
{"number":1,"text":"질문 내용","type":"multiple_choice","options":["옵션1","옵션2","옵션3","직접 입력"]}
__END_QUESTION__

복수선택형 예시: {"number":2,"text":"주요 타겟 사용자는 누구인가요?","type":"multiple_choice","options":["20-30대 직장인","학생/대학생","소상공인/자영업자","기업 담당자","직접 입력"]}
주관식은 불가피한 경우만: {"number":3,"text":"서비스 이름이 있다면?","type":"open_text","options":[]}

__PRD_UPDATE__ 형식:
__PRD_UPDATE__
{"overview":{"one_liner":"","product_goal":"","background":""},"core_value":{"problem":"","solution":"","differentiator":""},"target":{"users":"","scenario":""},"metrics":{"kpis":"","risks":""},"settings":{"category":"","roles":[],"devices":[]}}
__END_PRD_UPDATE__`;

  const processResponse = useCallback((text) => {
    const qMatch     = text.match(/__QUESTION__\s*([\s\S]*?)\s*__END_QUESTION__/);
    const prdMatch   = text.match(/__PRD_UPDATE__\s*([\s\S]*?)\s*__END_PRD_UPDATE__/);
    const scoreMatch = text.match(/__SCORE__\s*(\d+)\s*__END_SCORE__/);

    let displayText = text
      .replace(/__QUESTION__[\s\S]*?__END_QUESTION__/, '')
      .replace(/__PRD_UPDATE__[\s\S]*?__END_PRD_UPDATE__/, '')
      .replace(/__SCORE__[\s\S]*?__END_SCORE__/, '')
      .trim();

    let question = null;
    if (qMatch) {
      try { question = JSON.parse(qMatch[1].trim()); } catch (e) {}
    }
    if (prdMatch) {
      try { setPrd(prev => deepMergePrd(prev, JSON.parse(prdMatch[1].trim()))); } catch (e) {}
    }
    if (scoreMatch) {
      const s = parseInt(scoreMatch[1], 10);
      if (!isNaN(s)) {
        const clamped = Math.min(100, Math.max(0, s));
        setAiScore(clamped);
        onScoreUpdate?.(clamped);
      }
    }

    return { displayText, question };
  }, [setPrd, onScoreUpdate]);

  const sendAnswer = useCallback(async (answerText, history) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const text = await callGemini(history.slice(-16), INTERVIEW_SYSTEM);
      const { displayText, question } = processResponse(text);
      if (question) setQCount(q => q + 1);
      setMessages(prev => [...prev, { role: 'assistant', content: displayText, question }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `오류: ${e.message}`, question: null }]);
    }
    setIsLoading(false);
  }, [isLoading, processResponse, INTERVIEW_SYSTEM]);

  // 초기 인사 + Q1
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const init = async () => {
      setIsLoading(true);
      const greeting = `안녕하세요! 저는 기획 작업을 도와드릴 PlanForge AI입니다.\n프로젝트를 명확히 이해할 수 있도록, 몇 가지 질문에 답해주세요!\n\n서비스 아이디어: "${initialIdea}"`;
      const initHistory = [{ role: 'user', content: `프로젝트 아이디어: ${initialIdea}. 지금부터 인터뷰를 시작해줘.` }];
      try {
        const text = await callGemini(initHistory, INTERVIEW_SYSTEM);
        const { displayText, question } = processResponse(text);
        if (question) setQCount(1);
        setMessages([
          { role: 'assistant', content: greeting, question: null },
          { role: 'assistant', content: displayText, question },
        ]);
      } catch (e) {
        setMessages([{ role: 'assistant', content: `오류: ${e.message}`, question: null }]);
      }
      setIsLoading(false);
    };
    init();
  }, []);

  const handleAnswer = useCallback((answer) => {
    const userMsg = { role: 'user', content: answer, question: null };
    const newHistory = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }));
    setMessages(prev => [...prev, userMsg]);
    sendAnswer(answer, newHistory);
  }, [messages, sendAnswer]);

  const scoreColor = aiScore >= 75 ? '#7c3aed' : aiScore >= 40 ? '#f59e0b' : '#9ca3af';
  const scoreLabel = aiScore >= 75 ? '충분해요' : aiScore >= 40 ? '보통' : '부족해요';
  const tabs = ['PRD', '기능명세서', '유저플로우'];

  return (
    <div className="h-screen flex flex-col bg-gray-50" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
      {/* 상단 네비 */}
      <nav className="flex items-center px-4 h-12 bg-white border-b border-gray-200 shrink-0 gap-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-purple-600 rounded-md flex items-center justify-center text-white text-xs font-bold">PF</div>
          <span className="text-sm font-semibold text-gray-800 truncate max-w-[200px]">
            {initialIdea.slice(0, 25)}{initialIdea.length > 25 ? '...' : ''}
          </span>
        </div>
        <div className="flex-1 flex justify-center gap-6">
          {tabs.map((t, i) => (
            <span key={t} className={`text-sm font-medium ${i === 0 ? 'text-purple-600 border-b-2 border-purple-500 pb-0.5' : 'text-gray-400'}`}>{t}</span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {isHighScore ? (
            <button onClick={onComplete}
              className="px-4 py-1.5 text-sm font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors shadow-sm animate-pulse">
              PRD 생성하기 →
            </button>
          ) : isMidScore ? (
            <button onClick={onComplete}
              className="px-3 py-1.5 text-xs font-medium text-purple-600 border border-purple-200 rounded-lg hover:bg-purple-50 transition-colors">
              지금 바로 생성
            </button>
          ) : null}
          <button className="px-3 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50">공유</button>
          <button className="px-3 py-1.5 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700">내보내기</button>
        </div>
      </nav>

      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 채팅 */}
        <div className="w-[420px] shrink-0 bg-white border-r border-gray-200 flex flex-col">
          {/* AI 점수 바 */}
          <div className="px-4 py-2 border-b border-gray-100">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs text-purple-600 font-medium bg-purple-50 px-2 py-0.5 rounded-full">PRD 완성도</span>
              <span className="text-xs font-mono font-semibold ml-auto" style={{ color: scoreColor }}>{aiScore}%</span>
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ background: scoreColor + '18', color: scoreColor }}>{scoreLabel}</span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${aiScore}%`, background: scoreColor }} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'assistant' && (
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold shrink-0 mt-0.5">P</div>
                    <div className="flex-1 space-y-3">
                      {msg.content && (
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{msg.content}</p>
                      )}
                      {msg.question && i === messages.length - 1 && !isLoading && (
                        <InterviewQuestionCard question={msg.question} onSubmit={handleAnswer} disabled={isLoading} />
                      )}
                      {msg.question && (i < messages.length - 1 || isLoading) && (
                        <p className="text-xs text-gray-400 italic">Q{msg.question.number}. {msg.question.text}</p>
                      )}
                    </div>
                  </div>
                )}
                {msg.role === 'user' && (
                  <div className="flex gap-2.5 flex-row-reverse">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs font-bold shrink-0">J</div>
                    <div className="max-w-[80%] bg-purple-500 text-white rounded-xl px-3 py-2 text-sm">{msg.content}</div>
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-bold shrink-0">P</div>
                <div className="flex items-center gap-1 px-3 py-2 bg-white border border-gray-200 rounded-xl shadow-sm">
                  <span className="text-xs text-gray-400">생각 중</span>
                  {[0, 150, 300].map(d => (
                    <div key={d} className="w-1.5 h-1.5 bg-purple-300 rounded-full animate-bounce ml-0.5" style={{ animationDelay: d + 'ms' }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 하단 영역 */}
          <div className="border-t border-gray-100">
            {isTired && !isHighScore && (
              <div className="px-4 pt-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                  <span className="text-base">😅</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-amber-700">질문이 많아졌네요</p>
                    <p className="text-xs text-amber-600 mt-0.5">지금 바로 PRD를 생성해도 괜찮아요!</p>
                  </div>
                  <button onClick={onComplete}
                    className="shrink-0 px-3 py-1.5 text-xs font-semibold text-white bg-amber-500 rounded-lg hover:bg-amber-600 transition-colors">
                    생성하기
                  </button>
                </div>
              </div>
            )}
            {isHighScore && (
              <div className="px-4 pt-3">
                <button onClick={onComplete}
                  className="w-full py-2.5 text-sm font-semibold text-white bg-purple-600 rounded-xl hover:bg-purple-700 transition-colors shadow-md">
                  ✨ PRD 생성하기 ({aiScore}% 완성)
                </button>
              </div>
            )}
            <FreeTextInput onSend={handleAnswer} disabled={isLoading} />
          </div>
        </div>

        {/* 우측 PRD 미리보기 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <PrdPreview prd={prd} />
        </div>
      </div>
    </div>
  );
}
