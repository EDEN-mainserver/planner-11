// Upload Post API 프록시
// 브라우저에서 받은 video multipart를 api.upload-post.com으로 전달한다.
/* global Buffer, process */

export const config = {
  api: {
    bodyParser: false,
  },
};

const UPLOAD_VIDEO_URL = "https://api.upload-post.com/api/upload";
const UPLOAD_PHOTOS_URL = "https://api.upload-post.com/api/upload_photos";
const MAX_UPLOAD_BYTES = 120 * 1024 * 1024;
const UPLOAD_TIMEOUT_MS = 240000;
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-m4v",
]);
const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov", ".webm", ".m4v"]);
const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);
const ALLOWED_PHOTO_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getBoundary(contentType) {
  return contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2] || "";
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
    if (total > MAX_UPLOAD_BYTES) {
      throw new Error("동영상 파일은 120MB 이하만 업로드할 수 있습니다");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
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

function isAllowedVideo(video) {
  const type = String(video?.contentType || "").toLowerCase();
  const extension = getExtension(video?.filename);
  return ALLOWED_VIDEO_TYPES.has(type) || ALLOWED_EXTENSIONS.has(extension);
}

function isAllowedPhoto(photo) {
  const type = String(photo?.contentType || "").toLowerCase();
  const extension = getExtension(photo?.filename);
  return ALLOWED_PHOTO_TYPES.has(type) || ALLOWED_PHOTO_EXTENSIONS.has(extension);
}

function summarizeUpstreamPayload(payload, fallbackMessage = "") {
  if (!payload || typeof payload !== "object") {
    return {
      message: fallbackMessage || "",
    };
  }

  const data = payload.data && typeof payload.data === "object" ? payload.data : null;
  const message =
    payload.message ||
    payload.error ||
    data?.message ||
    data?.error ||
    fallbackMessage ||
    "";

  const jobId =
    payload.jobId ||
    payload.jobID ||
    payload.job_id ||
    data?.jobId ||
    data?.jobID ||
    data?.job_id ||
    null;

  const status =
    payload.status ||
    data?.status ||
    (payload.success === true ? "success" : "") ||
    "";

  return {
    message,
    jobId,
    status,
  };
}

function normalizeSuccessResponse(statusCode, payload, responseText) {
  const summary = summarizeUpstreamPayload(payload, responseText);
  return {
    ok: true,
    status: statusCode,
    data: payload,
    jobId: summary.jobId,
    message: summary.message || "Upload Post 업로드 요청을 완료했습니다.",
    upstream: {
      status: summary.status || "success",
      message: summary.message || responseText || "",
    },
  };
}

function normalizeErrorResponse(statusCode, payload, responseText) {
  const summary = summarizeUpstreamPayload(payload, responseText);
  const fallbackMessage = responseText || "Upload Post 업스트림 요청이 실패했습니다.";
  return {
    ok: false,
    status: statusCode,
    error: summary.message || fallbackMessage,
    data: payload,
    jobId: summary.jobId,
    upstream: {
      status: summary.status || "error",
      message: summary.message || fallbackMessage,
      raw: responseText || "",
    },
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const apiKey = process.env.UPLOAD_POST_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "UPLOAD_POST_API_KEY 환경변수가 설정되지 않았습니다" });
  }

  try {
    const contentType = req.headers["content-type"] || "";
    const boundary = getBoundary(contentType);
    if (!boundary) return res.status(400).json({ error: "multipart/form-data 요청이 필요합니다" });

    const buffer = await readRequestBuffer(req);
    const parts = parseMultipart(buffer, boundary);
    const video = parts.find((part) => part.name === "video" && part.filename);
    const photos = parts.filter((part) => part.name === "photos[]" && part.filename);
    const title = firstField(parts, "title");
    const user = firstField(parts, "user");
    const platforms = allFields(parts, "platform[]");
    const isPhotoUpload = photos.length > 0;

    if (!video?.body?.length && photos.length === 0) {
      return res.status(400).json({ error: "video 또는 photos[] 파일이 필요합니다" });
    }
    if (!title) return res.status(400).json({ error: "title 값이 필요합니다" });
    if (!user) return res.status(400).json({ error: "user 값이 필요합니다" });
    if (platforms.length === 0) return res.status(400).json({ error: "platform 값을 하나 이상 선택해주세요" });
    if (video?.body?.length && photos.length > 0) {
      return res.status(400).json({ error: "video와 photos[]를 동시에 업로드할 수 없습니다" });
    }

    if (isPhotoUpload) {
      if (photos.length > 10) {
        return res.status(400).json({ error: "캐러셀 이미지는 최대 10장까지 업로드할 수 있습니다" });
      }
      const invalidPhoto = photos.find((photo) => !photo.body?.length || !isAllowedPhoto(photo));
      if (invalidPhoto) {
        return res.status(400).json({ error: "jpg, jpeg, png, webp 형식의 이미지만 업로드할 수 있습니다" });
      }
    } else {
      if (video.body.length > MAX_UPLOAD_BYTES) {
        return res.status(400).json({ error: "동영상 파일은 120MB 이하만 업로드할 수 있습니다" });
      }
      if (!isAllowedVideo(video)) {
        return res.status(400).json({ error: "mp4, mov, webm, m4v 형식의 동영상만 업로드할 수 있습니다" });
      }
    }

    const form = new FormData();
    form.set("title", title);
    form.set("user", user);
    platforms.forEach((platform) => form.append("platform[]", platform));
    if (isPhotoUpload) {
      photos.forEach((photo, index) => {
        form.append(
          "photos[]",
          new Blob([photo.body], { type: photo.contentType }),
          photo.filename || `photo-${index + 1}.jpg`
        );
      });
    } else {
      form.set("video", new Blob([video.body], { type: video.contentType }), video.filename || "video.mp4");
    }

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), UPLOAD_TIMEOUT_MS);

    try {
      const uploadRes = await fetch(isPhotoUpload ? UPLOAD_PHOTOS_URL : UPLOAD_VIDEO_URL, {
        method: "POST",
        headers: {
          Authorization: `Apikey ${apiKey}`,
        },
        body: form,
        signal: abortController.signal,
      });

      const responseText = await uploadRes.text();
      let data = null;
      try {
        data = JSON.parse(responseText);
      } catch {
        data = { message: responseText };
      }

      if (!uploadRes.ok) {
        const errorBody = normalizeErrorResponse(uploadRes.status, data, responseText);
        console.error("[upload-post] upstream error", errorBody);
        return res.status(uploadRes.status).json(errorBody);
      }

      const successBody = normalizeSuccessResponse(uploadRes.status, data, responseText);
      console.log("[upload-post] upstream success", {
        user,
        platforms,
        mode: isPhotoUpload ? "photos" : "video",
        photosCount: photos.length,
        jobId: successBody.jobId,
        upstreamStatus: successBody.upstream.status,
      });
      return res.status(uploadRes.status).json(successBody);
    } finally {
      clearTimeout(timeout);
    }
  } catch (err) {
    if (err?.name === "AbortError") {
      return res.status(504).json({
        ok: false,
        status: 504,
        error: "Upload Post 업스트림 응답 시간이 초과되었습니다",
        upstream: {
          status: "timeout",
          message: `업스트림 응답이 ${UPLOAD_TIMEOUT_MS / 1000}초 안에 완료되지 않았습니다`,
        },
      });
    }

    return res.status(500).json({
      ok: false,
      status: 500,
      error: err.message || "Upload Post 업로드 실패",
    });
  }
}
