/**
 * ElevenLabs TTS 프록시 — Vercel Serverless Function
 * POST /api/tts  Body: { text, voiceId, voiceSettings? }
 *
 * ELEVENLABS_API_KEY 환경변수에서 키를 읽어 ElevenLabs API를 호출합니다.
 * 프론트에 API 키를 노출하지 않습니다.
 */

export const config = { maxDuration: 30 };

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
    const elevenRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          "Accept": "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
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

    const audioBuffer = Buffer.from(await elevenRes.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", audioBuffer.length);
    res.status(200).send(audioBuffer);

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
