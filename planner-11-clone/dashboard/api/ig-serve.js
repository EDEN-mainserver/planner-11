// Vercel Blob에 올라간 임시 이미지를 우리 앱 도메인으로 프록시 서빙
// Instagram/Meta 크롤러는 vercel-storage.com에 접근 불가 → 우리 vercel.app 도메인을 경유

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { u } = req.query;
  if (!u) return res.status(400).end("Missing u param");

  // 보안: Vercel Blob 스토어 URL만 허용 (SSRF 방지)
  let parsed;
  try {
    parsed = new URL(decodeURIComponent(u));
  } catch {
    return res.status(400).end("Invalid URL");
  }

  if (!parsed.hostname.endsWith("public.blob.vercel-storage.com")) {
    return res.status(403).end("Forbidden");
  }

  try {
    const response = await fetch(parsed.href);
    if (!response.ok) return res.status(404).end("Not found");

    const buffer = await response.arrayBuffer();
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=600, s-maxage=600");
    res.send(Buffer.from(buffer));
  } catch (e) {
    res.status(500).end(e.message);
  }
}
