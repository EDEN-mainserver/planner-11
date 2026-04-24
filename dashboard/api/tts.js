/**
 * TTS 프록시 — Vercel Serverless Function
 * POST /api/tts  Body: { text, voiceId, voiceSettings? }
 *
 * 1차: ElevenLabs with-timestamps → 오디오 + 단어별 정확한 타이밍 반환
 * 2차: 크레딧 소진 시 Google AI Studio(Gemini) TTS로 자동 폴백
 *      → 오디오 반환, captions: null (프론트에서 추정 타이밍 사용)
 */

export const config = { maxDuration: 30 };

// ── ElevenLabs 문자 정렬 데이터 → 단어별 타이밍 배열 ──────────────────────────
function parseWordTimings(alignment) {
  const chars      = alignment.characters ?? [];
  const startTimes = alignment.character_start_times_seconds ?? [];
  const endTimes   = alignment.character_end_times_seconds ?? [];

  const words = [];
  let wordChars = "";
  let wordStart = null;
  let wordEnd   = null;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === " " || ch === "\n") {
      if (wordChars.trim()) {
        words.push({
          text:    wordChars,
          startMs: Math.round(wordStart * 1000),
          endMs:   Math.round(wordEnd   * 1000),
        });
      }
      wordChars = "";
      wordStart = null;
      wordEnd   = null;
    } else {
      if (wordStart === null) wordStart = startTimes[i];
      wordEnd   = endTimes[i];
      wordChars += ch;
    }
  }
  if (wordChars.trim()) {
    words.push({
      text:    wordChars,
      startMs: Math.round(wordStart * 1000),
      endMs:   Math.round(wordEnd   * 1000),
    });
  }
  return words;
}

// ── ElevenLabs 에러 응답에서 메시지·상태 추출 ────────────────────────────────
function parseElevenLabsError(errBody) {
  // detail이 객체인 경우: { detail: { status: "quota_exceeded", message: "..." } }
  // detail이 문자열인 경우: { detail: "Invalid API key" }
  const detail = errBody?.detail;
  if (detail && typeof detail === "object") {
    return { status: detail.status ?? "", message: detail.message ?? "" };
  }
  if (typeof detail === "string") {
    return { status: "", message: detail };
  }
  return { status: "", message: "" };
}

// ── ElevenLabs 크레딧 에러 여부 판별 ─────────────────────────────────────────
function isCreditError(httpStatus, apiStatus, msg) {
  if (httpStatus === 401) return false; // 인증 오류는 폴백 안 함
  if (apiStatus === "quota_exceeded" || apiStatus === "insufficient_credits") return true;
  if (httpStatus === 402 || httpStatus === 429) return true;
  const m = (msg ?? "").toLowerCase();
  return m.includes("quota") || m.includes("credit") || m.includes("insufficient");
}

// ── Google AI Studio (Gemini) TTS 폴백 ───────────────────────────────────────
async function googleTTS(text, geminiKey) {
  // Gemini 2.5 Flash TTS 모델 사용
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${geminiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Aoede" },
          },
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Google TTS 오류 (${res.status})`);
  }

  const data = await res.json();
  const part = data?.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) {
    throw new Error("Google TTS: 오디오 데이터를 받지 못했습니다.");
  }

  return {
    audioBase64: part.inlineData.data,
    mimeType: part.inlineData.mimeType ?? "audio/wav",
  };
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (!elevenKey) {
    return res.status(500).json({ error: "ELEVENLABS_API_KEY 환경변수가 설정되지 않았습니다." });
  }

  const { text, voiceId, voiceSettings } = req.body;
  if (!text || !voiceId) {
    return res.status(400).json({ error: "text, voiceId는 필수입니다." });
  }

  // ── 1차: ElevenLabs ──────────────────────────────────────────────────────
  try {
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "xi-api-key":   elevenKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id:       "eleven_multilingual_v2",
          voice_settings: voiceSettings ?? { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (elevenRes.ok) {
      const data     = await elevenRes.json();
      const captions = parseWordTimings(data.alignment ?? {});
      return res.status(200).json({
        audioBase64: data.audio_base64,
        captions,
        provider: "elevenlabs",
      });
    }

    // 에러 파싱
    const errBody  = await elevenRes.json().catch(() => ({}));
    const { status: apiStatus, message: apiMsg } = parseElevenLabsError(errBody);
    const displayMsg = apiMsg || `ElevenLabs 오류 (${elevenRes.status})`;

    if (!isCreditError(elevenRes.status, apiStatus, apiMsg)) {
      return res.status(elevenRes.status).json({ error: displayMsg });
    }

    // 크레딧 소진 → Google TTS 폴백 시도
    console.log("[TTS] ElevenLabs 크레딧 소진 감지 (HTTP:", elevenRes.status, "/ status:", apiStatus, "), Google AI Studio로 폴백");

  } catch (e) {
    // 네트워크 오류 등 — Google TTS 폴백 시도
    console.log("[TTS] ElevenLabs 호출 실패, Google AI Studio로 폴백:", e.message);
  }

  // ── 2차: Google AI Studio TTS ────────────────────────────────────────────
  if (!geminiKey) {
    return res.status(402).json({
      error: "ElevenLabs 크레딧이 소진됐고 GEMINI_API_KEY도 설정되지 않았습니다. Vercel 환경변수를 확인해주세요.",
    });
  }

  try {
    const { audioBase64, mimeType } = await googleTTS(text, geminiKey);
    return res.status(200).json({
      audioBase64,
      mimeType,
      captions: null,   // 타이밍 없음 → 프론트에서 추정 타이밍 사용
      provider: "google",
    });
  } catch (e) {
    return res.status(500).json({ error: `Google TTS 폴백도 실패했습니다: ${e.message}` });
  }
}
