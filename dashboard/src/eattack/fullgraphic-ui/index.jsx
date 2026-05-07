/**
 * 풀그래픽 영상 워크플로우 UI
 * video-use (컷 편집) + Hyperframes (모션 그래픽) 7단계 파이프라인
 *
 * 1. 프로젝트 설정 — 영상 업로드
 * 2. 컷 편집    — Video Use 채팅
 * 3. 컷 승인    — 세그먼트 타임라인
 * 4. 모션 설명  — 자연어 입력
 * 5. 플랜 검토  — 비트별 편집
 * 6. 미리보기   — Hyperframes Studio (localhost:3002)
 * 7. 최종 렌더  — give me the render
 */
import { useState, useRef, useCallback, useEffect } from "react";

// ── 서버 베이스 URL ───────────────────────────────────────────────
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── 단계 정의 ─────────────────────────────────────────────────────
const STAGES = [
  { id: 1, key: "setup",    label: "프로젝트 설정",  icon: "📁" },
  { id: 2, key: "cut",      label: "컷 편집",        icon: "✂️" },
  { id: 3, key: "approve",  label: "컷 승인",        icon: "✅" },
  { id: 4, key: "motion",   label: "모션 설명",      icon: "🎨" },
  { id: 5, key: "plan",     label: "플랜 검토",      icon: "📋" },
  { id: 6, key: "preview",  label: "미리보기",       icon: "👁️" },
  { id: 7, key: "render",   label: "최종 렌더",      icon: "🎬" },
];

// ── 모션 예시 프롬프트 ────────────────────────────────────────────
const MOTION_EXAMPLES = [
  "검은 배경에서 크롬 그라디언트 타이틀이 whip-pan으로 등장하고, 3개의 핵심 키워드가 순차적으로 팝인되는 30초 인트로",
  "제품 이미지가 중앙에서 줌인되며 왼쪽에 가격·스펙 텍스트가 슬라이드인, 마지막에 CTA 버튼 펄스 효과",
  "상단 로고 리빌 → 중간 풀스크린 배경 영상 + 자막 오버레이 → 하단 소셜 팔로우 카드 순서의 세로 영상",
];

// ── 유틸 ─────────────────────────────────────────────────────────
function fmtSec(s) {
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1);
  return m > 0 ? `${m}:${sec.padStart(4, "0")}` : `0:${sec.padStart(4, "0")}`;
}
function fmtBytes(b) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

