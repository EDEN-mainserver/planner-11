/**
 * Klipy GIF 검색 프록시 — Vercel Serverless Function
 * GET /api/klipy?q={검색어(한국어 가능)}
 *
 * 1) Claude API로 한국어 → 영어 검색 키워드 변환
 * 2) Klipy GIF Search API 호출
 *
 * Response: { url: string, urls?: string[], width: number, height: number, keyword: string }
 */

export const config = { maxDuration: 15 };

// 한국어 → 영어 번역 (Google Translate 비공식 API, 키 불필요)
async function toEnglishKeyword(text) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ko&tl=en&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return null;
  const data = await res.json();
  // 응답: [[["translated","original",...],...],...]
  const translated = data?.[0]?.map(chunk => chunk?.[0]).filter(Boolean).join(" ").trim();
  return translated || null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const klipyKey = process.env.KLIPY_API_KEY;

  if (!klipyKey) {
    return res.status(500).json({ error: "KLIPY_API_KEY 환경변수가 설정되지 않았습니다." });
  }

  const q = req.query.q?.trim();
  if (!q) {
    return res.status(400).json({ error: "검색어(q)가 필요합니다." });
  }

  // 한국어 감지 시 영어로 번역 (Google Translate 비공식 API)
  const isKorean = /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(q);
  let keyword = q;
  if (isKorean) {
    const translated = await toEnglishKeyword(q).catch(() => null);
    if (translated) keyword = translated;
  }

  try {
    const klipyRes = await fetch(
      `https://api.klipy.com/api/v1/${klipyKey}/gifs/search?q=${encodeURIComponent(keyword)}&per_page=8`,
      { headers: { "Accept": "application/json" } }
    );

    if (!klipyRes.ok) {
      const errText = await klipyRes.text().catch(() => "");
      return res.status(klipyRes.status).json({
        error: `Klipy 오류 (${klipyRes.status})`,
        detail: errText,
        keyword,
      });
    }

    const data = await klipyRes.json();

    // 응답 구조: { result: true, data: { data: [ { file: { sm, md, hd } } ] } }
    const list = data?.data?.data ?? data?.data ?? [];
    const items = Array.isArray(list) ? list : [];
    const item = items[0] ?? null;

    if (!item) {
      return res.status(200).json({ url: null, keyword });
    }

    // file.sm.gif.url → md.gif.url → hd.gif.url 순으로 시도 (sm이 가장 가벼움)
    const urls = items.map((entry) => {
      const f = entry?.file ?? {};
      return (
        f?.sm?.gif?.url ||
        f?.md?.gif?.url ||
        f?.hd?.gif?.url ||
        f?.sm?.webp?.url ||
        f?.md?.webp?.url ||
        null
      );
    }).filter(Boolean);

    const f = item?.file ?? {};
    const url = urls[0] ?? null;

    const smGif = f?.sm?.gif ?? f?.md?.gif ?? {};
    res.setHeader("Cache-Control", "s-maxage=60");
    res.status(200).json({
      url,
      urls,
      keyword,
      width:  smGif?.width  ?? null,
      height: smGif?.height ?? null,
    });

  } catch (e) {
    res.status(500).json({ error: e.message, keyword });
  }
}
