// Threads 자동 게시 탭
// 텍스트(+선택적 이미지) → Threads Graph API → 게시
import { useState } from "react";
import { callGemini } from "../utils/gemini";
import LoginModal, { getSession } from "./LoginModal";
import TopicPicker from "./TopicPicker";

// ── 소셜 설정 키/로드/저장 ──
const threadsKey = (u) => `eden_threads_${u}_v1`;

function loadSocial(keyFn, username) {
  try { return JSON.parse(localStorage.getItem(keyFn(username))) || {}; }
  catch { return {}; }
}
function saveSocial(keyFn, username, data) {
  localStorage.setItem(keyFn(username), JSON.stringify(data));
}

const TH_MAX_CHARS = 500;
const THREAD_TEMPLATE_KEY = "eattack_threads_view_template";
const CONVERSATION_FORMATS = [
  {
    key: "expert",
    label: "전문가 설명",
    prompt: "차분한 전문가가 쉽게 풀어주는 말투. 주장 → 이유 → 적용 팁 → 낮은 허들 CTA 흐름.",
  },
  {
    key: "friend",
    label: "친구 조언",
    prompt: "친한 친구가 옆에서 알려주는 말투. 공감 → 솔직한 경험 → 바로 해볼 행동 → 부드러운 CTA 흐름.",
  },
  {
    key: "story",
    label: "경험담",
    prompt: "개인 경험을 들려주는 말투. 상황 묘사 → 깨달음 → 바뀐 관점 → 독자에게 넘기는 CTA 흐름.",
  },
  {
    key: "question",
    label: "질문 유도",
    prompt: "독자에게 질문을 던지며 대화를 여는 말투. 문제 질문 → 선택지/오해 제시 → 관점 제안 → 댓글 CTA 흐름.",
  },
  {
    key: "checklist",
    label: "체크리스트",
    prompt: "짧고 실용적인 체크리스트 말투. 결론 선제시 → 3~5개 포인트 → 바로 적용 CTA 흐름.",
  },
];
const TONE_OPTIONS = [
  { key: "template", label: "템플릿 말투", prompt: "분석된 템플릿의 원래 말투를 최대한 유지" },
  { key: "direct", label: "직설적", prompt: "짧고 단정적인 문장, 군더더기 없는 확신형 말투" },
  { key: "warm", label: "따뜻한 공감", prompt: "독자의 상황을 먼저 받아주고 부담 없이 권하는 말투" },
  { key: "bold", label: "도발적", prompt: "익숙한 믿음을 살짝 뒤집고 강한 주장으로 끌고 가는 말투" },
  { key: "casual", label: "캐주얼", prompt: "친근하고 가벼운 대화체, 과한 전문용어를 줄인 말투" },
];
const FLOW_OPTIONS = [
  { key: "template", label: "템플릿 흐름", prompt: "저장된 템플릿의 흐름을 우선 적용" },
  { key: "problem", label: "문제→해결", prompt: "문제 제기 → 공감 → 해결책 → 바로 할 행동 순서" },
  { key: "value", label: "가치 선제시", prompt: "첫 줄에서 얻을 이득 제시 → 왜 필요한지 → 구성/근거 → CTA 순서" },
  { key: "story", label: "상황→깨달음", prompt: "짧은 상황 묘사 → 시행착오 → 깨달음 → 독자 적용 순서" },
  { key: "contrarian", label: "반전 주장", prompt: "통념 제시 → 반박 → 새로운 관점 → 확인/댓글 CTA 순서" },
];
const CTA_OPTIONS = [
  { key: "template", label: "템플릿 CTA", prompt: "저장된 템플릿의 CTA 방식을 우선 적용" },
  { key: "comment", label: "댓글 유도", prompt: "댓글로 키워드나 의견을 남기게 하는 낮은 허들 CTA" },
  { key: "save", label: "저장 유도", prompt: "나중에 다시 보도록 저장을 유도하는 실용형 CTA" },
  { key: "dm", label: "DM 유도", prompt: "자료/체크리스트를 받기 위한 DM 또는 키워드 요청 CTA" },
  { key: "soft", label: "부드러운 권유", prompt: "강요 없이 오늘 바로 한 가지를 해보게 하는 CTA" },
];

function loadThreadTemplate() {
  try { return JSON.parse(localStorage.getItem(THREAD_TEMPLATE_KEY)) || null; }
  catch { return null; }
}

