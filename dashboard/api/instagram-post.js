// Instagram Graph API 게시 (ig-mcp 방식)
// base64 data URL → Vercel Blob 임시 업로드 → 공개 URL → Graph API → Blob 삭제

import { Buffer } from "node:buffer";
import { put, del } from "@vercel/blob";

const IG_API = "https://graph.instagram.com/v22.0";

export const config = {
  api: {
    bodyParser: { sizeLimit: "50mb" },
    maxDuration: 120,
  },
};

function normalizeToken(value) {
  return String(value || "").replace(/[\s\u200B-\u200D\uFEFF-]+/g, "").trim();
}

// base64 data URL → Vercel Blob 업로드 → 공개 URL 반환
async function toPublicUrl(image, index) {
  // 이미 공개 URL이면 그대로 사용
  if (String(image).startsWith("http")) return { url: image, blobUrl: null };

  // base64 data URL 처리
  const match = String(image).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error(`이미지 ${index + 1}: 지원하지 않는 형식입니다`);

  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");
  const ext = mimeType.includes("png") ? "png" : "jpg";
  const filename = `ig-temp/${Date.now()}-${index}.${ext}`;

  const blob = await put(filename, buffer, {
    access: "public",
    contentType: mimeType,
  });

  return { url: blob.url, blobUrl: blob.url };
}

async function createContainer(accountId, accessToken, imageUrl, caption, isCarouselItem) {
  const params = new URLSearchParams({ access_token: accessToken });
  params.set("image_url", imageUrl);
  params.set("media_type", "IMAGE");
  if (isCarouselItem) {
    params.set("is_carousel_item", "true");
  } else {
    params.set("caption", caption || "");
  }
  const res = await fetch(`${IG_API}/${accountId}/media`, { method: "POST", body: params });
  const data = await res.json();
  if (!res.ok || !data?.id) {
    throw new Error(data?.error?.message || `미디어 컨테이너 생성 실패 (${res.status})`);
  }
  return data.id;
}

async function createCarouselContainer(accountId, accessToken, childIds, caption) {
  const params = new URLSearchParams({
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption: caption || "",
    access_token: accessToken,
  });
  const res = await fetch(`${IG_API}/${accountId}/media`, { method: "POST", body: params });
  const data = await res.json();
  if (!res.ok || !data?.id) {
    throw new Error(data?.error?.message || `캐러셀 컨테이너 생성 실패 (${res.status})`);
  }
  return data.id;
}

async function publishContainer(accountId, accessToken, containerId) {
  const params = new URLSearchParams({ creation_id: containerId, access_token: accessToken });
  const res = await fetch(`${IG_API}/${accountId}/media_publish`, { method: "POST", body: params });
  const data = await res.json();
  if (!res.ok || !data?.id) {
    throw new Error(data?.error?.message || `게시 실패 (${res.status})`);
  }
  return data.id;
}

async function getPermalink(mediaId, accessToken) {
  try {
    const res = await fetch(`${IG_API}/${mediaId}?fields=permalink&access_token=${accessToken}`);
    const data = await res.json();
    return data.permalink || null;
  } catch {
    return null;
  }
}

export async function prepareInstagramImages(images) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("이미지가 없습니다");
  }

  const publicUrls = [];
  const blobUrls = [];
  for (let i = 0; i < images.length; i++) {
    const { url, blobUrl } = await toPublicUrl(images[i], i);
    publicUrls.push(url);
    if (blobUrl) blobUrls.push(blobUrl);
  }

  return { publicUrls, blobUrls };
}

export async function postInstagram(accountId, accessToken, images, caption) {
  if (!accountId || !accessToken) {
    throw new Error("accountId와 accessToken이 필요합니다");
  }
  const blobUrls = [];

  try {
    const { publicUrls, blobUrls: preparedBlobUrls } = await prepareInstagramImages(images);
    blobUrls.push(...preparedBlobUrls);

    let containerId;
    if (publicUrls.length === 1) {
      containerId = await createContainer(accountId, accessToken, publicUrls[0], caption || "", false);
    } else {
      const childIds = [];
      for (const url of publicUrls.slice(0, 10)) {
        childIds.push(await createContainer(accountId, accessToken, url, "", true));
      }
      containerId = await createCarouselContainer(accountId, accessToken, childIds, caption || "");
    }

    const mediaId = await publishContainer(accountId, accessToken, containerId);
    const permalink = await getPermalink(mediaId, accessToken);
    return { ok: true, mediaId, permalink };
  } finally {
    if (blobUrls.length > 0) {
      Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    }
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { accountId, accessToken: rawToken, images, caption } = req.body || {};
  const accessToken = normalizeToken(rawToken);

  try {
    const result = await postInstagram(accountId, accessToken, images, caption);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
