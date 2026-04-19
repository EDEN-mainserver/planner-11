// 커뮤니티 영상 자동화 탭
// 썰 스크립트 → 배경 영상 + TikTok 자막 → Remotion 숏폼 영상 자동 생성
import { useState, useCallback, useEffect } from "react";
import CaptionPreview from "./CaptionPreview";
import VideoPreview from "./VideoPreview";
import {
  BG_PRESETS,
  FONT_OPTIONS,
  HIGHLIGHT_COLORS,
  EXAMPLE_SCRIPTS,
} from "./constants";
import { generateCaptionsFromText, estimateSeconds } from "./utils";

const STEPS = [
  { num: 1, label: "스크립트" },
  { num: 2, label: "배경 영상" },
  { num: 3, label: "자막 스타일" },
  { num: 4, label: "AI 보이스" },
];

export default function CommunityTab({ nasState, onGoToNas }) {
  const [step, setStep]                     = useState(1);
  const [script, setScript]                 = useState("");
  const [selectedBg, setSelectedBg]         = useState("minecraft");
  const [highlightColor, setHighlightColor] = useState("#FFE600");
  const [fontFamily, setFontFamily]         = useState("Noto Sans KR");
  const [captionPos, setCaptionPos]         = useState("center");
  const [voices, setVoices]                 = useState([]);
  const [voicesLoading, setVoicesLoading]   = useState(true);
  const [voiceId, setVoiceId]               = useState("");
  const [generating, setGenerating]         = useState(false);
  const [generated, setGenerated]           = useState(null);
  const [ttsError, setTtsError]             = useState("");

  // 컴포넌트 마운트 시 보이스 목록 로드
  useEffect(() => {
    fetch("/api/voices")
      .then(r => r.json())
      .then(data => {
        const list = data.voices ?? [];
        setVoices(list);
        if (list.length > 0) setVoiceId(list[0].id);
      })
      .catch(() => {})
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

    let captions = [];
    let totalMs  = 0;
    let audioUrl = null;

    // 백엔드 TTS 프록시 호출 — with-timestamps로 정확한 단어 타이밍 수신
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

      const { audioBase64, captions: wordTimings } = await res.json();

      // base64 → Blob URL
      const binary = atob(audioBase64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      audioUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));

      // ElevenLabs가 반환한 정확한 단어 타이밍 사용
      captions = wordTimings.map((w, i) => ({
        text:        i === 0 ? w.text : ` ${w.text}`,
        startMs:     w.startMs,
        endMs:       w.endMs,
        timestampMs: w.startMs,
        confidence:  1,
      }));
      totalMs = (captions[captions.length - 1]?.endMs ?? 0) + 300;

    } catch (e) {
      setTtsError(e.message);
      // TTS 실패 시 추정 자막 폴백
      const fallback = generateCaptionsFromText(script);
      captions = fallback.captions;
      totalMs  = fallback.totalMs;
    }

    setGenerated({
      captions,
      totalMs,
      wordCount,
      estSeconds,
      audioUrl,
      backgroundVideoUrl: BG_PRESETS.find(b => b.key === selectedBg)?.videoUrl ?? "",
    });
    setGenerating(false);
  }, [script, selectedBg, highlightColor, fontFamily, captionPos, wordCount, estSeconds, voiceId]);

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
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-700">썰 스크립트</label>
                <span className={`text-xs ${scriptLen > 800 ? "text-red-500" : "text-gray-400"}`}>
                  {scriptLen} / 1000자 · 약 {estSeconds}초 영상
                </span>
              </div>
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

        {/* ── STEP 2: 배경 영상 선택 ── */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">배경 영상 선택</p>
              <p className="text-xs text-gray-400 mb-4">썰 영상에 어울리는 배경을 고르세요. 저작권 무료 영상입니다.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BG_PRESETS.map(bg => (
                  <button
                    key={bg.key}
                    onClick={() => setSelectedBg(bg.key)}
                    className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                      selectedBg === bg.key
                        ? "border-indigo-400 bg-indigo-50 shadow-md"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${bg.color} flex items-center justify-center mb-2 text-lg shadow-sm`}>
                      {bg.emoji}
                    </div>
                    <p className={`text-xs font-bold ${selectedBg === bg.key ? "text-indigo-700" : "text-gray-800"}`}>
                      {bg.label}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{bg.desc}</p>
                    <span className="mt-1.5 inline-block px-1.5 py-0.5 rounded-full text-[9px] bg-gray-100 text-gray-500">{bg.category}</span>
                    {selectedBg === bg.key && (
                      <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m20 6-11 11-5-5"/>
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
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
                  highlightColor={highlightColor}
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

                {/* 하이라이트 색상 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">하이라이트 색상</label>
                  <div className="flex gap-2 flex-wrap">
                    {HIGHLIGHT_COLORS.map(c => (
                      <button
                        key={c.key}
                        onClick={() => setHighlightColor(c.key)}
                        title={c.label}
                        className={`w-7 h-7 rounded-full border-2 transition-all ${highlightColor === c.key ? "border-gray-700 scale-110" : "border-transparent"}`}
                        style={{ background: c.key }}
                      />
                    ))}
                  </div>
                </div>

                {/* 자막 위치 */}
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">자막 위치</label>
                  <div className="flex gap-2">
                    {[{ k: "center", l: "중앙" }, { k: "bottom", l: "하단" }].map(p => (
                      <button
                        key={p.k}
                        onClick={() => setCaptionPos(p.k)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                          captionPos === p.k ? "border-indigo-400 bg-indigo-50 text-indigo-700 font-semibold" : "border-gray-200 text-gray-600"
                        }`}
                      >
                        {p.l}
                      </button>
                    ))}
                  </div>
                </div>
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
                  <p className="text-gray-400">하이라이트</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full" style={{ background: highlightColor }} />
                    <span className="font-semibold text-gray-800">{HIGHLIGHT_COLORS.find(c => c.key === highlightColor)?.label}</span>
                  </div>
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
                  backgroundVideoUrl={generated.backgroundVideoUrl}
                  audioUrl={generated.audioUrl}
                  captions={generated.captions}
                  highlightColor={highlightColor}
                  fontFamily={fontFamily}
                  captionPos={captionPos}
                  totalMs={generated.totalMs}
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
                    onClick={() => { setGenerated(null); setStep(1); setScript(""); }}
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