export default function ThreadsTab() {
  const [session] = useState(() => getSession());

  // 설정
  const [config, setConfig] = useState(
    () => loadSocial(threadsKey, getSession()?.username || "__guest")
  );
  const [accessToken, setAccessToken] = useState(config.accessToken || "");
  const [userId, setUserId] = useState(config.userId || "");

  // 게시 내용
  const [text, setText] = useState("");
  const [aiTopic, setAiTopic] = useState("");

  // 상태
  const [posting, setPosting] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [templating, setTemplating] = useState(false);
  const [templateFormat, setTemplateFormat] = useState("expert");
  const [templateTone, setTemplateTone] = useState("template");
  const [templateFlow, setTemplateFlow] = useState("template");
  const [templateCta, setTemplateCta] = useState("template");
  const [fetchingId, setFetchingId] = useState(false);
  const [result, setResult] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showTopicPicker, setShowTopicPicker] = useState(false);

  const addLog = (level, msg, detail = null) => {
    const entry = { time: new Date().toLocaleTimeString("ko-KR"), level, msg, detail };
    setLogs(prev => [...prev.slice(-49), entry]);
  };

  if (!session) {
    return <LoginModal onLogin={() => window.location.reload()} />;
  }

  // 토큰으로 userId 자동 조회
  const handleFetchUserId = async () => {
    if (!accessToken.trim()) {
      addLog("error", "액세스 토큰을 먼저 입력하세요");
      return;
    }
    setFetchingId(true);
    addLog("info", "Threads 사용자 ID 조회 중...");
    try {
      const res = await fetch(
        `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${accessToken.trim()}`
      );
      const data = await res.json();
      if (!res.ok || !data.id) {
        throw new Error(data.error?.message || `조회 실패 (${res.status})`);
      }
      const newUserId = data.id;
      const newConfig = { accessToken: accessToken.trim(), userId: newUserId };
      setUserId(newUserId);
      setConfig(newConfig);
      saveSocial(threadsKey, session.username, newConfig);
      addLog("info", `조회 성공: @${data.username} → ${newUserId}`);
    } catch (e) {
      addLog("error", `조회 실패: ${e.message}`);
    } finally {
      setFetchingId(false);
    }
  };

  // 토큰/userId 저장
  const handleSaveConfig = () => {
    const newConfig = { accessToken: accessToken.trim(), userId: userId.trim() };
    setConfig(newConfig);
    saveSocial(threadsKey, session.username, newConfig);
    addLog("info", "설정 저장됨");
  };

  // AI 글 생성
  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) {
      addLog("error", "주제를 입력하세요");
      return;
    }
    setGenerating(true);
    addLog("info", `AI 글 생성 중: "${aiTopic}"`);
    try {
      const result = await callGemini(
        [
          {
            role: "user",
            content: `주제: "${aiTopic}"\n\nThreads(인스타그램의 텍스트 SNS)에 올릴 게시글을 작성해줘.\n\n규칙:\n- 최대 500자 이내\n- 줄바꿈을 활용한 읽기 쉬운 구조\n- 한 줄에 10~25자\n- 해시태그 2~4개 (마지막에)\n- 자연스럽고 공감 가는 톤\n- 마크다운, 따옴표 없이 순수 텍스트만`,
          },
        ],
        "SNS 콘텐츠 전문가. Threads에 최적화된 공감형 게시글을 작성합니다."
      );
      setText(result.slice(0, TH_MAX_CHARS));
      addLog("info", "AI 글 생성 완료");
    } catch (e) {
      addLog("error", `AI 생성 실패: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleTemplateRewrite = async () => {
    const savedTemplate = loadThreadTemplate();
    const template = savedTemplate?.data;
    const format = CONVERSATION_FORMATS.find(f => f.key === templateFormat) || CONVERSATION_FORMATS[0];
    const tone = TONE_OPTIONS.find(o => o.key === templateTone) || TONE_OPTIONS[0];
    const flow = FLOW_OPTIONS.find(o => o.key === templateFlow) || FLOW_OPTIONS[0];
    const cta = CTA_OPTIONS.find(o => o.key === templateCta) || CTA_OPTIONS[0];
    const source = text.trim() || aiTopic.trim();

    if (!template) {
      addLog("error", "먼저 인기글 수집 화면에서 조회수 템플릿 역설계를 실행하세요");
      return;
    }
    if (!source) {
      addLog("error", "재구성할 주제나 초안을 입력하세요");
      return;
    }

    setTemplating(true);
    addLog("info", "조회수 템플릿 기반 재구성 중...");

    try {
      const result = await callGemini(
        [
          {
            role: "user",
            content:
`다음 주제/초안을 Threads 게시글로 재구성해주세요.

주제 또는 초안:
${source}

조회수 기반 분석 템플릿:
${JSON.stringify(template, null, 2)}

요구사항:
- 분석된 템플릿의 흐름을 실제 글 구조에 반영
- 대화 포맷: ${format.label}
- 말투/흐름 지시: ${format.prompt}
- 세부 말투: ${tone.label} — ${tone.prompt}
- 세부 흐름: ${flow.label} — ${flow.prompt}
- CTA 방식: ${cta.label} — ${cta.prompt}
- 첫 문장은 강한 카피라이팅으로 재작성
- 말투는 자연스럽고 자신감 있게, 과장 광고처럼 보이지 않게
- 중간 전개는 공감 → 해결책/관점 → 증거/이유 순서
- 마지막에는 낮은 허들의 CTA 포함
- 최대 500자 이내
- 줄바꿈을 활용해 Threads에서 읽기 쉽게 구성
- 해시태그는 필요할 때만 1~3개
- 마크다운 없이 게시글 본문만 반환`,
          },
        ],
        `당신은 조회수 높은 Threads 글의 구조를 새 주제에 적용하는 카피라이터입니다. 선택된 대화 포맷(${format.label}), 말투(${tone.label}), 흐름(${flow.label}), CTA(${cta.label})를 우선 반영하고 게시 가능한 본문만 작성하세요.`
      );
      setText(result.slice(0, TH_MAX_CHARS));
      addLog("info", "템플릿 기반 재구성 완료");
    } catch (e) {
      addLog("error", `템플릿 재구성 실패: ${e.message}`);
    } finally {
      setTemplating(false);
    }
  };

  // Threads 게시
  const handlePost = async () => {
    if (!accessToken.trim() || !userId.trim()) {
      addLog("error", "액세스 토큰과 사용자 ID를 입력하세요");
      return;
    }
    if (!text.trim()) {
      addLog("error", "게시할 텍스트를 입력하세요");
      return;
    }
    setPosting(true);
    setResult(null);
    addLog("info", "Threads 게시 시작...");
    addLog("info", `텍스트 길이: ${text.length}자`);

    try {
      const res = await fetch("/api/threads-post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: userId.trim(),
          accessToken: accessToken.trim(),
          text: text.trim(),
          images: [],
        }),
      });
      const data = await res.json();

      if (data.logs?.length) {
        data.logs.forEach(l => addLog("info", `[서버] ${l.msg}`, l.data));
      }
      addLog(res.ok ? "info" : "error", `서버 응답 [${res.status}]`, res.ok ? undefined : data);

      if (!res.ok) throw new Error(data.error || "게시 실패");

      addLog("info", `게시 성공! mediaId: ${data.mediaId}`);
      setResult({ status: "success", mediaId: data.mediaId });
    } catch (e) {
      addLog("error", `오류: ${e.message}`);
      setResult({ status: "error", message: e.message });
    } finally {
      setPosting(false);
    }
  };

  const charLeft = TH_MAX_CHARS - text.length;

  return (
    <div className="p-6 space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gray-900 flex items-center justify-center shadow-sm flex-shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 192 192" fill="white">
            <path d="M141.537 88.988a66.667 66.667 0 0 0-2.518-1.143c-1.482-27.307-16.403-42.94-41.457-43.1h-.34c-14.986 0-27.449 6.396-35.12 18.036l13.779 9.452c5.73-8.695 14.724-10.548 21.348-10.548h.229c8.249.053 14.474 2.452 18.503 7.129 2.932 3.405 4.893 8.111 5.864 14.05-7.314-1.243-15.224-1.626-23.68-1.141-23.82 1.372-39.134 15.265-38.105 34.568.522 9.792 5.4 18.216 13.735 23.719 7.047 4.652 16.124 6.927 25.557 6.412 12.458-.683 22.231-5.436 29.049-14.127 5.178-6.6 8.453-15.153 9.899-25.93 5.937 3.583 10.337 8.298 12.767 13.966 4.132 9.635 4.373 25.468-8.546 38.376-11.319 11.308-24.925 16.2-45.488 16.351-22.809-.169-40.06-7.484-51.275-21.742C35.236 139.966 29.808 120.682 29.605 96c.203-24.682 5.63-43.966 16.133-57.317C56.954 24.425 74.204 17.11 97.013 16.94c22.975.17 40.526 7.52 52.171 21.847 5.71 7.026 10.015 15.86 12.853 26.162l16.147-4.308c-3.44-12.68-8.853-23.606-16.219-32.668C147.036 10.208 125.202.195 97.07 0h-.113C68.882.195 47.292 10.24 32.788 29.813 19.882 47.192 13.223 71.245 13.008 96.02v.04c.215 24.775 6.874 48.829 19.78 66.207 14.504 19.574 36.094 29.619 64.199 29.813h.113c25.316-.177 43.063-6.807 57.756-21.488 19.08-19.073 18.496-43.016 12.209-57.81-4.567-10.638-13.349-19.274-25.528-24.794z"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-800">Threads 자동 게시</p>
          <p className="text-xs text-gray-400">텍스트 게시물을 자동으로 Threads에 올립니다</p>
        </div>
      </div>

      {/* 인증 설정 */}
      <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">인증 설정</p>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">액세스 토큰</label>
          <input
            type="password"
            value={accessToken}
            onChange={e => setAccessToken(e.target.value)}
            placeholder="Threads 장기 액세스 토큰 (60일)"
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 font-mono"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-gray-500 font-medium">사용자 ID</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="숫자 ID (자동 조회 가능)"
              className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 font-mono"
            />
            <button
              onClick={handleFetchUserId}
              disabled={fetchingId || !accessToken.trim()}
              className="px-3 py-2 text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap"
            >
              {fetchingId ? "조회 중..." : "토큰으로 자동 조회"}
            </button>
          </div>
        </div>

        <button
          onClick={handleSaveConfig}
          className="w-full py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
        >
          설정 저장 (로컬)
        </button>
      </div>

      {/* 게시 내용 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">게시 내용</p>
          <span className={`text-xs font-mono ${charLeft < 0 ? "text-red-500" : charLeft < 50 ? "text-amber-500" : "text-gray-400"}`}>
            {charLeft}자 남음
          </span>
        </div>

        {/* AI 생성 */}
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            value={aiTopic}
            onChange={e => setAiTopic(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !generating && handleAiGenerate()}
            placeholder="주제 입력 후 AI 생성 (예: 퇴근 후 루틴)"
            className="flex-1 px-3 py-2 text-xs border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-pink-200"
          />
          <button
            onClick={handleAiGenerate}
            disabled={generating || !aiTopic.trim()}
            className="px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl hover:opacity-90 disabled:opacity-40 whitespace-nowrap"
          >
            {generating ? "생성 중..." : "AI로 생성"}
          </button>
          <button
            onClick={() => setShowTopicPicker(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-violet-200 text-violet-600 bg-violet-50 hover:bg-violet-100 transition-all whitespace-nowrap"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            인기글에서 가져오기
          </button>
          <select
            value={templateFormat}
            onChange={e => setTemplateFormat(e.target.value)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-amber-200 text-amber-700 bg-white hover:bg-amber-50 transition-all focus:outline-none focus:ring-2 focus:ring-amber-100"
            title="템플릿 재구성에 적용할 대화 말투와 흐름"
          >
            {CONVERSATION_FORMATS.map(format => (
              <option key={format.key} value={format.key}>{format.label}</option>
            ))}
          </select>
          <select
            value={templateTone}
            onChange={e => setTemplateTone(e.target.value)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-amber-200 text-amber-700 bg-white hover:bg-amber-50 transition-all focus:outline-none focus:ring-2 focus:ring-amber-100"
            title="재구성할 말투"
          >
            {TONE_OPTIONS.map(option => (
              <option key={option.key} value={option.key}>말투: {option.label}</option>
            ))}
          </select>
          <select
            value={templateFlow}
            onChange={e => setTemplateFlow(e.target.value)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-amber-200 text-amber-700 bg-white hover:bg-amber-50 transition-all focus:outline-none focus:ring-2 focus:ring-amber-100"
            title="재구성할 글 흐름"
          >
            {FLOW_OPTIONS.map(option => (
              <option key={option.key} value={option.key}>흐름: {option.label}</option>
            ))}
          </select>
          <select
            value={templateCta}
            onChange={e => setTemplateCta(e.target.value)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-amber-200 text-amber-700 bg-white hover:bg-amber-50 transition-all focus:outline-none focus:ring-2 focus:ring-amber-100"
            title="재구성할 CTA 방식"
          >
            {CTA_OPTIONS.map(option => (
              <option key={option.key} value={option.key}>CTA: {option.label}</option>
            ))}
          </select>
          <button
            onClick={handleTemplateRewrite}
            disabled={templating || (!aiTopic.trim() && !text.trim())}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-all whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed"
            title="조회수 템플릿 역설계 결과를 적용해 말투, 첫 문장, CTA까지 재구성합니다"
          >
            {templating ? (
              <svg className="animate-spin w-3 h-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5Z"/>
                <path d="M8 7h8M8 11h8M8 15h5"/>
              </svg>
            )}
            {templating ? "재구성 중..." : "템플릿으로 재구성"}
          </button>
        </div>

        {showTopicPicker && (
          <TopicPicker
            onSelect={v => {
              setAiTopic(typeof v === "string" ? v : v.text || v.title || "");
              setShowTopicPicker(false);
            }}
            onClose={() => setShowTopicPicker(false)}
          />
        )}

        <textarea
          value={text}
          onChange={e => setText(e.target.value.slice(0, TH_MAX_CHARS))}
          placeholder="Threads에 게시할 텍스트를 입력하거나 AI로 생성하세요 (최대 500자)"
          rows={8}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 resize-none leading-relaxed"
        />
      </div>

      {/* 게시 버튼 */}
      <button
        onClick={handlePost}
        disabled={posting || !text.trim() || !accessToken.trim() || !userId.trim() || charLeft < 0}
        className="w-full py-3 text-sm font-bold text-white bg-gray-900 rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-all"
      >
        {posting ? "게시 중..." : "Threads에 게시하기"}
      </button>

      {/* 결과 */}
      {result && (
        <div className={`px-4 py-3 rounded-xl text-xs font-medium ${
          result.status === "success"
            ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
            : "bg-red-50 border border-red-200 text-red-600"
        }`}>
          {result.status === "success"
            ? `게시 성공! mediaId: ${result.mediaId}`
            : `오류: ${result.message}`}
        </div>
      )}

      {/* 실행 로그 패널 */}
      {logs.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900">
            <span className="text-[11px] font-bold text-gray-300 font-mono">실행 로그</span>
            <button
              onClick={() => setLogs([])}
              className="text-[10px] text-gray-500 hover:text-gray-300"
            >
              지우기
            </button>
          </div>
          <div className="bg-gray-950 p-3 max-h-52 overflow-y-auto space-y-1 font-mono">
            {logs.map((log, i) => (
              <div key={i} className="flex gap-2 text-[11px] leading-relaxed">
                <span className="text-gray-600 flex-shrink-0">{log.time}</span>
                <span className={`flex-shrink-0 font-bold ${
                  log.level === "error" ? "text-red-400" : "text-emerald-400"
                }`}>
                  {log.level === "error" ? "ERR" : "LOG"}
                </span>
                <span className={log.level === "error" ? "text-red-300" : "text-gray-200"}>
                  {log.msg}
                </span>
                {log.detail && (
                  <span className="text-gray-500 truncate">
                    {typeof log.detail === "object"
                      ? JSON.stringify(log.detail)
                      : String(log.detail)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 토큰 발급 안내 */}
      <details className="group">
        <summary className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 select-none">
          Threads 토큰 발급 방법 (최초 1회)
        </summary>
        <div className="mt-2 p-3 bg-gray-50 border border-gray-100 rounded-xl text-xs text-gray-600 space-y-1.5 leading-relaxed">
          <p><strong>1.</strong> developers.facebook.com/apps → 앱 생성 → Use Case: Threads 선택</p>
          <p><strong>2.</strong> Redirect URI 설정: <code className="bg-gray-200 px-1 rounded">https://planforge-eden-planner.vercel.app/auth/</code></p>
          <p><strong>3.</strong> Authorization URL로 Threads 로그인 → code 획득</p>
          <p><strong>4.</strong> code → 단기 토큰 교환 → 장기 토큰(60일) 교환</p>
          <p><strong>5.</strong> 위 토큰 입력 → "자동 조회" 클릭 → 완료</p>
        </div>
      </details>
    </div>
  );
}
