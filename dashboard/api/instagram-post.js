// Instagram Graph API 카드뉴스 게시
// base64 이미지 → Vercel Blob 임시 저장 → 공개 URL 획득 → IG 게시

import { put, del } from "@vercel/blob";

const IG_API = "https://graph.facebook.com/v19.0";

// base64 데이터 URL → Blob 업로드 → 공개 URL 반환
async function uploadBase64ToBlob(base64DataUrl, filename) {
  // "data:image/png;base64,xxxx" → Buffer
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("잘못된 이미지 형식");
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], "base64");

  const blob = await put(`ig-temp/${filename}`, buffer, {
    access: "public",
    contentType: mimeType,
  });
  return blob.url;
}

// 단일 미디어 컨테이너 생성
async function createMediaContainer(accountId, accessToken, imageUrl, caption, isCarouselItem) {
  const params = new URLSearchParams({
    image_url: imageUrl,
    access_token: accessToken,
  });
  if (isCarouselItem) {
    params.set("is_carousel_item", "true");
  } else if (caption) {
    params.set("caption", caption);
  }

  const res = await fetch(`${IG_API}/${accountId}/media`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || `미디어 컨테이너 생성 실패 (${res.status})`);
  }
  return data.id;
}

// 캐러셀 컨테이너 생성
async function createCarouselContainer(accountId, accessToken, childrenIds, caption) {
  const params = new URLSearchParams({
    media_type: "CAROUSEL",
    children: childrenIds.join(","),
    caption: caption || "",
    access_token: accessToken,
  });

  const res = await fetch(`${IG_API}/${accountId}/media`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || `캐러셀 컨테이너 생성 실패 (${res.status})`);
  }
  return data.id;
}

// 게시 (publish)
async function publishMedia(accountId, accessToken, creationId) {
  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  const res = await fetch(`${IG_API}/${accountId}/media_publish`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || `게시 실패 (${res.status})`);
  }
  return data.id;
}

// 게시된 미디어 permalink 조회
async function getPermalink(mediaId, accessToken) {
  try {
    const res = await fetch(
      `${IG_API}/${mediaId}?fields=permalink&access_token=${accessToken}`
    );
    const data = await res.json();
    return data.permalink || null;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { accountId, accessToken, images, caption } = req.body || {};

  if (!accountId || !accessToken) {
    return res.status(400).json({ error: "accountId와 accessToken이 필요합니다" });
  }
  if (!images || images.length === 0) {
    return res.status(400).json({ error: "이미지가 없습니다" });
  }

  const blobUrls = [];
  try {
    // 1. 이미지 업로드 (base64 → Vercel Blob 공개 URL)
    const uploadedUrls = await Promise.all(
      images.map((img, i) => {
        // 이미 HTTP URL이면 그대로 사용
        if (typeof img === "string" && img.startsWith("http")) {
          return Promise.resolve(img);
        }
        return uploadBase64ToBlob(img, `card-${Date.now()}-${i}.jpg`).then((url) => {
          blobUrls.push(url); // 나중에 삭제용
          return url;
        });
      })
    );

    let publishedId;

    if (uploadedUrls.length === 1) {
      // 2a. 단일 이미지 게시
      const containerId = await createMediaContainer(
        accountId, accessToken, uploadedUrls[0], caption || "", false
      );
      publishedId = await publishMedia(accountId, accessToken, containerId);
    } else {
      // 2b. 캐러셀 게시 (최대 10장)
      const limited = uploadedUrls.slice(0, 10);
      const childIds = await Promise.all(
        limited.map((url) =>
          createMediaContainer(accountId, accessToken, url, "", true)
        )
      );
      const carouselId = await createCarouselContainer(
        accountId, accessToken, childIds, caption || ""
      );
      publishedId = await publishMedia(accountId, accessToken, carouselId);
    }

    // 3. permalink 조회
    const permalink = await getPermalink(publishedId, accessToken);

    // 4. 임시 Blob 파일 정리 (백그라운드)
    if (blobUrls.length > 0) {
      Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    }

    return res.status(200).json({ ok: true, mediaId: publishedId, permalink });
  } catch (err) {
    // 업로드된 임시 파일 정리
    if (blobUrls.length > 0) {
      Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    }
    return res.status(500).json({ error: err.message });
  }
}
