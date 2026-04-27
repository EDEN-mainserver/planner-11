// Threads Graph API 게시
// 텍스트 전용 또는 base64 이미지 → imgbb(우선) / Vercel Blob(폴백) → 공개 URL → Threads 게시

import { put, del } from "@vercel/blob";

const TH_API = "https://graph.threads.net/v1.0";

// imgbb 업로드 — 공개 접근 보장 URL 반환
async function uploadToImgbb(b64Pure, apiKey) {
  const params = new URLSearchParams({ key: apiKey, image: b64Pure });
  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`imgbb 업로드 실패: ${JSON.stringify(data.error || data)}`);
  }
  return data.data.url;
}

async function uploadBase64ToBlob(base64DataUrl, filename) {
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("잘못된 이미지 형식");
  const b64Pure = match[2];
  const mime = match[1];

  // imgbb 우선 사용
  if (process.env.IMGBB_API_KEY) {
    return { url: await uploadToImgbb(b64Pure, process.env.IMGBB_API_KEY), blobUrl: null };
  }

  // Vercel Blob 폴백
  const buffer = Buffer.from(b64Pure, "base64");
  const blob = await put(`th-temp/${filename}`, buffer, {
    access: "public",
    contentType: mime,
  });
  return { url: blob.url, blobUrl: blob.url };
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

export const config = { api: { bodyParser: { sizeLimit: "25mb" } } };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { userId, accessToken, images = [], text, caption } = req.body || {};
  const postText = text || caption || "";

  if (!userId || !accessToken) {
    return res.status(400).json({ error: "userId와 accessToken이 필요합니다" });
  }

  const logs = [];
  const log = (msg, data) => logs.push({ msg, data });
  const blobUrls = [];

  try {
    log("요청 수신", { userId, imageCount: images.length, textLen: postText.length });

    let publishedId;

    if (images.length === 0) {
      // ── 텍스트 전용 게시 ──
      log("텍스트 전용 게시 시작");
      if (!postText.trim()) throw new Error("텍스트 또는 이미지가 필요합니다");

      const params = new URLSearchParams({
        media_type: "TEXT",
        text: postText,
        access_token: accessToken,
      });
      const containerRes = await fetch(`${TH_API}/${userId}/threads`, {
        method: "POST",
        body: params,
      });
      const containerData = await containerRes.json();
      if (!containerRes.ok || !containerData.id) {
        throw new Error(containerData.error?.message || `컨테이너 생성 실패 (${containerRes.status})`);
      }
      log("텍스트 컨테이너 생성", { id: containerData.id });

      // 30초 대기 (Threads API 권장)
      await new Promise(r => setTimeout(r, 30000));
      log("30초 대기 완료 — 게시 시도");

      publishedId = await publishContainer(userId, accessToken, containerData.id);
      log("텍스트 게시 완료", { publishedId });

    } else {
      // ── 이미지 포함 게시 ──
      log(`이미지 업로드 시작 (${images.length}장)`);

      const uploadedUrls = await Promise.all(
        images.map(async (img, i) => {
          const filename = `th-${Date.now()}-${i}.jpg`;
          if (typeof img === "string" && img.startsWith("http")) return img;
          const { url, blobUrl } = await uploadBase64ToBlob(img, filename);
          if (blobUrl) blobUrls.push(blobUrl);
          log(`이미지 ${i + 1} 업로드 완료`, url.slice(0, 60));
          return url;
        })
      );

      const limited = uploadedUrls.slice(0, 10);

      if (limited.length === 1) {
        const containerId = await createContainer(userId, accessToken, limited[0], postText, false);
        log("단일 컨테이너 생성", { containerId });
        await new Promise(r => setTimeout(r, 30000));
        log("30초 대기 완료 — 게시 시도");
        publishedId = await publishContainer(userId, accessToken, containerId);
      } else {
        const childIds = await Promise.all(
          limited.map((url) => createContainer(userId, accessToken, url, "", true))
        );
        log("캐러셀 아이템 생성", { childIds });
        const carouselId = await createCarouselContainer(userId, accessToken, childIds, postText);
        log("캐러셀 컨테이너 생성", { carouselId });
        await new Promise(r => setTimeout(r, 30000));
        log("30초 대기 완료 — 게시 시도");
        publishedId = await publishContainer(userId, accessToken, carouselId);
      }

      log("이미지 게시 완료", { publishedId });
    }

    // Blob 정리
    if (blobUrls.length > 0) {
      Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    }

    return res.status(200).json({ ok: true, mediaId: publishedId, logs });
  } catch (err) {
    log("오류 발생", { message: err.message });
    if (blobUrls.length > 0) {
      Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    }
    return res.status(500).json({ error: err.message, logs });
  }
}
