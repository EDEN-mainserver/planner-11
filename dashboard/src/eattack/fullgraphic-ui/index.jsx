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
  const [projectName, setProjectName] = useState("");
  const [videoFile,   setVideoFile]   = useState(null);
  const [dragging,    setDragging]    = useState(false);
  const inputRef = useRef();

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.type.startsWith("video/")) setVideoFile(f);
  }, []);

  const canNext = projectName.trim() && videoFile;

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

      {/* 영상 드롭존 */}
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

      <button
        disabled={!canNext}
        onClick={() => onNext({ projectName: projectName.trim(), videoFile })}
        className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-600
          shadow-md hover:shadow-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
      >
        컷 편집 시작 →
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
      text: `**${project.projectName}** 프로젝트가 준비됐습니다.\n\n원본 영상 \`${project.videoFile.name}\`을 분석합니다. 어떻게 컷 편집할까요?`,
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
function StageMotion({ onNext }) {
  const [desc,  setDesc]  = useState("");
  const [style, setStyle] = useState("corporate"); // corporate | hype | storytelling | social

  const STYLES = [
    { key: "corporate",    label: "기업·제품",  emoji: "🏢" },
    { key: "hype",         label: "하이프·에너지", emoji: "⚡" },
    { key: "storytelling", label: "스토리텔링",  emoji: "📖" },
    { key: "social",       label: "소셜·숏폼",  emoji: "📱" },
  ];

  return (
    <div className="space-y-4">
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
        <label className="block text-xs font-semibold text-gray-600 mb-2">모션 그래픽 설명 (자연어)</label>
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

      {/* 예시 프롬프트 */}
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

      <button
        disabled={!desc.trim()}
        onClick={() => onNext({ motionDesc: desc, style })}
        className="w-full py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-fuchsia-500 to-pink-600 shadow-md hover:shadow-lg transition-all disabled:opacity-40">
        플랜 생성 →
      </button>
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
  const [beats,    setBeats]    = useState(() => defaultBeats(motionData.motionDesc));
  const [editing,  setEditing]  = useState(null); // beat.id or null
  const [editText, setEditText] = useState("");

  const startEdit = (b) => { setEditing(b.id); setEditText(b.desc); };
  const saveEdit  = (id) => {
    setBeats(prev => prev.map(b => b.id === id ? { ...b, desc: editText } : b));
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
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs text-fuchsia-500 font-mono">{b.time}</span>
                  <span className="text-xs font-semibold text-gray-700">{b.label}</span>
                </div>
                {editing === b.id ? (
                  <div className="flex gap-2">
                    <input
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && saveEdit(b.id)}
                      className="flex-1 text-xs border border-fuchsia-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-fuchsia-400"
                      autoFocus
                    />
                    <button onClick={() => saveEdit(b.id)}
                      className="text-xs px-2 py-1 bg-fuchsia-500 text-white rounded-lg">저장</button>
                    <button onClick={() => setEditing(null)}
                      className="text-xs px-2 py-1 border border-gray-200 rounded-lg text-gray-500">취소</button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-gray-500 leading-relaxed">{b.desc}</p>
                    <button onClick={() => startEdit(b)}
                      className="text-xs text-gray-400 hover:text-fuchsia-500 flex-shrink-0">✎</button>
                  </div>
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
  const BEAT_DURATION = 3500; // ms per beat

  const STYLES = {
    corporate:    { bg: "#0d1117", accent: "#4f8ef7", sub: "#8ba3c7", title: "#ffffff", grad: "linear-gradient(135deg,#0d1117,#1a2332)" },
    hype:         { bg: "#000000", accent: "#ff6b6b", sub: "#ffd93d", title: "#ffffff", grad: "linear-gradient(135deg,#0a0010,#1a0020)" },
    storytelling: { bg: "#13100a", accent: "#f5c842", sub: "#c8a96e", title: "#fff8ee", grad: "linear-gradient(135deg,#13100a,#2a1f0f)" },
    social:       { bg: "#0f0a1e", accent: "#c77dff", sub: "#e0aaff", title: "#ffffff", grad: "linear-gradient(135deg,#0f0a1e,#1a0a3e)" },
  };
  const s = STYLES[style] || STYLES.corporate;
  const total = beats.length * BEAT_DURATION;

  const keyframes = beats.map((b, i) => {
    const start  = (i * BEAT_DURATION) / total * 100;
    const fadeIn = start + (300 / total * 100);
    const hold   = start + (BEAT_DURATION * 0.8 / total * 100);
    const end    = start + (BEAT_DURATION / total * 100);
    return `
      @keyframes beat${i} {
        0%,${start.toFixed(1)}%                          { opacity:0; transform:translateY(18px); }
        ${fadeIn.toFixed(1)}%,${hold.toFixed(1)}%        { opacity:1; transform:translateY(0); }
        ${end.toFixed(1)}%,100%                          { opacity:0; transform:translateY(-10px); }
      }`;
  }).join("\n");

  const scenes = beats.map((b, i) => `
    <div class="scene" style="animation:beat${i} ${total}ms ease forwards infinite;">
      <div class="time">${b.time}</div>
      <div class="label">${b.label}</div>
      <div class="desc">${b.desc}</div>
      <div class="bar"></div>
    </div>`).join("\n");

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{
    width:100%;height:100%;
    background:${s.grad};
    font-family:'Noto Sans KR',sans-serif;
    overflow:hidden;
    display:flex;align-items:center;justify-content:center;
  }
  .wrap{position:relative;width:100%;height:100%;}
  /* 배경 그리드 */
  .grid{
    position:absolute;inset:0;
    background-image:linear-gradient(${s.accent}18 1px,transparent 1px),
                     linear-gradient(90deg,${s.accent}18 1px,transparent 1px);
    background-size:40px 40px;
  }
  .scene{
    position:absolute;inset:0;
    display:flex;flex-direction:column;align-items:center;justify-content:center;
    padding:24px 28px;
    text-align:center;
    opacity:0;
  }
  .time{
    font-size:11px;letter-spacing:3px;text-transform:uppercase;
    color:${s.accent};opacity:0.8;margin-bottom:12px;
    font-weight:700;
  }
  .label{
    font-size:22px;font-weight:900;color:${s.title};
    line-height:1.2;margin-bottom:10px;
    text-shadow:0 0 30px ${s.accent}66;
  }
  .desc{
    font-size:11px;color:${s.sub};line-height:1.6;
    max-width:280px;
  }
  .bar{
    width:48px;height:3px;border-radius:2px;
    background:${s.accent};margin-top:16px;
    box-shadow:0 0 12px ${s.accent};
  }
  /* 코너 데코 */
  .corner{position:absolute;width:16px;height:16px;border-color:${s.accent};border-style:solid;opacity:0.5;}
  .tl{top:12px;left:12px;border-width:2px 0 0 2px;}
  .tr{top:12px;right:12px;border-width:2px 2px 0 0;}
  .bl{bottom:12px;left:12px;border-width:0 0 2px 2px;}
  .br{bottom:12px;right:12px;border-width:0 2px 2px 0;}
  ${keyframes}
</style>
</head>
<body>
<div class="wrap">
  <div class="grid"></div>
  <div class="corner tl"></div>
  <div class="corner tr"></div>
  <div class="corner bl"></div>
  <div class="corner br"></div>
  ${scenes}
</div>
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════
// STAGE 6 — 미리보기 & 반복 수정
// ═══════════════════════════════════════════════════════════════════
function StagePreview({ project, planData, motionData, onNext }) {
  const [generating, setGenerating] = useState(true);
  const [progress,   setProgress]   = useState(0);
  const [previewReady, setPreviewReady] = useState(false);
  const [chatInput,  setChatInput]  = useState("");
  const [chatMsgs,   setChatMsgs]   = useState([]);
  const [chatLoading,setChatLoading]= useState(false);
  const bottomRef = useRef();

  // planData가 없을 때 기본 beats 사용
  const beats = planData?.beats || [
    { time: "0:00–0:05", label: "오프닝", desc: "타이틀 화면" },
    { time: "0:05–0:15", label: "핵심 메시지", desc: "주요 내용 전달" },
    { time: "0:15–0:25", label: "마무리", desc: "아웃트로" },
  ];
  const style = motionData?.style || "corporate";
  const compositionHTML = buildCompositionHTML(beats, style);

  // 생성 진행 시뮬레이션
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setGenerating(false);
          setPreviewReady(true);
          return 100;
        }
        return Math.min(100, p + Math.random() * 8);
      });
    }, 200);
    return () => clearInterval(interval);
  }, [generating]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMsgs]);

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMsgs(prev => [...prev, { role: "user", text: msg }]);
    setChatLoading(true);
    await new Promise(r => setTimeout(r, 1400));
    setChatMsgs(prev => [...prev, {
      role: "assistant",
      text: `적용했습니다. 타이틀 색상·애니메이션을 수정하고 Hyperframes를 다시 빌드합니다. localhost:3002에서 변경사항을 확인하세요.`,
    }]);
    setChatLoading(false);
  };

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
              <p className="text-sm font-semibold text-gray-700">Hyperframes 컴포지션 생성 중...</p>
              <p className="text-xs text-gray-400">{Math.round(progress)}% 완료</p>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-fuchsia-500 to-pink-500 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }} />
          </div>
          <div className="text-xs text-gray-400 space-y-0.5">
            {progress > 10  && <p className="text-green-600">✓ GSAP 타임라인 생성</p>}
            {progress > 35  && <p className="text-green-600">✓ 컴포지션 HTML 빌드</p>}
            {progress > 60  && <p className="text-green-600">✓ 에셋 최적화</p>}
            {progress > 80  && <p className="text-green-600">✓ Studio 서버 시작</p>}
            {progress < 100 && <p className="text-gray-400">… 빌드 완료 대기 중</p>}
          </div>
        </div>
      ) : (
        <>
          {/* 인라인 컴포지션 미리보기 */}
          <div className="border border-fuchsia-200 rounded-2xl overflow-hidden shadow-md">
            <div className="flex items-center justify-between bg-gray-900 px-4 py-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-gray-400 text-xs font-mono">composition-preview · {beats.length} beats</span>
              <span className="text-xs text-fuchsia-400 font-medium">{style}</span>
            </div>
            <iframe
              srcDoc={compositionHTML}
              className="w-full"
              style={{ height: 320, border: "none", display: "block" }}
              title="컴포지션 미리보기"
              sandbox="allow-scripts"
            />
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
          <StageSetup onNext={data => { setProject(data); setStage(2); }} />
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
          <StageMotion onNext={data => { setMotionData(data); setStage(5); }} />
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
