/**
 * Klipy GIF 검색 프록시 — Vercel Serverless Function
 * GET /api/klipy?q={검색어(한국어 가능)}
 *
 * 1) Claude API로 한국어 → 영어 검색 키워드 변환
 * 2) Klipy GIF Search API 호출
 *
 * Response: { url: string, width: number, height: number, keyword: string }
 */

export const config = { maxDuration: 15 };

// 한국어 자막 → GIF 검색에 적합한 영어 키워드 1~2단어
async function toEnglishKeyword(text, anthropicKey) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 20,
      messages: [{
        role: "user",
        content: `Convert this Korean text to 1-2 English words suitable for GIF search. Reply ONLY the English keyword(s), nothing else.\n\nKorean: ${text}`,
      }],
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.content?.[0]?.text?.trim() ?? null;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const klipyKey    = process.env.KLIPY_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!klipyKey) {
    return res.status(500).json({ error: "KLIPY_API_KEY 환경변수가 설정되지 않았습니다." });
  }

  const q = req.query.q?.trim();
  if (!q) {
    return res.status(400).json({ error: "검색어(q)가 필요합니다." });
  }

  // 한국어 → 영어 키워드 변환 (Claude 없으면 원문 그대로 사용)
  let keyword = q;
  if (anthropicKey) {
    const translated = await toEnglishKeyword(q, anthropicKey).catch(() => null);
    if (translated) keyword = translated;
  }

  try {
    const klipyRes = await fetch(
      `https://api.klipy.com/api/v1/${klipyKey}/gifs/search?q=${encodeURIComponent(keyword)}&per_page=1`,
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
    const item = Array.isArray(list) ? list[0] : null;

    if (!item) {
      return res.status(200).json({ url: null, keyword });
    }

    // file.sm.gif.url → md.gif.url → hd.gif.url 순으로 시도 (sm이 가장 가벼움)
    const f = item?.file ?? {};
    const url =
      f?.sm?.gif?.url ||
      f?.md?.gif?.url ||
      f?.hd?.gif?.url ||
      f?.sm?.webp?.url ||
      f?.md?.webp?.url ||
      null;

    const smGif = f?.sm?.gif ?? f?.md?.gif ?? {};
    res.setHeader("Cache-Control", "s-maxage=60");
    res.status(200).json({
      url,
      keyword,
      width:  smGif?.width  ?? null,
      height: smGif?.height ?? null,
    });

  } catch (e) {
    res.status(500).json({ error: e.message, keyword });
  }
}
