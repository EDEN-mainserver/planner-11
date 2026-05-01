/* global Buffer, process */

import { head, put } from "@vercel/blob";
import { runInstagramUploadPostJob } from "./_instagram-upload-post.js";

export const config = {
  api: {
    bodyParser: false,
    maxDuration: 120,
  },
};

const MAX_UPLOAD_BYTES = 120 * 1024 * 1024;
const MAX_PHOTOS = 10;
const STATUS_PREFIX = "upload-post-local/status";
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Idempotency-Key, X-Idempotency-Key, X-Request-Id");
}

function getBoundary(contentType) {
  const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
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
    if (total > MAX_UPLOAD_BYTES) {
      throw new Error("이미지 업로드 총 용량은 120MB 이하만 가능합니다");
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

function isAllowedPhoto(photo) {
  const type = String(photo?.contentType || "").toLowerCase();
  const extension = getExtension(photo?.filename);
  return ALLOWED_PHOTO_TYPES.has(type) || ALLOWED_PHOTO_EXTENSIONS.has(extension);
}

function normalizeHeaderValue(value) {
  return String(value || "").trim();
}

function buildStatusPath(requestId) {
  return `${STATUS_PREFIX}/${requestId}.json`;
}

async function readStatus(requestId) {
  const info = await head(buildStatusPath(requestId)).catch(() => null);
  if (!info?.url) return null;
  const res = await fetch(info.url, { cache: "no-store" });
  if (!res.ok) return null;
  return await res.json();
}

async function writeStatus(requestId, data) {
  await put(buildStatusPath(requestId), JSON.stringify(data, null, 2), {
    access: "public",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

function buildPendingStatus({ requestId, user, platforms, photoCount }) {
  const now = new Date().toISOString();
  return {
    request_id: requestId,
    status: "pending",
    completed: 0,
    total: platforms.length,
    created_at: now,
    last_update: now,
    user,
    photo_count: photoCount,
    results: [],
  };
}

function buildCompletedStatus(requestId, result) {
  const now = new Date().toISOString();
  return {
    request_id: requestId,
    status: "completed",
    completed: 1,
    total: 1,
    created_at: result.created_at || now,
    last_update: now,
    user: result.user,
    photo_count: result.photo_count,
    results: [
      {
        platform: "instagram",
        success: !!result.results?.instagram?.success,
        message: result.results?.instagram?.success ? "Published" : result.results?.instagram?.error || "Failed",
        upload_timestamp: now,
        data: result.results?.instagram || null,
      },
    ],
    response: result,
  };
}

function buildFailedStatus(requestId, err, pending) {
  const now = new Date().toISOString();
  return {
    request_id: requestId,
    status: "completed",
    completed: 1,
    total: 1,
    created_at: pending?.created_at || now,
    last_update: now,
    user: pending?.user || "",
    photo_count: pending?.photo_count || 0,
    results: [
      {
        platform: "instagram",
        success: false,
        message: err.message,
        upload_timestamp: now,
      },
    ],
    response: {
      success: true,
      results: {
        instagram: {
          success: false,
          error: err.message,
        },
      },
    },
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  try {
    const contentType = req.headers["content-type"] || "";
    const boundary = getBoundary(contentType);
    if (!boundary) return res.status(400).json({ error: "multipart/form-data 요청이 필요합니다" });

    const buffer = await readRequestBuffer(req);
    const parts = parseMultipart(buffer, boundary);
    const photos = parts.filter((part) => part.name === "photos[]" && part.filename);
    const title = firstField(parts, "title");
    const user = firstField(parts, "user");
    const platforms = allFields(parts, "platform[]");
    const requestId =
      firstField(parts, "request_id") ||
      normalizeHeaderValue(req.headers["x-request-id"]) ||
      normalizeHeaderValue(req.headers["idempotency-key"]) ||
      normalizeHeaderValue(req.headers["x-idempotency-key"]) ||
      crypto.randomUUID();
    const asyncUpload = ["true", "1", "yes"].includes(firstField(parts, "async_upload").toLowerCase());
    const accountId = firstField(parts, "instagram_account_id");
    const accessToken = firstField(parts, "instagram_access_token");

    if (photos.length === 0) {
      return res.status(400).json({ error: "photos[] 파일이 필요합니다" });
    }
    if (photos.length > MAX_PHOTOS) {
      return res.status(400).json({ error: "캐러셀 이미지는 최대 10장까지 업로드할 수 있습니다" });
    }
    if (!user) return res.status(400).json({ error: "user 값이 필요합니다" });
    if (platforms.length === 0) return res.status(400).json({ error: "platform 값을 하나 이상 선택해주세요" });
    if (platforms.length !== 1 || platforms[0] !== "instagram") {
      return res.status(400).json({ error: "현재 로컬 구현은 platform[]=instagram 사진 업로드만 지원합니다" });
    }
    const invalidPhoto = photos.find((photo) => !photo.body?.length || !isAllowedPhoto(photo));
    if (invalidPhoto) {
      return res.status(400).json({ error: "jpg, jpeg, png, webp 형식의 이미지만 업로드할 수 있습니다" });
    }

    const existing = await readStatus(requestId);
    if (existing?.response) {
      return res.status(200).json(existing.response);
    }

    const pending = buildPendingStatus({
      requestId,
      user,
      platforms,
      photoCount: photos.length,
    });
    await writeStatus(requestId, pending);

    const logs = [];
    try {
      const instagram = await runInstagramUploadPostJob({
        accountId,
        accessToken,
        photos,
        title,
        logs,
      });

      const response = asyncUpload
        ? {
            success: true,
            message: "Photo upload initiated successfully in background.",
            request_id: requestId,
            total_platforms: 1,
          }
        : {
            success: true,
            results: {
              instagram,
            },
            request_id: requestId,
          };

      const completed = buildCompletedStatus(requestId, {
        ...response,
        created_at: pending.created_at,
        user,
        photo_count: photos.length,
      });
      await writeStatus(requestId, completed);
      return res.status(200).json(response);
    } catch (err) {
      const failed = buildFailedStatus(requestId, err, pending);
      await writeStatus(requestId, failed);
      return res.status(500).json({
        success: false,
        request_id: requestId,
        error: err.message || "로컬 Upload Post 업로드 실패",
      });
    }
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "로컬 Upload Post 업로드 실패",
    });
  }
}
