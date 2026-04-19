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

    const GENDER_KO   = { male: "남성", female: "여성" };
    const ACCENT_KO   = {
      american: "미국식", british: "영국식", australian: "호주식",
      irish: "아일랜드식", african: "아프리카식", indian: "인도식",
    };
    const AGE_KO      = { young: "젊음", "middle aged": "중간", old: "노년" };
    const USECASE_KO  = {
      narration: "내레이션", news: "뉴스", meditation: "명상",
      "social media": "SNS", conversational: "대화형",
      characters: "캐릭터", audiobook: "오디오북",
    };

    // 클론/커스텀 제외 — premade만
    const voices = (data.voices ?? [])
      .filter(v => v.category === "premade")
      .map(v => {
        const lb = v.labels ?? {};
        const tags = [
          GENDER_KO[lb.gender],
          ACCENT_KO[lb.accent],
          AGE_KO[lb.age],
          USECASE_KO[lb.use_case],
        ].filter(Boolean);
        return {
          id: v.voice_id,
          name: v.name,
          desc: tags.join(" · ") || lb.description || "",
        };
      });

    res.setHeader("Cache-Control", "s-maxage=300"); // 5분 캐시
    res.status(200).json({ voices });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
