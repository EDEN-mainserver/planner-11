/**
 * ElevenLabs TTS 프록시 — Vercel Serverless Function
 * POST /api/tts  Body: { text, voiceId, voiceSettings? }
 *
 * with-timestamps 엔드포인트로 오디오 + 단어별 정확한 타이밍을 함께 반환합니다.
 * Response: { audioBase64: string, captions: { text, startMs, endMs }[] }
 */

export const config = { maxDuration: 30 };

// ElevenLabs 문자 정렬 데이터 → 단어별 타이밍 배열로 변환
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
  // 마지막 단어
  if (wordChars.trim()) {
    words.push({
      text:    wordChars,
      startMs: Math.round(wordStart * 1000),
      endMs:   Math.round(wordEnd   * 1000),
    });
  }
  return words;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ELEVENLABS_API_KEY 환경변수가 설정되지 않았습니다." });
  }

  const { text, voiceId, voiceSettings } = req.body;
  if (!text || !voiceId) {
    return res.status(400).json({ error: "text, voiceId는 필수입니다." });
  }

  try {
    // with-timestamps 엔드포인트: 오디오 + 문자별 타이밍 동시 반환
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`,
      {
        method: "POST",
        headers: {
          "xi-api-key":   apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id:       "eleven_multilingual_v2",
          voice_settings: voiceSettings ?? { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!elevenRes.ok) {
      const err = await elevenRes.json().catch(() => ({}));
      return res.status(elevenRes.status).json({
        error: err?.detail?.message || `ElevenLabs 오류 (${elevenRes.status})`,
      });
    }

    const data = await elevenRes.json();
    // data.audio_base64: base64 MP3
    // data.alignment: { characters[], character_start_times_seconds[], character_end_times_seconds[] }

    const captions = parseWordTimings(data.alignment ?? {});

    res.status(200).json({
      audioBase64: data.audio_base64,
      captions,
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
