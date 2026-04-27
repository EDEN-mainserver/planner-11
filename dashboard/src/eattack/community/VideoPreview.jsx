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

// 녹화 캔버스용 둥근 사각형 (ctx.roundRect 미지원 브라우저 폴백)
function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x,     y + r);
  ctx.arcTo(x,     y,     x + r, y,          r);
  ctx.closePath();
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
// ── SRT 자막 생성 ──
function buildSRT(captions) {
  const WORDS_PER = 3;
  const chunks = [];
  let cur = null, wc = 0;
  for (const cap of captions) {
    if (!cur) { cur = { startMs: cap.startMs, endMs: cap.endMs, text: "" }; chunks.push(cur); wc = 0; }
    cur.text += cap.text;
    cur.endMs = Math.max(cur.endMs, cap.endMs);
    if (cap.text.trim()) wc++;
    if (wc >= WORDS_PER) cur = null;
  }
  const pad2 = n => String(n).padStart(2, "0");
  const pad3 = n => String(n).padStart(3, "0");
  const fmt = ms => {
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000), mils = ms % 1000;
    return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(mils)}`;
  };
  return chunks.map((c, i) => `${i + 1}\n${fmt(c.startMs)} --> ${fmt(c.endMs)}\n${c.text.trim()}`).join("\n\n");
}

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
  const speechStartRef = useRef(null);
  const speechRafRef   = useRef(null);
  const webWordRef     = useRef([]);
  const previewDivRef  = useRef(null);  // 녹화용 div ref
  const currentGifRef  = useRef({ url: null, el: null }); // 녹화 중 GIF 오버레이용
  const [playing, setPlaying]         = useState(false);
  const [currentMs, setCurrentMs]     = useState(0);
  const [webCaptions, setWebCaptions] = useState(null);
  const [recording, setRecording]     = useState(false);
  const [recProgress, setRecProgress] = useState(0);
  const [gifUrl, setGifUrl]           = useState(null);  // gifUrl을 useEffect보다 먼저 선언 (TDZ 방지)

  // 언마운트 시 Web Speech 정리
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      cancelAnimationFrame(speechRafRef.current);
    };
  }, []);

  // audioUrl 바뀌면 webCaptions 초기화
  useEffect(() => { setWebCaptions(null); webWordRef.current = []; }, [audioUrl]);

  // 녹화 중 GIF 오버레이용: gifUrl 변경 시 프록시 경유 로드 (CORS 우회)
  useEffect(() => {
    if (!gifUrl) { currentGifRef.current = { url: null, el: null }; return; }
    if (currentGifRef.current.url === gifUrl) return;
    let cancelled = false;
    // /api/gif-proxy 를 통해 same-origin 으로 받아야 canvas.drawImage() 허용됨
    const el = new Image();
    el.src = `/api/gif-proxy?url=${encodeURIComponent(gifUrl)}`;
    el.onload  = () => { if (!cancelled) currentGifRef.current = { url: gifUrl, el }; };
    el.onerror = () => { if (!cancelled) currentGifRef.current = { url: gifUrl, el: null }; };
    return () => { cancelled = true; };
  }, [gifUrl]);

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
      audio.currentTime = 0; // 다시 재생 가능하도록 리셋
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

  // BGM 설정 (볼륨 30%, 앞 15초 반복)
  useEffect(() => {
    if (!bgmFile) { bgmRef.current = null; return; }
    // encodeURI: 파일명에 한글·이모지·공백이 있어도 올바른 URL로 변환
    const bgm = new Audio(encodeURI(bgmFile));
    bgm.volume = 0.3;
    const onTimeUpdate = () => { if (bgm.currentTime >= 15) bgm.currentTime = 0; };
    bgm.addEventListener("timeupdate", onTimeUpdate);
    bgmRef.current = bgm;
    return () => {
      bgm.removeEventListener("timeupdate", onTimeUpdate);
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
        // API TTS 오디오 재생 (ended 상태면 처음부터 재생)
        if (audio.ended) audio.currentTime = 0;
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

  // ── 오디오 다운로드 ──
  const handleDownloadAudio = useCallback(() => {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = "tts-audio.mp3";
    a.click();
  }, [audioUrl]);

  // ── SRT 자막 다운로드 (Premiere Pro 임포트용) ──
  const handleDownloadSRT = useCallback(() => {
    if (!captions?.length) return;
    const srt = buildSRT(captions);
    const blob = new Blob([srt], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "subtitles.srt";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [captions]);

  // ── 녹화 캔버스 직접 렌더링 (html2canvas 대체 — 위치 정확도 100%) ──
  const drawPreviewFrame = useCallback((ctx, W, H, sentenceText, gifEl) => {
    const bodyDark = isDark(bodyBgColor || "#ffffff");
    const textMain = bodyDark ? "#ffffff" : "#111111";
    const textSub  = bodyDark ? "#aaaaaa" : "#888888";
    const dividerC = bodyDark ? "#444444" : "#222222";

    // ── 배경 ──
    ctx.fillStyle = bodyBgColor || "#ffffff";
    ctx.fillRect(0, 0, W, H);

    // ── 헤더 (CSS 50px → canvas 100px) ──
    ctx.fillStyle = headerColor || "#FFD6C1";
    ctx.fillRect(0, 0, W, 100);

    // 뒤로가기 아이콘
    ctx.save();
    ctx.strokeStyle = "#333"; ctx.lineWidth = 5;
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.beginPath(); ctx.moveTo(52, 38); ctx.lineTo(38, 54); ctx.lineTo(52, 70);
    ctx.stroke(); ctx.restore();

    // 메뉴 아이콘 (3 bars)
    ctx.fillStyle = "#333";
    for (let i = 0; i < 3; i++) ctx.fillRect(W - 56, 36 + i * 16, 36, 4);

    // 로고 박스 — 사이트명 너비 기반으로 정확히 중앙 정렬
    const siteText = siteName || "줍줍썰";
    ctx.font = "bold 26px 'Noto Sans KR', sans-serif";
    const siteTextW = ctx.measureText(siteText).width;
    const dotR = 15, innerGap = 10, logoPadX = 28, logoBoxH = 46, logoRad = 16;
    const logoBoxW = dotR * 2 + innerGap + siteTextW + logoPadX * 2;
    const logoBoxX = (W - logoBoxW) / 2;
    const logoBoxY = (100 - logoBoxH) / 2;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.08)"; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    ctx.fillStyle = "white";
    drawRoundRect(ctx, logoBoxX, logoBoxY, logoBoxW, logoBoxH, logoRad);
    ctx.fill();
    ctx.restore();

    // 로고 점 (검은 원)
    ctx.fillStyle = "#222";
    ctx.beginPath();
    ctx.arc(logoBoxX + logoPadX + dotR, 50, dotR, 0, Math.PI * 2);
    ctx.fill();

    // 사이트명 텍스트
    ctx.fillStyle = "#000";
    ctx.font = "bold 26px 'Noto Sans KR', sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText(siteText, logoBoxX + logoPadX + dotR * 2 + innerGap, 50);

    // ── 본문 (padding: 14px→28px top, 16px→32px 좌우) ──
    const bPadX = 32, bPadTop = 128; // 100 + 28
    const maxW = W - bPadX * 2;

    // 게시글 제목 (15px→30px, lineHeight 1.35, marginBottom 8px→16px)
    ctx.fillStyle = textMain;
    ctx.font = "bold 30px 'Noto Sans KR', sans-serif";
    ctx.textAlign = "left"; ctx.textBaseline = "top";

    const tit = titleExcerpt || "제목 없음";
    let line1 = "", line2 = "";
    for (let i = 0; i < tit.length; i++) {
      if (ctx.measureText(line1 + tit[i]).width <= maxW) { line1 += tit[i]; }
      else { line2 = tit.slice(i); break; }
    }
    if (line2 && ctx.measureText(line2).width > maxW) {
      while (line2.length > 0 && ctx.measureText(line2 + "…").width > maxW) line2 = line2.slice(0, -1);
      line2 += "…";
    }
    const lineH = 41; // 30px * 1.35 ≈ 40.5
    ctx.fillText(line1, bPadX, bPadTop);
    if (line2) ctx.fillText(line2, bPadX, bPadTop + lineH);
    const titEndY = bPadTop + (line2 ? lineH * 2 : lineH);

    // 메타 (10px→20px)
    const presetKey = bgPreset?.key ?? "";
    const views = hashInt(presetKey + "v", 10000, 200000).toLocaleString();
    const hh = String(hashInt(presetKey + "h", 10, 23)).padStart(2, "0");
    const mm = String(hashInt(presetKey + "m", 0, 59)).padStart(2, "0");
    ctx.fillStyle = textSub;
    ctx.font = "20px 'Noto Sans KR', sans-serif";
    ctx.textBaseline = "top";
    ctx.fillText(`ㅇㅇ  |  ${hh}:${mm}  |  조회수 ${views}`, bPadX, titEndY + 16);

    // 구분선 (paddingBottom 10px→20px + border)
    const divY = titEndY + 16 + 20 + 20;
    ctx.strokeStyle = dividerC; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bPadX, divY); ctx.lineTo(W - bPadX, divY); ctx.stroke();

    // ── 동적 자막 (top:148px→296px, padding-top:4px→8px) ──
    const subTop = 304;
    if (sentenceText) {
      ctx.fillStyle = "#111";
      ctx.font = `bold 26px '${fontFamily || "Noto Sans KR"}', sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(sentenceText, W / 2, subTop);
    }

    // GIF (gap 8px→16px, 자막 높이 26px)
    if (gifEl && gifEl.complete && gifEl.naturalWidth > 0) {
      const gifW = 320, gifX = (W - 320) / 2;
      const gifH = Math.min(gifEl.naturalHeight * (gifW / gifEl.naturalWidth), 400);
      const gifY = subTop + (sentenceText ? 26 + 16 : 0);
      try { ctx.drawImage(gifEl, gifX, gifY, gifW, gifH); } catch (_) {}
    }
  }, [bgPreset, titleExcerpt, siteName, headerColor, bodyBgColor, fontFamily]);

  // ── MP4(WebM) 녹화 다운로드 ──
  const handleDownloadMp4 = useCallback(async () => {
    if (recording || !previewDivRef.current) return;
    setRecording(true);
    setRecProgress(0);

    const W = 540, H = 960;

    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // 비디오 스트림
    const videoStream = canvas.captureStream(8);
    const streams = [...videoStream.getVideoTracks()];

    // ── 오디오: createMediaElementSource 방식 ──
    // 이미 로드된 audio 엘리먼트를 AudioContext에 직접 연결 → fetch/decode 불필요
    let recAudioCtx = null;
    try {
      recAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
      await recAudioCtx.resume();
      const recDest = recAudioCtx.createMediaStreamDestination();

      // TTS: 기존 Audio 엘리먼트를 녹화 목적지에 연결
      if (audioRef.current) {
        try {
          const ttsSrc = recAudioCtx.createMediaElementSource(audioRef.current);
          ttsSrc.connect(recDest);
          ttsSrc.connect(recAudioCtx.destination); // 스피커 출력도 유지
        } catch (e) { console.warn("[rec] TTS 소스 연결 실패:", e); }
      }

      // BGM: 기존 BGM 엘리먼트를 녹화 목적지에 연결
      if (bgmRef.current) {
        try {
          const bgmSrc = recAudioCtx.createMediaElementSource(bgmRef.current);
          bgmSrc.connect(recDest);
          bgmSrc.connect(recAudioCtx.destination); // 스피커 출력도 유지
        } catch (e) { console.warn("[rec] BGM 소스 연결 실패:", e); }
      }

      streams.push(...recDest.stream.getAudioTracks());
    } catch (err) {
      console.warn("[rec] AudioContext 설정 실패:", err);
      recAudioCtx?.close(); recAudioCtx = null;
    }

    // 오디오 코덱 명시 (opus 포함) — 미포함 시 audio track이 무시될 수 있음
    const mimeType = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ].find(t => MediaRecorder.isTypeSupported(t)) || "video/webm";

    const chunks = [];
    const recorder = new MediaRecorder(new MediaStream(streams), {
      mimeType,
      videoBitsPerSecond: 3_000_000,
      audioBitsPerSecond: 128_000,
    });
    recorder.ondataavailable = e => e.data.size > 0 && chunks.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "community-video.webm";
      a.click();
      URL.revokeObjectURL(a.href);
      // AudioContext 닫기 → audio 엘리먼트가 기본 출력으로 복귀
      recAudioCtx?.close();
      setRecording(false);
      setRecProgress(0);
    };

    // 폰트 로드 완료 대기 (Noto Sans KR 등)
    await document.fonts.ready;

    // recorder 먼저 시작 → 오디오 재생 시작 (타이밍 보장)
    setCurrentMs(0);
    recorder.start(200);
    const startTs = performance.now();

    if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}); }
    if (bgmRef.current)   { bgmRef.current.currentTime = 0;   bgmRef.current.play().catch(() => {}); }
    setPlaying(true);

    // 동기 루프 — canvas에 직접 그림
    const loop = () => {
      const elapsed = performance.now() - startTs;
      if (elapsed > totalMs + 1000) {
        recorder.stop();
        setPlaying(false);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        if (bgmRef.current)   { bgmRef.current.pause();   bgmRef.current.currentTime = 0; }
        return;
      }
      setRecProgress(Math.min(99, Math.round((elapsed / totalMs) * 100)));

      // 현재 자막 계산
      let found = null;
      for (const s of sentences) {
        if (elapsed >= s.startMs) found = s;
        else break;
      }
      const sentenceText = (found && elapsed <= found.endMs + 500) ? found.text : null;

      drawPreviewFrame(ctx, W, H, sentenceText, currentGifRef.current.el);
      setTimeout(loop, 125);
    };
    loop();
  }, [recording, totalMs, audioUrl, bgmFile, sentences, drawPreviewFrame]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* 9:16 캔버스 */}
      <div ref={previewDivRef} className="relative overflow-hidden rounded-2xl shadow-2xl"
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

      {/* 다운로드 버튼 */}
      <div className="w-full flex flex-col gap-2" style={{ maxWidth: 270 }}>
        {/* MP4 녹화 */}
        <button
          onClick={handleDownloadMp4}
          disabled={recording}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-70"
        >
          {recording ? (
            <>
              <svg className="animate-spin w-3.5 h-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
              녹화 중... {recProgress}%
            </>
          ) : (
            <>
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
              </svg>
              영상 다운로드 (.webm)
            </>
          )}
        </button>

        {/* PR 에셋 (오디오 + SRT) */}
        <div className="flex gap-2">
          <button
            onClick={handleDownloadAudio}
            disabled={!audioUrl}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
            </svg>
            오디오 (.mp3)
          </button>
          <button
            onClick={handleDownloadSRT}
            disabled={!captions?.length}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-40"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>
            </svg>
            자막 PR (.srt)
          </button>
        </div>

        {recording && (
          <p className="text-[10px] text-gray-400 text-center">영상이 처음부터 재생되며 녹화됩니다. 완료 시 자동 다운로드됩니다.</p>
        )}
      </div>
    </div>
  );
}
