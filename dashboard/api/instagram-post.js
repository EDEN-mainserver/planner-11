// Instagram Graph API 카드뉴스 게시
// base64 이미지 → Vercel Blob 임시 저장 → 공개 URL 획득 → IG 게시

import { put, del } from "@vercel/blob";

// 서버 로그 (Vercel 함수 로그에서 확인 가능)
function slog(msg, data) {
  console.log(`[IG-API] ${msg}`, data !== undefined ? JSON.stringify(data) : "");
}

// 카드 1장 base64 JPEG ≈ 1MB, 10장 ≈ 10MB → 기본 1MB 제한 초과 방지
export const config = { api: { bodyParser: { sizeLimit: "25mb" } } };

const IG_API = "https://graph.facebook.com/v21.0";

// imgbb 업로드 — Instagram이 확실히 접근 가능한 i.ibb.co URL 반환
async function uploadToImgbb(b64Pure, apiKey) {
  const params = new URLSearchParams({ key: apiKey, image: b64Pure });
  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: params,
  });
  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();
  let data = null;
  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }
  if (!res.ok || !data?.success) {
    const detail = data?.error || text.slice(0, 240).replace(/\s+/g, " ");
    throw new Error(`imgbb 업로드 실패 [${res.status}]: ${detail}`);
  }
  return data.data.url; // https://i.ibb.co/xxxxx/image.jpg
}

// HTTP URL → 다운로드 → JPEG 변환 → 공개 URL (imgbb 우선, Blob 폴백)
async function uploadHttpUrl(httpUrl, filename) {
  const res = await fetch(httpUrl);
  if (!res.ok) throw new Error(`이미지 다운로드 실패 [${res.status}]`);
  const arrayBuffer = await res.arrayBuffer();
  const { default: sharp } = await import("sharp");
  const buffer = await sharp(Buffer.from(arrayBuffer)).jpeg({ quality: 92 }).toBuffer();

  if (process.env.IMGBB_API_KEY) {
    try {
      return { url: await uploadToImgbb(buffer.toString("base64"), process.env.IMGBB_API_KEY), blobUrl: null };
    } catch (err) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw err;
      console.warn(`[IG-API] imgbb 실패, Blob 폴백: ${err.message}`);
    }
  }
  const jpegFilename = filename.replace(/\.\w+$/, ".jpg");
  const blob = await put(`ig-temp/${jpegFilename}`, buffer, { access: "public", contentType: "image/jpeg" });
  return { url: toProxyUrl(blob.url), blobUrl: blob.url };
}

// base64 데이터 URL → JPEG 변환 → 공개 URL (imgbb 우선, Blob 폴백)
async function uploadBase64(base64DataUrl, filename) {
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("잘못된 이미지 형식");

  let buffer = Buffer.from(match[2], "base64");

  // PNG/webp 등 → JPEG 변환 (Instagram 요구사항)
  const { default: sharp } = await import("sharp");
  buffer = await sharp(buffer).jpeg({ quality: 92 }).toBuffer();

  if (process.env.IMGBB_API_KEY) {
    try {
      return { url: await uploadToImgbb(buffer.toString("base64"), process.env.IMGBB_API_KEY), blobUrl: null };
    } catch (err) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw err;
      console.warn(`[IG-API] imgbb 실패, Blob 폴백: ${err.message}`);
    }
  }
  const jpegFilename = filename.replace(/\.\w+$/, ".jpg");
  const blob = await put(`ig-temp/${jpegFilename}`, buffer, { access: "public", contentType: "image/jpeg" });
  return { url: toProxyUrl(blob.url), blobUrl: blob.url };
}

