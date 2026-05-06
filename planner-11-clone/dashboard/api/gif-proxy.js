// GIF 프록시 — cross-origin GIF(Klipy CDN 등)를 same-origin으로 중계
// canvas.drawImage() 보안 오류 우회용
// GET /api/gif-proxy?url=<encoded_gif_url>
export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url 파라미터가 필요합니다." });

  try {
    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!resp.ok) return res.status(resp.status).end();

    const buffer = Buffer.from(await resp.arrayBuffer());
    const contentType = resp.headers.get("content-type") || "image/gif";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.end(buffer);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
