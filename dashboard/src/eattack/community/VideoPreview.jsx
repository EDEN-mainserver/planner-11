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

// ─── 커뮤니티 UI 배경 (줍줍썰 스타일) ────────────────────────────────────────
function hashInt(str, min, max) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return min + (Math.abs(h) % (max - min));
}

// 배경색 밝기 계산 → 텍스트 색 자동 결정
function isDark(hex) {
  const c = hex?.replace("#", "") ?? "ffffff";
  const r = parseInt(c.slice(0,2), 16);
  const g = parseInt(c.slice(2,4), 16);
  const b = parseInt(c.slice(4,6), 16);
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
}

function CommunityBg({ bgPreset, titleExcerpt, bodyText, siteName, headerColor, bodyBgColor }) {
  const { key } = bgPreset ?? {};

  const views = hashInt((key ?? "") + "v", 10000, 200000).toLocaleString();

  // 시각적으로 자연스러운 시간 (해시 기반)
  const hour = String(hashInt((key ?? "") + "h", 10, 23)).padStart(2, "0");
  const min  = String(hashInt((key ?? "") + "m", 0, 59)).padStart(2, "0");
  const timeStr = `${hour}:${min}`;

  const bodyDark    = isDark(bodyBgColor || "#ffffff");
  const textMain    = bodyDark ? "#ffffff" : "#111111";
  const textSub     = bodyDark ? "#aaaaaa" : "#888888";
  const dividerColor = bodyDark ? "#444444" : "#222222";

  return (
    <div style={{
      position: "absolute", inset: 0,
      background: bodyBgColor || "#ffffff",
      overflow: "hidden",
      fontFamily: "'Noto Sans KR', sans-serif",
    }}>

      {/* 헤더 */}
      <div style={{
        background: headerColor || "#FFD6C1",
        height: 50,
        display: "flex",
        alignItems: "center",
        padding: "0 14px",
        gap: 8,
      }}>
        {/* 뒤로가기 */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>

        {/* 로고 박스 */}
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{
            background: "white",
            padding: "4px 14px",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            gap: 5,
            boxShadow: "0 2px 4px rgba(0,0,0,0.08)",
          }}>
            <div style={{
              width: 15, height: 15,
              background: "#222",
              borderRadius: "50%",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ color: "white", fontSize: 6, letterSpacing: 1 }}>••</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: 13, color: "#000", letterSpacing: "-0.3px" }}>{siteName || "줍줍썰"}</span>
          </div>
        </div>

        {/* 메뉴 버튼 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 18, height: 2, background: "#333", borderRadius: 2 }}/>
          ))}
        </div>
      </div>

      {/* 본문 영역 */}
      <div style={{ padding: "14px 16px 0", background: bodyBgColor || "#fff" }}>

        {/* 게시글 제목 */}
        <h1 style={{
          fontSize: 15,
          fontWeight: 700,
          marginBottom: 8,
          letterSpacing: "-0.3px",
          lineHeight: 1.35,
          color: textMain,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {titleExcerpt || "제목 없음"}
        </h1>

        {/* 메타 정보 */}
        <div style={{
          fontSize: 10,
          color: textSub,
          paddingBottom: 10,
          borderBottom: `1px solid ${dividerColor}`,
          display: "flex",
          gap: 5,
          alignItems: "center",
        }}>
          <span style={{ fontWeight: 600, color: textSub }}>ㅇㅇ</span>
          <span>|</span>
          <span>{timeStr}</span>
          <span>|</span>
          <span>조회수 {views}</span>
        </div>

      </div>
    </div>
  );
}

