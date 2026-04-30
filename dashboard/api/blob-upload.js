/**
 * Vercel Blob 클라이언트 업로드 토큰 발급 API
 * POST /api/blob-upload  — 클라이언트가 Blob에 직접 업로드할 수 있는 토큰 발급
 * (Vercel 서버리스 4.5MB 바디 제한 우회용)
 */
import { handleUpload } from "@vercel/blob/client";

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // handleUpload가 Web Request 객체를 요구하므로 변환
  const host     = req.headers.host;
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const url      = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    headers.set(k, Array.isArray(v) ? v.join(", ") : v);
  }

  const webRequest = new Request(url, {
    method:  req.method,
    headers,
    body:    JSON.stringify(req.body),
  });

  try {
    const jsonResponse = await handleUpload({
      body:    req.body,
      request: webRequest,
      onBeforeGenerateToken: async (pathname) => ({
        allowedContentTypes: [
          "video/mp4", "video/quicktime", "video/x-msvideo",
          "video/x-matroska", "video/webm", "video/x-m4v",
          "audio/mpeg", "audio/wav", "audio/mp4", "audio/x-m4a",
        ],
        maximumSizeInBytes: 200 * 1024 * 1024, // 200MB
        tokenPayload: pathname,
      }),
      onUploadCompleted: async ({ blob }) => {
        // 업로드 완료 콜백 — 전사는 클라이언트가 별도로 /api/transcribe 호출
        console.log("[blob-upload] 업로드 완료:", blob.url);
      },
    });
    return res.json(jsonResponse);
  } catch (e) {
    console.error("[blob-upload] 오류:", e.message);
    return res.status(400).json({ error: e.message });
  }
}
