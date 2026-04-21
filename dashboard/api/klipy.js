/**
 * Klipy GIF 검색 프록시 — Vercel Serverless Function
 * GET /api/klipy?q={검색어}
 *
 * Response: { url: string, width: number, height: number }
 */

export const config = { maxDuration: 10 };

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const apiKey = process.env.KLIPY_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "KLIPY_API_KEY 환경변수가 설정되지 않았습니다." });
  }

  const q = req.query.q?.trim();
  if (!q) {
    return res.status(400).json({ error: "검색어(q)가 필요합니다." });
  }

  try {
    const klipyRes = await fetch(
      `https://api.klipy.co/api/v1/gifs/search?q=${encodeURIComponent(q)}&api_key=${apiKey}&limit=1`,
      { headers: { "Accept": "application/json" } }
    );

    if (!klipyRes.ok) {
      return res.status(klipyRes.status).json({ error: `Klipy 오류 (${klipyRes.status})` });
    }

    const data = await klipyRes.json();
    const item = data?.data?.[0];

    if (!item) {
      return res.status(200).json({ url: null });
    }

    // Klipy 응답 구조에 맞게 URL 추출
    const url =
      item?.media_formats?.gif?.url ||
      item?.media_formats?.mp4?.url ||
      item?.url ||
      null;

    res.setHeader("Cache-Control", "s-maxage=60");
    res.status(200).json({ url, width: item?.width ?? null, height: item?.height ?? null });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
