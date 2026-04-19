// 9:16 인앱 영상 프리뷰 컴포넌트
// 커뮤니티 썰 UI 배경 + TikTok 단어 하이라이트 자막 실시간 렌더링
import { useRef, useState, useEffect, useMemo, useCallback } from "react";

// ─── 자막 페이지 빌더 ───────────────────────────────────────────────────────
const MAX_CHARS_PER_PAGE = 10;
const PUNCT_BREAK = /[.!?,。\n]/;

function buildPages(captions) {
  if (!captions || captions.length === 0) return [];
  const pages = [];
  let page = null;
  let pageChars = 0;

  for (const cap of captions) {
    const wordLen = cap.text.trim().length;
    if (!page || pageChars + wordLen > MAX_CHARS_PER_PAGE) {
      page = { startMs: cap.startMs, endMs: cap.endMs, tokens: [] };
      pages.push(page);
      pageChars = 0;
    }
    page.tokens.push({ text: cap.text, fromMs: cap.startMs, toMs: cap.endMs });
    page.endMs = Math.max(page.endMs, cap.endMs);
    pageChars += wordLen;
    if (PUNCT_BREAK.test(cap.text)) { page = null; pageChars = 0; }
  }
  return pages;
}

// ─── 애니 캐릭터 SVG ────────────────────────────────────────────────────────
function AnimeCharacter({ mood = "happy", hairColor = "#2c1a0e", clothesColor = "#4a90d9" }) {
  const eyeScale = (mood === "happy" || mood === "laugh") ? "5" : "6";
  const eyes = mood === "shocked" ? (
    <>
      <circle cx="39" cy="44" r="7" fill="white" stroke="#222" strokeWidth="1"/>
      <circle cx="61" cy="44" r="7" fill="white" stroke="#222" strokeWidth="1"/>
      <circle cx="40" cy="45" r="4" fill="#1a1a3a"/>
      <circle cx="62" cy="45" r="4" fill="#1a1a3a"/>
      <circle cx="41" cy="43" r="1.5" fill="white"/>
      <circle cx="63" cy="43" r="1.5" fill="white"/>
    </>
  ) : (
    <>
      <ellipse cx="39" cy="44" rx="6" ry={eyeScale} fill="white" stroke="#222" strokeWidth="1"/>
      <ellipse cx="61" cy="44" rx="6" ry={eyeScale} fill="white" stroke="#222" strokeWidth="1"/>
      <circle cx="40" cy="45" r="3.5" fill="#1a1a3a"/>
      <circle cx="62" cy="45" r="3.5" fill="#1a1a3a"/>
      <circle cx="41" cy="43.5" r="1.2" fill="white"/>
      <circle cx="63" cy="43.5" r="1.2" fill="white"/>
    </>
  );

  const mouths = {
    happy:   <path d="M42 58 Q50 65 58 58" stroke="#c05050" strokeWidth="2.5" fill="none" strokeLinecap="round"/>,
    angry:   <path d="M42 62 Q50 56 58 62" stroke="#c05050" strokeWidth="2.5" fill="none" strokeLinecap="round"/>,
    shocked: <ellipse cx="50" cy="60" rx="5" ry="7" fill="#c05050"/>,
    sad:     <path d="M42 62 Q50 57 58 62" stroke="#c05050" strokeWidth="2.5" fill="none" strokeLinecap="round"/>,
    laugh:   <path d="M40 56 Q50 68 60 56" stroke="#c05050" strokeWidth="2.5" fill="#ffb3b3" strokeLinecap="round"/>,
  };

  const showBlush = ["happy", "laugh", "shocked"].includes(mood);

  return (
    <svg viewBox="0 0 100 160" width="88" height="140">
      {/* 뒷머리 */}
      <ellipse cx="50" cy="32" rx="34" ry="36" fill={hairColor}/>
      {/* 얼굴 */}
      <ellipse cx="50" cy="48" rx="28" ry="30" fill="#fdd9b3"/>
      {/* 귀 */}
      <ellipse cx="22" cy="48" rx="5" ry="7" fill="#fdd9b3"/>
      <ellipse cx="78" cy="48" rx="5" ry="7" fill="#fdd9b3"/>
      {/* 앞머리 */}
      <path d="M20 28 Q18 10 35 8 Q50 2 65 8 Q82 10 80 28 Q70 20 60 22 Q50 18 40 22 Q30 20 20 28Z" fill={hairColor}/>
      {/* 눈 */}
      {eyes}
      {/* 코 */}
      <path d="M48 52 Q50 55 52 52" stroke="#c8956c" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      {/* 입 */}
      {mouths[mood] ?? mouths.happy}
      {/* 볼터치 */}
      {showBlush && (
        <>
          <ellipse cx="32" cy="54" rx="7" ry="4" fill="rgba(255,140,140,0.3)"/>
          <ellipse cx="68" cy="54" rx="7" ry="4" fill="rgba(255,140,140,0.3)"/>
        </>
      )}
      {/* 목 */}
      <rect x="43" y="76" width="14" height="12" fill="#fdd9b3"/>
      {/* 몸통 */}
      <path d="M20 88 Q20 82 35 82 Q42 80 50 80 Q58 80 65 82 Q80 82 80 88 L78 158 L22 158 Z" fill={clothesColor}/>
      {/* 칼라 */}
      <path d="M35 82 L50 96 L65 82" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── 커뮤니티 UI 배경 ────────────────────────────────────────────────────────
// 조회수/추천 수는 키로 해시해서 고정값 사용 (리렌더 때마다 바뀌지 않도록)
function hashInt(str, min, max) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return min + (Math.abs(h) % (max - min));
}

function CommunityBg({ bgPreset, titleExcerpt }) {
  const { site, character, key } = bgPreset ?? {};
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
        {/* 햄버거 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, cursor: "pointer" }}>
          {[0,1,2].map(i => <div key={i} style={{ width: 20, height: 2.5, background: "rgba(255,255,255,0.9)", borderRadius: 2 }}/>)}
        </div>
        {/* 사이트명 */}
        <span style={{ color: "white", fontWeight: 800, fontSize: 14, flex: 1, textAlign: "center", letterSpacing: "-0.3px" }}>
          {siteName}
        </span>
        {/* 돋보기 */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
      </div>

      {/* 게시물 카드 */}
      <div style={{ margin: "8px 8px 4px", background: "white", borderRadius: 10, padding: "10px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
        {/* 메타 정보 */}
        <div style={{ fontSize: 9, color: "#aaa", marginBottom: 6, display: "flex", gap: 5 }}>
          <span style={{ color: "#888", fontWeight: 600 }}>익명</span>
          <span>·</span>
          <span>{dateStr}</span>
          <span>·</span>
          <span>조회 {views}</span>
        </div>
        {/* 제목 */}
        <div style={{ fontSize: 12, fontWeight: 700, color: "#111", lineHeight: 1.55,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {titleExcerpt || "제목 없음"}
        </div>
        {/* 반응 */}
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
  captionPos,
  totalMs,
}) {
  const audioRef    = useRef(null);
  const intervalRef = useRef(null);
  const [playing, setPlaying]   = useState(false);
  const [currentMs, setCurrentMs] = useState(0);

  const pages      = useMemo(() => buildPages(captions), [captions]);
  const durationMs = totalMs || (captions?.[captions.length - 1]?.endMs ?? 0) + 500;

  // title이 없으면 스크립트 앞부분을 폴백으로 사용
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

  const currentPage = useMemo(() => {
    let found = null;
    for (const p of pages) {
      if (currentMs >= p.startMs) found = p;
      else break;
    }
    if (found && currentMs <= found.endMs + 400) return found;
    return null;
  }, [pages, currentMs]);

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

  const captionStyle = captionPos === "bottom"
    ? { justifyContent: "flex-end", paddingBottom: 80 }
    : { justifyContent: "center" };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* 9:16 캔버스 */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl"
        style={{ width: 270, height: 480, background: "#f0f0f2", flexShrink: 0 }}>

        {/* 커뮤니티 배경 */}
        <CommunityBg bgPreset={bgPreset} titleExcerpt={titleExcerpt}/>

        {/* 자막 오버레이 */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", padding: "0 14px",
          pointerEvents: "none",
          ...captionStyle,
        }}>
          {currentPage && (
            <div style={{ background: "rgba(0,0,0,0.0)", borderRadius: 10, padding: "4px 10px" }}>
              <p style={{ fontFamily, fontSize: 17, fontWeight: 900, lineHeight: 1.25, margin: 0, whiteSpace: "nowrap", textAlign: "center" }}>
                {currentPage.tokens.map((token, i) => (
                  <span key={i} style={{ color: "#111" }}>{token.text}</span>
                ))}
              </p>
            </div>
          )}
        </div>

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
