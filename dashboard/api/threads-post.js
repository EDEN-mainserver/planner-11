// Threads Graph API 카드뉴스 게시
// base64 이미지 → Vercel Blob 임시 저장 → 공개 URL → Threads 게시

import { put, del } from "@vercel/blob";

const TH_API = "https://graph.threads.net/v1.0";

async function uploadBase64ToBlob(base64DataUrl, filename) {
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("잘못된 이미지 형식");
  const buffer = Buffer.from(match[2], "base64");
  const blob = await put(`th-temp/${filename}`, buffer, {
    access: "public",
    contentType: match[1],
  });
  return blob.url;
}

// 단일 미디어 컨테이너 생성
async function createContainer(userId, accessToken, imageUrl, text, isCarouselItem) {
  const params = new URLSearchParams({ access_token: accessToken });
  if (isCarouselItem) {
    params.set("media_type", "IMAGE");
    params.set("image_url", imageUrl);
    params.set("is_carousel_item", "true");
  } else {
    params.set("media_type", "IMAGE");
    params.set("image_url", imageUrl);
    if (text) params.set("text", text);
  }

  const res = await fetch(`${TH_API}/${userId}/threads`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || `Threads 컨테이너 생성 실패 (${res.status})`);
  }
  return data.id;
}

// 캐러셀 컨테이너 생성
async function createCarouselContainer(userId, accessToken, childrenIds, text) {
  const params = new URLSearchParams({
    media_type: "CAROUSEL",
    children: childrenIds.join(","),
    access_token: accessToken,
  });
  if (text) params.set("text", text);

  const res = await fetch(`${TH_API}/${userId}/threads`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || `Threads 캐러셀 생성 실패 (${res.status})`);
  }
  return data.id;
}

// 게시 (publish)
async function publishContainer(userId, accessToken, creationId) {
  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  const res = await fetch(`${TH_API}/${userId}/threads_publish`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || `Threads 게시 실패 (${res.status})`);
  }
  return data.id;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { userId, accessToken, images, caption } = req.body || {};

  if (!userId || !accessToken) {
    return res.status(400).json({ error: "userId와 accessToken이 필요합니다" });
  }
  if (!images || images.length === 0) {
    return res.status(400).json({ error: "이미지가 없습니다" });
  }

  const blobUrls = [];
  try {
    // 1. 이미지 업로드
    const uploadedUrls = await Promise.all(
      images.map((img, i) => {
        if (typeof img === "string" && img.startsWith("http")) return Promise.resolve(img);
        return uploadBase64ToBlob(img, `th-${Date.now()}-${i}.jpg`).then((url) => {
          blobUrls.push(url);
          return url;
        });
      })
    );

    let publishedId;
    const limited = uploadedUrls.slice(0, 10); // Threads 최대 10장

    if (limited.length === 1) {
      const containerId = await createContainer(userId, accessToken, limited[0], caption || "", false);
      publishedId = await publishContainer(userId, accessToken, containerId);
    } else {
      const childIds = await Promise.all(
        limited.map((url) => createContainer(userId, accessToken, url, "", true))
      );
      const carouselId = await createCarouselContainer(userId, accessToken, childIds, caption || "");
      publishedId = await publishContainer(userId, accessToken, carouselId);
    }

    // 2. Blob 정리
    if (blobUrls.length > 0) {
      Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    }

    return res.status(200).json({ ok: true, mediaId: publishedId, permalink: null });
  } catch (err) {
    if (blobUrls.length > 0) {
      Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    }
    return res.status(500).json({ error: err.message });
  }
}
