/**
 * AI 영상편집 자동화 탭
 * 영상 업로드 → 무음 감지 → Whisper 전사 → 세그먼트 편집 → 자막 스타일 → 캡컷 초안 다운로드
 *
 * 백엔드: Render 배포 FastAPI 서버
 * 환경변수: VITE_AUTOEDIT_API (예: https://autoedit-lab-api.onrender.com)
 *           미설정 시 http://localhost:8000 (로컬 테스트)
 */
import { useState, useRef, useCallback, useEffect } from "react";

// ── 백엔드 URL 설정 ──────────────────────────────────────────────
const API = (import.meta.env.VITE_AUTOEDIT_API || "http://localhost:8000") + "/api";

const VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"];
const RATIOS = {
  "16:9": { width: 1920, height: 1080, label: "가로 (16:9)", desc: "1920×1080", icon: "🖥️" },
  "9:16": { width: 1080, height: 1920, label: "세로 (9:16)", desc: "1080×1920", icon: "📱" },
};

let _uid = 0;
const uid = () => ++_uid;

function fmtBytes(b) {
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)}KB`;
  return `${(b / 1024 / 1024).toFixed(1)}MB`;
}
function fmtSec(s) {
  if (!s) return "-";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return m > 0 ? `${m}분 ${sec}초` : `${sec}초`;
}

// ── 스텝 배지 ────────────────────────────────────────────────────
function StepBadge({ n, label, active, done }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
      done   ? "bg-green-100 text-green-700" :
      active ? "bg-purple-100 text-purple-700" :
               "bg-gray-100 text-gray-400"
    }`}>
      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
        done   ? "bg-green-500 text-white" :
        active ? "bg-purple-500 text-white" :
                 "bg-gray-300 text-white"
      }`}>{done ? "✓" : n}</span>
      {label}
    </div>
  );
}

// ── 타임스탬프 입력 ───────────────────────────────────────────────
function SegTimeInput({ value, onChange, color = "amber", label }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  const colorMap = {
    amber:  "text-amber-700 bg-amber-50 border-amber-200 focus:border-amber-500",
    orange: "text-orange-600 bg-orange-50 border-orange-200 focus:border-orange-500",
  };
  return (
    <div>
      <span className={`text-[8px] font-semibold block text-center leading-none mb-0.5 text-${color}-400`}>{label}</span>
      <input
        type="text"
        inputMode="decimal"
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={() => {
          const v = parseFloat(local);
          if (!isNaN(v) && v >= 0) onChange(Math.round(v * 100) / 100);
          else setLocal(String(value));
        }}
        onKeyDown={e => { if (e.key === "Enter") e.target.blur(); }}
        className={`w-full text-[10px] font-mono border rounded px-1 py-0.5 text-center focus:outline-none ${colorMap[color]}`}
      />
    </div>
  );
}

// ── 세그먼트 카드 ─────────────────────────────────────────────────
function SegCard({ seg, idx, isLast, onTextCommit, onStartChange, onEndChange, onSplit, onDelete, onMerge }) {
  const [localText, setLocalText] = useState(seg.text);
  const taRef = useRef();
  useEffect(() => {
    if (seg.text !== localText) setLocalText(seg.text);
  }, [seg._id, seg.text]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div>
      <div className="flex gap-2 items-start rounded-lg border border-amber-100 bg-white px-2 py-1.5">
        <div className="flex-shrink-0 w-[60px] pt-0.5 space-y-0.5">
          <SegTimeInput label="시작(s)" color="amber" value={seg.start} onChange={onStartChange} />
          <div className="text-[8px] text-gray-300 text-center">↓</div>
          <SegTimeInput label="끝(s)"   color="orange" value={seg.end}   onChange={onEndChange}   />
        </div>
        <textarea
          ref={taRef}
          value={localText}
          onChange={e => setLocalText(e.target.value)}
          onBlur={e => onTextCommit(e.target.value)}
          rows={3}
          className="flex-1 text-xs px-2 py-1 rounded border border-gray-200 resize-none focus:outline-none focus:border-amber-400 bg-white leading-relaxed"
        />
        <div className="flex flex-col gap-1 flex-shrink-0 pt-0.5">
          <button onClick={() => onSplit(taRef.current?.selectionStart)}
            className="text-[10px] px-1.5 py-0.5 rounded border border-blue-200 text-blue-500 hover:bg-blue-50 font-semibold leading-tight"
            title="커서 위치에서 분할">✂️</button>
          <button onClick={onDelete} className="text-gray-300 hover:text-red-400 text-sm leading-tight" title="삭제">🗑</button>
        </div>
      </div>
      {!isLast && (
        <div className="flex justify-center my-0.5">
          <button onClick={onMerge}
            className="flex items-center gap-1 px-3 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-600 text-[10px] font-semibold hover:bg-amber-100 transition-colors">
            + 합치기
          </button>
        </div>
      )}
    </div>
  );
}

// ── STEP 1: 영상 업로드 & 전사 ───────────────────────────────────
function TranscribeStep({ onDone }) {
  const [file,    setFile]     = useState(null);
  const [phase,   setPhase]    = useState("setup");
  const [progress,setProgress] = useState("");
  const [error,   setError]    = useState("");
  const inputRef = useRef();

  const [filePath,      setFilePath]      = useState(null);
  const [silenceResult, setSilenceResult] = useState(null);
  const [result,        setResult]        = useState(null);

  const [silenceApply,  setSilenceApply]  = useState(true);
  const [thresholdDb,   setThresholdDb]   = useState(-35);
  const [minSilenceSec, setMinSilenceSec] = useState(0.3);
  const [paddingSec,    setPaddingSec]    = useState(0.1);

  const [editSegs,     setEditSegs]     = useState(null);
  const [paraOpen,     setParaOpen]     = useState(false);
  const [wordsPerLine, setWordsPerLine] = useState(3);

  const [styleOpen, setStyleOpen] = useState(false);
  const [subStyle,  setSubStyle]  = useState({
    font_size: 5.0, color: [1,1,1], bold: false, italic: false, underline: false,
    alpha: 1.0, align: 1, letter_spacing: 0, line_spacing: 0,
    transform_x: 0.0, transform_y: -0.8, font: null,
    border_enabled: false, border_color: [0,0,0], border_width: 40.0,
  });

  const initEditSegs = (segs) => {
    setEditSegs(segs.map((s, i) => ({ ...s, _id: i })));
    setParaOpen(true);
  };
  const mergeSegs = (idx) => {
    setEditSegs(prev => {
      const next = [...prev];
      const merged = { _id: next[idx]._id, start: next[idx].start, end: next[idx+1].end,
        text: next[idx].text.trimEnd() + " " + next[idx+1].text.trimStart() };
      next.splice(idx, 2, merged);
      return next;
    });
  };
  const editSegText = (idx, text) => setEditSegs(prev => prev.map((s,i) => i===idx ? {...s,text} : s));
  const deleteSeg   = (idx)       => setEditSegs(prev => prev.filter((_,i) => i!==idx));
  const splitSeg    = (idx, cursorPos) => {
    setEditSegs(prev => {
      const seg = prev[idx];
      const cut = (() => { const p = cursorPos ?? Math.floor(seg.text.length/2); return (p>0&&p<seg.text.length)?p:Math.floor(seg.text.length/2); })();
      const tA = seg.text.slice(0, cut).trimEnd(), tB = seg.text.slice(cut).trimStart();
      if (!tA || !tB) return prev;
      const mid = seg.start + (seg.end - seg.start) * (cut / seg.text.length);
      const next = [...prev];
      next.splice(idx, 1,
        { _id: seg._id, start: seg.start, end: parseFloat(mid.toFixed(2)), text: tA },
        { _id: uid(),   start: parseFloat(mid.toFixed(2)), end: seg.end,   text: tB }
      );
      return next;
    });
  };

  const reset = () => {
    setFile(null); setPhase("setup"); setError(""); setProgress("");
    setFilePath(null); setSilenceResult(null); setResult(null);
    setEditSegs(null); setParaOpen(false);
  };

  const handleFile = (f) => { if (!f) return; setFile(f); setPhase("setup"); setError(""); };

  const handleUpload = async () => {
    setPhase("uploading"); setProgress(`업로드 중... (${fmtBytes(file.size)})`); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch(`${API}/upload/video`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `오류 (${res.status})`);
      setFilePath(data.file_path);
      if (silenceApply) await runDetect(data.file_path);
      else              await runTranscribe(data.file_path, null);
    } catch(e) { setError(e.message); setPhase("error"); setProgress(""); }
  };

  const runDetect = async (fp) => {
    setPhase("detecting"); setProgress("무음 구간 감지 중...");
    try {
      const res  = await fetch(`${API}/silence/detect`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: fp ?? filePath, threshold_db: thresholdDb,
          min_silence_sec: minSilenceSec, padding_sec: paddingSec }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `오류 (${res.status})`);
      setSilenceResult(data); setPhase("silence_ready"); setProgress("");
    } catch(e) { setError(e.message); setPhase("error"); setProgress(""); }
  };

  const runTranscribe = async (fp, sr) => {
    const path    = fp ?? filePath;
    const silence = sr !== undefined ? sr : silenceResult;
    setPhase("transcribing");
    setProgress(silence ? "Whisper 전사 중... (무음 제거 오디오 기준)" : "Whisper 전사 중...");
    try {
      const safeJson = async (res, name) => {
        if (res.status === 404) throw new Error(`${name} 없음 — 서버 확인 필요`);
        const ct = res.headers.get("content-type") || "";
        if (!ct.includes("application/json")) {
          const txt = await res.text();
          throw new Error(`서버 오류 (${res.status}): ${txt.slice(0,200)}`);
        }
        const d = await res.json();
        if (!res.ok) throw new Error(d.detail || `오류 (${res.status})`);
        return d;
      };

      let data;
      if (silence && silenceApply) {
        const res = await fetch(`${API}/transcribe/aligned`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: path, keep_segments: silence.keep_segments }),
        });
        data = await safeJson(res, "/api/transcribe/aligned");
        data.file_path = path;
      } else {
        const res = await fetch(`${API}/transcribe/from-path`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ file_path: path }),
        });
        data = await safeJson(res, "/api/transcribe/from-path");
      }
      setResult(data); setPhase("done"); setProgress("");
      if (data.segments?.length) initEditSegs(data.segments);
    } catch(e) { setError(e.message); setPhase("error"); setProgress(""); }
  };

  const isLoading = ["uploading","detecting","transcribing"].includes(phase);

  return (
    <div className="space-y-3">
      {/* 파일 선택 */}
      {!file ? (
        <label
          onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
          onDragOver={e => e.preventDefault()}
          className="flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed border-purple-200 rounded-xl bg-purple-50/40 py-8 cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all"
        >
          <input ref={inputRef} type="file"
            accept=".mp4,.mov,.avi,.mkv,.webm,.m4v,.mp3,.wav,.m4a"
            className="hidden" onChange={e => handleFile(e.target.files[0])} />
          <span className="text-3xl">🎬</span>
          <p className="text-sm font-semibold text-gray-700">영상 / 오디오 드래그 또는 클릭</p>
          <p className="text-xs text-gray-400">mp4 · mov · avi · mkv · webm · mp3 · wav · m4a</p>
        </label>
      ) : (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50">
          <span className="text-xl">🎬</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800 truncate">{file.name}</p>
            <p className="text-xs text-gray-400">{fmtBytes(file.size)}</p>
          </div>
          {phase === "setup" && <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">변경</button>}
        </div>
      )}

      {/* 설정 (파일 선택 후, 시작 전) */}
      {file && phase === "setup" && (
        <div className="space-y-3">
          {/* 무음 제거 토글 */}
          <div className="rounded-xl border-2 border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
              <div className="flex items-center gap-2">
                <span>🔇</span>
                <span className="text-sm font-semibold text-gray-700">무음구간 자동 제거</span>
                <span className="text-[10px] text-gray-400">(먼저 감지 후 전사)</span>
              </div>
              <button onClick={() => setSilenceApply(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${silenceApply ? "bg-purple-500" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${silenceApply ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
            {silenceApply && (
              <div className="p-3 space-y-3 border-t border-gray-100">
                {[
                  { label: "감도 (소음 임계값)", val: thresholdDb,   set: setThresholdDb,   min:-60, max:-20, step:1,    fmt: v=>`${v} dB`,         desc:["-60dB (예민)","-20dB (둔감)"] },
                  { label: "최소 무음 길이",      val: minSilenceSec, set: setMinSilenceSec, min:0.1, max:2.0, step:0.05, fmt: v=>`${v.toFixed(2)}초`, desc:["0.1초 (세밀)","2.0초 (넉넉)"] },
                  { label: "컷 앞뒤 여백",        val: paddingSec,    set: setPaddingSec,    min:0,   max:0.5, step:0.02, fmt: v=>`${v.toFixed(2)}초`, desc:["0초 (타이트)","0.5초 (여유)"] },
                ].map(({ label, val, set, min, max, step, fmt, desc }) => (
                  <div key={label}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] font-semibold text-gray-600">{label}</span>
                      <span className="text-[10px] font-mono text-purple-600 font-bold">{fmt(val)}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step} value={val}
                      onChange={e => set(Number(e.target.value))}
                      className="w-full accent-purple-500 h-1.5" />
                    <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                      <span>{desc[0]}</span><span>{desc[1]}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 자막 단어 수 */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
            <span className="text-sm">💬</span>
            <span className="text-xs font-semibold text-gray-600 flex-1">자막 단어 수</span>
            <div className="flex gap-1">
              {[0,1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setWordsPerLine(n)}
                  className={`${n===0?"px-2":"w-7"} h-7 rounded-lg text-[11px] font-bold border transition-colors ${
                    wordsPerLine===n ? "bg-green-500 border-green-500 text-white" : "bg-white border-gray-200 text-gray-500 hover:border-green-300"
                  }`}>{n===0?"원본":n}</button>
              ))}
            </div>
          </div>

          <button onClick={handleUpload}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-bold hover:opacity-90 shadow transition-opacity">
            {silenceApply ? "🔇 무음 감지 후 전사 →" : "🎙️ 전사 시작 →"}
          </button>
        </div>
      )}

      {/* 로딩 */}
      {isLoading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-50 border border-purple-200">
          <svg className="animate-spin text-purple-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <p className="text-xs text-purple-700">{progress}</p>
        </div>
      )}

      {/* 무음 감지 완료 */}
      {phase === "silence_ready" && silenceResult && (
        <div className="space-y-3">
          <div className="rounded-xl border-2 border-green-200 bg-green-50 p-3 space-y-2">
            <p className="text-xs font-semibold text-green-700">✅ 무음 구간 감지 완료</p>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label:"제거 구간", value:`${silenceResult.cut_count}개`,     color:"red" },
                { label:"제거 시간", value:`${silenceResult.cut_duration}초`,  color:"orange" },
                { label:"남은 시간", value:`${silenceResult.kept_duration}초`, color:"green" },
              ].map(({ label, value, color }) => (
                <div key={label} className={`text-center px-2 py-1.5 rounded-lg bg-${color}-50 border border-${color}-100`}>
                  <p className={`text-sm font-bold text-${color}-600`}>{value}</p>
                  <p className={`text-[9px] text-${color}-400`}>{label}</p>
                </div>
              ))}
            </div>
            <div className="relative h-4 bg-gray-200 rounded-full overflow-hidden">
              {silenceResult.keep_segments.map((seg, i) => (
                <div key={i}
                  style={{ left:`${(seg.start/silenceResult.total_duration)*100}%`, width:`${(seg.duration/silenceResult.total_duration)*100}%` }}
                  className="absolute top-0 h-full bg-green-400 opacity-80"
                  title={`${seg.start}s ~ ${seg.end}s`} />
              ))}
            </div>
            <p className="text-[9px] text-gray-400 text-center">초록: 유지 / 회색: 제거</p>
          </div>

          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
              <p className="text-[10px] font-semibold text-gray-500">파라미터 조정 후 재감지</p>
            </div>
            <div className="p-3 space-y-3">
              {[
                { label:"감도",     val:thresholdDb,   set:setThresholdDb,   min:-60, max:-20, step:1,    fmt:v=>`${v}dB` },
                { label:"최소 무음", val:minSilenceSec, set:setMinSilenceSec, min:0.1, max:2.0, step:0.05, fmt:v=>`${v.toFixed(2)}s` },
                { label:"여백",     val:paddingSec,    set:setPaddingSec,    min:0,   max:0.5, step:0.02, fmt:v=>`${v.toFixed(2)}s` },
              ].map(({ label, val, set, min, max, step, fmt }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-500 w-14 flex-shrink-0">{label}</span>
                  <input type="range" min={min} max={max} step={step} value={val}
                    onChange={e => set(Number(e.target.value))}
                    className="flex-1 accent-purple-500 h-1.5" />
                  <span className="text-[10px] font-mono text-purple-600 w-12 text-right">{fmt(val)}</span>
                </div>
              ))}
              <button onClick={() => runDetect(filePath)}
                className="w-full py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100">
                🔄 재감지
              </button>
            </div>
          </div>

          <button onClick={() => runTranscribe(filePath, silenceResult)}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-bold hover:opacity-90 shadow">
            🎙️ 전사 시작 (무음 제거된 오디오 기준) →
          </button>
        </div>
      )}

      {/* 에러 */}
      {phase === "error" && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200">
          <p className="text-xs font-semibold text-red-600 mb-1">오류</p>
          <p className="text-xs text-red-500 font-mono whitespace-pre-wrap">{error}</p>
          <button onClick={reset} className="text-xs text-red-400 underline mt-2">다시 시도</button>
        </div>
      )}

      {/* 전사 완료 */}
      {phase === "done" && result && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: silenceResult ? "압축 후 길이" : "영상 길이", value: fmtSec(result.duration), color: "purple" },
              { label: "세그먼트", value: editSegs ? editSegs.length : result.count, color: "violet" },
              { label: "글자 수",  value: editSegs ? editSegs.reduce((a,s)=>a+s.text.length,0) : result.text?.length, color: "indigo" },
            ].map(({ label, value, color }) => (
              <div key={label} className={`px-3 py-2.5 rounded-xl bg-${color}-50 border border-${color}-100 text-center`}>
                <p className={`text-base font-bold text-${color}-700`}>{value}</p>
                <p className={`text-[10px] text-${color}-400 mt-0.5`}>{label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 max-h-24 overflow-y-auto">
            <p className="text-[10px] font-semibold text-gray-400 mb-1">
              전사 텍스트 {silenceResult && <span className="text-green-500">(무음 제거 후 기준)</span>}
            </p>
            <p className="text-xs text-gray-700 leading-relaxed">{result.text}</p>
          </div>

          {/* 단락 편집 */}
          {editSegs && (
            <div className="rounded-xl border-2 border-amber-200 overflow-hidden">
              <button onClick={() => setParaOpen(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-amber-50 border-b border-amber-200">
                <div className="flex items-center gap-2">
                  <span>📝</span>
                  <span className="text-sm font-semibold text-amber-800">단락 편집</span>
                  <span className="text-[10px] text-amber-500 bg-amber-100 px-2 py-0.5 rounded-full">{editSegs.length}개</span>
                </div>
                <span className="text-amber-400 text-xs">{paraOpen ? "▲" : "▼"}</span>
              </button>
              {paraOpen && (
                <div className="p-3 space-y-1.5 max-h-72 overflow-y-auto">
                  <p className="text-[10px] text-gray-400 mb-2">✂️ 나누기: 텍스트에 커서 놓고 클릭 · + 합치기 · 🗑 삭제</p>
                  {editSegs.map((seg, idx) => (
                    <SegCard key={seg._id} seg={seg} idx={idx} isLast={idx===editSegs.length-1}
                      onTextCommit={text => editSegText(idx, text)}
                      onStartChange={v => setEditSegs(prev => prev.map((s,i) => i===idx?{...s,start:v}:s))}
                      onEndChange={v   => setEditSegs(prev => prev.map((s,i) => i===idx?{...s,end:v}:s))}
                      onSplit={cursorPos => splitSeg(idx, cursorPos)}
                      onDelete={() => deleteSeg(idx)}
                      onMerge={() => mergeSegs(idx)} />
                  ))}
                  <button onClick={() => initEditSegs(result.segments)} className="text-[10px] text-gray-400 underline mt-1">원본으로 초기화</button>
                </div>
              )}
            </div>
          )}

          {/* 자막 단어 수 */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
            <span className="text-sm">💬</span>
            <span className="text-xs font-semibold text-gray-600 flex-1">자막 단어 수</span>
            <div className="flex gap-1">
              {[0,1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setWordsPerLine(n)}
                  className={`${n===0?"px-2":"w-7"} h-7 rounded-lg text-[11px] font-bold border transition-colors ${
                    wordsPerLine===n ? "bg-green-500 border-green-500 text-white" : "bg-white border-gray-200 text-gray-500 hover:border-green-300"
                  }`}>{n===0?"원본":n}</button>
              ))}
            </div>
          </div>

          {/* 자막 스타일 */}
          <div className="rounded-xl border-2 border-indigo-200 overflow-hidden">
            <button onClick={() => setStyleOpen(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 border-b border-indigo-100">
              <div className="flex items-center gap-2">
                <span>🎨</span>
                <span className="text-sm font-semibold text-indigo-800">자막 스타일 / 위치</span>
              </div>
              <span className="text-indigo-400 text-xs">{styleOpen ? "▲" : "▼"}</span>
            </button>
            {styleOpen && (
              <div className="p-3 space-y-3 bg-white">
                {/* 위치 프리셋 */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 mb-1.5">위치</p>
                  <div className="flex gap-1 mb-2">
                    {[["위",0.75],["중앙",0.0],["아래",-0.8]].map(([label, y]) => (
                      <button key={label} onClick={() => setSubStyle(s => ({ ...s, transform_y: y }))}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                          Math.abs(subStyle.transform_y - y) < 0.05
                            ? "bg-indigo-500 border-indigo-500 text-white"
                            : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300"
                        }`}>{label}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-400 w-6 text-right">위</span>
                    <input type="range" min="-1" max="1" step="0.05"
                      value={subStyle.transform_y}
                      onChange={e => setSubStyle(s => ({ ...s, transform_y: parseFloat(e.target.value) }))}
                      className="flex-1 accent-indigo-500 h-1.5" style={{ direction: "rtl" }} />
                    <span className="text-[9px] text-gray-400 w-6">아래</span>
                    <span className="text-[10px] font-mono text-indigo-600 w-10 text-right">{subStyle.transform_y.toFixed(2)}</span>
                  </div>
                </div>

                {/* 정렬 */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 mb-1.5">정렬</p>
                  <div className="flex gap-1">
                    {[["◀ 왼쪽",0],["가운데",1],["오른쪽 ▶",2]].map(([label, v]) => (
                      <button key={v} onClick={() => setSubStyle(s => ({ ...s, align: v }))}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                          subStyle.align === v ? "bg-indigo-500 border-indigo-500 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300"
                        }`}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* 폰트 크기 + 스타일 */}
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <p className="text-[10px] font-semibold text-gray-500 mb-1">폰트 크기</p>
                    <div className="flex items-center gap-2">
                      <input type="range" min="2" max="20" step="0.5" value={subStyle.font_size}
                        onChange={e => setSubStyle(s => ({ ...s, font_size: parseFloat(e.target.value) }))}
                        className="flex-1 accent-indigo-500 h-1.5" />
                      <span className="text-[10px] font-mono text-indigo-600 w-8 text-right">{subStyle.font_size}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {[["B","bold","font-bold"],["I","italic","italic"],["U","underline","underline"]].map(([label, key, cls]) => (
                      <button key={key} onClick={() => setSubStyle(s => ({ ...s, [key]: !s[key] }))}
                        className={`w-8 h-8 rounded-lg text-xs border transition-colors ${cls} ${
                          subStyle[key] ? "bg-indigo-500 border-indigo-500 text-white" : "bg-white border-gray-200 text-gray-600 hover:border-indigo-300"
                        }`}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* 색상 */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 mb-1.5">색상</p>
                  <div className="flex gap-2">
                    {[
                      { label:"흰색", color:[1,1,1],       bg:"bg-white border-gray-300",         text:"text-gray-700" },
                      { label:"노랑", color:[1,1,0],        bg:"bg-yellow-300 border-yellow-400",  text:"text-yellow-900" },
                      { label:"검정", color:[0,0,0],        bg:"bg-gray-900 border-gray-700",      text:"text-white" },
                      { label:"빨강", color:[1,0.2,0.2],    bg:"bg-red-400 border-red-500",        text:"text-white" },
                      { label:"하늘", color:[0.4,0.8,1],    bg:"bg-sky-300 border-sky-400",        text:"text-sky-900" },
                    ].map(({ label, color, bg, text }) => (
                      <button key={label} onClick={() => setSubStyle(s => ({ ...s, color }))}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border-2 transition-all ${bg} ${text} ${
                          JSON.stringify(subStyle.color) === JSON.stringify(color) ? "ring-2 ring-indigo-400 ring-offset-1" : ""
                        }`}>{label}</button>
                    ))}
                  </div>
                </div>

                {/* 투명도 + 자간 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 mb-1">투명도</p>
                    <div className="flex items-center gap-2">
                      <input type="range" min="0" max="1" step="0.05" value={subStyle.alpha}
                        onChange={e => setSubStyle(s => ({ ...s, alpha: parseFloat(e.target.value) }))}
                        className="flex-1 accent-indigo-500 h-1.5" />
                      <span className="text-[10px] font-mono text-indigo-600 w-8">{Math.round(subStyle.alpha*100)}%</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 mb-1">자간</p>
                    <div className="flex items-center gap-2">
                      <input type="range" min="-10" max="20" step="1" value={subStyle.letter_spacing}
                        onChange={e => setSubStyle(s => ({ ...s, letter_spacing: parseInt(e.target.value) }))}
                        className="flex-1 accent-indigo-500 h-1.5" />
                      <span className="text-[10px] font-mono text-indigo-600 w-6">{subStyle.letter_spacing}</span>
                    </div>
                  </div>
                </div>

                {/* 글꼴 */}
                <div>
                  <p className="text-[10px] font-semibold text-gray-500 mb-1.5">글꼴 <span className="text-gray-300 font-normal">(한국어 지원)</span></p>
                  <select value={subStyle.font ?? ""}
                    onChange={e => setSubStyle(s => ({ ...s, font: e.target.value || null }))}
                    className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-indigo-400 bg-white">
                    <option value="">시스템 기본</option>
                    <optgroup label="── 고딕 계열 ──">
                      <option value="中黑体">중간 고딕</option>
                      <option value="特黑体">굵은 고딕</option>
                      <option value="高端黑">고급 고딕 (얇은)</option>
                      <option value="细体">가는체</option>
                      <option value="圆体">둥근 고딕</option>
                    </optgroup>
                    <optgroup label="── 명조 / 세리프 ──">
                      <option value="思源中宋">소스한 명조 — 중간 ★한국어</option>
                      <option value="思源粗宋">소스한 명조 — 굵게 ★한국어</option>
                      <option value="宋体">명조체</option>
                    </optgroup>
                    <optgroup label="── 개성 / 디자인 ──">
                      <option value="综艺体">종합예술체</option>
                      <option value="黄金时代">황금시대체</option>
                      <option value="新青年体">신청년체</option>
                    </optgroup>
                    <optgroup label="── 귀여운 / 손글씨 ──">
                      <option value="默陌手写">손글씨체</option>
                      <option value="CC_可爱">귀여운체</option>
                      <option value="像素体">픽셀체</option>
                    </optgroup>
                  </select>
                  <p className="text-[9px] text-gray-300 mt-1">★ 표시는 한국어 확실 지원</p>
                </div>

                {/* 획(테두리) */}
                <div className="rounded-lg border border-gray-200 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
                    <p className="text-[10px] font-semibold text-gray-600">획 (테두리)</p>
                    <button onClick={() => setSubStyle(s => ({ ...s, border_enabled: !s.border_enabled }))}
                      style={{ height:"18px", width:"36px" }}
                      className={`relative rounded-full transition-colors ${subStyle.border_enabled ? "bg-indigo-500" : "bg-gray-300"}`}>
                      <span className={`absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow transition-transform ${subStyle.border_enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                  {subStyle.border_enabled && (
                    <div className="p-3 space-y-2 border-t border-gray-100">
                      <div>
                        <p className="text-[9px] text-gray-400 mb-1">획 색상</p>
                        <div className="flex gap-1.5">
                          {[
                            { label:"검정", color:[0,0,0],   bg:"bg-gray-900 border-gray-700 text-white" },
                            { label:"흰색", color:[1,1,1],   bg:"bg-white border-gray-300 text-gray-700" },
                            { label:"빨강", color:[0.8,0,0], bg:"bg-red-600 border-red-700 text-white" },
                            { label:"파랑", color:[0,0.2,0.8],bg:"bg-blue-700 border-blue-800 text-white" },
                            { label:"노랑", color:[1,0.8,0], bg:"bg-yellow-400 border-yellow-500 text-yellow-900" },
                          ].map(({ label, color, bg }) => (
                            <button key={label} onClick={() => setSubStyle(s => ({ ...s, border_color: color }))}
                              className={`flex-1 py-1 rounded text-[9px] font-bold border-2 transition-all ${bg} ${
                                JSON.stringify(subStyle.border_color) === JSON.stringify(color) ? "ring-2 ring-indigo-400 ring-offset-1" : ""
                              }`}>{label}</button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-[9px] text-gray-400">획 두께</p>
                          <span className="text-[10px] font-mono text-indigo-600">{subStyle.border_width.toFixed(0)}</span>
                        </div>
                        <input type="range" min="5" max="100" step="5" value={subStyle.border_width}
                          onChange={e => setSubStyle(s => ({ ...s, border_width: parseFloat(e.target.value) }))}
                          className="w-full accent-indigo-500 h-1.5" />
                        <div className="flex justify-between text-[9px] text-gray-300 mt-0.5"><span>얇게</span><span>두껍게</span></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 자막으로 변환 */}
          <button onClick={() => {
            const segs = editSegs ?? result.segments;
            onDone(
              { ...result, segments: segs, count: segs.length },
              silenceResult, wordsPerLine, !!silenceResult, subStyle,
            );
          }}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-bold hover:opacity-90 shadow">
            {silenceResult ? "✅ 무음 제거 + 싱크 정렬 자막 생성 →" : "✅ 자막 생성 →"}
          </button>

          <button onClick={reset} className="text-xs text-gray-400 underline hover:text-gray-600">다른 영상 처리</button>
        </div>
      )}
    </div>
  );
}

// ── STEP 2: 타임라인 편집 ────────────────────────────────────────
function TimelineStep({ items, setItems, transcribeResult }) {
  const addItem = (type) => {
    const defaults = {
      image:     { type:"image",     start:0, duration:5,   file_path:"", _filename:"" },
      subtitle:  { type:"subtitle",  start:0, duration:3,   text:"", font_size:5.0, color:[1,1,1] },
      narration: { type:"narration", start:0, voice:"nova", speed:1.0, text:"" },
    };
    setItems(prev => [...prev, { ...defaults[type], _id: uid() }]);
  };
  const changeItem = (index, patch) => setItems(prev => prev.map((item,i) => i===index ? {...item,...patch} : item));
  const removeItem = (index) => setItems(prev => prev.filter((_,i) => i!==index));

  const typeColor = {
    image:     { border:"border-blue-300",  bg:"bg-blue-50/40",  badge:"bg-blue-100 text-blue-700",   label:"이미지" },
    subtitle:  { border:"border-amber-300", bg:"bg-amber-50/40", badge:"bg-amber-100 text-amber-700", label:"자막" },
    narration: { border:"border-green-300", bg:"bg-green-50/40", badge:"bg-green-100 text-green-700", label:"나레이션" },
  };
  const typeIcon = { image:"🖼️", subtitle:"💬", narration:"🎙️" };

  const fileRef = useRef();
  const [uploadingIdx, setUploadingIdx] = useState(null);

  const handleImageUpload = async (e, index) => {
    const f = e.target.files[0];
    if (!f) return;
    setUploadingIdx(index);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res  = await fetch(`${API}/upload/image`, { method:"POST", body:fd });
      const data = await res.json();
      changeItem(index, { file_path: data.file_path, _filename: data.filename });
    } catch { alert("이미지 업로드 실패"); }
    finally { setUploadingIdx(null); }
  };

  const totalDur = items.length
    ? Math.max(...items.map(i => i.start + (i.type==="narration" ? 3 : i.duration)), 10) : 10;

  return (
    <div className="space-y-4">
      {transcribeResult && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border border-green-200">
          <span className="text-green-500 text-sm">✅</span>
          <p className="text-xs text-green-700 font-medium">전사 세그먼트 {transcribeResult.count}개 → 자막 자동 추가됨</p>
          <span className="text-xs text-green-400 ml-auto">{fmtSec(transcribeResult.duration)}</span>
        </div>
      )}

      <div>
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">아이템 추가</p>
        <div className="flex gap-2 flex-wrap">
          {["image","subtitle","narration"].map(type => (
            <button key={type} onClick={() => addItem(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 text-xs font-semibold transition-colors
                ${type==="image" ? "border-blue-200 text-blue-600 hover:bg-blue-50" :
                  type==="subtitle" ? "border-amber-200 text-amber-600 hover:bg-amber-50" :
                                      "border-green-200 text-green-600 hover:bg-green-50"}`}>
              {typeIcon[type]} + {typeColor[type].label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-8 rounded-xl border-2 border-dashed border-gray-200 text-gray-300">
          <span className="text-3xl mb-2">📋</span>
          <p className="text-sm">아이템이 없습니다</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {items.map((item, index) => {
            const tc = typeColor[item.type];
            return (
              <div key={item._id} className={`rounded-xl border-2 ${tc.border} ${tc.bg} p-3 space-y-2`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{typeIcon[item.type]}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tc.badge}`}>{tc.label}</span>
                  <span className="text-[10px] text-gray-400">#{index+1}</span>
                  <button onClick={() => removeItem(index)} className="ml-auto text-gray-300 hover:text-red-400 text-sm">🗑</button>
                </div>
                <div className="flex gap-2">
                  <label className="flex-1">
                    <span className="text-[9px] text-gray-400 font-semibold block mb-0.5">시작(초)</span>
                    <input type="number" min="0" step="0.5" value={item.start}
                      onChange={e => changeItem(index, { start: parseFloat(e.target.value)||0 })}
                      className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-purple-400 bg-white" />
                  </label>
                  {item.type !== "narration" && (
                    <label className="flex-1">
                      <span className="text-[9px] text-gray-400 font-semibold block mb-0.5">지속(초)</span>
                      <input type="number" min="0.5" step="0.5" value={item.duration}
                        onChange={e => changeItem(index, { duration: parseFloat(e.target.value)||1 })}
                        className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-purple-400 bg-white" />
                    </label>
                  )}
                </div>

                {item.type === "image" && (
                  <>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden"
                      onChange={e => handleImageUpload(e, index)} />
                    <button onClick={() => { fileRef.current.value=""; fileRef.current.onchange=e=>handleImageUpload(e,index); fileRef.current.click(); }}
                      className="w-full px-3 py-1.5 rounded-lg border-2 border-dashed border-blue-200 text-xs text-blue-500 hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      {uploadingIdx===index ? "업로드 중..." : item._filename ? `📎 ${item._filename}` : "클릭하여 이미지 선택"}
                    </button>
                  </>
                )}

                {item.type === "subtitle" && (
                  <div className="space-y-2">
                    <textarea value={item.text} onChange={e => changeItem(index, { text: e.target.value })}
                      rows={2} placeholder="자막 텍스트"
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs resize-none focus:outline-none focus:border-purple-400 bg-white" />
                    <div className="grid grid-cols-2 gap-2">
                      <label>
                        <span className="text-[9px] text-gray-400 block mb-0.5">크기</span>
                        <input type="number" min="1" max="20" step="0.5" value={item.font_size??5}
                          onChange={e => changeItem(index, { font_size: parseFloat(e.target.value)||5 })}
                          className="w-full px-1.5 py-1 rounded border border-gray-200 text-xs focus:outline-none" />
                      </label>
                      <label>
                        <span className="text-[9px] text-gray-400 block mb-0.5">색상</span>
                        <select value={JSON.stringify(item.color??[1,1,1])}
                          onChange={e => changeItem(index, { color: JSON.parse(e.target.value) })}
                          className="w-full px-1 py-1 rounded border border-gray-200 text-[10px]">
                          <option value={JSON.stringify([1,1,1])}>흰색</option>
                          <option value={JSON.stringify([1,1,0])}>노랑</option>
                          <option value={JSON.stringify([0,0,0])}>검정</option>
                          <option value={JSON.stringify([1,0.2,0.2])}>빨강</option>
                          <option value={JSON.stringify([0.4,0.8,1])}>하늘</option>
                        </select>
                      </label>
                    </div>
                  </div>
                )}

                {item.type === "narration" && (
                  <div className="space-y-2">
                    <textarea value={item.text} onChange={e => changeItem(index, { text: e.target.value })}
                      rows={2} placeholder="나레이션 텍스트 (OpenAI TTS 변환)"
                      className="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-xs resize-none focus:outline-none focus:border-purple-400 bg-white" />
                    <div className="flex gap-2">
                      <select value={item.voice} onChange={e => changeItem(index, { voice: e.target.value })}
                        className="flex-1 px-2 py-1 rounded-lg border border-gray-200 text-xs focus:outline-none">
                        {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                      <input type="number" min="0.25" max="4" step="0.25" value={item.speed}
                        onChange={e => changeItem(index, { speed: parseFloat(e.target.value)||1 })}
                        className="w-16 px-2 py-1 rounded-lg border border-gray-200 text-xs focus:outline-none" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 타임라인 미니맵 */}
      {items.length > 0 && (
        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider mb-2">타임라인 ({totalDur.toFixed(1)}초)</p>
          <div className="relative h-6 bg-gray-200 rounded-lg overflow-hidden">
            {items.map(item => {
              const dur   = item.type==="narration" ? 3 : item.duration;
              const left  = (item.start/totalDur)*100;
              const width = Math.max((dur/totalDur)*100, 0.5);
              const bg    = item.type==="image" ? "bg-blue-400" : item.type==="subtitle" ? "bg-amber-400" : "bg-green-400";
              return <div key={item._id} style={{ left:`${left}%`, width:`${width}%` }}
                className={`absolute top-0.5 bottom-0.5 rounded ${bg} opacity-75`}
                title={`${item.type} ${item.start}s`} />;
            })}
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-gray-400">0s</span>
            <span className="text-[9px] text-gray-400">{totalDur.toFixed(0)}s</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── STEP 3: 초안 생성 ────────────────────────────────────────────
function GenerateStep({ items, projectName, setProjectName, ratio, setRatio, width, height, fps }) {
  const [status, setStatus] = useState("idle");
  const [error,  setError]  = useState("");

  const [bgm, setBgm] = useState({ enabled:false, filePath:null, filename:null, volume:0.5, fade_in:0.5, fade_out:0.5 });
  const [bgmUploading, setBgmUploading] = useState(false);
  const bgmRef = useRef();

  const handleBgmUpload = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setBgmUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res  = await fetch(`${API}/upload/audio`, { method:"POST", body:fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || `오류 (${res.status})`);
      setBgm(prev => ({ ...prev, filePath: data.file_path, filename: data.filename }));
    } catch(e) { alert(`BGM 업로드 실패: ${e.message}`); }
    finally { setBgmUploading(false); }
  };

  const handleGenerate = async () => {
    if (!items.length) { alert("타임라인 아이템이 없습니다."); return; }
    setStatus("loading"); setError("");

    const resolvedItems = items.map(({ _id, _filename, ...rest }) => rest);
    if (bgm.enabled && bgm.filePath) {
      resolvedItems.push({ type:"bgm", audio_path:bgm.filePath, volume:bgm.volume, start:0, fade_in:bgm.fade_in, fade_out:bgm.fade_out });
    }

    const payload = { project_name: projectName, width, height, fps, allow_replace: true, items: resolvedItems };

    try {
      const res = await fetch(`${API}/draft/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `오류 (${res.status})`);
      }

      // zip 파일 다운로드
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `${projectName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStatus("done");
    } catch(e) { setError(e.message); setStatus("error"); }
  };

  return (
    <div className="space-y-3">
      {/* 프로젝트 이름 */}
      <div>
        <span className="text-[10px] text-gray-400 font-semibold block mb-1">캡컷 프로젝트 이름</span>
        <input value={projectName} onChange={e => setProjectName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-purple-400" />
      </div>

      {/* 비율 */}
      <div>
        <span className="text-[10px] text-gray-400 font-semibold block mb-2">영상 비율</span>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(RATIOS).map(([key, r]) => (
            <button key={key} onClick={() => setRatio(key)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all text-left ${
                ratio===key ? "border-purple-500 bg-purple-50" : "border-gray-200 bg-white hover:border-purple-300"
              }`}>
              <div className="flex-shrink-0 flex items-center justify-center w-10 h-10">
                {key==="16:9"
                  ? <div className={`rounded border-2 ${ratio===key ? "border-purple-500 bg-purple-100" : "border-gray-300 bg-gray-100"}`} style={{ width:36, height:20 }} />
                  : <div className={`rounded border-2 ${ratio===key ? "border-purple-500 bg-purple-100" : "border-gray-300 bg-gray-100"}`} style={{ width:20, height:36 }} />
                }
              </div>
              <div>
                <p className={`text-sm font-bold ${ratio===key ? "text-purple-700" : "text-gray-700"}`}>{r.icon} {r.label}</p>
                <p className={`text-[10px] mt-0.5 ${ratio===key ? "text-purple-400" : "text-gray-400"}`}>{r.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* BGM */}
      <div className="rounded-xl border-2 border-pink-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-pink-50">
          <div className="flex items-center gap-2"><span>🎵</span><span className="text-sm font-semibold text-pink-800">BGM 자동 추가</span></div>
          <button onClick={() => setBgm(prev => ({ ...prev, enabled: !prev.enabled }))}
            style={{ width:36, height:20, background: bgm.enabled ? "#ec4899" : "#d1d5db" }}
            className="relative rounded-full transition-colors">
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${bgm.enabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>
        {bgm.enabled && (
          <div className="p-3 space-y-3 border-t border-pink-100 bg-white">
            <input ref={bgmRef} type="file" accept=".mp3,.wav,.m4a,.flac,.ogg" className="hidden" onChange={handleBgmUpload} />
            <button onClick={() => { bgmRef.current.value=""; bgmRef.current.click(); }}
              className="w-full px-3 py-2 rounded-lg border-2 border-dashed border-pink-200 text-xs text-pink-500 hover:border-pink-400 hover:bg-pink-50 transition-colors">
              {bgmUploading ? "업로드 중..." : bgm.filename ? `🎵 ${bgm.filename}` : "클릭하여 BGM 선택 (mp3/wav/m4a)"}
            </button>
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-semibold text-gray-600">볼륨</span>
                <span className="text-[10px] font-mono text-pink-600">{Math.round(bgm.volume*100)}%</span>
              </div>
              <input type="range" min="0" max="1" step="0.05" value={bgm.volume}
                onChange={e => setBgm(prev => ({ ...prev, volume: parseFloat(e.target.value) }))}
                className="w-full accent-pink-500 h-1.5" />
            </div>
          </div>
        )}
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-2 text-center">
        {[
          { label:"이미지",   count:items.filter(i=>i.type==="image").length,     color:"blue" },
          { label:"자막",     count:items.filter(i=>i.type==="subtitle").length,  color:"amber" },
          { label:"나레이션", count:items.filter(i=>i.type==="narration").length, color:"green" },
        ].map(({ label, count, color }) => (
          <div key={label} className={`px-3 py-2 rounded-xl bg-${color}-50 border border-${color}-100`}>
            <p className={`text-lg font-bold text-${color}-700`}>{count}</p>
            <p className={`text-[10px] text-${color}-400`}>{label}</p>
          </div>
        ))}
      </div>

      {/* 생성 버튼 */}
      {status !== "loading" && (
        <button onClick={handleGenerate}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-bold hover:opacity-90 shadow-md transition-opacity">
          🎬 캡컷 초안 생성 (zip 다운로드)
        </button>
      )}

      {status === "loading" && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-purple-50 border border-purple-200">
          <svg className="animate-spin text-purple-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
          <div>
            <p className="text-sm font-semibold text-purple-700">초안 생성 중...</p>
            <p className="text-xs text-purple-400">나레이션 TTS → pyCapCut 빌드 → zip 압축</p>
          </div>
        </div>
      )}

      {status === "done" && (
        <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4 space-y-2">
          <p className="text-sm font-bold text-green-700">✅ 초안 생성 완료! zip 다운로드 시작됨</p>
          <div className="rounded-lg bg-white border border-green-200 p-3 text-xs text-gray-600 space-y-1">
            <p className="font-semibold text-gray-700">📁 적용 방법</p>
            <p>1. 다운로드된 <code className="bg-gray-100 px-1 rounded font-mono">{projectName}.zip</code> 압축 해제</p>
            <p>2. 폴더 전체를 아래 경로에 복사</p>
            <code className="block bg-gray-100 rounded px-2 py-1 font-mono text-[10px] mt-1 break-all">
              C:\Users\[계정]\AppData\Local\CapCut\User Data\Projects\com.lveditor.draft\
            </code>
            <p>3. 캡컷 열기 → <span className="font-semibold">{projectName}</span> 초안 확인</p>
          </div>
          <button onClick={() => setStatus("idle")} className="text-xs text-green-600 underline">다시 생성</button>
        </div>
      )}

      {status === "error" && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold text-red-600 mb-1">❌ 생성 실패</p>
          <p className="text-xs text-red-500 font-mono whitespace-pre-wrap">{error}</p>
          <button onClick={() => setStatus("idle")} className="text-xs text-red-400 underline mt-2">다시 시도</button>
        </div>
      )}
    </div>
  );
}