// ── 상단 스테이지 인디케이터 ──────────────────────────────────────
function StageIndicator({ current }) {
  return (
    <div className="flex items-center gap-0 mb-6 px-1 overflow-x-auto pb-1">
      {STAGES.map((s, i) => {
        const done    = s.id < current;
        const active  = s.id === current;
        return (
          <div key={s.id} className="flex items-center flex-shrink-0">
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
              ${active ? "bg-fuchsia-100 text-fuchsia-700 ring-2 ring-fuchsia-400 ring-offset-1" :
                done   ? "bg-purple-50 text-purple-500" :
                         "bg-gray-100 text-gray-400"}`}>
              <span>{done ? "✓" : s.icon}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`w-4 h-px mx-0.5 flex-shrink-0 ${done ? "bg-purple-300" : "bg-gray-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STAGE 1 — 프로젝트 설정
// ═══════════════════════════════════════════════════════════════════
function StageSetup({ onNext }) {
  const [mode,        setMode]        = useState("upload"); // "upload" | "prompt"
  const [projectName, setProjectName] = useState("");
  // 영상 업로드 모드
  const [videoFile,   setVideoFile]   = useState(null);
  const [dragging,    setDragging]    = useState(false);
  const inputRef = useRef();
  // URL·주제·프롬프트 모드
  const [url,     setUrl]     = useState("");
  const [topic,   setTopic]   = useState("");
  const [prompt,  setPrompt]  = useState("");

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("video/")) setVideoFile(f);
  }, []);

  const canNext = projectName.trim() && (
    mode === "upload" ? !!videoFile : !!(url.trim() || topic.trim() || prompt.trim())
  );

  const handleNext = () => {
    onNext({
      projectName: projectName.trim(),
      videoFile:   mode === "upload" ? videoFile : null,
      sourceUrl:   url.trim()    || null,
      topic:       topic.trim()  || null,
      prompt:      prompt.trim() || null,
      mode,
    });
  };

  const TABS = [
    { key: "upload", label: "영상 업로드", icon: "🎬" },
    { key: "prompt", label: "URL · 주제 · 프롬프트", icon: "✍️" },
  ];

  return (
    <div className="space-y-5">
      {/* 프로젝트 이름 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1.5">프로젝트 이름</label>
        <input
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          placeholder="예: 5월-제품런칭"
          className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
        />
      </div>

      {/* 모드 탭 */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setMode(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-xs font-semibold transition-all
              ${mode === t.key
                ? "bg-fuchsia-500 text-white"
                : "bg-white text-gray-500 hover:bg-gray-50"}`}
          >
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ── 영상 업로드 모드 ── */}
      {mode === "upload" && (
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">원본 영상 업로드</label>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all
              ${dragging ? "border-fuchsia-400 bg-fuchsia-50" :
                videoFile ? "border-purple-300 bg-purple-50" :
                            "border-gray-200 hover:border-fuchsia-300 hover:bg-gray-50"}`}
          >
            <input
              ref={inputRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={e => { if (e.target.files[0]) setVideoFile(e.target.files[0]); }}
            />
            {videoFile ? (
              <div className="space-y-1">
                <div className="w-10 h-10 mx-auto rounded-xl bg-purple-100 flex items-center justify-center text-xl">🎬</div>
                <p className="text-sm font-semibold text-purple-700">{videoFile.name}</p>
                <p className="text-xs text-gray-400">{fmtBytes(videoFile.size)}</p>
                <button
                  onClick={e => { e.stopPropagation(); setVideoFile(null); }}
                  className="text-xs text-red-400 hover:text-red-600 mt-1"
                >✕ 파일 변경</button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="w-10 h-10 mx-auto rounded-xl bg-gray-100 flex items-center justify-center text-xl">📹</div>
                <p className="text-sm text-gray-500">원본 영상을 여기에 드래그하거나 클릭해서 선택</p>
                <p className="text-xs text-gray-400">MP4, MOV, AVI, MKV 지원</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── URL · 주제 · 프롬프트 모드 ── */}
      {mode === "prompt" && (
        <div className="space-y-4">
          {/* URL */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">참고 URL <span className="text-gray-400 font-normal">(선택)</span></label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔗</span>
              <input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/product"
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">제품 페이지, 브랜드 사이트, 레퍼런스 영상 URL 등</p>
          </div>

          {/* 주제 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">주제 <span className="text-gray-400 font-normal">(선택)</span></label>
            <input
              type="text"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="예: 신제품 런칭 홍보 · 브랜드 스토리 · 이벤트 안내"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400"
            />
          </div>

          {/* 프롬프트 */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">프롬프트 <span className="text-gray-400 font-normal">(선택)</span></label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder={"예: 30초 세로형 숏폼 영상으로 만들어줘.\n크롬 그라디언트 타이틀로 시작하고, 핵심 기능 3가지를 슬라이드인으로 보여준 뒤\n마지막에 CTA 버튼으로 마무리해줘."}
              rows={5}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400 resize-none"
            />
            <p className="text-[11px] text-gray-400 mt-1">영상 스타일, 길이, 포함할 내용, 분위기 등 자유롭게 입력</p>
          </div>

          {/* 입력 요약 프리뷰 */}
          {(url || topic || prompt) && (
            <div className="rounded-xl bg-fuchsia-50 border border-fuchsia-100 p-3 space-y-1.5 text-xs text-fuchsia-700">
              <p className="font-semibold text-fuchsia-600 mb-1">입력 요약</p>
              {url    && <p>🔗 <span className="font-mono break-all">{url}</span></p>}
              {topic  && <p>📌 주제: {topic}</p>}
              {prompt && <p>✍️ 프롬프트: {prompt.slice(0, 60)}{prompt.length > 60 ? "…" : ""}</p>}
            </div>
          )}
        </div>
      )}

      <button
        disabled={!canNext}
        onClick={handleNext}
        className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-600
          shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {mode === "upload" ? "컷 편집 시작 →" : "플랜 생성 시작 →"}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STAGE 2 — 컷 편집 (Video Use 채팅)
// ═══════════════════════════════════════════════════════════════════
const CUT_SUGGESTIONS = [
  "무음 구간 자동 제거하고 좋은 테이크만 남겨줘",
  "앞뒤 10초 잘라내고 핵심 내용만 추출해줘",
  "말 더듬는 부분, um/uh 제거해줘",
  "B-롤 삽입 포인트 표시하고 컷 제안해줘",
];

function StageCut({ project, onNext }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: project.videoFile
        ? `**${project.projectName}** 프로젝트가 준비됐습니다.\n\n원본 영상 \`${project.videoFile.name}\`을 분석합니다. 어떻게 컷 편집할까요?`
        : `**${project.projectName}** 프로젝트가 준비됐습니다.\n\n${[project.topic && `주제: ${project.topic}`, project.sourceUrl && `URL: ${project.sourceUrl}`, project.prompt && `프롬프트 입력됨`].filter(Boolean).join(" · ")}\n\n어떻게 구성할까요?`,
    },
  ]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const bottomRef = useRef();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", text: userMsg }]);
    setLoading(true);

    // video-use 백엔드 연동 (현재는 mock)
    await new Promise(r => setTimeout(r, 1800));
    setMessages(prev => [...prev, {
      role: "assistant",
      text: `알겠습니다. 영상을 분석 중입니다...\n\n**발견된 무음 구간:** 3개 (0:12–0:15, 1:04–1:07, 2:33–2:36)\n**추천 컷:** 총 8개 세그먼트 / 원본 대비 23% 단축\n\n컷 계획이 준비됐습니다. 다음 단계에서 세그먼트별로 승인하시겠습니까?`,
      isDone: true,
    }]);
    setLoading(false);
    setDone(true);
  };

  // mock 세그먼트 데이터
  const mockSegments = [
    { id: 1, start: 0,    end: 12.0, keep: true,  label: "인트로 멘트" },
    { id: 2, start: 15.0, end: 64.0, keep: true,  label: "핵심 설명 1" },
    { id: 3, start: 67.0, end: 104,  keep: true,  label: "핵심 설명 2" },
    { id: 4, start: 104,  end: 153,  keep: false, label: "무음 / 삭제 예정" },
    { id: 5, start: 153,  end: 212,  keep: true,  label: "예시 시연" },
    { id: 6, start: 215,  end: 280,  keep: true,  label: "Q&A" },
    { id: 7, start: 282,  end: 340,  keep: true,  label: "아웃트로" },
  ];

  return (
    <div className="space-y-4">
      {/* 채팅 영역 */}
      <div className="h-72 overflow-y-auto border border-gray-100 rounded-2xl bg-gray-50 p-4 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center text-white text-xs mr-2 flex-shrink-0 mt-0.5">✂</div>
            )}
            <div className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed
              ${m.role === "user"
                ? "bg-fuchsia-500 text-white rounded-br-sm"
                : "bg-white text-gray-700 rounded-bl-sm shadow-sm border border-gray-100"}`}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center text-white text-xs mr-2 flex-shrink-0">✂</div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 빠른 제안 */}
      {!done && (
        <div className="flex flex-wrap gap-2">
          {CUT_SUGGESTIONS.map(s => (
            <button key={s} onClick={() => setInput(s)}
              className="text-xs px-3 py-1.5 rounded-full border border-fuchsia-200 text-fuchsia-600 bg-fuchsia-50 hover:bg-fuchsia-100 transition-colors">
              {s}
            </button>
          ))}
        </div>
      )}

      {/* 입력창 */}
      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="컷 편집 요청을 입력하세요..."
          disabled={loading}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400 disabled:bg-gray-50"
        />
        <button onClick={send} disabled={!input.trim() || loading}
          className="px-4 py-2.5 rounded-xl bg-fuchsia-500 text-white text-sm font-bold hover:bg-fuchsia-600 disabled:opacity-40 transition-colors">
          전송
        </button>
      </div>

      {done && (
        <button
          onClick={() => onNext({ segments: mockSegments })}
          className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-600 shadow-md hover:shadow-lg transition-all">
          컷 승인 단계로 이동 →
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STAGE 3 — 컷 승인
// ═══════════════════════════════════════════════════════════════════
function StageApprove({ cutData, onNext }) {
  const [segments, setSegments] = useState(cutData.segments);

  const toggle = (id) => {
    setSegments(prev => prev.map(s => s.id === id ? { ...s, keep: !s.keep } : s));
  };

  const kept     = segments.filter(s => s.keep);
  const totalDur = kept.reduce((acc, s) => acc + (s.end - s.start), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>세그먼트 {kept.length}/{segments.length} 선택 · 총 {fmtSec(totalDur)}</span>
        <div className="flex gap-2">
          <button onClick={() => setSegments(prev => prev.map(s => ({ ...s, keep: true  })))}
            className="text-fuchsia-500 hover:underline">전체 선택</button>
          <span>·</span>
          <button onClick={() => setSegments(prev => prev.map(s => ({ ...s, keep: false })))}
            className="text-gray-400 hover:underline">전체 해제</button>
        </div>
      </div>

      {/* 세그먼트 목록 */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {segments.map((seg) => (
          <div key={seg.id}
            onClick={() => toggle(seg.id)}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all
              ${seg.keep ? "border-fuchsia-200 bg-fuchsia-50" : "border-gray-200 bg-gray-50 opacity-50"}`}>
            {/* 체크박스 */}
            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors
              ${seg.keep ? "border-fuchsia-500 bg-fuchsia-500" : "border-gray-300 bg-white"}`}>
              {seg.keep && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
            </div>
            {/* 타임라인 바 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-700 truncate">{seg.label}</span>
                <span className="text-xs text-gray-400 ml-2 flex-shrink-0">
                  {fmtSec(seg.start)} – {fmtSec(seg.end)}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${seg.keep ? "bg-fuchsia-400" : "bg-gray-300"}`}
                  style={{ width: `${Math.min(100, ((seg.end - seg.start) / 60) * 100)}%` }}
                />
              </div>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0
              ${seg.keep ? "bg-fuchsia-100 text-fuchsia-600" : "bg-gray-100 text-gray-400"}`}>
              {fmtSec(seg.end - seg.start)}
            </span>
          </div>
        ))}
      </div>

      {/* 컷 결과 정보 */}
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs text-purple-700 space-y-1">
        <div className="font-semibold">📄 컷 결과물</div>
        <div className="text-gray-500">cut_output.mp4 · transcript.json 생성 예정</div>
      </div>

      <button
        disabled={kept.length === 0}
        onClick={() => onNext({ segments: kept })}
        className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-600 shadow-md hover:shadow-lg transition-all disabled:opacity-40">
        승인 완료 — 모션 설명 단계로 →
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STAGE 4 — 모션 설명
// ═══════════════════════════════════════════════════════════════════
function StageMotion({ project, onNext }) {
  // prompt 모드면 project.prompt를 초기값으로 사용
  const [desc,    setDesc]    = useState(project?.prompt || "");
  const [style,   setStyle]   = useState("social");
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const STYLES = [
    { key: "corporate",    label: "기업·제품",     emoji: "🏢" },
    { key: "hype",         label: "하이프·에너지", emoji: "⚡" },
    { key: "storytelling", label: "스토리텔링",    emoji: "📖" },
    { key: "social",       label: "소셜·숏폼",     emoji: "📱" },
  ];

  const isPromptMode = project?.mode === "prompt";

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/fullgraphic-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic:     project?.topic     || null,
          sourceUrl: project?.sourceUrl || null,
          prompt:    project?.prompt    || null,
          motionDesc: desc.trim() || null,
          style,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "플랜 생성 실패");
      // beats를 바로 넘겨서 Stage 5에서 표시
      onNext({ motionDesc: desc, style, beats: json.beats });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* prompt 모드 안내 */}
      {isPromptMode && (
        <div className="rounded-xl bg-fuchsia-50 border border-fuchsia-200 px-4 py-3 text-xs text-fuchsia-700 space-y-1">
          <p className="font-semibold">✍️ 프롬프트 기반 플랜 생성</p>
          {project.topic     && <p>📌 주제: {project.topic}</p>}
          {project.sourceUrl && <p>🔗 URL: <span className="font-mono break-all">{project.sourceUrl}</span></p>}
          <p className="text-fuchsia-500">아래 설명을 보완하거나 그대로 생성하세요.</p>
        </div>
      )}

      {/* 스타일 선택 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">영상 스타일</label>
        <div className="grid grid-cols-2 gap-2">
          {STYLES.map(s => (
            <button key={s.key} onClick={() => setStyle(s.key)}
              className={`flex items-center gap-2 p-2.5 rounded-xl border text-sm transition-all
                ${style === s.key
                  ? "border-fuchsia-400 bg-fuchsia-50 text-fuchsia-700 font-medium"
                  : "border-gray-200 text-gray-600 hover:border-gray-300"}`}>
              <span>{s.emoji}</span>{s.label}
            </button>
          ))}
        </div>
      </div>

      {/* 모션 설명 텍스트 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-2">
          모션 그래픽 설명 <span className="text-gray-400 font-normal">(자연어)</span>
        </label>
        <textarea
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="어떤 영상을 만들고 싶은지 자연어로 설명하세요..."
          rows={5}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-fuchsia-400 resize-none"
        />
        <div className="flex justify-end mt-1">
          <span className="text-xs text-gray-400">{desc.length}자</span>
        </div>
      </div>

      {/* 예시 프롬프트 (prompt 모드가 아닐 때만) */}
      {!isPromptMode && (
        <div>
          <p className="text-xs text-gray-400 mb-2">예시 프롬프트 (클릭하여 사용)</p>
          <div className="space-y-2">
            {MOTION_EXAMPLES.map((ex, i) => (
              <button key={i} onClick={() => setDesc(ex)}
                className="w-full text-left text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 hover:bg-purple-50 hover:border-purple-200 transition-colors leading-relaxed">
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 오류 */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-600">
          ⚠ {error}
        </div>
      )}

      {isPromptMode ? (
        /* prompt 모드: Claude API로 beats 생성 */
        <button
          disabled={loading}
          onClick={handleGenerate}
          className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-600 shadow-md hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2">
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              AI가 플랜 생성 중...
            </>
          ) : "✨ AI 플랜 생성 →"}
        </button>
      ) : (
        /* upload 모드: 기존 흐름 */
        <button
          disabled={!desc.trim()}
          onClick={() => onNext({ motionDesc: desc, style, beats: null })}
          className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-600 shadow-md hover:shadow-lg transition-all disabled:opacity-40">
          플랜 생성 →
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STAGE 5 — 플랜 검토 (Plan Mode)
// ═══════════════════════════════════════════════════════════════════
function defaultBeats(motionDesc) {
  return [
    { id: 1, time: "0:00–0:03", label: "오프닝 로고 리빌",   desc: "검은 배경 + 크롬 그라디언트 타이틀 whip-pan 등장",  keep: true },
    { id: 2, time: "0:03–0:08", label: "키 메시지 #1",       desc: "핵심 키워드 왼쪽 슬라이드인, 배경 그리드 오버레이", keep: true },
    { id: 3, time: "0:08–0:15", label: "영상 클립 인서트",   desc: "원본 컷 B-롤 삽입, 하단 자막 오버레이",             keep: true },
    { id: 4, time: "0:15–0:22", label: "키 메시지 #2",       desc: "두 번째 포인트 애니메이션 텍스트 팝인",             keep: true },
    { id: 5, time: "0:22–0:28", label: "소셜 팔로우 카드",   desc: "Instagram / YouTube 팔로우 카드 슬라이드인",        keep: true },
    { id: 6, time: "0:28–0:33", label: "아웃트로 + CTA",     desc: "로고 페이드아웃, CTA 버튼 펄스, 6초 홀드",          keep: true },
  ];
}

function StagePlan({ motionData, onNext }) {
  // motionData.beats가 있으면 AI 생성 beats, 없으면 기본값
  const [beats,     setBeats]     = useState(() => motionData?.beats?.length ? motionData.beats : defaultBeats(motionData?.motionDesc));
  const [editing,   setEditing]   = useState(null); // beat.id or null
  const [editLabel, setEditLabel] = useState("");
  const [editDesc,  setEditDesc]  = useState("");

  const startEdit = (b) => { setEditing(b.id); setEditLabel(b.label); setEditDesc(b.desc); };
  const saveEdit  = (id) => {
    setBeats(prev => prev.map(b => b.id === id ? { ...b, label: editLabel, desc: editDesc } : b));
    setEditing(null);
  };

  const totalSec = 33;

  return (
    <div className="space-y-4">
      <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 text-xs text-purple-700">
        <span className="font-semibold">플랜 모드</span> — 각 비트를 검토하고 필요시 수정하세요. 토글로 비트를 제외할 수 있습니다.
      </div>

      {/* 타임라인 시각화 */}
      <div className="flex gap-px h-4 rounded-lg overflow-hidden">
        {beats.map(b => (
          <div key={b.id}
            className={`flex-1 ${b.keep ? "bg-gradient-to-r from-fuchsia-400 to-pink-500" : "bg-gray-200"}`}
            title={b.label}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>0:00</span>
        <span>총 {fmtSec(totalSec)} (예상)</span>
      </div>

      {/* 비트 카드 목록 */}
      <div className="space-y-2">
        {beats.map((b) => (
          <div key={b.id}
            className={`border rounded-xl p-3 transition-all ${b.keep ? "border-gray-200 bg-white" : "border-gray-100 bg-gray-50 opacity-60"}`}>
            <div className="flex items-start gap-3">
              {/* 토글 */}
              <button onClick={() => setBeats(prev => prev.map(x => x.id === b.id ? { ...x, keep: !x.keep } : x))}
                className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 transition-colors
                  ${b.keep ? "border-fuchsia-500 bg-fuchsia-500" : "border-gray-300 bg-white"}`}>
                {b.keep && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5L8.5 2" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>}
              </button>
              <div className="flex-1 min-w-0">
                {editing === b.id ? (
                  /* ── 편집 모드 ── */
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-fuchsia-500 font-mono flex-shrink-0">{b.time}</span>
                      <input
                        value={editLabel}
                        onChange={e => setEditLabel(e.target.value)}
                        placeholder="비트 이름"
                        className="flex-1 text-xs font-semibold border border-fuchsia-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-fuchsia-400"
                        autoFocus
                      />
                    </div>
                    <input
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveEdit(b.id)}
                      placeholder="효과 설명"
                      className="w-full text-xs border border-fuchsia-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-fuchsia-400 text-gray-600"
                    />
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setEditing(null)}
                        className="text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-500">취소</button>
                      <button onClick={() => saveEdit(b.id)}
                        className="text-xs px-2 py-1 bg-fuchsia-500 text-white rounded-lg">저장</button>
                    </div>
                  </div>
                ) : (
                  /* ── 보기 모드 ── */
                  <>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-fuchsia-500 font-mono">{b.time}</span>
                      <span className="text-xs font-semibold text-gray-700">{b.label}</span>
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
                      <button onClick={() => startEdit(b)}
                        className="text-xs text-gray-400 hover:text-fuchsia-500 flex-shrink-0">✎</button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <button
        disabled={beats.filter(b => b.keep).length === 0}
        onClick={() => onNext({ beats: beats.filter(b => b.keep) })}
        className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-600 shadow-md hover:shadow-lg transition-all disabled:opacity-40">
        플랜 확정 — 생성 시작 →
      </button>
    </div>
  );
}

// ── 비트 데이터로 인라인 HTML 컴포지션 생성 ──────────────────────
function buildCompositionHTML(beats, style) {
  const STYLES = {
    corporate:    { accent:"#4f8ef7", sub:"#8ba3c7", title:"#ffffff", bg1:"#0d1117", bg2:"#0a1628" },
    hype:         { accent:"#ff4466", sub:"#ffaa00", title:"#ffffff", bg1:"#0a0010", bg2:"#200010" },
    storytelling: { accent:"#f5c842", sub:"#c8a96e", title:"#fff8ee", bg1:"#13100a", bg2:"#2a1f0f" },
    social:       { accent:"#c77dff", sub:"#e0aaff", title:"#ffffff", bg1:"#0f0a1e", bg2:"#1a0a3e" },
  };
  const s = STYLES[style] || STYLES.corporate;
  const beatsJSON = JSON.stringify(beats.map(b => ({
    time: b.time||"", label: b.label||"", desc: b.desc||""
  })));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;overflow:hidden;background:${s.bg1};}
#bg{position:fixed;inset:0;width:100%;height:100%;}
#ui{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:'Noto Sans KR',Arial,sans-serif;}
/* 시네마틱 바 */
.cin{position:fixed;left:0;right:0;height:36px;background:#000;z-index:10;}
.cin.top{top:0;} .cin.bottom{bottom:0;}
/* 코너 데코 */
.corner{position:fixed;width:20px;height:20px;border-color:${s.accent};border-style:solid;opacity:0.5;z-index:11;}
.tl{top:44px;left:12px;border-width:2px 0 0 2px;}
.tr{top:44px;right:12px;border-width:2px 2px 0 0;}
.bl{bottom:44px;left:12px;border-width:0 0 2px 2px;}
.br{bottom:44px;right:12px;border-width:0 2px 2px 0;}
/* 콘텐츠 */
#content{
  text-align:center;padding:0 32px;
  transition:opacity .35s ease,transform .35s ease;
  position:relative;z-index:5;
}
#content.hidden{opacity:0;transform:translateY(16px);}
#content.visible{opacity:1;transform:translateY(0);}
#tc{font-size:10px;letter-spacing:4px;text-transform:uppercase;color:${s.accent};font-weight:700;margin-bottom:14px;opacity:.85;}
#ttl{font-size:22px;font-weight:900;color:${s.title};line-height:1.2;margin-bottom:10px;text-shadow:0 0 32px ${s.accent}66;}
#dsc{font-size:11px;color:${s.sub};line-height:1.7;max-width:300px;margin:0 auto;}
#acbar{width:48px;height:3px;border-radius:2px;background:${s.accent};box-shadow:0 0 12px ${s.accent};margin:16px auto 0;}
/* 타임라인 */
#timeline{position:fixed;bottom:36px;left:0;right:0;height:3px;background:rgba(255,255,255,.08);z-index:10;}
#tl-fill{height:100%;width:0%;background:${s.accent};box-shadow:0 0 6px ${s.accent};transition:width .1s linear;}
/* 카운터 */
#ctr{position:fixed;top:10px;left:50%;transform:translateX(-50%);font-size:9px;color:${s.accent};opacity:.5;letter-spacing:2px;z-index:11;font-family:monospace;}
/* 타임코드 */
#clock{position:fixed;bottom:10px;right:12px;font-size:9px;color:rgba(255,255,255,.3);font-family:monospace;z-index:11;}
</style>
</head>
<body>
<canvas id="bg"></canvas>
<div id="ui">
  <div class="cin top"></div>
  <div class="cin bottom"></div>
  <div class="corner tl"></div><div class="corner tr"></div>
  <div class="corner bl"></div><div class="corner br"></div>
  <div id="ctr"></div>
  <div id="content" class="hidden">
    <div id="tc"></div>
    <div id="ttl"></div>
    <div id="dsc"></div>
    <div id="acbar"></div>
  </div>
  <div id="timeline"><div id="tl-fill"></div></div>
  <div id="clock">00:00:00</div>
</div>
<script>
(function(){
  var BEATS    = ${beatsJSON};
  var BEAT_MS  = 4000;
  var ACCENT   = '${s.accent}';
  var BG1      = '${s.bg1}';
  var BG2      = '${s.bg2}';

  /* ── 캔버스 배경 ── */
  var canvas = document.getElementById('bg');
  var ctx    = canvas.getContext('2d');
  var W, H;
  function resize(){
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  /* 파티클 */
  var PTS = Array.from({length:35},function(){
    return {x:Math.random(),y:Math.random(),r:Math.random()*1.2+.4,vx:(Math.random()-.5)*.0004,vy:(Math.random()-.5)*.0004,o:Math.random()*.4+.1};
  });

  /* hex → rgba */
  function hexRgb(h,a){
    var r=parseInt(h.slice(1,3),16),g=parseInt(h.slice(3,5),16),b=parseInt(h.slice(5,7),16);
    return 'rgba('+r+','+g+','+b+','+a+')';
  }

  function drawBg(t){
    /* 베이스 그라디언트 */
    var grd = ctx.createLinearGradient(0,0,W,H);
    grd.addColorStop(0,BG1); grd.addColorStop(1,BG2);
    ctx.fillStyle = grd; ctx.fillRect(0,0,W,H);

    /* 움직이는 글로우 */
    var gx = W*.5 + Math.sin(t*.0007)*W*.35;
    var gy = H*.5 + Math.cos(t*.0005)*H*.35;
    var rg = ctx.createRadialGradient(gx,gy,0,W*.5,H*.5,Math.max(W,H)*.7);
    rg.addColorStop(0, hexRgb(ACCENT,.13));
    rg.addColorStop(1, 'transparent');
    ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);

    /* 그리드 */
    ctx.strokeStyle = hexRgb(ACCENT,.06);
    ctx.lineWidth = 1;
    for(var x=0;x<W;x+=44){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
    for(var y=0;y<H;y+=44){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}

    /* 파티클 */
    PTS.forEach(function(p){
      p.x=(p.x+p.vx+1)%1; p.y=(p.y+p.vy+1)%1;
      ctx.beginPath();
      ctx.arc(p.x*W,p.y*H,p.r,0,Math.PI*2);
      ctx.fillStyle=hexRgb(ACCENT,p.o);
      ctx.fill();
    });

    /* 스캔라인 (영상감) */
    ctx.fillStyle='rgba(0,0,0,.04)';
    for(var sy=0;sy<H;sy+=2){ ctx.fillRect(0,sy,W,1); }
  }

  /* ── 콘텐츠 전환 ── */
  var content = document.getElementById('content');
  var tcEl    = document.getElementById('tc');
  var ttlEl   = document.getElementById('ttl');
  var dscEl   = document.getElementById('dsc');
  var ctrEl   = document.getElementById('ctr');
  var tlFill  = document.getElementById('tl-fill');
  var clockEl = document.getElementById('clock');
  var curBeat = -1;

  function setContent(idx){
    if(idx===curBeat) return;
    curBeat=idx;
    content.classList.remove('visible'); content.classList.add('hidden');
    setTimeout(function(){
      var b=BEATS[idx];
      tcEl.textContent  = b.time;
      ttlEl.textContent = b.label;
      dscEl.textContent = b.desc;
      ctrEl.textContent = (idx+1)+' / '+BEATS.length;
      content.classList.remove('hidden'); content.classList.add('visible');
    },350);
  }

  function fmtClock(ms){
    var s=Math.floor(ms/1000),m=Math.floor(s/60),h=Math.floor(m/60);
    return [h,m%60,s%60].map(function(v){return String(v).padStart(2,'0');}).join(':');
  }

  /* ── 메인 루프 ── */
  var start = performance.now();
  function loop(now){
    var elapsed = now - start;
    var t       = elapsed;
    var beatIdx = Math.floor(elapsed/BEAT_MS) % BEATS.length;
    var pct     = (elapsed%BEAT_MS)/BEAT_MS*100;

    drawBg(t);
    setContent(beatIdx);
    tlFill.style.width = pct+'%';
    clockEl.textContent = fmtClock(elapsed);

    requestAnimationFrame(loop);
  }
  setContent(0);
  requestAnimationFrame(loop);
})();
</script>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
// STAGE 6 — 미리보기 & 반복 수정
// ═══════════════════════════════════════════════════════════════════
// ── 비트 설명 → 실제 CSS 모션 애니메이션 오버레이 ─────────────────
function MotionOverlay({ beat, accent, beatKey }) {
  const full = ((beat?.label || "") + " " + (beat?.desc || "")).toLowerCase();
  const is = (...kws) => kws.some(k => full.includes(k));

  const A = (name, dur = "0.65s", delay = "0s") =>
    ({ animation: `${name} ${dur} cubic-bezier(0.22,1,0.36,1) ${delay} both` });

  const CHROME = {
    background: "linear-gradient(90deg,#fff 0%,#d0d0d0 30%,#fff 55%,#a8a8a8 75%,#fff 100%)",
    WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
  };
  const GLOW   = { textShadow: `0 0 28px ${accent}99` };
  const FONT   = { fontFamily: "'Noto Sans KR',Arial,sans-serif" };
  const BAR    = { width: 44, height: 3, borderRadius: 2, background: accent, boxShadow: `0 0 10px ${accent}` };

  // 공통 keyframe CSS
  const KF = `
    @keyframes whipPan  { 0%{transform:translateX(-90vw) skewX(-14deg);opacity:0} 65%{transform:translateX(4px) skewX(1deg);opacity:1} 82%{transform:translateX(-2px)} 100%{transform:none} }
    @keyframes slideL   { from{transform:translateX(-110%);opacity:0} to{transform:translateX(0);opacity:1} }
    @keyframes slideUp  { from{transform:translateY(28px);opacity:0} to{transform:translateY(0);opacity:1} }
    @keyframes popIn    { 0%{transform:scale(.55);opacity:0} 70%{transform:scale(1.06);opacity:1} 100%{transform:scale(1)} }
    @keyframes fadeIn   { from{opacity:0} to{opacity:1} }
    @keyframes pulse    { 0%,100%{box-shadow:0 0 0 0 ${accent}99} 50%{box-shadow:0 0 0 10px transparent} }
    @keyframes shimmer  { 0%{background-position:200% center} 100%{background-position:-200% center} }
  `;

  /* ── 오프닝 / 로고 리빌 / whip-pan ── */
  if (is("오프닝","로고","리빌","whip","인트로","reveal")) return (
    <div key={beatKey} style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"0 24px", ...FONT }}>
      <style>{KF}</style>
      <div style={{ ...A("fadeIn","0.4s","0s"), fontSize:10, letterSpacing:4, textTransform:"uppercase", color:accent, fontWeight:700, marginBottom:12 }}>
        {beat?.time}
      </div>
      <div style={{ ...A("whipPan","0.7s","0.05s"), fontSize:27, fontWeight:900, lineHeight:1.15, textAlign:"center", ...CHROME }}>
        {beat?.label}
      </div>
      <div style={{ ...A("slideUp","0.4s","0.55s"), marginTop:14, ...BAR }} />
    </div>
  );

  /* ── 키 메시지 / 키워드 슬라이드인 ── */
  if (is("키 메시지","키워드","슬라이드","slide","메시지")) return (
    <div key={beatKey} style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 20px", ...FONT }}>
      <style>{KF}</style>
      {(beat?.label || "").split(/[\s·]+/).filter(Boolean).map((w, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, ...A("slideL","0.5s",`${i * 0.13}s`) }}>
          <span style={{ background:accent, color:"#000", fontWeight:900, fontSize:9, padding:"2px 7px", borderRadius:4, flexShrink:0 }}>
            {String(i+1).padStart(2,"0")}
          </span>
          <span style={{ fontSize: i===0?18:14, fontWeight:900, color:"#fff", textShadow:"0 2px 8px rgba(0,0,0,0.8)" }}>{w}</span>
        </div>
      ))}
      <div style={{ ...A("slideL","0.4s","0.4s"), ...BAR }} />
    </div>
  );

  /* ── 소셜 / 팔로우 카드 ── */
  if (is("소셜","팔로우","social","follow","인스타","유튜브")) return (
    <div key={beatKey} style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, ...FONT }}>
      <style>{KF}</style>
      <div style={{ ...A("fadeIn","0.3s","0s"), color:"rgba(255,255,255,0.5)", fontSize:10, marginBottom:4 }}>팔로우해주세요</div>
      {["YouTube","Instagram"].map((p,i) => (
        <div key={p} style={{ background:"rgba(0,0,0,0.75)", border:`1.5px solid ${accent}66`, borderRadius:12, padding:"9px 20px", display:"flex", alignItems:"center", gap:10, ...A("popIn","0.5s",`${i*0.14}s`) }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:accent, boxShadow:`0 0 8px ${accent}` }} />
          <span style={{ fontSize:13, fontWeight:700, color:"#fff" }}>{p} 팔로우</span>
        </div>
      ))}
    </div>
  );

  /* ── 아웃트로 / CTA / 버튼 ── */
  if (is("아웃트로","cta","버튼","outro","마무리","홀드")) return (
    <div key={beatKey} style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:16, ...FONT }}>
      <style>{KF}</style>
      <div style={{ ...A("fadeIn","0.5s","0s"), fontSize:20, fontWeight:900, color:"#fff", textAlign:"center", ...GLOW }}>
        {beat?.label}
      </div>
      <div style={{ background:accent, color:"#000", fontWeight:900, fontSize:12, padding:"10px 24px", borderRadius:24, animation:`pulse 1.6s ease infinite, popIn 0.5s cubic-bezier(0.22,1,0.36,1) 0.3s both`, cursor:"default" }}>
        지금 바로 시작하기 →
      </div>
    </div>
  );

  /* ── B-롤 / 영상 클립 / 자막 스타일 (기본) ── */
  return (
    <div key={beatKey} style={{ position:"absolute", bottom:0, left:0, right:0, padding:"36px 18px 20px", background:"linear-gradient(transparent,rgba(0,0,0,0.92))", ...FONT }}>
      <style>{KF}</style>
      <div style={{ ...A("slideUp","0.35s","0s"), fontSize:9, letterSpacing:3, textTransform:"uppercase", color:accent, fontWeight:700, marginBottom:6 }}>
        {beat?.time}
      </div>
      <div style={{ ...A("slideUp","0.35s","0.08s"), fontSize:16, fontWeight:900, color:"#fff", lineHeight:1.25, marginBottom:4, ...GLOW }}>
        {beat?.label}
      </div>
      <div style={{ ...A("slideUp","0.35s","0.18s"), ...BAR, marginTop:10 }} />
    </div>
  );
}

