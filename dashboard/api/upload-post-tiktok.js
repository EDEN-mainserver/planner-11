/* global Buffer, process */

export const config = {
  api: {
    bodyParser: false,
    maxDuration: 120,
  },
};

const DEFAULT_UPSTREAM_URL = "https://api.upload-post.com/api/upload";
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
  "video/x-msvideo",
  "video/x-matroska",
  "application/octet-stream",
]);
const ALLOWED_VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v", ".avi", ".mkv"]);

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key, X-Idempotency-Key, X-Request-Id");
}

function getBoundary(contentType) {
  const match = String(contentType || "").match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return match?.[1] || match?.[2] || "";
}

function getExtension(filename = "") {
  const normalized = String(filename).toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex >= 0 ? normalized.slice(dotIndex) : "";
}

async function readRequestBuffer(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

function parseMultipart(buffer, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const parts = [];
  let cursor = buffer.indexOf(delimiter);

  while (cursor !== -1) {
    const next = buffer.indexOf(delimiter, cursor + delimiter.length);
    if (next === -1) break;

    let part = buffer.subarray(cursor + delimiter.length, next);
    if (part.subarray(0, 2).toString() === "\r\n") part = part.subarray(2);
    if (part.subarray(0, 2).toString() === "--") break;
    if (part.subarray(-2).toString() === "\r\n") part = part.subarray(0, -2);

    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd !== -1) {
      const rawHeaders = part.subarray(0, headerEnd).toString("utf8");
      const body = part.subarray(headerEnd + 4);
      const disposition = rawHeaders.match(/content-disposition:\s*([^\r\n]+)/i)?.[1] || "";
      const name = disposition.match(/name="([^"]+)"/)?.[1] || "";
      const filename = disposition.match(/filename="([^"]*)"/)?.[1] || "";
      const contentType = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)?.[1] || "application/octet-stream";
      if (name) parts.push({ name, filename, contentType, body });
    }

    cursor = next;
  }

  return parts;
}

function firstField(parts, name) {
  return parts.find((part) => part.name === name && !part.filename)?.body.toString("utf8").trim() || "";
}

function allFields(parts, name) {
  return parts
    .filter((part) => part.name === name && !part.filename)
    .map((part) => part.body.toString("utf8").trim())
    .filter(Boolean);
}

function firstFile(parts, name) {
  return parts.find((part) => part.name === name && part.filename) || null;
}

function isAllowedVideo(video) {
  const type = String(video?.contentType || "").toLowerCase();
  const extension = getExtension(video?.filename);
  return ALLOWED_VIDEO_TYPES.has(type) || ALLOWED_VIDEO_EXTENSIONS.has(extension) || type.startsWith("video/");
}

function isJsonResponse(contentType) {
  return String(contentType || "").toLowerCase().includes("application/json");
}

async function parseUpstreamResponse(res) {
  const contentType = res.headers.get("content-type") || "";
  if (isJsonResponse(contentType)) {
    return await res.json();
  }
  const text = await res.text();
  return text ? { message: text } : {};
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const apiKey = String(process.env.UPLOAD_POST_API_KEY || process.env.UPLOAD_POST_API_TOKEN || "").trim();
  const upstreamUrl = String(process.env.UPLOAD_POST_API_URL || DEFAULT_UPSTREAM_URL).trim();

  if (!apiKey) {
    return res.status(500).json({ error: "UPLOAD_POST_API_KEY 환경변수가 없습니다." });
  }

  try {
    const contentType = req.headers["content-type"] || "";
    const boundary = getBoundary(contentType);
    if (!boundary) {
      return res.status(400).json({ error: "multipart/form-data 요청이 필요합니다" });
    }

    const buffer = await readRequestBuffer(req);
    const parts = parseMultipart(buffer, boundary);
    const title = firstField(parts, "title");
    const user = firstField(parts, "user");
    const platforms = allFields(parts, "platform[]");
    const video = firstFile(parts, "video");

    if (!title) return res.status(400).json({ error: "title 값이 필요합니다" });
    if (!user) return res.status(400).json({ error: "user 값이 필요합니다" });
    if (!video?.body?.length) return res.status(400).json({ error: "video 파일이 필요합니다" });
    if (platforms.length === 0) return res.status(400).json({ error: "platform 값을 하나 이상 선택해주세요" });
    if (platforms.length !== 1 || platforms[0] !== "tiktok") {
      return res.status(400).json({ error: "현재 이 엔드포인트는 platform[]=tiktok만 지원합니다" });
    }
    if (!isAllowedVideo(video)) {
      return res.status(400).json({ error: "video 파일은 mp4, mov, webm, m4v, avi, mkv 형식만 업로드할 수 있습니다" });
    }

    const form = new FormData();
    form.append("title", title);
    form.append("user", user);
    form.append("platform[]", "tiktok");
    form.append("video", new Blob([video.body], { type: video.contentType || "video/mp4" }), video.filename || "video.mp4");

    let upstreamRes;
    try {
      upstreamRes = await fetch(upstreamUrl, {
        method: "POST",
        headers: {
          Authorization: `Apikey ${apiKey}`,
        },
        body: form,
      });
    } catch (fetchErr) {
      return res.status(502).json({
        error: "외부 Upload Post API 호출 실패",
        detail: fetchErr.message,
      });
    }

    const upstreamBody = await parseUpstreamResponse(upstreamRes);
    const payload = upstreamBody && typeof upstreamBody === "object" && !Array.isArray(upstreamBody)
      ? upstreamBody
      : { message: String(upstreamBody || "") };

    return res.status(upstreamRes.status).json({
      ...payload,
      raw: payload,
      request: {
        title,
        user,
        platform: "tiktok",
        video: {
          filename: video.filename || "",
          contentType: video.contentType || "",
          size: video.body.length,
        },
      },
      upstream: {
        status: upstreamRes.status,
        ok: upstreamRes.ok,
        url: upstreamUrl,
      },
      success: upstreamRes.ok,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Upload Post TikTok 업로드 실패",
    });
  }
}
