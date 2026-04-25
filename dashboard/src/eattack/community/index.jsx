// 커뮤니티 영상 자동화 탭
// 썰 스크립트 → 배경 영상 + TikTok 자막 → Remotion 숏폼 영상 자동 생성
import { useState, useCallback, useEffect } from "react";
import CaptionPreview from "./CaptionPreview";
import VideoPreview from "./VideoPreview";
import TopicPicker from "../TopicPicker";
import {
  BG_PRESETS,
  BGM_LIST,
  FONT_OPTIONS,
  EXAMPLE_SCRIPTS,
} from "./constants";
import { generateCaptionsFromText, estimateSeconds } from "./utils";

// 실제 오디오 길이에 비례해서 단어별 자막 타이밍 분배
function buildProportionalCaptions(text, totalDurationMs) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return { captions: [], totalMs: totalDurationMs };

  const totalChars   = words.reduce((sum, w) => sum + w.length, 0);
  const introMs      = 150;                          // 음성 시작 전 여유
  const usableMs     = totalDurationMs - introMs - 100; // 뒤 100ms 여유
  const captions     = [];
  let currentMs      = introMs;

  for (let i = 0; i < words.length; i++) {
    const word      = words[i];
    const duration  = Math.max(150, Math.round((word.length / totalChars) * usableMs));
    captions.push({
      text:        i === 0 ? word : ` ${word}`,
      startMs:     currentMs,
      endMs:       currentMs + duration,
      timestampMs: currentMs,
      confidence:  1,
    });
    currentMs += duration + 30; // 단어 간 30ms 간격
  }

  return { captions, totalMs: totalDurationMs };
}

const STEPS = [
  { num: 1, label: "스크립트" },
  { num: 2, label: "배경 영상" },
  { num: 3, label: "자막 스타일" },
  { num: 4, label: "AI 보이스" },
];

