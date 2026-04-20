// 9:16 인앱 영상 프리뷰 컴포넌트
// 커뮤니티 썰 UI 배경 + 자막 한 문장씩 카드 본문에 실시간 렌더링
import { useRef, useState, useEffect, useMemo, useCallback } from "react";

// ─── 2-3단어 단위 자막 빌더 ─────────────────────────────────────────────────
const WORDS_PER_CHUNK = 3;

function buildChunks(captions) {
  if (!captions || captions.length === 0) return [];
  const chunks = [];
  let cur = null;
  let wordCount = 0;

  for (const cap of captions) {
    if (!cur) {
      cur = { startMs: cap.startMs, endMs: cap.endMs, text: "" };
      chunks.push(cur);
      wordCount = 0;
    }
    cur.text += cap.text;
    cur.endMs = Math.max(cur.endMs, cap.endMs);
    if (cap.text.trim()) wordCount++;
    if (wordCount >= WORDS_PER_CHUNK) { cur = null; }
  }
  return chunks;
}

// ─── 커뮤니티 UI 배경 ────────────────────────────────────────────────────────
function hashInt(str, min, max) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return min + (Math.abs(h) % (max - min));
}

function CommunityBg({ bgPreset, titleExcerpt, fontFamily }) {
  const { site, key } = bgPreset ?? {};
  const siteName  = site?.name  ?? "커뮤니티";
  const siteColor = site?.color ?? "#1e6dc8";

  const views    = hashInt((key ?? "") + "v", 1200, 18000).toLocaleString();
  const likes    = hashInt((key ?? "") + "l", 50, 450);
  const comments = hashInt((key ?? "") + "c", 20, 180);

  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,"0")}.${String(today.getDate()).padStart(2,"0")}`;

  return (
    <div style={{ position: "absolute", inset: 0, background: "#f0f0f2", overflow: "hidden", fontFamily: "'Noto Sans KR', sans-serif" }}>

      {/* 커뮤니티 상단 헤더 */}
      <div style={{ background: siteColor, height: 46, display: "flex", alignItems: "center", padding: "0 12px", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 20, height: 2.5, background: "rgba(255,255,255,0.9)", borderRadius: 2 }}/>)}
        </div>
        <span style={{ color: "white", fontWeight: 800, fontSize: 14, flex: 1, textAlign: "center", letterSpacing: "-0.3px" }}>
          {siteName}
        </span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>

      {/* 게시물 카드 — 제목만 */}
      <div style={{ margin: "8px 8px 4px", background: "white", borderRadius: 10, padding: "10px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        <div style={{ fontSize: 9, color: "#aaa", marginBottom: 6, display: "flex", gap: 5 }}>
          <span style={{ color: "#888", fontWeight: 600 }}>익명</span>
          <span>·</span>
          <span>{dateStr}</span>
          <span>·</span>
          <span>조회 {views}</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#111", lineHeight: 1.55,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {titleExcerpt || "제목 없음"}
        </div>
        <div style={{ marginTop: 7, display: "flex", gap: 10 }}>
          <span style={{ fontSize: 9, color: "#e03131", fontWeight: 600 }}>👍 {likes}</span>
          <span style={{ fontSize: 9, color: "#868e96" }}>💬 {comments}</span>
        </div>
      </div>


      {/* 하단 네비게이션 바 */}
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 44,
        background: "white", borderTop: "1px solid #e9ecef",
        display: "flex", alignItems: "center", justifyContent: "space-around" }}>
        {["🏠","🔥","✏️","🔔","👤"].map(icon => (
          <span key={icon} style={{ fontSize: 18 }}>{icon}</span>
        ))}
      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────
export default function VideoPreview({
  bgPreset,
  title,
  script,
  audioUrl,
  captions,
  fontFamily,
  totalMs,
}) {
  const audioRef    = useRef(null);
  const intervalRef = useRef(null);
  const [playing, setPlaying]     = useState(false);
  const [currentMs, setCurrentMs] = useState(0);

  const sentences  = useMemo(() => buildChunks(captions), [captions]);
  const durationMs = totalMs || (captions?.[captions.length - 1]?.endMs ?? 0) + 500;

  const titleExcerpt = title?.trim() || script?.trim().slice(0, 60) || "";

  // 오디오 설정 + currentMs 동기화
  useEffect(() => {
    if (!audioUrl) { audioRef.current = null; return; }
    const audio = new Audio(audioUrl);
    audio.preload = "auto";
    audioRef.current = audio;
    const onTime  = () => setCurrentMs(audio.currentTime * 1000);
    const onEnded = () => { setPlaying(false); setCurrentMs(0); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, [audioUrl]);

  // 오디오 없을 때 폴백 타이머
  useEffect(() => {
    if (audioUrl || !playing) return;
    intervalRef.current = setInterval(() => {
      setCurrentMs(prev => {
        const next = prev + 100;
        if (next >= durationMs) { setPlaying(false); return 0; }
        return next;
      });
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [audioUrl, playing, durationMs]);

  // 현재 문장 계산
  const currentSentence = useMemo(() => {
    if (!sentences.length) return null;
    let found = null;
    for (const s of sentences) {
      if (currentMs >= s.startMs) found = s;
      else break;
    }
    if (found && currentMs <= found.endMs + 500) return found.text;
    return null;
  }, [sentences, currentMs]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (playing) {
      audio?.pause();
      setPlaying(false);
    } else {
      audio?.play().catch(e => console.error("[VideoPreview] audio.play() 실패:", e));
      setPlaying(true);
    }
  }, [playing]);

  const handleSeek = useCallback((e) => {
    const ms = Number(e.target.value);
    setCurrentMs(ms);
    if (audioRef.current) audioRef.current.currentTime = ms / 1000;
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* 9:16 캔버스 */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl"
        style={{ width: 270, height: 480, background: "#f0f0f2", flexShrink: 0 }}>

        <CommunityBg
          bgPreset={bgPreset}
          titleExcerpt={titleExcerpt}
          fontFamily={fontFamily}
        />

        {/* 자막 — 제목 카드 바로 아래 중앙 정렬 */}
        {currentSentence && (
          <div style={{
            position: "absolute", top: 155, left: 0, right: 0,
            display: "flex", justifyContent: "center",
            pointerEvents: "none", padding: "0 20px",
          }}>
            <p style={{
              fontFamily: fontFamily ?? "'Noto Sans KR', sans-serif",
              fontSize: 18, fontWeight: 800, color: "#111",
              textAlign: "center", margin: 0,
              lineHeight: 1.5,
            }}>
              {currentSentence}
            </p>
          </div>
        )}

        {/* 일시정지 시 재생 버튼 */}
        {!playing && (
          <button onClick={togglePlay} style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.18)", border: "none", cursor: "pointer",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(255,255,255,0.92)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#111">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          </button>
        )}

        {/* 재생 중 일시정지 버튼 */}
        {playing && (
          <button onClick={togglePlay}
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.35)", border: "none", cursor: "pointer" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
          </button>
        )}
      </div>

      {/* 타임라인 */}
      <div className="w-full" style={{ maxWidth: 270 }}>
        <div className="flex items-center gap-2">
          <button onClick={togglePlay}
            className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 hover:bg-indigo-700 transition-colors">
            {playing
              ? <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            }
          </button>
          <input type="range" min={0} max={durationMs} value={currentMs}
            onChange={handleSeek} className="flex-1 accent-indigo-600" style={{ height: 3 }}/>
          <span className="text-[11px] text-gray-400 font-mono w-10 text-right flex-shrink-0">
            {(currentMs / 1000).toFixed(1)}s
          </span>
        </div>
      </div>
    </div>
  );
}
