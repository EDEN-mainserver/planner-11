// AI 영상편집 자동화 탭
// 영상 업로드 → Whisper 직접 전사 → 세그먼트 결과 표시
import { useState, useRef, useCallback } from "react";

// ── 파이프라인 단계 ────────────────────────────────────────────────
const PIPELINE_STEPS = [
  { label: "영상 업로드",    icon: "📤" },
  { label: "Whisper 전사",  icon: "🎙️" },
  { label: "세그먼트 분절", icon: "✂️" },
  { label: "소스 자동 배치", icon: "🎬" },
  { label: "캡컷 드래프트", icon: "✅" },
];

// ── 기능 카드 데이터 ──────────────────────────────────────────────
const FEATURES = [
  {
    num: "02", key: "capcut", label: "캡컷 드래프트 자동 생성",
    priority: "높음", priorityColor: "bg-red-100 text-red-600",
    gradient: "from-violet-500 to-indigo-600",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>,
    desc: "분석된 구간별로 강조 자막·시그니처 캐릭터·GIF 움짤을 자동 배치한 캡컷 드래프트를 3분 내에 생성합니다.",
    details: ["구간별 강조 자막 자동 배치", "시그니처 캐릭터 삽입", "Clippy GIF 움짤 검색·배치", "무음 구간 자동 제거"],
    tools: ["CapCut API", "Clippy"],
  },
  {
    num: "03", key: "tts", label: "TTS 내레이션 자동 생성",
    priority: "높음", priorityColor: "bg-red-100 text-red-600",
    gradient: "from-indigo-500 to-blue-600",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>,
    desc: "텍스트 스크립트를 입력하면 QN3 TTS가 사용자 목소리를 복제한 자연스러운 내레이션 음성을 30초 내에 생성합니다.",
    details: ["QN3 TTS 음성 복제", "텍스트 → 개인화 음성", "30초 내 생성", "별도 녹음 불필요"],
    tools: ["QN3 TTS"],
  },
  {
    num: "04", key: "hooking", label: "후킹 오프닝 자동 제작",
    priority: "중간", priorityColor: "bg-amber-100 text-amber-600",
    gradient: "from-orange-500 to-rose-500",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>,
    desc: "Kling AI 기반 비디오·RVC 음성·Remotion 모션 그래픽을 결합하여 시청자 이탈을 막는 3초 후킹 오프닝을 자동 완성합니다.",
    details: ["Kling AI 키워드 맞춤 비디오", "RVC 음성 클론 적용", "Remotion 모션 그래픽", "캡컷 타임라인 자동 삽입"],
    tools: ["Kling AI", "RVC", "Remotion"],
  },
  {
    num: "05", key: "chat", label: "대화형 드래프트 수정",
    priority: "중간", priorityColor: "bg-amber-100 text-amber-600",
    gradient: "from-teal-500 to-emerald-600",
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    desc: "생성된 드래프트를 Claude Code와 자연어 채팅으로 자막 톤·움짤 교체·구간 배치 등을 실시간으로 수정·정교화합니다.",
    details: ["자연어 수정 요청 해석", "자막 톤·폰트 변경", "움짤 교체·구간 재배치", "Claude Code 실시간 연동"],
    tools: ["Claude Code"],
  },
];

// ── 파일 크기 포맷 ────────────────────────────────────────────────
function fmtBytes(b) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / 1024 / 1024).toFixed(1)}MB`;
}
function fmtSec(s) {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}분 ${sec}초` : `${sec}초`;
}