// ── 비트 시간 문자열 → 초 변환 ("0:03" → 3)
function parseTimeToSec(str) {
  if (!str) return 0;
  const m = str.match(/(\d+):(\d+)/);
  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : 0;
}

function StagePreview({ project, planData, motionData, onNext }) {
  const videoRef  = useRef();
  const bottomRef = useRef();

  const [generating,   setGenerating]   = useState(true);
  const [progress,     setProgress]     = useState(0);
  const [videoUrl,     setVideoUrl]     = useState(null);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [beatIdx,      setBeatIdx]      = useState(0);
  const [chatInput,    setChatInput]    = useState("");
  const [chatMsgs,     setChatMsgs]     = useState([]);
  const [chatLoading,  setChatLoading]  = useState(false);

  const beats   = planData?.beats || [
    { time: "0:00–0:05", label: "오프닝",     desc: "타이틀 화면" },
    { time: "0:05–0:15", label: "핵심 메시지", desc: "주요 내용 전달" },
    { time: "0:15–0:25", label: "마무리",     desc: "아웃트로" },
  ];
  const style    = motionData?.style || "corporate";
  const hasVideo = !!project?.videoFile;

  // 업로드 영상 blob URL 생성
  useEffect(() => {
    if (!project?.videoFile) return;
    const url = URL.createObjectURL(project.videoFile);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, []);

  // 영상 없을 때 fallback: 캔버스 애니메이션
  const compositionHTML = !hasVideo ? buildCompositionHTML(beats, style) : null;

  // 스타일별 accent 색상
  const ACCENT = { corporate:"#4f8ef7", hype:"#ff4466", storytelling:"#f5c842", social:"#c77dff" }[style] || "#4f8ef7";

  // 생성 진행 시뮬레이션
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); setGenerating(false); return 100; }
        return Math.min(100, p + Math.random() * 8);
      });
    }, 200);
    return () => clearInterval(interval);
  }, [generating]);

  // 영상 재생 시간 → 현재 비트 계산
  const onTimeUpdate = () => {
    const t = videoRef.current?.currentTime || 0;
    setCurrentTime(t);
    for (let i = 0; i < beats.length; i++) {
      const parts = (beats[i].time || "").split("–");
      const s = parseTimeToSec(parts[0]);
      const e = parseTimeToSec(parts[1]) || s + 5;
      if (t >= s && t < e) { setBeatIdx(i); return; }
    }
    // 범위 밖이면 비율로 계산
    setBeatIdx(Math.floor((t / (duration || 1)) * beats.length) % beats.length);
  };

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMsgs(prev => [...prev, { role: "user", text: msg }]);
    setChatLoading(true);
    await new Promise(r => setTimeout(r, 1400));
    setChatMsgs(prev => [...prev, {
      role: "assistant",
      text: "적용했습니다. 오버레이 스타일을 수정했습니다.",
    }]);
    setChatLoading(false);
  };

  const activeBeat = beats[beatIdx] || beats[0];
  const vidPct = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* 생성 진행 */}
      {generating ? (
        <div className="border border-gray-100 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center">
              <span className="text-white text-sm animate-spin inline-block">⚙</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">컴포지션 생성 중...</p>
              <p className="text-xs text-gray-400">{Math.round(progress)}% 완료</p>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs text-gray-400 space-y-0.5">
            {progress > 10 && <p className="text-green-600">✓ 비트 타임라인 파싱</p>}
            {progress > 35 && <p className="text-green-600">✓ 오버레이 레이어 빌드</p>}
            {progress > 60 && <p className="text-green-600">✓ 스타일 적용</p>}
            {progress > 80 && <p className="text-green-600">✓ 미리보기 준비 완료</p>}
            {progress < 100 && <p className="text-gray-400">… 완료 대기 중</p>}
          </div>
        </div>
      ) : (
        <>
          {/* ── 9:16 미리보기 ── */}
          <div className="rounded-2xl overflow-hidden border border-fuchsia-200 shadow-md bg-gray-950">
            <div className="flex items-center justify-between bg-gray-900 px-4 py-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-gray-400 text-xs font-mono">
                9:16 · {beats.length} beats{hasVideo ? " · " + (project.videoFile?.name || "") : " · demo"}
              </span>
              <span className="text-xs font-medium" style={{ color: ACCENT }}>{style}</span>
            </div>

            <div className="flex justify-center items-center py-4 bg-gray-950">
              <div style={{ width: 270, height: 480, position: "relative", borderRadius: 12, overflow: "hidden", background: "#000", flexShrink: 0 }}>

                {hasVideo ? (
                  <>
                    {/* 실제 업로드 영상 */}
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      autoPlay loop muted playsInline
                      onTimeUpdate={onTimeUpdate}
                      onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                    />

                    {/* 비트별 실제 모션 오버레이 */}
                    <MotionOverlay beat={activeBeat} accent={ACCENT} beatKey={beatIdx} />

                    {/* 상단: 비트 카운터 */}
                    <div style={{ position: "absolute", top: 10, right: 12, fontSize: 9, color: "rgba(255,255,255,0.4)", fontFamily: "monospace", letterSpacing: 1 }}>
                      {beatIdx + 1} / {beats.length}
                    </div>

                    {/* 하단 영상 진행 바 */}
                    <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgba(255,255,255,0.1)" }}>
                      <div style={{ height: "100%", background: ACCENT, width: `${vidPct}%`, transition: "width 0.2s linear", boxShadow: `0 0 6px ${ACCENT}` }} />
                    </div>
                  </>
                ) : (
                  /* 영상 없을 때: 캔버스 애니메이션 fallback */
                  <iframe
                    srcDoc={compositionHTML}
                    style={{ width: "100%", height: "100%", border: "none", display: "block" }}
                    title="컴포지션 미리보기"
                    sandbox="allow-scripts"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 반복 수정 채팅 */}
          <div className="border border-gray-100 rounded-2xl bg-gray-50">
            <div className="px-4 pt-3 pb-1 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-600">타임라인 수정 채팅</p>
            </div>
            <div className="h-36 overflow-y-auto p-3 space-y-2">
              {chatMsgs.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-4">자연어로 수정을 요청하세요. 예: "타이틀 색상 파랑으로 변경해줘"</p>
              )}
              {chatMsgs.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] text-xs px-3 py-2 rounded-xl
                    ${m.role === "user" ? "bg-fuchsia-500 text-white" : "bg-white border border-gray-200 text-gray-600"}`}>
                    {m.text}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex gap-1 px-3">
                  {[0,1,2].map(i => <div key={i} className="w-1.5 h-1.5 bg-fuchsia-400 rounded-full animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="p-3 border-t border-gray-100 flex gap-2">
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder="수정 요청 입력..."
                className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-fuchsia-400"
              />
              <button onClick={sendChat} disabled={!chatInput.trim() || chatLoading}
                className="px-3 py-2 bg-fuchsia-500 text-white text-xs rounded-lg disabled:opacity-40">전송</button>
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2">
        {generating && (
          <button
            onClick={() => { setGenerating(false); setPreviewReady(true); setProgress(100); }}
            className="flex-1 py-3 rounded-2xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-all">
            건너뛰기 →
          </button>
        )}
        <button
          disabled={generating}
          onClick={onNext}
          className="flex-1 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-600 shadow-md hover:shadow-lg transition-all disabled:opacity-40">
          확인 완료 — 최종 렌더로 →
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// STAGE 7 — 최종 렌더
// ═══════════════════════════════════════════════════════════════════
function StageRender({ project }) {
  const [status,   setStatus]   = useState("idle"); // idle | rendering | done | error
  const [progress, setProgress] = useState(0);
  const [logLines, setLogLines] = useState([]);
  const [outputPath, setOutputPath] = useState("");

  const RENDER_LOGS = [
    "Hyperframes renderer starting...",
    `Composition: ${project?.projectName || "project"}-final`,
    "Resolution: 1920×1080 · 30fps",
    "Quality: standard (CRF 18)",
    "Rendering frames 1–990...",
    "Encoding H.264 stream...",
    "Muxing audio + video...",
    "Optimizing for web (faststart)...",
    "Writing output file...",
  ];

  const startRender = async () => {
    setStatus("rendering");
    setProgress(0);
    setLogLines([]);

    for (let i = 0; i < RENDER_LOGS.length; i++) {
      await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
      setLogLines(prev => [...prev, RENDER_LOGS[i]]);
      setProgress(Math.round(((i + 1) / RENDER_LOGS.length) * 100));
    }

    await new Promise(r => setTimeout(r, 500));
    setOutputPath(`renders/${project?.projectName || "project"}-final.mp4`);
    setStatus("done");
  };

  return (
    <div className="space-y-4">
      {/* 렌더 버튼 */}
      {status === "idle" && (
        <div className="text-center py-6 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-fuchsia-500 to-pink-600 flex items-center justify-center shadow-lg">
            <span className="text-white text-2xl">🎬</span>
          </div>
          <div>
            <h4 className="text-base font-bold text-gray-800">최종 렌더 준비 완료</h4>
            <p className="text-sm text-gray-500 mt-1">표준 품질 (1080p · CRF 18) 렌더를 시작합니다.</p>
          </div>
          <button
            onClick={startRender}
            className="px-8 py-3.5 rounded-2xl text-base font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-600 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all">
            give me the render 🎬
          </button>
        </div>
      )}

      {/* 렌더 진행 */}
      {status === "rendering" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">렌더링 중...</span>
            <span className="text-sm font-bold text-fuchsia-600">{progress}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
          <div className="bg-gray-900 rounded-xl p-3 h-40 overflow-y-auto font-mono text-xs space-y-0.5">
            {logLines.map((l, i) => (
              <div key={i} className={i === logLines.length - 1 ? "text-fuchsia-400" : "text-gray-400"}>
                {`> ${l}`}
              </div>
            ))}
            <div className="text-gray-600 animate-pulse">█</div>
          </div>
        </div>
      )}

      {/* 렌더 완료 */}
      {status === "done" && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-full bg-green-100 flex items-center justify-center text-2xl">✅</div>
            <div>
              <p className="font-bold text-green-700">렌더 시뮬레이션 완료</p>
              <p className="text-xs text-green-600 mt-1 font-mono">{outputPath}</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700 text-left space-y-1">
              <p className="font-semibold">⚠ 현재는 데모 모드입니다</p>
              <p>실제 영상 파일이 생성되지 않았습니다. Hyperframes 렌더 엔진 연동 후 실제 파일 다운로드 및 NAS 저장이 가능합니다.</p>
            </div>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => alert("실제 렌더 엔진 연동 후 사용 가능합니다.\n현재는 데모 모드입니다.")}
                className="px-4 py-2 text-xs font-bold text-gray-400 bg-gray-100 rounded-xl cursor-not-allowed border border-gray-200">
                📁 파일 열기 (준비 중)
              </button>
              <button
                onClick={() => alert("실제 렌더 엔진 연동 후 사용 가능합니다.\n현재는 데모 모드입니다.")}
                className="px-4 py-2 text-xs font-bold text-gray-400 border border-gray-200 rounded-xl cursor-not-allowed">
                📤 NAS에 저장 (준비 중)
              </button>
            </div>
          </div>

          <div className="bg-gray-900 rounded-xl p-3 h-32 overflow-y-auto font-mono text-xs space-y-0.5">
            {logLines.map((l, i) => (
              <div key={i} className="text-gray-400">{`> ${l}`}</div>
            ))}
            <div className="text-green-400">✓ Done in 00:28</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ═══════════════════════════════════════════════════════════════════
export default function FullGraphicWorkflow({ nasState, onGoToNas }) {
  const [stage,   setStage]   = useState(1);
  const [project, setProject] = useState(null);
  const [cutData, setCutData] = useState(null);
  const [motionData, setMotionData] = useState(null);
  const [planData, setPlanData] = useState(null);

  return (
    <div className="p-4">
      <StageIndicator current={stage} />

      <div className="max-w-xl mx-auto">
        {stage === 1 && (
          <StageSetup onNext={data => {
            setProject(data);
            // prompt 모드면 컷 편집·승인 건너뛰고 바로 모션 설명으로
            setStage(data.mode === "prompt" ? 4 : 2);
          }} />
        )}
        {stage === 2 && (
          <StageCut
            project={project}
            onNext={data => { setCutData(data); setStage(3); }}
          />
        )}
        {stage === 3 && (
          <StageApprove
            cutData={cutData}
            onNext={data => { setCutData(data); setStage(4); }}
          />
        )}
        {stage === 4 && (
          <StageMotion
            project={project}
            onNext={data => { setMotionData(data); setStage(5); }}
          />
        )}
        {stage === 5 && (
          <StagePlan
            motionData={motionData}
            onNext={data => { setPlanData(data); setStage(6); }}
          />
        )}
        {stage === 6 && (
          <StagePreview
            project={project}
            planData={planData}
            motionData={motionData}
            onNext={() => setStage(7)}
          />
        )}
        {stage === 7 && (
          <StageRender project={project} />
        )}
      </div>

      {/* 처음으로 돌아가기 */}
      {stage > 1 && (
        <div className="text-center mt-6">
          <button
            onClick={() => { setStage(1); setProject(null); setCutData(null); setMotionData(null); setPlanData(null); }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← 새 프로젝트로 처음부터
          </button>
        </div>
      )}
    </div>
  );
}