// 단일 미디어 컨테이너 생성
// 캐러셀 아이템: is_carousel_item=true만, media_type 없음
// 단일 이미지: media_type=IMAGE 명시
async function createMediaContainer(accountId, accessToken, imageUrl, caption, isCarouselItem) {
  const params = new URLSearchParams({
    image_url: imageUrl,
    access_token: accessToken,
  });
  if (isCarouselItem) {
    params.set("media_type", "IMAGE");
    params.set("is_carousel_item", "true");
  } else {
    params.set("media_type", "IMAGE");
    if (caption) params.set("caption", caption);
  }

  const res = await fetch(`${IG_API}/${accountId}/media`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data.id) {
    // 전체 에러 객체 포함해서 던짐
    const errDetail = JSON.stringify(data.error || data);
    throw new Error(`미디어 컨테이너 생성 실패 [${res.status}]: ${errDetail}`);
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

// Vercel Blob URL → 우리 앱 도메인 프록시 URL 변환
// Instagram 크롤러는 vercel-storage.com 접근 불가 → vercel.app 도메인으로 우회
function toProxyUrl(blobUrl) {
  const appBase = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appBase}/api/ig-serve?u=${encodeURIComponent(blobUrl)}`;
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
  const logs = [];
  const log = (msg, data) => { logs.push({ msg, data }); slog(msg, data); };

  try {
    log("요청 수신", { accountId, imageCount: images.length, captionLen: (caption||"").length });

    // 1. 이미지 업로드 → Instagram 접근 가능한 공개 URL 획득
    // imgbb API key 있으면 imgbb 사용, 없으면 Vercel Blob + 프록시 폴백
    if (!process.env.IMGBB_API_KEY && !process.env.BLOB_READ_WRITE_TOKEN) {
      throw new Error("IMGBB_API_KEY 또는 BLOB_READ_WRITE_TOKEN 환경변수가 필요합니다");
    }
    log(process.env.IMGBB_API_KEY ? "imgbb 업로드 모드" : "Vercel Blob 프록시 모드");

    const uploadedUrls = await Promise.all(
      images.map(async (img, i) => {
        const filename = `card-${Date.now()}-${i}.jpg`;
        if (typeof img === "string" && img.startsWith("http")) {
          log(`이미지 ${i+1}: HTTP URL → 변환 업로드 시작`, img.slice(0, 60));
          const { url, blobUrl } = await uploadHttpUrl(img, filename);
          if (blobUrl) blobUrls.push(blobUrl);
          log(`이미지 ${i+1}: 업로드 완료`, url);
          return url;
        }
        log(`이미지 ${i+1}: base64 → 업로드 시작`);
        const { url, blobUrl } = await uploadBase64(img, filename);
        if (blobUrl) blobUrls.push(blobUrl);
        log(`이미지 ${i+1}: 업로드 완료`, url);
        return url;
      })
    );

    let publishedId;

    if (uploadedUrls.length === 1) {
      log("단일 이미지 게시 시작", uploadedUrls[0].slice(0, 60));
      const containerId = await createMediaContainer(
        accountId, accessToken, uploadedUrls[0], caption || "", false
      );
      log("미디어 컨테이너 생성", { containerId });
      publishedId = await publishMedia(accountId, accessToken, containerId);
      log("게시 완료", { publishedId });
    } else {
      log(`캐러셀 게시 시작 (${uploadedUrls.length}장)`);
      const limited = uploadedUrls.slice(0, 10);
      const childIds = await Promise.all(
        limited.map((url, i) => {
          log(`캐러셀 아이템 ${i+1} 컨테이너 생성`);
          return createMediaContainer(accountId, accessToken, url, "", true);
        })
      );
      log("캐러셀 컨테이너 생성", { childIds });
      const carouselId = await createCarouselContainer(
        accountId, accessToken, childIds, caption || ""
      );
      log("캐러셀 컨테이너 완성", { carouselId });
      publishedId = await publishMedia(accountId, accessToken, carouselId);
      log("캐러셀 게시 완료", { publishedId });
    }

    // 3. permalink 조회
    const permalink = await getPermalink(publishedId, accessToken);
    log("Permalink", permalink);

    // 4. 임시 Blob 파일 정리 (백그라운드)
    if (blobUrls.length > 0) {
      Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    }

    return res.status(200).json({ ok: true, mediaId: publishedId, permalink, logs });
  } catch (err) {
    log("오류 발생", { message: err.message, stack: err.stack?.split("\n")[0] });
    if (blobUrls.length > 0) {
      Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    }
    return res.status(500).json({ error: err.message, logs });
  }
}