// ── 영상 업로드 & 전사 컴포넌트 ───────────────────────────────────
function TranscribePanel() {
  const [videoFile,  setVideoFile]  = useState(null);
  const [step,       setStep]       = useState("idle");   // idle | extracting | transcribing | done | error
  const [progress,   setProgress]   = useState("");
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState("");
  const [expandSeg,  setExpandSeg]  = useState(false);
  const inputRef = useRef();

  const ACCEPTED = ".mp4,.mov,.avi,.mkv,.webm,.m4v,.mp3,.wav,.m4a";

  const handleFile = useCallback((file) => {
    if (!file) return;
    setVideoFile(file);
    setStep("idle");
    setResult(null);
    setError("");
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleRun = useCallback(async () => {
    if (!videoFile) return;
    setError("");
    setResult(null);

    // 25MB 초과 시 클라이언트에서 미리 차단
    if (videoFile.size > 25 * 1024 * 1024) {
      setError(`파일이 ${fmtBytes(videoFile.size)}입니다. Whisper 제한(25MB)을 초과합니다. 짧은 영상을 사용해주세요.`);
      setStep("error");
      return;
    }

    try {
      setStep("transcribing");
      setProgress(`파일 전송 중... (${fmtBytes(videoFile.size)})`);

      // 영상/오디오 파일을 그대로 Whisper API로 전송 (mp4·mov·mp3·wav 모두 지원)
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": videoFile.type || "video/mp4" },
        body: videoFile,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `서버 오류 (${res.status})`);
      }

      const data = await res.json();
      setResult(data);
      setStep("done");
      setProgress("");

    } catch (e) {
      console.error("[transcribe]", e);
      setError(e.message || String(e) || "알 수 없는 오류");
      setStep("error");
      setProgress("");
    }
  }, [videoFile]);

  const reset = () => {
    setVideoFile(null);
    setStep("idle");
    setResult(null);
    setError("");
    setProgress("");
  };

  return (
    <div className="space-y-4">

      {/* 드롭존 */}
      {!videoFile ? (
        <label
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-3 w-full border-2 border-dashed border-purple-200 rounded-xl bg-purple-50/40 py-10 cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all"
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={e => handleFile(e.target.files[0])}
          />
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">영상 또는 오디오 파일을 드래그하거나 클릭</p>
            <p className="text-xs text-gray-400 mt-1">mp4 · mov · avi · mkv · webm · mp3 · wav · m4a</p>
          </div>
        </label>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-white">
          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-600">
              <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.934a.5.5 0 0 0-.777-.416L16 11"/><rect x="2" y="6" width="14" height="12" rx="2"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{videoFile.name}</p>
            <p className="text-xs text-gray-400">{fmtBytes(videoFile.size)}</p>
          </div>
          {step === "idle" && (
            <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">변경</button>
          )}
        </div>
      )}

      {/* 실행 버튼 */}
      {videoFile && step === "idle" && (
        <button
          onClick={handleRun}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-semibold hover:opacity-90 transition-opacity shadow"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/>
          </svg>
          전사 시작
        </button>
      )}

      {/* 진행 상태 */}
      {step === "transcribing" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-50 border border-purple-200">
          <svg className="animate-spin flex-shrink-0 text-purple-500" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <div>
            <p className="text-xs font-semibold text-purple-700">Whisper 전사 중</p>
            <p className="text-xs text-purple-500 mt-0.5">{progress}</p>
          </div>
        </div>
      )}

      {/* 에러 */}
      {step === "error" && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-xs font-semibold text-red-600">오류 발생</p>
          <p className="text-xs text-red-500 mt-0.5">{error}</p>
          <button onClick={reset} className="text-xs text-red-400 underline mt-2">다시 시도</button>
        </div>
      )}

      {/* 결과 */}
      {step === "done" && result && (
        <div className="space-y-3">

          {/* 요약 */}
          <div className="grid grid-cols-3 gap-2">
            <div className="px-3 py-2.5 rounded-xl bg-purple-50 border border-purple-100 text-center">
              <p className="text-lg font-bold text-purple-700">{result.count}</p>
              <p className="text-[10px] text-purple-400 mt-0.5">세그먼트</p>
            </div>
            <div className="px-3 py-2.5 rounded-xl bg-violet-50 border border-violet-100 text-center">
              <p className="text-lg font-bold text-violet-700">{result.duration ? fmtSec(result.duration) : "-"}</p>
              <p className="text-[10px] text-violet-400 mt-0.5">영상 길이</p>
            </div>
            <div className="px-3 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-center">
              <p className="text-lg font-bold text-indigo-700">{result.text.length}</p>
              <p className="text-[10px] text-indigo-400 mt-0.5">글자 수</p>
            </div>
          </div>

          {/* 전체 텍스트 */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">전체 전사 텍스트</p>
            <p className="text-sm text-gray-700 leading-relaxed">{result.text}</p>
          </div>

          {/* 세그먼트 목록 */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <button
              onClick={() => setExpandSeg(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">세그먼트 타임라인 ({result.count}개)</p>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className={`text-gray-400 transition-transform ${expandSeg ? "rotate-180" : ""}`}>
                <path d="m6 9 6 6 6-6"/>
              </svg>
            </button>
            {expandSeg && (
              <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
                {result.segments.map((seg, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50">
                    <span className="text-[10px] font-mono text-gray-300 flex-shrink-0 mt-0.5 w-16">
                      {fmtSec(seg.start)}
                    </span>
                    <p className="text-xs text-gray-600 leading-relaxed flex-1">{seg.text}</p>
                    <span className="text-[10px] text-gray-300 flex-shrink-0 mt-0.5">
                      {(seg.end - seg.start).toFixed(1)}s
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 재시작 */}
          <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
            다른 영상 전사하기
          </button>
        </div>
      )}
    </div>
  );
}

// ── 기능 카드 (02~05, 준비중) ─────────────────────────────────────
function FeatureCard({ feat }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-xl border-2 overflow-hidden transition-all duration-200 ${open ? "border-purple-300 bg-purple-50/30" : "border-gray-200 bg-white"}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-gray-50/60 transition-colors"
      >
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${feat.gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
          {feat.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-gray-400 font-mono">{feat.num}</span>
            <p className="text-sm font-semibold text-gray-800">{feat.label}</p>
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold ${feat.priorityColor}`}>중요도 {feat.priority}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">시작전</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{feat.desc}</p>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          className={`text-gray-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-white/60">
          <p className="text-xs text-gray-600 leading-relaxed mt-3 mb-3">{feat.desc}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">세부 기능</p>
              <ul className="space-y-1.5">
                {feat.details.map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400 mt-0.5 flex-shrink-0">
                      <path d="m9 11 3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                    </svg>
                    <span className="text-xs text-gray-600">{d}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">사용 도구</p>
              <div className="flex flex-wrap gap-1.5">
                {feat.tools.map(t => (
                  <span key={t} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">{t}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 메인 탭 컴포넌트 ──────────────────────────────────────────────
export default function AutoEditTab({ nasState, onGoToNas, NasSaveFooter }) {
  return (
    <div>
      {/* 헤더 */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-md flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
            </svg>
          </div>
          <div>
            <h4 className="text-base font-bold text-gray-800">AI 영상편집 자동화</h4>
            <p className="text-xs text-gray-400 mt-0.5">영상 하나로 자막·움짤·드래프트까지 — 편집 시간 10분의 1</p>
          </div>
        </div>
      </div>

      {/* 파이프라인 흐름 */}
      <div className="px-6 py-4 bg-gray-50/60 border-b border-gray-100">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">자동화 파이프라인</p>
        <div className="flex items-center gap-1 flex-wrap">
          {PIPELINE_STEPS.map((step, i) => (
            <div key={i} className="flex items-center gap-1">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 shadow-sm">
                <span className="text-sm">{step.icon}</span>
                <span className="text-[11px] font-medium text-gray-700 whitespace-nowrap">{step.label}</span>
              </div>
              {i < PIPELINE_STEPS.length - 1 && (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 flex-shrink-0">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="p-6 space-y-6">

        {/* 01 — 영상 업로드 및 자동 전사 (실제 동작) */}
        <div className="rounded-xl border-2 border-purple-300 bg-white overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-purple-100 bg-purple-50/40">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-bold text-gray-400 font-mono">01</span>
                <p className="text-sm font-semibold text-gray-800">영상 업로드 및 자동 전사</p>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-600">중요도 높음</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500 text-white">구현됨</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">영상 파일 → Whisper API 직접 전사 (최대 25MB)</p>
            </div>
          </div>
          <div className="p-4">
            <TranscribePanel />
          </div>
        </div>

        {/* 02~05 — 준비중 기능 카드 */}
        <div className="space-y-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">다음 기능 (준비중)</p>
          {FEATURES.map(feat => <FeatureCard key={feat.key} feat={feat} />)}
        </div>
      </div>

      <NasSaveFooter nasState={nasState} subfolder="자동편집" onGoToNas={onGoToNas} />
    </div>
  );
}
