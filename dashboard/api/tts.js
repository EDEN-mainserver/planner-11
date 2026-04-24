/**
 * TTS 프록시 — Vercel Serverless Function
 * POST /api/tts  Body: { text, voiceId, voiceSettings? }
 *
 * 1차: ElevenLabs with-timestamps → 오디오 + 단어별 정확한 타이밍 반환
 * 2차: 크레딧 소진 시 Google TTS + Whisper STT 파이프라인으로 폴백
 *      Google TTS → WAV 오디오 생성 → Whisper로 단어별 타임스탬프 추출
 */

export const config = { maxDuration: 60 }; // Google TTS + Whisper 처리 시간 확보

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

// ── ElevenLabs 에러 파싱 ─────────────────────────────────────────────────────
function parseElevenLabsError(errBody) {
  const detail = errBody?.detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    return { status: detail.status ?? "", message: detail.message ?? "" };
  }
  if (typeof detail === "string") {
    return { status: "", message: detail };
  }
  return { status: "", message: String(errBody?.message || errBody?.error || "") };
}

function isCreditError(httpStatus, apiStatus, msg) {
  if (apiStatus === "quota_exceeded" || apiStatus === "insufficient_credits") return true;
  if (httpStatus === 401) return false;
  if (httpStatus === 402 || httpStatus === 429) return true;
  if (httpStatus === 422) {
    const m = (msg ?? "").toLowerCase();
    return m.includes("quota") || m.includes("credit") || m.includes("insufficient") || m.includes("character");
  }
  const m = (msg ?? "").toLowerCase();
  return m.includes("quota") || m.includes("credit") || m.includes("insufficient");
}

// ── PCM(L16) → WAV 변환 ──────────────────────────────────────────────────────
function pcmToWavBuffer(pcmBase64, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const pcm      = Buffer.from(pcmBase64, "base64");
  const dataSize = pcm.length;
  const wav      = Buffer.alloc(44 + dataSize);

  wav.write("RIFF", 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(numChannels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  wav.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  wav.writeUInt16LE(bitsPerSample, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(dataSize, 40);
  pcm.copy(wav, 44);

  return wav;
}

// ── OpenAI TTS ───────────────────────────────────────────────────────────────
async function openaiTTS(text, openaiKey) {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice: "nova",            // 한국어 자연스러운 편
      response_format: "wav",
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI TTS 오류 (${res.status})`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return { wavBuffer: Buffer.from(arrayBuffer) };
}

// ── Google AI Studio (Gemini) TTS ────────────────────────────────────────────
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
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
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
  if (!part?.inlineData?.data) throw new Error("Google TTS: 오디오 데이터 없음");

  const rawMime    = part.inlineData.mimeType ?? "";
  const isPcm      = rawMime.includes("L16") || rawMime.includes("pcm");
  const rateMatch  = rawMime.match(/rate=(\d+)/);
  const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;

  // raw PCM → WAV Buffer
  const wavBuffer = isPcm
    ? pcmToWavBuffer(part.inlineData.data, sampleRate)
    : Buffer.from(part.inlineData.data, "base64");

  return { wavBuffer };
}

// ── Whisper STT → 단어별 타임스탬프 ─────────────────────────────────────────
async function whisperTimestamps(wavBuffer, openaiKey) {
  // Node.js 18+ FormData + Blob 사용
  const formData = new FormData();
  formData.append("file", new Blob([wavBuffer], { type: "audio/wav" }), "audio.wav");
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "word");
  formData.append("language", "ko");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openaiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Whisper 오류 (${res.status})`);
  }

  const data = await res.json();
  // data.words = [{ word, start, end }]
  return (data.words ?? []).map(w => ({
    text:    w.word,
    startMs: Math.round(w.start * 1000),
    endMs:   Math.round(w.end   * 1000),
  }));
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const elevenKey = process.env.ELEVENLABS_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!elevenKey) {
    return res.status(500).json({ error: "ELEVENLABS_API_KEY 환경변수가 없습니다." });
  }

  const { text, voiceId, voiceSettings } = req.body;
  if (!text || !voiceId) {
    return res.status(400).json({ error: "text, voiceId는 필수입니다." });
  }

  // ── 1차: ElevenLabs (정확한 단어 타임스탬프 포함) ───────────────────────────
  try {
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: "POST",
        headers: { "xi-api-key": elevenKey, "Content-Type": "application/json" },
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

    const errBody = await elevenRes.json().catch(() => ({}));
    console.log("[TTS] ElevenLabs 오류:", JSON.stringify({ httpStatus: elevenRes.status, body: errBody }));

    const { status: apiStatus, message: apiMsg } = parseElevenLabsError(errBody);
    if (!isCreditError(elevenRes.status, apiStatus, apiMsg)) {
      return res.status(elevenRes.status).json({ error: apiMsg || `ElevenLabs 오류 (${elevenRes.status})` });
    }

    console.log("[TTS] 크레딧 소진 → OpenAI TTS + Whisper 파이프라인 시작");
  } catch (e) {
    console.log("[TTS] ElevenLabs 네트워크 오류:", e.message);
  }

  // ── 2차: OpenAI TTS + Whisper STT 파이프라인 ────────────────────────────
  if (!openaiKey) {
    return res.status(402).json({ error: "ElevenLabs 크레딧 소진 + OPENAI_API_KEY 없음" });
  }

  try {
    console.log("[TTS] OpenAI TTS 생성 중...");
    const { wavBuffer } = await openaiTTS(text, openaiKey);
    console.log("[TTS] OpenAI TTS 완료, WAV 크기:", wavBuffer.length, "bytes");

    const audioBase64 = wavBuffer.toString("base64");

    let captions = null;
    try {
      console.log("[TTS] Whisper STT 시작...");
      captions = await whisperTimestamps(wavBuffer, openaiKey);
      console.log("[TTS] Whisper 완료, 단어 수:", captions.length);
    } catch (whisperErr) {
      console.log("[TTS] Whisper 실패:", whisperErr.message);
    }

    return res.status(200).json({
      audioBase64,
      mimeType: "audio/wav",
      captions,
      provider: "openai+whisper",
    });
  } catch (e) {
    // OpenAI TTS 실패 시 에러 반환 (Google TTS로 넘기지 않음 — 한도 문제 있음)
    return res.status(500).json({ error: `OpenAI TTS 폴백 실패: ${e.message}` });
  }

  // ── (미사용) Google TTS 예비 ─────────────────────────────────────────────
  // Google AI Studio 무료 티어 한도(분당 10회) 초과 문제로 비활성화
  // geminiKey가 있고 openaiKey가 없을 때만 아래 코드를 활성화할 것
  if (false && geminiKey) {
    try {
      console.log("[TTS] Google TTS 생성 중...");
      const { wavBuffer } = await googleTTS(text, geminiKey);
      console.log("[TTS] Google TTS 완료, WAV 크기:", wavBuffer.length, "bytes");

      const audioBase64 = wavBuffer.toString("base64");

      let captions = null;
      if (openaiKey) {
        try {
          console.log("[TTS] Whisper STT 시작...");
          captions = await whisperTimestamps(wavBuffer, openaiKey);
          console.log("[TTS] Whisper 완료, 단어 수:", captions.length);
        } catch (whisperErr) {
          console.log("[TTS] Whisper 실패:", whisperErr.message);
        }
      }

      return res.status(200).json({
        audioBase64,
        mimeType: "audio/wav",
        captions,
        provider: "google+whisper",
      });
    } catch (e) {
      return res.status(500).json({ error: `Google TTS 폴백 실패: ${e.message}` });
    }
  }
}
