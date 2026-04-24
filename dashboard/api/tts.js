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
  const detail = errBody?.detail;
  // { detail: { status, message } }
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    return { status: detail.status ?? "", message: detail.message ?? "" };
  }
  // { detail: "문자열" }
  if (typeof detail === "string") {
    return { status: "", message: detail };
  }
  // { detail: [...] } 배열이거나 없는 경우
  const fallbackMsg = errBody?.message || errBody?.error || "";
  return { status: "", message: String(fallbackMsg) };
}

// ── ElevenLabs 크레딧 에러 여부 판별 ─────────────────────────────────────────
function isCreditError(httpStatus, apiStatus, msg) {
  // apiStatus로 먼저 판별 (HTTP 상태코드 무관)
  if (apiStatus === "quota_exceeded" || apiStatus === "insufficient_credits") return true;
  // 401이지만 quota가 아니면 → 진짜 인증 오류이므로 폴백 안 함
  if (httpStatus === 401) return false;
  if (httpStatus === 402 || httpStatus === 422 || httpStatus === 429) {
    // 422는 다양한 에러를 포함하므로 메시지도 확인
    if (httpStatus === 422) {
      const m = (msg ?? "").toLowerCase();
      return m.includes("quota") || m.includes("credit") || m.includes("insufficient") || m.includes("character");
    }
    return true;
  }
  const m = (msg ?? "").toLowerCase();
  return m.includes("quota") || m.includes("credit") || m.includes("insufficient") || m.includes("character");
}

// ── PCM(L16) raw 오디오 → WAV 변환 ──────────────────────────────────────────
// Gemini TTS는 audio/L16;rate=24000 형태의 raw PCM을 반환하므로 WAV 헤더 추가 필요
function pcmToWavBase64(pcmBase64, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const pcm      = Buffer.from(pcmBase64, "base64");
  const dataSize = pcm.length;
  const wav      = Buffer.alloc(44 + dataSize);

  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);                                          // fmt chunk 크기
  wav.writeUInt16LE(1, 20);                                           // PCM = 1
  wav.writeUInt16LE(numChannels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // byte rate
  wav.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);           // block align
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  pcm.copy(wav, 44);

  return wav.toString("base64");
}

// ── Google AI Studio (Gemini) TTS 폴백 ───────────────────────────────────────
async function googleTTS(text, geminiKey) {
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
  console.log("[Google TTS] 응답 mimeType:", data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.mimeType);

  const part = data?.candidates?.[0]?.content?.parts?.[0];
  if (!part?.inlineData?.data) {
    throw new Error("Google TTS: 오디오 데이터를 받지 못했습니다.");
  }

  const rawMime   = part.inlineData.mimeType ?? "";
  const isPcm     = rawMime.includes("L16") || rawMime.includes("pcm");
  const rateMatch = rawMime.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;

  // raw PCM → WAV 변환 (브라우저 재생 가능하도록)
  const audioBase64 = isPcm
    ? pcmToWavBase64(part.inlineData.data, sampleRate)
    : part.inlineData.data;

  return {
    audioBase64,
    mimeType: "audio/wav",
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

    // 에러 파싱 — 실제 응답 전체 로깅
    const errBody  = await elevenRes.json().catch(() => ({}));
    console.log("[TTS] ElevenLabs 오류 응답:", JSON.stringify({ httpStatus: elevenRes.status, body: errBody }));

    const { status: apiStatus, message: apiMsg } = parseElevenLabsError(errBody);
    const displayMsg = apiMsg || `ElevenLabs 오류 (${elevenRes.status})`;

    if (!isCreditError(elevenRes.status, apiStatus, apiMsg)) {
      return res.status(elevenRes.status).json({ error: displayMsg });
    }

    // 크레딧 소진 → Google TTS 폴백 시도
    console.log("[TTS] 크레딧 소진 감지 → Google AI Studio 폴백 (HTTP:", elevenRes.status, "/ apiStatus:", apiStatus, "/ msg:", apiMsg, ")");

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