// ── 메인 AutoEditTab ──────────────────────────────────────────────
export default function AutoEditTab({ nasState, onGoToNas, NasSaveFooter }) {
  const [currentStep,      setCurrentStep]      = useState(1);
  const [transcribeResult, setTranscribeResult] = useState(null);
  const [items,            setItems]            = useState([]);
  const [projectName,      setProjectName]      = useState("캡컷_자동화_프로젝트");
  const [ratio,            setRatio]            = useState("16:9");
  const { width, height } = RATIOS[ratio];
  const fps = 30;

  const handleTranscribeDone = (result, silenceData=null, wordsPerLine=0, aligned=false, subStyle={}) => {
    setTranscribeResult(result);
    const keepSegs    = silenceData?.keep_segments ?? null;
    const totalDuration = keepSegs
      ? keepSegs.reduce((sum,s) => sum+s.duration, 0)
      : result.duration || 10;

    const videoItem = result.file_path ? [{
      _id: uid(), type:"image",
      file_path: result.file_path,
      _filename: result.file_path.split(/[\\/]/).pop(),
      start: 0, duration: totalDuration,
      ...(keepSegs ? { silence_cuts: keepSegs } : {}),
    }] : [];

    const segs = result.segments.filter(s => s.text.trim());
    const hasWordData = segs.some(s => s.words?.length > 0);
    let subtitleItems = [];

    if (aligned || !keepSegs) {
      if (wordsPerLine > 0 && hasWordData) {
        const allWords = segs.flatMap(s => s.words?.filter(w => w.word?.trim()) ?? []);
        for (let i = 0; i < allWords.length; i += wordsPerLine) {
          const group = allWords.slice(i, i+wordsPerLine);
          const text  = group.map(w => w.word).join(" ").trim();
          if (!text) continue;
          subtitleItems.push({
            ...subStyle, _id:uid(), type:"subtitle", text,
            start:    Math.round(group[0].start * 1000) / 1000,
            duration: Math.round(Math.max(group[group.length-1].end - group[0].start, 0.05) * 1000) / 1000,
          });
        }
      } else {
        subtitleItems = segs.map(seg => ({
          ...subStyle, _id:uid(), type:"subtitle",
          text:     seg.text.trim(),
          start:    Math.round(seg.start * 1000) / 1000,
          duration: Math.round(Math.max(seg.end - seg.start, 0.05) * 1000) / 1000,
        }));
      }
    } else {
      const remapTime = (t) => {
        let compressed = 0;
        for (const seg of keepSegs) {
          if (t <= seg.start) return compressed;
          if (t <= seg.end)   return compressed + (t - seg.start);
          compressed += seg.duration;
        }
        return compressed;
      };
      subtitleItems = segs.map(seg => ({
        ...subStyle, _id:uid(), type:"subtitle",
        text:     seg.text.trim(),
        start:    Math.round(remapTime(seg.start) * 1000) / 1000,
        duration: Math.round(Math.max(remapTime(seg.end) - remapTime(seg.start), 0.05) * 1000) / 1000,
      })).filter(s => s.text);
    }

    subtitleItems.sort((a,b) => a.start - b.start);
    const PYCC_GAP = 0.002, MIN_DUR = 0.05;

    for (let i = 1; i < subtitleItems.length; i++) {
      const prev = subtitleItems[i-1], cur = subtitleItems[i];
      const minStart = Math.round((prev.start + MIN_DUR + PYCC_GAP) * 1000) / 1000;
      if (cur.start < minStart) cur.start = minStart;
    }
    for (let i = 0; i < subtitleItems.length - 1; i++) {
      const cur = subtitleItems[i], next = subtitleItems[i+1];
      cur.duration = Math.round((next.start - cur.start - PYCC_GAP) * 1000) / 1000;
    }
    if (subtitleItems.length > 0) {
      const last    = subtitleItems[subtitleItems.length-1];
      const videoEnd = result.duration != null ? Math.round(result.duration*1000)/1000 : totalDuration;
      const remaining = Math.round((videoEnd - last.start) * 1000) / 1000;
      last.duration = Math.max(MIN_DUR, remaining > 0 ? remaining : last.duration);
    }

    setItems([...videoItem, ...subtitleItems]);
    setCurrentStep(2);
  };

  const step1Done       = !!transcribeResult;
  const step3Accessible = items.length > 0;
  const goToStep = (n) => {
    if (n === 1) setCurrentStep(1);
    if (n === 2 && step1Done)        setCurrentStep(2);
    if (n === 3 && step3Accessible)  setCurrentStep(3);
  };

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
          <div className="flex-1 min-w-0">
            <h4 className="text-base font-bold text-gray-800">AI 영상편집 자동화</h4>
            <p className="text-xs text-gray-400 mt-0.5">영상 하나로 자막·무음컷·캡컷 초안까지 — 편집 시간 10분의 1</p>
          </div>
        </div>
      </div>

      {/* 스텝 인디케이터 */}
      <div className="px-6 py-4 bg-gray-50/60 border-b border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => goToStep(1)}>
            <StepBadge n="1" label="영상 전사" active={currentStep===1} done={step1Done && currentStep!==1} />
          </button>
          <span className="text-gray-300 text-xs">→</span>
          <button onClick={() => goToStep(2)} disabled={!step1Done} className={!step1Done ? "opacity-40 cursor-not-allowed" : ""}>
            <StepBadge n="2" label="타임라인 편집" active={currentStep===2} done={step3Accessible && currentStep===3} />
          </button>
          <span className="text-gray-300 text-xs">→</span>
          <button onClick={() => goToStep(3)} disabled={!step3Accessible} className={!step3Accessible ? "opacity-40 cursor-not-allowed" : ""}>
            <StepBadge n="3" label="초안 생성" active={currentStep===3} done={false} />
          </button>
        </div>
      </div>

      {/* 스텝 컨텐츠 */}
      <div className="p-6">
        {currentStep === 1 && <TranscribeStep onDone={handleTranscribeDone} />}

        {currentStep === 2 && (
          <div className="space-y-4">
            <TimelineStep items={items} setItems={setItems} transcribeResult={transcribeResult} />
            <button onClick={() => setCurrentStep(3)} disabled={!items.length}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-bold hover:opacity-90 shadow transition-opacity disabled:opacity-40">
              다음: 초안 생성 →
            </button>
          </div>
        )}

        {currentStep === 3 && (
          <GenerateStep items={items} projectName={projectName} setProjectName={setProjectName}
            ratio={ratio} setRatio={setRatio} width={width} height={height} fps={fps} />
        )}
      </div>

      <NasSaveFooter nasState={nasState} subfolder="자동편집" onGoToNas={onGoToNas} />
    </div>
  );
}