export default function CommunityTab({ nasState, onGoToNas }) {
  const [step, setStep]                     = useState(1);
  const [title, setTitle]                   = useState("");
  const [script, setScript]                 = useState("");
  const [selectedBg, setSelectedBg]         = useState("minecraft");
  const [fontFamily, setFontFamily]         = useState("Noto Sans KR");
  const [voices, setVoices]                 = useState([]);
  const [voicesLoading, setVoicesLoading]   = useState(true);
  const [voicesError, setVoicesError]       = useState("");
  const [voiceId, setVoiceId]               = useState("");
  const [bgmKey, setBgmKey]                 = useState("none");
  const [siteName, setSiteName]             = useState("줍줍썰");
  const [headerColor, setHeaderColor]       = useState("#FFD6C1");
  const [bodyBgColor, setBodyBgColor]       = useState("#ffffff");
  const [showTopicPicker, setShowTopicPicker] = useState(false);
  const [generating, setGenerating]         = useState(false);
  const [generated, setGenerated]           = useState(null);
  const [ttsError, setTtsError]             = useState("");
  const [ttsInfo, setTtsInfo]               = useState("");

  // 컴포넌트 마운트 시 보이스 목록 로드
  useEffect(() => {
    fetch("/api/voices")
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        const list = data.voices ?? [];
        setVoices(list);
        if (list.length > 0) setVoiceId(list[0].id);
      })
      .catch(e => setVoicesError(e.message))
      .finally(() => setVoicesLoading(false));
  }, []);

  const scriptLen  = script.trim().length;
  const wordCount  = script.trim().split(/\s+/).filter(Boolean).length;
  const estSeconds = estimateSeconds(script);
  const bgPreset   = BG_PRESETS.find(b => b.key === selectedBg);

  const handleGenerate = useCallback(async () => {
    if (!script.trim()) return;
    setGenerating(true);
    setGenerated(null);
    setTtsError("");
    setTtsInfo("");

    let captions = [];
    let totalMs  = 0;
    let audioUrl = null;
    let ttsProvider = null;

    // 백엔드 TTS 프록시 호출
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: script, voiceId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `TTS 오류 (${res.status})`);
      }

      const { audioBase64, captions: wordTimings, provider, mimeType, durationMs: audioDurationMs } = await res.json();
      ttsProvider = provider;

      // base64 → Blob URL
      const binary = atob(audioBase64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const mime   = mimeType || "audio/mpeg";
      audioUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));

      if (wordTimings && wordTimings.length > 0) {
        // ElevenLabs: 정확한 단어 타이밍 사용
        captions = wordTimings.map((w, i) => ({
          text:        i === 0 ? w.text : ` ${w.text}`,
          startMs:     w.startMs,
          endMs:       w.endMs,
          timestampMs: w.startMs,
          confidence:  1,
        }));
        totalMs = (captions[captions.length - 1]?.endMs ?? 0) + 300;
      } else {
        // Whisper 없이 폴백: 글자수 비례 분배
        const fallback = generateCaptionsFromText(script);
        captions = fallback.captions;
        totalMs  = fallback.totalMs;
      }

      if (provider === "openai+whisper") {
        setTtsInfo("ElevenLabs 크레딧 소진 → OpenAI TTS로 자동 전환됐습니다.");
      } else if (provider === "google+whisper") {
        setTtsInfo("ElevenLabs 크레딧 소진 → Google AI Studio TTS로 자동 전환됐습니다.");
      }

    } catch (e) {
      // TTS 전체 실패 → 브라우저 Web Speech API로 재생 (audioUrl=null)
      const fallback = generateCaptionsFromText(script);
      captions = fallback.captions;
      totalMs  = fallback.totalMs;
      setTtsInfo("API TTS 크레딧 소진 → 브라우저 내장 음성으로 대체됩니다. (재생 버튼 클릭 시 자동 실행)");
    }

    setGenerated({
      captions,
      totalMs,
      wordCount,
      estSeconds,
      audioUrl,
      bgPreset: BG_PRESETS.find(b => b.key === selectedBg),
      title,
      siteName,
      headerColor,
      bodyBgColor,
      gifQuery: title.trim() || script.trim().slice(0, 40),
      bgmFile: BGM_LIST.find(b => b.key === bgmKey)?.file ?? null,
    });
    setGenerating(false);
  }, [script, selectedBg, fontFamily, wordCount, estSeconds, voiceId, title, bgmKey, siteName, headerColor, bodyBgColor]);

  const handleDownloadCaptions = useCallback(() => {
    if (!generated) return;
    const blob = new Blob([JSON.stringify(generated.captions, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "captions.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [generated]);

  return (
    <div>
      <div className="p-6 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <h4 className="text-base font-bold text-gray-800">커뮤니티 썰 영상 메이커</h4>
            <p className="text-xs text-gray-400">텍스트만 입력하면 숏폼 영상이 자동 완성됩니다</p>
          </div>
        </div>

        {/* 스텝 네비게이션 */}
        <div className="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => setStep(s.num)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex-1 justify-center ${
                  step === s.num
                    ? "bg-indigo-600 text-white shadow"
                    : step > s.num
                    ? "bg-indigo-50 text-indigo-600"
                    : "bg-gray-100 text-gray-400"
                }`}
              >
                <span className={`w-4 h-4 rounded-full text-[9px] flex items-center justify-center font-bold ${
                  step === s.num ? "bg-white text-indigo-600" :
                  step > s.num  ? "bg-indigo-200 text-indigo-700" : "bg-gray-300 text-gray-500"
                }`}>{s.num}</span>
                {s.label}
              </button>
              {i < STEPS.length - 1 && (
                <div className={`w-3 h-0.5 rounded flex-shrink-0 ${step > s.num ? "bg-indigo-300" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* ── STEP 1: 썰 스크립트 입력 ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-sm font-semibold text-gray-700 block mb-2">게시물 제목</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  maxLength={60}
                  placeholder="예: 회사 팀장이 편의점에서 한 짓"
                  className="w-full px-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 transition-colors font-medium"
                />
                <p className="text-[11px] text-gray-400 mt-1 text-right">{title.length}/60자</p>
              </div>
              <div className="w-28 flex-shrink-0">
                <label className="text-sm font-semibold text-gray-700 block mb-2">사이트명</label>
                <input
                  value={siteName}
                  onChange={e => setSiteName(e.target.value)}
                  maxLength={10}
                  placeholder="줍줍썰"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 transition-colors font-medium"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-semibold text-gray-700">썰 스크립트</label>
                  <button
                    onClick={() => setShowTopicPicker(true)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold border border-violet-200 text-violet-600 bg-violet-50 hover:bg-violet-100 transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    인기글에서 가져오기
                  </button>
                </div>
                <span className={`text-xs ${scriptLen > 800 ? "text-red-500" : scriptLen > 500 ? "text-orange-400" : "text-gray-400"}`}>
                  {scriptLen}자 · 약 {estSeconds}초
                </span>
              </div>
              {showTopicPicker && (
                <TopicPicker
                  onSelect={v => {
                    if (v && typeof v === "object") {
                      // 커뮤니티 썰 탭: 제목 + 스크립트 동시 입력
                      setTitle(v.title || "");
                      setScript(v.text  || "");
                    } else {
                      setTitle(v);
                    }
                  }}
                  onClose={() => setShowTopicPicker(false)}
                />
              )}
              <textarea
                value={script}
                onChange={e => setScript(e.target.value)}
                maxLength={1000}
                rows={10}
                placeholder={"커뮤니티에서 가져온 썰을 그대로 붙여넣으세요.\n\n예시:\n아 진짜 오늘 있었던 일 들어봐\n회사 점심시간에 편의점 갔는데\n거기서 진짜 말도 안 되는 상황이 생겼어\n..."}
                className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 transition-colors resize-none leading-relaxed font-medium"
                style={{ lineHeight: 1.8 }}
              />
              {scriptLen > 0 && (
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                  <span>{wordCount} 단어</span>
                  <span>예상 영상 길이: <strong className="text-indigo-600">{estSeconds}~{Math.round(estSeconds * 1.3)}초</strong></span>
                </div>
              )}
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-2 font-medium">예시 썰로 시작하기</p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_SCRIPTS.map(ex => (
                  <button
                    key={ex.label}
                    onClick={() => setScript(ex.text)}
                    className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={scriptLen < 10}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              다음: 배경 영상 선택
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
              </svg>
            </button>
          </div>
        )}

        {/* ── STEP 2: 색상 선택 ── */}
        {step === 2 && (
          <div className="space-y-6">

            {/* 미니 프리뷰 */}
            <div className="flex justify-center">
              <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-100" style={{ width: 120, height: 214, flexShrink: 0 }}>
                <div style={{ height: 22, background: headerColor, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 8, fontWeight: 700, color: "#000", background: "white", borderRadius: 4, padding: "1px 6px" }}>{siteName || "줍줍썰"}</span>
                </div>
                <div style={{ flex: 1, background: bodyBgColor, padding: "6px 8px" }}>
                  <div style={{ height: 7, background: "#eee", borderRadius: 3, marginBottom: 4, width: "80%" }} />
                  <div style={{ height: 5, background: "#eee", borderRadius: 3, marginBottom: 4, width: "60%" }} />
                  <div style={{ height: 1, background: "#222", margin: "5px 0" }} />
                  <div style={{ height: 5, background: "#f0f0f0", borderRadius: 3, width: "90%" }} />
                </div>
              </div>
            </div>

            {/* 헤더 색상 */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">헤더 색상</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { label: "살구", color: "#FFD6C1" },
                  { label: "하늘", color: "#C1DEFF" },
                  { label: "민트", color: "#C1FFE8" },
                  { label: "라벤더", color: "#DCC1FF" },
                  { label: "노랑", color: "#FFF5C1" },
                  { label: "핑크", color: "#FFC1E3" },
                  { label: "연두", color: "#D4FFC1" },
                  { label: "다크", color: "#2D2D2D" },
                ].map(({ label, color }) => (
                  <button
                    key={color}
                    onClick={() => setHeaderColor(color)}
                    title={label}
                    className="flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-9 h-9 rounded-xl border-2 transition-all shadow-sm"
                      style={{
                        background: color,
                        borderColor: headerColor === color ? "#6366f1" : "transparent",
                        boxShadow: headerColor === color ? "0 0 0 2px #6366f1" : undefined,
                      }}
                    />
                    <span className="text-[9px] text-gray-400">{label}</span>
                  </button>
                ))}
                {/* 커스텀 컬러피커 */}
                <label className="flex flex-col items-center gap-1 cursor-pointer">
                  <div className="w-9 h-9 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative hover:border-indigo-400 transition-colors">
                    <div className="w-full h-full" style={{ background: headerColor }} />
                    <input
                      type="color"
                      value={headerColor}
                      onChange={e => setHeaderColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                  <span className="text-[9px] text-gray-400">직접입력</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">HEX</span>
                <input
                  type="text"
                  value={headerColor}
                  onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setHeaderColor(e.target.value); }}
                  className="w-28 px-2 py-1 text-xs border border-gray-200 rounded-lg font-mono focus:outline-none focus:border-indigo-400"
                />
                <div className="w-5 h-5 rounded border border-gray-200" style={{ background: headerColor }} />
              </div>
            </div>

            {/* 본문 배경색 */}
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-3">본문 배경색</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {[
                  { label: "화이트", color: "#ffffff" },
                  { label: "아이보리", color: "#FFFDF5" },
                  { label: "연회색", color: "#F5F5F5" },
                  { label: "연파랑", color: "#F0F5FF" },
                  { label: "연핑크", color: "#FFF0F5" },
                  { label: "연노랑", color: "#FFFBF0" },
                  { label: "다크", color: "#1a1a1a" },
                  { label: "네이비", color: "#0f172a" },
                ].map(({ label, color }) => (
                  <button
                    key={color}
                    onClick={() => setBodyBgColor(color)}
                    title={label}
                    className="flex flex-col items-center gap-1"
                  >
                    <div
                      className="w-9 h-9 rounded-xl border-2 transition-all shadow-sm"
                      style={{
                        background: color,
                        borderColor: bodyBgColor === color ? "#6366f1" : "#e5e7eb",
                        boxShadow: bodyBgColor === color ? "0 0 0 2px #6366f1" : undefined,
                      }}
                    />
                    <span className="text-[9px] text-gray-400">{label}</span>
                  </button>
                ))}
                <label className="flex flex-col items-center gap-1 cursor-pointer">
                  <div className="w-9 h-9 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden relative hover:border-indigo-400 transition-colors">
                    <div className="w-full h-full" style={{ background: bodyBgColor }} />
                    <input
                      type="color"
                      value={bodyBgColor}
                      onChange={e => setBodyBgColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                  </div>
                  <span className="text-[9px] text-gray-400">직접입력</span>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">HEX</span>
                <input
                  type="text"
                  value={bodyBgColor}
                  onChange={e => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setBodyBgColor(e.target.value); }}
                  className="w-28 px-2 py-1 text-xs border border-gray-200 rounded-lg font-mono focus:outline-none focus:border-indigo-400"
                />
                <div className="w-5 h-5 rounded border border-gray-200" style={{ background: bodyBgColor }} />
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                이전
              </button>
              <button onClick={() => setStep(3)} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
                다음: 자막 스타일
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: 자막 스타일 ── */}
        {step === 3 && (
          <div className="space-y-5">
            <p className="text-sm font-semibold text-gray-700">자막 스타일 설정</p>

            <div className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-[120px]">
                <CaptionPreview
                  script={script || "지금 말하고 있는 자막 스타일 미리보기입니다"}
                  fontFamily={fontFamily}
                />
              </div>
              <div className="flex-1 space-y-4">
                {/* 폰트 선택 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">폰트</label>
                  <div className="space-y-1.5">
                    {FONT_OPTIONS.map(f => (
                      <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="font"
                          value={f.key}
                          checked={fontFamily === f.key}
                          onChange={() => setFontFamily(f.key)}
                          className="accent-indigo-600"
                        />
                        <span className="text-xs text-gray-700">{f.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

              </div>
            </div>

            {/* BGM 선택 */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-2">배경 음악 (BGM)</label>
              <div className="grid grid-cols-2 gap-1.5">
                {BGM_LIST.map(b => (
                  <button
                    key={b.key}
                    onClick={() => setBgmKey(b.key)}
                    className={`px-3 py-2 rounded-lg border text-left transition-colors ${
                      bgmKey === b.key
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <p className="text-xs font-semibold truncate">{b.label}</p>
                    {b.mood && <p className="text-[10px] text-gray-400">{b.mood}</p>}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                이전
              </button>
              <button onClick={() => setStep(4)} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors">
                다음: AI 보이스
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: AI 보이스 & 생성 ── */}
        {step === 4 && (
          <div className="space-y-5">
            <p className="text-sm font-semibold text-gray-700">AI 보이스 설정</p>

            <div className="rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0 text-white text-xs font-bold">11</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-gray-800">ElevenLabs TTS</p>
                  <p className="text-xs text-gray-500 mt-0.5">가장 자연스러운 한국어 AI 목소리 제공</p>
                </div>
                <span className="px-2 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-700">연결됨 ✓</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">
                  보이스 선택 {!voicesLoading && <span className="text-gray-400 font-normal">({voices.length}개)</span>}
                </label>
                {voicesLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    보이스 목록 불러오는 중…
                  </div>
                ) : voicesError ? (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                    보이스 로딩 실패: {voicesError}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                    {voices.map(v => (
                      <button
                        key={v.id}
                        onClick={() => setVoiceId(v.id)}
                        className={`text-left p-2.5 rounded-lg border transition-all ${
                          voiceId === v.id ? "border-indigo-400 bg-indigo-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <p className={`text-xs font-semibold truncate ${voiceId === v.id ? "text-indigo-700" : "text-gray-800"}`}>{v.name}</p>
                        <p className="text-[10px] text-gray-400 truncate">{v.desc}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {ttsInfo && (
                <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
                  ℹ️ {ttsInfo}
                </div>
              )}
              {ttsError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                  음성 생성 실패: {ttsError} · 자막만으로 계속합니다.
                </div>
              )}
            </div>

            {/* 요약 카드 */}
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2.5">
              <p className="text-xs font-bold text-gray-600">영상 생성 요약</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <p className="text-gray-400">스크립트</p>
                  <p className="font-semibold text-gray-800 truncate">{wordCount} 단어 · ~{estSeconds}초</p>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <p className="text-gray-400">배경 영상</p>
                  <p className="font-semibold text-gray-800">{bgPreset?.emoji} {bgPreset?.label}</p>
                </div>
                <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                  <p className="text-gray-400">AI 보이스</p>
                  <p className="font-semibold text-gray-800">ElevenLabs · {voices.find(v => v.id === voiceId)?.name ?? voiceId}</p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep(3)} className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                이전
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || scriptLen < 10}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-bold hover:from-indigo-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 shadow-md"
              >
                {generating ? (
                  <>
                    <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    영상 생성 중…
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    영상 생성 시작
                  </>
                )}
              </button>
            </div>

            {/* 생성 완료 결과 — 인앱 영상 프리뷰 */}
            {generated && (
              <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m20 6-11 11-5-5"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-800">영상 생성 완료!</p>
                    <p className="text-xs text-gray-400">자막 {generated.captions.length}개 · 예상 {generated.estSeconds}초</p>
                  </div>
                </div>

                <VideoPreview
                  bgPreset={generated.bgPreset}
                  title={generated.title}
                  siteName={generated.siteName}
                  headerColor={generated.headerColor}
                  bodyBgColor={generated.bodyBgColor}
                  script={script}
                  audioUrl={generated.audioUrl}
                  captions={generated.captions}
                  fontFamily={fontFamily}
                  totalMs={generated.totalMs}
                  gifQuery={generated.gifQuery}
                  bgmFile={generated.bgmFile}
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleDownloadCaptions}
                    className="flex-1 py-2 rounded-lg bg-white border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
                    </svg>
                    captions.json
                  </button>
                  <button
                    onClick={() => { setGenerated(null); setStep(1); setTitle(""); setScript(""); }}
                    className="flex-1 py-2 rounded-lg bg-indigo-600 text-xs font-medium text-white hover:bg-indigo-700 transition-colors"
                  >
                    새 영상 만들기
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
