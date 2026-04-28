import { useEffect, useMemo, useState } from "react";
import { callGemini } from "../utils/gemini";
import { getSession } from "./LoginModal";

const HISTORY_KEY = (u) => `eattack_ai_assistant_history_${u}_v1`;
const INPUT_KEY = (u) => `eattack_ai_assistant_input_${u}_v1`;

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function makeQuickPrompts(scopeLabel) {
  return [
    `현재 화면(${scopeLabel}) 기준으로 바로 할 다음 작업 3개만 제안해줘.`,
    `이 문장을 검수해서 첫 문장, 흐름, CTA까지 더 자연스럽게 고쳐줘.`,
    `지금 내용의 핵심을 3줄로 요약해줘.`,
    `이 주제를 다른 각도 3개로 바꿔줘.`,
  ];
}

function parseAssistantPayload(raw) {
  const text = String(raw || "").trim();
  const match = text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/);
  if (match) {
    try {
      const data = JSON.parse(match[1] || match[0]);
      return {
        reply: String(data.reply || data.text || "").trim() || text,
        choices: Array.isArray(data.choices) ? data.choices.map((c) => String(c).trim()).filter(Boolean).slice(0, 3) : [],
      };
    } catch {
      // fall through
    }
  }
  return { reply: text, choices: [] };
}

export default function EAttackAssistantDock({ scopeLabel = "E-Attack" }) {
  const [session, setSession] = useState(() => getSession());
  const username = session?.username || "__guest";
  const [messages, setMessages] = useState(() => {
    if (!session?.username) return [];
    return loadJson(HISTORY_KEY(session.username), []);
  });
  const [input, setInput] = useState(() => {
    if (!session?.username) return "";
    return localStorage.getItem(INPUT_KEY(session.username)) || "";
  });
  const [sending, setSending] = useState(false);
  const [activeQuick, setActiveQuick] = useState(null);

  useEffect(() => {
    const handleSessionChange = () => setSession(getSession());
    window.addEventListener("eden-session-change", handleSessionChange);
    return () => window.removeEventListener("eden-session-change", handleSessionChange);
  }, []);

  useEffect(() => {
    if (!username || username === "__guest") return;
    saveJson(HISTORY_KEY(username), messages.slice(-40));
  }, [messages, username]);

  useEffect(() => {
    if (!username || username === "__guest") return;
    localStorage.setItem(INPUT_KEY(username), input);
  }, [input, username]);

  useEffect(() => {
    if (!username || username === "__guest") return;
    setMessages(loadJson(HISTORY_KEY(username), []));
    setInput(localStorage.getItem(INPUT_KEY(username)) || "");
  }, [username]);

  const quickPrompts = useMemo(() => makeQuickPrompts(scopeLabel), [scopeLabel]);

  const systemPrompt = useMemo(() => `
당신은 E-Attack 전용 AI 어시스턴트입니다.
역할:
- 현재 화면과 사용자의 요청을 빠르게 이해하고 실무적으로 답한다.
- 검수, 재작성, 요약, 다음 액션 제안, 대안 비교를 한다.
- 답변은 짧고 명확하게, 바로 실행 가능한 형태로 쓴다.
- 항상 선택 가능한 후속 버튼 3개를 제안한다.

현재 범위: ${scopeLabel}

반환 형식:
{
  "reply": "사용자에게 보여줄 답변",
  "choices": ["후속 선택지1", "후속 선택지2", "후속 선택지3"]
}

규칙:
- 설명문이나 머리말 없이 JSON만 반환한다.
- choices는 중복되지 않는 짧은 행동형 문장으로 3개까지.
- 검수 요청이면 문제점, 수정안, 다음 행동을 분리해서 제시한다.
- 사용자가 코드/문구를 붙여넣으면 바로 수정해서 내놓는다.
`, [scopeLabel]);

  const sendPrompt = async (prompt) => {
    const content = String(prompt || "").trim();
    if (!content || sending) return;
    const nextMessages = [
      ...messages,
      { role: "user", content, time: new Date().toISOString() },
    ];
    setMessages(nextMessages);
    setSending(true);
    setActiveQuick(content);
    try {
      const raw = await callGemini(
        nextMessages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        systemPrompt
      );
      const parsed = parseAssistantPayload(raw);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: parsed.reply,
          choices: parsed.choices,
          time: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `응답 생성 실패: ${e.message}`,
          choices: [],
          time: new Date().toISOString(),
          error: true,
        },
      ]);
    } finally {
      setSending(false);
      setActiveQuick(null);
    }
  };

  const handleSubmit = async () => {
    const prompt = input.trim();
    if (!prompt) return;
    setInput("");
    await sendPrompt(prompt);
  };

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem(HISTORY_KEY(username));
  };

  if (!session || username === "__guest") return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,380px)]">
      <div className="rounded-2xl border border-violet-200 bg-white/95 backdrop-blur shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-2 px-3 py-3 border-b border-violet-100 bg-violet-50/80">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-violet-600 text-white flex items-center justify-center shadow-sm flex-shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="7" width="18" height="11" rx="2" />
                <path d="M12 3v4" />
                <path d="M9 11h.01" />
                <path d="M15 11h.01" />
                <path d="M8 18h8" />
                <path d="M6 7l-2-2" />
                <path d="M18 7l2-2" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-violet-800 truncate">E-Attack AI</p>
              <p className="text-[10px] text-gray-500 truncate">{scopeLabel}</p>
            </div>
          </div>
          <button
            onClick={clearChat}
            className="text-[10px] font-semibold text-gray-500 hover:text-red-500"
            title="대화 지우기"
          >
            지우기
          </button>
        </div>

        <div className="p-3 space-y-3 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide">빠른 요청</p>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((label) => (
                <button
                  key={label}
                  onClick={() => sendPrompt(label)}
                  disabled={sending}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-40 ${
                    activeQuick === label
                      ? "bg-violet-600 text-white border-violet-600"
                      : "bg-white text-violet-700 border-violet-200 hover:bg-violet-50"
                  }`}
                >
                  {label.includes("검수") ? "검수" : label.includes("요약") ? "요약" : label.includes("다른 각도") ? "대안" : "다음 액션"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {messages.length === 0 ? (
              <div className="text-[11px] text-gray-400 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                여기서 질문하고, 답변 선택 버튼으로 이어가세요.
              </div>
            ) : (
              messages.map((message, idx) => (
                <div
                  key={`${message.time || idx}-${idx}`}
                  className={`rounded-xl border px-3 py-2 space-y-2 ${
                    message.role === "user"
                      ? "bg-violet-50 border-violet-100"
                      : message.error
                        ? "bg-red-50 border-red-100"
                        : "bg-white border-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-semibold uppercase ${message.role === "user" ? "text-violet-700" : "text-gray-500"}`}>
                      {message.role === "user" ? "나" : "AI"}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {message.time ? new Date(message.time).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </span>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  {message.role === "assistant" && Array.isArray(message.choices) && message.choices.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {message.choices.map((choice) => (
                        <button
                          key={choice}
                          onClick={() => sendPrompt(choice)}
                          disabled={sending}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-gray-200 text-gray-600 bg-gray-50 hover:bg-gray-100 transition-all disabled:opacity-40"
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="space-y-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              rows={3}
              placeholder="질문하거나 검수할 문장을 붙여넣으세요."
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 resize-none leading-relaxed"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={handleSubmit}
                disabled={sending || !input.trim()}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl transition-all"
              >
                {sending ? "응답 중..." : "보내기"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