// ─── 메인 컴포넌트 ───────────────────────────────────────────────────────────
export default function VideoPreview({
  bgPreset,
  title,
  siteName,
  headerColor,
  bodyBgColor,
  script,
  audioUrl,
  captions,
  fontFamily,
  totalMs,
  gifQuery,
  bgmFile,
}) {
  const audioRef       = useRef(null);
  const bgmRef         = useRef(null);
  const intervalRef    = useRef(null);
  const speechStartRef = useRef(null);   // Web Speech 시작 시각
  const speechRafRef   = useRef(null);   // Web Speech RAF ID
  const webWordRef     = useRef([]);     // onboundary로 쌓은 실시간 단어 타이밍
  const [playing, setPlaying]         = useState(false);
  const [currentMs, setCurrentMs]     = useState(0);
  const [webCaptions, setWebCaptions] = useState(null); // Web Speech 실시간 자막

  // 언마운트 시 Web Speech 정리
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      cancelAnimationFrame(speechRafRef.current);
    };
  }, []);

  // audioUrl 바뀌면 webCaptions 초기화
  useEffect(() => { setWebCaptions(null); webWordRef.current = []; }, [audioUrl]);

  // Web Speech 실시간 자막이 있으면 우선 사용, 없으면 prop captions
  const activeCaptions = webCaptions ?? captions;
  const sentences  = useMemo(() => buildChunks(activeCaptions), [activeCaptions]);
  const durationMs = totalMs || (activeCaptions?.[activeCaptions.length - 1]?.endMs ?? 0) + 500;

  const titleExcerpt = title?.trim() || script?.trim().slice(0, 60) || "";
  // 스크립트 첫 문장을 훅 문구로 사용
  const bodyText = script?.trim().split(/(?<=[.!?。])\s+/)[0]?.slice(0, 50) || "";

  // TTS 오디오 설정 + requestAnimationFrame으로 60fps 자막 동기화
  useEffect(() => {
    if (!audioUrl) { audioRef.current = null; return; }
    const audio = new Audio(audioUrl);
    audio.preload = "auto";
    audioRef.current = audio;

    let rafId = null;
    const tick = () => {
      setCurrentMs(audio.currentTime * 1000);
      rafId = requestAnimationFrame(tick);
    };
    const onPlay   = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(tick); };
    const onPause  = () => { cancelAnimationFrame(rafId); rafId = null; };
    const onEnded  = () => {
      cancelAnimationFrame(rafId); rafId = null;
      setPlaying(false); setCurrentMs(0);
    };

    audio.addEventListener("play",   onPlay);
    audio.addEventListener("pause",  onPause);
    audio.addEventListener("ended",  onEnded);
    return () => {
      cancelAnimationFrame(rafId);
      audio.pause();
      audio.removeEventListener("play",  onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audioRef.current = null;
    };
  }, [audioUrl]);

  // BGM 설정 (볼륨 30%, 루프)
  useEffect(() => {
    if (!bgmFile) { bgmRef.current = null; return; }
    const bgm = new Audio(bgmFile);
    bgm.volume = 0.3;
    bgmRef.current = bgm;
    return () => {
      bgm.pause();
      bgmRef.current = null;
    };
  }, [bgmFile]);

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

  // Klipy GIF — 캐시로 즉시 표시, 새 GIF 로드 완료 후 교체
  const [gifUrl, setGifUrl] = useState(null);
  const gifCacheRef = useRef({});

  const fetchAndSetGif = useCallback((q, keepPrevious = false) => {
    if (!q) return;
    // 캐시 히트 → 즉시 표시
    if (gifCacheRef.current[q]) {
      setGifUrl(gifCacheRef.current[q]);
      return;
    }
    // 캐시 미스 → 이전 GIF 유지하며 로드
    if (!keepPrevious) setGifUrl(null);
    let cancelled = false;
    fetch(`/api/klipy?q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d?.url) {
          gifCacheRef.current[q] = d.url;
          setGifUrl(d.url);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // 초기 GIF (gifQuery 기반)
  useEffect(() => {
    if (gifQuery) fetchAndSetGif(gifQuery, false);
  }, [gifQuery, fetchAndSetGif]);

  // 자막 청크 변경 시 GIF 교체 — 이전 GIF 유지하다가 새 것 로드되면 교체
  useEffect(() => {
    if (!currentSentence) { setGifUrl(null); return; }
    return fetchAndSetGif(currentSentence, true); // keepPrevious=true
  }, [currentSentence, fetchAndSetGif]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (playing) {
      audio?.pause();
      bgmRef.current?.pause();
      window.speechSynthesis?.cancel();
      cancelAnimationFrame(speechRafRef.current);
      speechRafRef.current = null;
      setPlaying(false);
    } else {
      if (audio) {
        // API TTS 오디오 재생
        audio.play().catch(e => console.error("[VideoPreview] audio.play() 실패:", e));
      } else if (script && window.speechSynthesis) {
        // Web Speech API 폴백 — 브라우저 내장 TTS
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(script);
        utt.lang  = "ko-KR";
        utt.rate  = 0.95;

        // 실시간 단어 타이밍 초기화
        webWordRef.current = [];
        setWebCaptions(null);

        utt.onstart = () => {
          speechStartRef.current = Date.now();
          const tick = () => {
            if (speechStartRef.current !== null) {
              setCurrentMs(Date.now() - speechStartRef.current);
            }
            speechRafRef.current = requestAnimationFrame(tick);
          };
          speechRafRef.current = requestAnimationFrame(tick);
        };

        // onboundary: 단어가 실제로 발음되는 순간마다 발생 → 정확한 타임스탬프 수집
        utt.onboundary = (event) => {
          if (event.name !== "word") return;
          if (speechStartRef.current === null) return;
          const nowMs    = Date.now() - speechStartRef.current;
          const charIdx  = event.charIndex;
          const charLen  = event.charLength ?? (script.slice(charIdx).search(/\s|$/) || 1);
          const wordText = script.slice(charIdx, charIdx + charLen).replace(/\s+$/, "");
          if (!wordText) return;

          // 이전 단어의 endMs 확정
          const words = webWordRef.current;
          if (words.length > 0) words[words.length - 1].endMs = nowMs;

          // 새 단어 추가
          words.push({ text: wordText, startMs: nowMs, endMs: null });

          // 실시간으로 자막 업데이트
          setWebCaptions(words.map((w, i) => ({
            text:    i === 0 ? w.text : ` ${w.text}`,
            startMs: w.startMs,
            endMs:   w.endMs ?? w.startMs + 600,
          })));
        };

        utt.onend = () => {
          cancelAnimationFrame(speechRafRef.current);
          speechRafRef.current   = null;
          speechStartRef.current = null;
          // 마지막 단어 endMs 확정
          const words = webWordRef.current;
          if (words.length > 0 && !words[words.length - 1].endMs) {
            words[words.length - 1].endMs = words[words.length - 1].startMs + 600;
            setWebCaptions(words.map((w, i) => ({
              text:    i === 0 ? w.text : ` ${w.text}`,
              startMs: w.startMs,
              endMs:   w.endMs,
            })));
          }
          setPlaying(false);
          setCurrentMs(0);
        };
        utt.onerror = () => {
          cancelAnimationFrame(speechRafRef.current);
          speechRafRef.current   = null;
          speechStartRef.current = null;
          setPlaying(false);
        };
        window.speechSynthesis.speak(utt);
      }

      if (bgmRef.current) {
        bgmRef.current.currentTime = 0;
        bgmRef.current.play().catch(e => console.error("[BGM] play 실패:", e));
      }
      setPlaying(true);
    }
  }, [playing, script]);

  const handleSeek = useCallback((e) => {
    const ms = Number(e.target.value);
    setCurrentMs(ms);
    if (audioRef.current) audioRef.current.currentTime = ms / 1000;
  }, []);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* 9:16 캔버스 */}
      <div className="relative overflow-hidden rounded-2xl shadow-2xl"
        style={{ width: 270, height: 480, background: "#ffffff", flexShrink: 0 }}>

        <CommunityBg
          bgPreset={bgPreset}
          titleExcerpt={titleExcerpt}
          bodyText={bodyText}
          siteName={siteName}
          headerColor={headerColor}
          bodyBgColor={bodyBgColor}
        />

        {/* 자막 + GIF — 헤더(50) + 제목/메타(~100) 아래 */}
        <div style={{
          position: "absolute", top: 148, left: 0, right: 0, bottom: 0,
          display: "flex", flexDirection: "column", alignItems: "center",
          pointerEvents: "none", padding: "4px 20px 0", gap: 8,
        }}>
          {currentSentence && (
            <p style={{
              fontFamily: fontFamily ?? "'Noto Sans KR', sans-serif",
              fontSize: 13, fontWeight: 700, color: "#111",
              textAlign: "center", margin: 0, lineHeight: 1.5,
              flexShrink: 0,
            }}>
              {currentSentence}
            </p>
          )}

          {/* Klipy GIF — 하단 바와 겹치지 않게 maxHeight 제한 */}
          {gifUrl && (
            <img
              src={gifUrl}
              alt="reaction"
              style={{
                width: 160, borderRadius: 10, boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
                maxHeight: 200, objectFit: "contain",
              }}
            />
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
