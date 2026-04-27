// YouTube Data API v3 헬퍼
// POST /api/youtube?_fn=init-upload  — 업로드 세션 초기화 (서버사이드 → CORS Location 헤더 우회)
// POST /api/youtube?_fn=refresh      — 액세스 토큰 리프레시

export const config = { maxDuration: 30 };

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export default async function handler(req, res) {
  const fn = req.query._fn;

  // ── 1) 토큰 리프레시 ────────────────────────────────────────────────────────
  if (fn === "refresh") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { refreshToken } = req.body ?? {};
    if (!refreshToken) return res.status(400).json({ error: "refreshToken 필수" });

    const clientId     = process.env.YOUTUBE_CLIENT_ID;
    const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET 미설정" });
    }

    const r = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
        client_id:     clientId,
        client_secret: clientSecret,
      }),
    });

    const data = await r.json();
    if (!r.ok || !data.access_token) {
      return res.status(r.status).json({ error: data.error_description || data.error || "리프레시 실패" });
    }

    return res.status(200).json({
      accessToken: data.access_token,
      expiresIn:   data.expires_in ?? 3600,
    });
  }

  // ── 2) 업로드 세션 초기화 ────────────────────────────────────────────────────
  // 클라이언트에서 직접 YouTube API를 호출하면 Location 헤더가 CORS에 의해
  // 노출되지 않을 수 있음 → 서버에서 초기화하고 uploadUrl만 반환
  if (fn === "init-upload") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { accessToken, title, description, privacyStatus, fileSize } = req.body ?? {};
    if (!accessToken) return res.status(400).json({ error: "accessToken 필수" });

    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method:  "POST",
        headers: {
          "Authorization":           `Bearer ${accessToken}`,
          "Content-Type":            "application/json",
          "X-Upload-Content-Type":   "video/mp4",
          "X-Upload-Content-Length": String(fileSize ?? 0),
        },
        body: JSON.stringify({
          snippet: {
            title:       title       || "커뮤니티 숏츠",
            description: description || "",
            categoryId:  "22", // People & Blogs
          },
          status: {
            privacyStatus: privacyStatus || "private",
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      const msg = err?.error?.message || err?.error?.errors?.[0]?.message || `YouTube API 오류 (${initRes.status})`;
      return res.status(initRes.status).json({ error: msg });
    }

    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) return res.status(502).json({ error: "YouTube에서 업로드 URL을 반환하지 않았습니다" });

    return res.status(200).json({ uploadUrl });
  }

  return res.status(400).json({ error: "_fn 파라미터가 필요합니다 (init-upload | refresh)" });
}
