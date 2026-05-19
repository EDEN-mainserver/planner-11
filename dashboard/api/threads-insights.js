// Threads 단건 인사이트 조회.
// GET /api/threads-insights?id=<mediaId>&token=<accessToken>
// 반환: 정규화된 메트릭 객체 + 원본 응답.

const TH_API = "https://graph.threads.net/v1.0";
const METRICS = ["views", "likes", "replies", "reposts", "quotes", "shares"];

export const config = { maxDuration: 30, memory: 256 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  const mediaId = req.query?.id;
  const accessToken = req.query?.token || req.headers?.authorization?.replace(/^Bearer /i, "") || "";
  if (!mediaId) return res.status(400).json({ error: "id (mediaId) 필요" });
  if (!accessToken) return res.status(400).json({ error: "token 필요" });

  try {
    const url = `${TH_API}/${encodeURIComponent(mediaId)}/insights?metric=${METRICS.join(",")}&access_token=${encodeURIComponent(accessToken)}`;
    const apiRes = await fetch(url);
    const raw = await apiRes.json();
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({
        error: raw?.error?.message || `Threads API ${apiRes.status}`,
        raw,
      });
    }
    const metrics = normalizeThreadsInsights(raw);
    return res.status(200).json({ ok: true, mediaId, metrics, raw });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Threads API 응답:
// { data: [{ name: 'views', period: 'lifetime', values: [{ value: 123 }] }, ...] }
export function normalizeThreadsInsights(raw) {
  const out = {
    likes: null, replies: null, shares: null,
    views: null, quotes: null,
  };
  const items = Array.isArray(raw?.data) ? raw.data : [];
  for (const item of items) {
    const name = String(item?.name || "").toLowerCase();
    const value = item?.values?.[0]?.value ?? item?.total_value?.value ?? null;
    if (value == null) continue;
    if (name === "views") out.views = Number(value);
    else if (name === "likes") out.likes = Number(value);
    else if (name === "replies") out.replies = Number(value);
    else if (name === "reposts") out.shares = Number(value);
    else if (name === "shares") out.shares = (out.shares || 0) + Number(value);
    else if (name === "quotes") out.quotes = Number(value);
  }
  // 합산 engagement (있는 값만)
  const sum = [out.likes, out.replies, out.shares, out.quotes].filter((v) => v != null);
  out.engagement = sum.length ? sum.reduce((a, b) => a + b, 0) : null;
  if (out.views && out.engagement != null) {
    out.engagement_rate = out.views > 0 ? out.engagement / out.views : null;
  }
  return out;
}
