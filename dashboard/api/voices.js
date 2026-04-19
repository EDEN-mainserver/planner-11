/**
 * ElevenLabs 보이스 목록 조회 — Vercel Serverless Function
 * GET /api/voices
 *
 * ELEVENLABS_API_KEY 환경변수를 사용해 계정의 전체 보이스 목록을 반환합니다.
 */

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ELEVENLABS_API_KEY 환경변수가 설정되지 않았습니다." });
  }

  try {
    const elevenRes = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });

    if (!elevenRes.ok) {
      return res.status(elevenRes.status).json({ error: `ElevenLabs 오류 (${elevenRes.status})` });
    }

    const data = await elevenRes.json();

    // 필요한 필드만 추려서 반환
    const voices = (data.voices ?? []).map(v => ({
      id: v.voice_id,
      name: v.name,
      category: v.category,       // "premade" | "cloned" | "generated"
      labels: v.labels ?? {},     // accent, description, age, gender, use_case 등
    }));

    res.setHeader("Cache-Control", "s-maxage=300"); // 5분 캐시
    res.status(200).json({ voices });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
