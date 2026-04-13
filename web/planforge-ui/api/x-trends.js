// Vercel Serverless Function — X(Twitter) 한국 실시간 트렌드
// 게스트 토큰 + v1.1 trends/place API (로그인 불필요)

const BEARER_TOKEN =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const KOREA_WOEID = 23424868;

async function getGuestToken() {
  const resp = await fetch("https://api.x.com/1.1/guest/activate.json", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${BEARER_TOKEN}`,
      "User-Agent": "Mozilla/5.0",
    },
  });
  if (!resp.ok) throw new Error(`Guest token 발급 실패: ${resp.status}`);
  const data = await resp.json();
  return data.guest_token;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { keyword = "" } = req.query;

  try {
    const gt = await getGuestToken();

    const resp = await fetch(
      `https://api.x.com/1.1/trends/place.json?id=${KOREA_WOEID}`,
      {
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
          "User-Agent": "Mozilla/5.0",
          "x-guest-token": gt,
        },
      }
    );

    if (!resp.ok) {
      return res.status(200).json({ platform: "x", total: 0, posts: [], error: `X API ${resp.status}` });
    }

    const data = await resp.json();
    const trends = data[0]?.trends || [];

    let rank = 1;
    const posts = [];

    for (const t of trends) {
      const name = t.name || "";
      // 키워드 필터
      if (keyword && !name.toLowerCase().includes(keyword.toLowerCase())) continue;

      posts.push({
        rank: rank++,
        title: name,
        content_raw: `트렌드 키워드: ${name}`,
        author: "X Korea Trends",
        views: t.tweet_volume || 0,
        likes: 0,
        comments: 0,
        shares: 0,
        image_url: "",
        source_url: t.url?.startsWith("http") ? t.url : `https://x.com/search?q=${t.query}`,
        created_at: "실시간",
        platform: "x",
      });
    }

    return res.status(200).json({
      platform: "x",
      total: posts.length,
      posts,
      error: "",
    });
  } catch (e) {
    return res.status(200).json({
      platform: "x",
      total: 0,
      posts: [],
      error: e.message || "X 트렌드 수집 실패",
    });
  }
}
