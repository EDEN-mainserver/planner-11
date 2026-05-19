// Instagram 단건 인사이트 조회.
// GET /api/instagram-insights?id=<mediaId>&token=<accessToken>&type=<media_type>
// 반환: 정규화된 메트릭 객체 + 원본 응답.

const IG_API = "https://graph.instagram.com/v22.0";

// 단일 미디어 메트릭 (image / video). 캐러셀은 다른 메트릭 명.
const METRICS_SINGLE = "impressions,reach,saved,likes,comments,shares";
const METRICS_CAROUSEL = "impressions,reach,saved,likes,comments,shares,total_interactions";

export const config = { maxDuration: 30, memory: 256 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method Not Allowed" });

  const mediaId = req.query?.id;
  const accessToken = req.query?.token || req.headers?.authorization?.replace(/^Bearer /i, "") || "";
  const mediaType = String(req.query?.type || "").toUpperCase(); // 'CAROUSEL_ALBUM' 등
  if (!mediaId) return res.status(400).json({ error: "id (mediaId) 필요" });
  if (!accessToken) return res.status(400).json({ error: "token 필요" });

  const metricList = mediaType === "CAROUSEL_ALBUM" ? METRICS_CAROUSEL : METRICS_SINGLE;
  try {
    const url = `${IG_API}/${encodeURIComponent(mediaId)}/insights?metric=${encodeURIComponent(metricList)}&access_token=${encodeURIComponent(accessToken)}`;
    const apiRes = await fetch(url);
    const raw = await apiRes.json();
    if (!apiRes.ok) {
      return res.status(apiRes.status).json({
        error: raw?.error?.message || `Instagram API ${apiRes.status}`,
        raw,
      });
    }
    const metrics = normalizeInstagramInsights(raw);
    return res.status(200).json({ ok: true, mediaId, metrics, raw });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Instagram API 응답:
// { data: [{ name: 'impressions', period: 'lifetime', values: [{ value: 1234 }] }, ...] }
export function normalizeInstagramInsights(raw) {
  const out = {
    likes: null, replies: null, shares: null, saves: null,
    impressions: null, reach: null, profile_visits: null,
  };
  const items = Array.isArray(raw?.data) ? raw.data : [];
  for (const item of items) {
    const name = String(item?.name || "").toLowerCase();
    const value = item?.values?.[0]?.value ?? item?.total_value?.value ?? null;
    if (value == null) continue;
    if (name === "impressions") out.impressions = Number(value);
    else if (name === "reach") out.reach = Number(value);
    else if (name === "saved") out.saves = Number(value);
    else if (name === "likes") out.likes = Number(value);
    else if (name === "comments") out.replies = Number(value);
    else if (name === "shares") out.shares = Number(value);
    else if (name === "profile_visits") out.profile_visits = Number(value);
    else if (name === "total_interactions") out.engagement = Number(value);
  }
  if (out.engagement == null) {
    const sum = [out.likes, out.replies, out.shares, out.saves].filter((v) => v != null);
    out.engagement = sum.length ? sum.reduce((a, b) => a + b, 0) : null;
  }
  if (out.reach && out.engagement != null && out.reach > 0) {
    out.engagement_rate = out.engagement / out.reach;
  } else if (out.impressions && out.engagement != null && out.impressions > 0) {
    out.engagement_rate = out.engagement / out.impressions;
  }
  return out;
}
