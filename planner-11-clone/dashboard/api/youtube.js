// YouTube Data API v3 헬퍼
// POST /api/youtube?_fn=init-upload  — 업로드 세션 초기화 (서버사이드 → CORS Location 헤더 우회)
// POST /api/youtube?_fn=refresh      — 액세스 토큰 리프레시
// POST /api/youtube?_fn=blob-token   — Vercel Blob 클라이언트 업로드 토큰 발급
// POST /api/youtube?_fn=blob-upload  — Vercel Blob URL에서 YouTube로 업로드 (서버-to-서버)

import { generateClientTokenFromReadWriteToken } from "@vercel/blob/client";
import { del as blobDel } from "@vercel/blob";

export const config = { maxDuration: 120 };

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

  // ── 3) Vercel Blob 클라이언트 업로드 토큰 발급 ──────────────────────────────
  if (fn === "blob-token") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { pathname } = req.body ?? {};
    if (!pathname) return res.status(400).json({ error: "pathname 필수" });

    const readWriteToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!readWriteToken) return res.status(500).json({ error: "BLOB_READ_WRITE_TOKEN 미설정" });

    try {
      const clientToken = await generateClientTokenFromReadWriteToken({
        token:                readWriteToken,
        pathname,
        allowedContentTypes:  ["video/mp4", "video/webm", "application/octet-stream"],
        maximumSizeInBytes:   500 * 1024 * 1024, // 500MB
        addRandomSuffix:      false,
      });
      return res.status(200).json({ clientToken });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // ── 4) Vercel Blob URL → YouTube 업로드 (서버-to-서버, CORS 없음) ────────────
  if (fn === "blob-upload") {
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const { blobUrl, accessToken, title, description, privacyStatus } = req.body ?? {};
    if (!blobUrl)     return res.status(400).json({ error: "blobUrl 필수" });
    if (!accessToken) return res.status(400).json({ error: "accessToken 필수" });

    let videoBuffer;
    try {
      const dlRes = await fetch(blobUrl);
      if (!dlRes.ok) throw new Error(`Blob 다운로드 실패 (${dlRes.status})`);
      const arrayBuf = await dlRes.arrayBuffer();
      videoBuffer = Buffer.from(arrayBuf);
    } catch (e) {
      return res.status(500).json({ error: `Blob 다운로드 오류: ${e.message}` });
    }

    // YouTube 업로드 세션 초기화
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method:  "POST",
        headers: {
          "Authorization":           `Bearer ${accessToken}`,
          "Content-Type":            "application/json",
          "X-Upload-Content-Type":   "video/mp4",
          "X-Upload-Content-Length": String(videoBuffer.byteLength),
        },
        body: JSON.stringify({
          snippet: {
            title:       title       || "커뮤니티 숏츠",
            description: description || "",
            categoryId:  "22",
          },
          status: {
            privacyStatus:           privacyStatus || "private",
            selfDeclaredMadeForKids: false,
          },
        }),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.json().catch(() => ({}));
      const msg = err?.error?.message || `YouTube API 오류 (${initRes.status})`;
      // Blob 삭제 시도 (실패해도 무시)
      await blobDel(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {});
      return res.status(initRes.status).json({ error: msg });
    }

    const uploadUrl = initRes.headers.get("Location");
    if (!uploadUrl) {
      await blobDel(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {});
      return res.status(502).json({ error: "YouTube에서 업로드 URL을 반환하지 않았습니다" });
    }

    // YouTube에 실제 업로드
    const putRes = await fetch(uploadUrl, {
      method:  "PUT",
      headers: {
        "Content-Type":   "video/mp4",
        "Content-Length": String(videoBuffer.byteLength),
        "Authorization":  `Bearer ${accessToken}`,
      },
      body: videoBuffer,
    });

    // Blob 삭제 (업로드 결과와 무관하게)
    await blobDel(blobUrl, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => {});

    if (!putRes.ok) {
      const errText = await putRes.text().catch(() => "");
      return res.status(putRes.status).json({ error: `YouTube 업로드 실패 (${putRes.status}): ${errText.slice(0, 300)}` });
    }

    const putData = await putRes.json().catch(() => ({}));
    const videoId = putData.id || "unknown";
    return res.status(200).json({ videoId });
  }

  return res.status(400).json({ error: "_fn 파라미터가 필요합니다 (init-upload | refresh | blob-token | blob-upload)" });
}
