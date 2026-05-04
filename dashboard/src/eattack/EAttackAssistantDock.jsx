import { useEffect, useMemo, useState } from "react";
import { callGemini } from "../utils/gemini";
import { getSession } from "../utils/authSession";
import { emitEAttackCommand, summarizeText } from "./eattackContext";

const HISTORY_KEY = (u) => `eattack_ai_assistant_history_${u}_v1`;
const INPUT_KEY = (u) => `eattack_ai_assistant_input_${u}_v1`;
const ASSISTANT_COMMAND_API = "/api/assistant-command";
const FULL_AUTO_CONFIRM_LABEL = "오늘 매시간 카드뉴스 자동화 켜기";
const FULL_AUTO_OPEN_LABEL = "풀가동화 화면 열기";
const FULL_AUTO_SECRET = import.meta.env.VITE_FULL_AUTO_SECRET || "";
const USERS_KEY = "eden_users_v1";
const igKey = (u) => `eden_ig_${u}_v1`;
const threadsKey = (u) => `eden_threads_${u}_v1`;
const fullAutoKey = (u) => `eden_fullauto_${u}_v1`;

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

function loadLocalJson(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function makeAssistantAccount(user) {
  const username = user?.username || user?.id || user;
  if (!username) return null;
  const ig = loadLocalJson(igKey(username), {}) || {};
  const th = loadLocalJson(threadsKey(username), {}) || {};
  const fa = loadLocalJson(fullAutoKey(username), {}) || {};
  return {
    id: username,
    name: user?.displayName || user?.name || username,
    igAccountId: ig.accountId || "",
    igAccessToken: ig.accessToken || "",
    threadsUserId: th.userId || "",
    threadsAccessToken: th.accessToken || "",
    settings: {
      topics: fa.topics || "",
      brandName: fa.brandName || "",
      tone: fa.tone || "친근하고 전문적인",
      slideCount: fa.slideCount || 5,
      captionTemplate: fa.captionTemplate || "{title}\n\n{body}",
    },
  };
}

function loadAssistantAccounts(username) {
  const users = loadLocalJson(USERS_KEY, []) || [];
  const accounts = Array.isArray(users)
    ? users.map(makeAssistantAccount).filter(Boolean)
    : [];
  if (accounts.length) return accounts;
  const fallback = makeAssistantAccount({ username, displayName: username });
  return fallback ? [fallback] : [];
}

function isFullAutoHourlyRequest(text) {
  const value = String(text || "").replace(/\s+/g, " ");
  const wantsCardNews = /카드\s*뉴스|카드뉴스|콘텐츠|이미지/.test(value);
  const wantsHourly = /매시간|1시간|한\s*시간|hourly/i.test(value);
  const wantsPublish = /배포|발행|게시|예약|올려|포스팅/.test(value);
  return wantsCardNews && wantsHourly && wantsPublish;
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

export default function EAttackAssistantDock({
  scopeLabel = "E-Attack",
  currentDepth = "root",
  onNavigate,
}) {
  const [session, setSession] = useState(() => getSession());
  const username = session?.username || "__guest";
  const [open, setOpen] = useState(false);
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
  const [contextSnapshot, setContextSnapshot] = useState(null);
  const [executingCommand, setExecutingCommand] = useState(false);

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

  useEffect(() => {
    const handleContext = (event) => {
      setContextSnapshot(event?.detail || null);
    };
    window.addEventListener("eattack-context", handleContext);
    return () => window.removeEventListener("eattack-context", handleContext);
  }, []);

  const quickPrompts = useMemo(() => makeQuickPrompts(scopeLabel), [scopeLabel]);
  const featureShortcuts = useMemo(() => {
    const rootItems = [
      { key: "text", label: "글", depth: "text", icon: "✍️" },
      { key: "image", label: "이미지", depth: "image", icon: "🖼️" },
      { key: "video", label: "영상", depth: "video", icon: "🎬" },
      { key: "crawling", label: "크롤링", depth: "crawling", icon: "🕸️" },
      { key: "fullAuto", label: "풀가동화", depth: "fullAuto", icon: "⚡" },
    ];
    const textItems = [
      { key: "blog", label: "블로그", depth: "funnelblog", icon: "📝" },
      { key: "iboss", label: "아이보스", depth: "iboss", icon: "💬" },
    ];
    const imageTabs = [
      { key: "image-unified", label: "통합 파이프라인", page: "ImagePage", tab: "unified", icon: "⟳" },
      { key: "image-detail", label: "상세페이지", page: "ImagePage", tab: "detail", icon: "📄" },
      { key: "image-proposal", label: "제안서", page: "ImagePage", tab: "proposal", icon: "📎" },
      { key: "image-threads", label: "Threads", page: "ImagePage", tab: "threads", icon: "🧵" },
    ];
    const blogTabs = [
      { key: "blog-articles", label: "제작", page: "BlogPage", tab: "articles", icon: "📝" },
      { key: "blog-styles", label: "스타일", page: "BlogPage", tab: "styles", icon: "🎨" },
    ];
    const ibossTabs = [
      { key: "iboss-articles", label: "제작", page: "IbossPage", tab: "articles", icon: "🧰" },
      { key: "iboss-trends", label: "인기글", page: "IbossPage", tab: "trends", icon: "📊" },
    ];
    const fullAutoTabs = [
      { key: "fa-accounts", label: "계정", page: "FullAutoPage", tab: "accounts", icon: "👥" },
      { key: "fa-history", label: "이력", page: "FullAutoPage", tab: "history", icon: "🕘" },
    ];
    const videoTabs = [
      { key: "video-nas", label: "NAS", page: "VideoPage", tab: "nas", icon: "💾" },
      { key: "video-edit", label: "편집", page: "VideoPage", tab: "edit", icon: "🎞️" },
      { key: "video-community", label: "커뮤니티", page: "VideoPage", tab: "community", icon: "🌐" },
      { key: "video-shorts", label: "숏폼", page: "VideoPage", tab: "shorts", icon: "⚙️" },
    ];
    if (contextSnapshot?.page === "ImagePage") return imageTabs;
    if (contextSnapshot?.page === "BlogPage") return blogTabs;
    if (contextSnapshot?.page === "IbossPage") return ibossTabs;
    if (contextSnapshot?.page === "FullAutoPage") return fullAutoTabs;
    if (contextSnapshot?.page === "VideoPage") return videoTabs;
    if (currentDepth === "text") return textItems;
    if (["blog", "funnelblog", "iboss"].includes(currentDepth)) return rootItems;
    return rootItems;
  }, [currentDepth, contextSnapshot?.page]);

  const currentContextText = useMemo(() => {
    if (!contextSnapshot) return `${scopeLabel} / ${currentDepth}`;
    const parts = [
      contextSnapshot.page ? `페이지: ${contextSnapshot.page}` : "",
      contextSnapshot.section ? `섹션: ${contextSnapshot.section}` : "",
      contextSnapshot.tab ? `탭: ${contextSnapshot.tab}` : "",
      contextSnapshot.step ? `단계: ${contextSnapshot.step}` : "",
      contextSnapshot.mode ? `모드: ${contextSnapshot.mode}` : "",
      contextSnapshot.status ? `상태: ${contextSnapshot.status}` : "",
      contextSnapshot.summary ? `요약: ${summarizeText(contextSnapshot.summary, 180)}` : "",
    ].filter(Boolean);
    return parts.join(" · ") || `${scopeLabel} / ${currentDepth}`;
  }, [contextSnapshot, scopeLabel, currentDepth]);

  const systemPrompt = useMemo(() => `
당신은 E-Attack 전용 AI 어시스턴트입니다.
역할:
- 현재 화면과 사용자의 요청을 빠르게 이해하고 실무적으로 답한다.
- 검수, 재작성, 요약, 다음 액션 제안, 대안 비교를 한다.
- 답변은 짧고 명확하게, 바로 실행 가능한 형태로 쓴다.
- 항상 선택 가능한 후속 버튼 3개를 제안한다.
- 현재 E-Attack 기능을 전환할 수 있으면 기능 바로가기를 제안한다.

현재 범위: ${scopeLabel}
현재 화면 컨텍스트: ${currentContextText}

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
- 현재 화면에서 전환 가능한 기능이 있으면 choices에 그 기능명을 넣는다.
`, [scopeLabel, currentContextText]);

  const executeAssistantCommand = async (sourceText) => {
    const accounts = loadAssistantAccounts(username);
    setExecutingCommand(true);
    setSending(true);
    try {
      const res = await fetch(ASSISTANT_COMMAND_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(FULL_AUTO_SECRET ? { Authorization: `Bearer ${FULL_AUTO_SECRET}` } : {}),
        },
        body: JSON.stringify({
          action: "configure_full_auto_hourly",
          accounts,
          requestedBy: username,
          sourceText,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.detail || "자동화 설정에 실패했습니다.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `매시간 풀가동화 실행 대상으로 ${data.accountCount}개 계정을 등록했습니다.\n\n주의: Vercel Hobby 플랜에서는 크론이 제한될 수 있습니다. 배포 환경이 Pro이거나 외부 크론이 /api/full-auto-cron을 매시간 호출하면 기존 기능만으로 정보 수집, 카드뉴스 생성, 배포까지 이어집니다.`,
          choices: [FULL_AUTO_OPEN_LABEL],
          time: new Date().toISOString(),
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `자동화 설정 실패: ${e.message}`,
          choices: [FULL_AUTO_OPEN_LABEL],
          time: new Date().toISOString(),
          error: true,
        },
      ]);
    } finally {
      setExecutingCommand(false);
      setSending(false);
      setActiveQuick(null);
    }
  };

  const sendPrompt = async (prompt) => {
    const content = String(prompt || "").trim();
    if (!content || sending) return;

    if (content === FULL_AUTO_OPEN_LABEL) {
      handleNavigate("fullAuto");
      return;
    }

    const nextMessages = [
      ...messages,
      { role: "user", content, time: new Date().toISOString() },
    ];
    setMessages(nextMessages);
    setSending(true);
    setActiveQuick(content);

    if (content === FULL_AUTO_CONFIRM_LABEL) {
      await executeAssistantCommand(content);
      return;
    }

    if (isFullAutoHourlyRequest(content)) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "요청을 풀가동화 카드뉴스 매시간 배포로 인식했습니다. 기존 풀가동화 계정 설정을 사용해서 정보 수집, 카드뉴스 생성, IG/Threads 배포 파이프라인을 매시간 실행 대상으로 등록할 수 있습니다. 실제 배포/예약 작업이므로 아래 버튼으로 한 번 더 확인해 주세요.",
          choices: [FULL_AUTO_CONFIRM_LABEL, FULL_AUTO_OPEN_LABEL],
          time: new Date().toISOString(),
        },
      ]);
      setSending(false);
      setActiveQuick(null);
      return;
    }

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

  const handleNavigate = (depth) => {
    if (typeof onNavigate === "function") onNavigate(depth);
  };

  const handleShortcut = (item) => {
    if (item.page) {
      emitEAttackCommand({ targetPage: item.page, action: "setTab", tab: item.tab });
      return;
    }
    handleNavigate(item.depth);
  };

  if (!session || username === "__guest") return null;

  if (!open) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-3 rounded-full bg-violet-600 text-white shadow-2xl hover:bg-violet-700 transition-all"
          title="E-Attack AI 열기"
        >
          <span className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="7" width="18" height="11" rx="2" />
              <path d="M12 3v4" />
              <path d="M9 11h.01" />
              <path d="M15 11h.01" />
            </svg>
          </span>
          <span className="text-sm font-bold pr-1">AI</span>
        </button>
      </div>
    );
  }

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
              <p className="text-[10px] text-gray-400 truncate">{currentContextText}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={clearChat}
              className="text-[10px] font-semibold text-gray-500 hover:text-red-500"
              title="대화 지우기"
            >
              지우기
            </button>
            <button
              onClick={() => setOpen(false)}
              className="w-6 h-6 rounded-md text-gray-400 hover:text-violet-700 hover:bg-violet-50 flex items-center justify-center"
              title="닫기"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" />
                <path d="M6 6 18 18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3 max-h-[calc(100vh-6rem)] overflow-y-auto">
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide">기능 바로가기</p>
            <div className="flex flex-wrap gap-1.5">
              {featureShortcuts.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleShortcut(item)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-violet-200 text-violet-700 bg-white hover:bg-violet-50 transition-all"
                >
                  <span className="text-[10px]">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide">빠른 요청</p>
            <div className="flex flex-wrap gap-1.5">
              {quickPrompts.map((label) => (
                <button
                  key={label}
                  onClick={() => sendPrompt(label)}
                  disabled={sending || executingCommand}
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
                          disabled={sending || executingCommand}
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
                disabled={sending || executingCommand || !input.trim()}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-40 rounded-xl transition-all"
              >
                {executingCommand ? "실행 중..." : sending ? "응답 중..." : "보내기"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
