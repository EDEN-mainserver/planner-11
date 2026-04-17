// 9:16 인앱 영상 프리뷰 컴포넌트
// 배경영상 + TikTok 스타일 단어 하이라이트 자막 실시간 렌더링
import { useRef, useState, useEffect, useMemo, useCallback } from "react";

const SWITCH_EVERY_MS = 1500;

function buildPages(captions) {
  if (!captions || captions.length === 0) return [];
  const pages = [];
  let page = null;
  for (const cap of captions) {
    if (!page || cap.startMs - page.startMs >= SWITCH_EVERY_MS) {
      page = { startMs: cap.startMs, endMs: cap.endMs, tokens: [] };
      pages.push(page);
    }
    page.tokens.push({ text: cap.text, fromMs: cap.startMs, toMs: cap.endMs });
    page.endMs = Math.max(page.endMs, cap.endMs);
  }
  return pages;
}

export default function VideoPreview({
  backgroundVideoUrl,
  captions,
  highlightColor,
  fontFamily,
  captionPos,
  totalMs,
}) {
  const videoRef                          = useRef(null);
  const intervalRef                       = useRef(null);
  const [playing, setPlaying]             = useState(false);
  const [currentMs, setCurrentMs]         = useState(0);
  const [videoLoaded, setVideoLoaded]     = useState(false);
  const [videoError, setVideoError]       = useState(false);

  const pages      = useMemo(() => buildPages(captions), [captions]);
  const durationMs = totalMs || (captions?.[captions.length - 1]?.endMs ?? 0) + 500;

  // 영상 → currentMs 동기화
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onTime = () => setCurrentMs(video.currentTime * 1000);
    video.addEventListener("timeupdate", onTime);
    return () => video.removeEventListener("timeupdate", onTime);
  }, [videoLoaded]);

  // 영상 실패 시 폴백 타이머 (자막 싱크용)
  useEffect(() => {
    if (!videoError || !playing) return;
    intervalRef.current = setInterval(() => {
      setCurrentMs(prev => {
        const next = prev + 100;
        if (next >= durationMs) { setPlaying(false); return 0; }
        return next;
      });
    }, 100);
    return () => clearInterval(intervalRef.current);
  }, [videoError, playing, durationMs]);

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
    const video = videoRef.current;
    if (video && !videoError) {
      if (playing) {
        video.pause(); setPlaying(false);
      } else {
        video.play().catch(() => { setVideoError(true); setPlaying(true); });
        setPlaying(true);
      }
    } else {
      setPlaying(p => !p);
    }
  }, [playing, videoError]);

  const handleSeek = useCallback((e) => {
    const ms = Number(e.target.value);
    setCurrentMs(ms);
    if (videoRef.current && !videoError) videoRef.current.currentTime = ms / 1000;
  }, [videoError]);

  const captionStyle =
    captionPos === "bottom"
      ? { justifyContent: "flex-end", paddingBottom: 72 }
      : { justifyContent: "center" };

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* 9:16 캔버스 */}
      <div
        className="relative overflow-hidden rounded-2xl shadow-2xl"
        style={{ width: 270, height: 480, background: "#0a0a0a", flexShrink: 0 }}
      >
        {!videoError && (
          <video
            ref={videoRef}
            src={backgroundVideoUrl}
            loop muted playsInline
            onLoadedData={() => setVideoLoaded(true)}
            onError={() => setVideoError(true)}
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              opacity: videoLoaded ? 1 : 0,
              transition: "opacity 0.4s",
            }}
          />
        )}

        {/* 배경 (영상 로딩 중/실패 폴백) */}
        <div style={{
          position: "absolute", inset: 0,
          background: videoLoaded && !videoError
            ? "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0) 80%)"
            : "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
          transition: "background 0.4s",
        }} />

        {!videoLoaded && !videoError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <svg className="animate-spin text-white/40" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            <p className="text-white/30 text-[10px]">배경 로딩 중…</p>
          </div>
        )}

        {/* 자막 */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", padding: "0 14px",
          pointerEvents: "none",
          ...captionStyle,
        }}>
          {currentPage && (
            <div style={{ background: "rgba(0,0,0,0.5)", borderRadius: 10, padding: "9px 14px", maxWidth: "92%", textAlign: "center" }}>
              <p style={{ fontFamily, fontSize: 19, fontWeight: 900, lineHeight: 1.35, margin: 0, whiteSpace: "pre-wrap" }}>
                {currentPage.tokens.map((token, i) => {
                  const isActive = token.fromMs <= currentMs && token.toMs > currentMs;
                  return (
                    <span key={i} style={{
                      color: isActive ? highlightColor : "#ffffff",
                      textShadow: "-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000",
                      transition: "color 0.05s",
                    }}>{token.text}</span>
                  );
                })}
              </p>
            </div>
          )}
        </div>

        {/* 일시정지 시 재생 버튼 */}
        {!playing && (
          <button onClick={togglePlay} style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(0,0,0,0.3)", border: "none", cursor: "pointer",
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(255,255,255,0.92)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="#111">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
            </div>
          </button>
        )}

        {/* 재생 중 일시정지 버튼 */}
        {playing && (
          <button onClick={togglePlay} className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.5)", border: "none", cursor: "pointer" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="white">
              <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
            </svg>
          </button>
        )}

        {videoError && (
          <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[9px] font-medium"
            style={{ background: "rgba(0,0,0,0.5)", color: "rgba(255,255,255,0.5)" }}>
            배경 로드 실패 · 자막만 표시
          </div>
        )}
      </div>

      {/* 타임라인 */}
      <div className="w-full" style={{ maxWidth: 270 }}>
        <div className="flex items-center gap-2">
          <button onClick={togglePlay} className="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0 hover:bg-indigo-700 transition-colors">
            {playing
              ? <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              : <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            }
          </button>
          <input type="range" min={0} max={durationMs} value={currentMs} onChange={handleSeek} className="flex-1 accent-indigo-600" style={{ height: 3 }} />
          <span className="text-[11px] text-gray-400 font-mono w-10 text-right flex-shrink-0">{(currentMs / 1000).toFixed(1)}s</span>
        </div>
      </div>
    </div>
  );
}
