// Instagram Graph API 카드뉴스 게시
// base64 이미지 → Vercel Blob 임시 저장 → 공개 URL 획득 → IG 게시

import { put, del } from "@vercel/blob";

// 서버 로그 (Vercel 함수 로그에서 확인 가능)
function slog(msg, data) {
  console.log(`[IG-API] ${msg}`, data !== undefined ? JSON.stringify(data) : "");
}

// 카드 1장 base64 JPEG ≈ 1MB, 10장 ≈ 10MB → 기본 1MB 제한 초과 방지
export const config = { api: { bodyParser: { sizeLimit: "25mb" } } };

const IG_API = "https://graph.instagram.com/v21.0";

// HTTP URL → 서버에서 다운로드 → JPEG 변환 → Blob 업로드 → 공개 URL 반환
// Instagram이 접근 가능한 안정적인 공개 URL이 필요하므로 항상 Blob을 경유
async function uploadHttpUrlToBlob(httpUrl, filename) {
  const res = await fetch(httpUrl);
  if (!res.ok) throw new Error(`이미지 다운로드 실패 [${res.status}]: ${httpUrl.slice(0, 80)}`);
  const arrayBuffer = await res.arrayBuffer();
  const { default: sharp } = await import("sharp");
  const buffer = await sharp(Buffer.from(arrayBuffer)).jpeg({ quality: 92 }).toBuffer();
  const jpegFilename = filename.replace(/\.\w+$/, ".jpg");
  const blob = await put(`ig-temp/${jpegFilename}`, buffer, {
    access: "public",
    contentType: "image/jpeg",
  });
  return blob.url;
}

// base64 데이터 URL → JPEG 변환 → Blob 업로드 → 공개 URL 반환
// Instagram은 JPEG만 허용하므로 PNG 등은 sharp로 변환
async function uploadBase64ToBlob(base64DataUrl, filename) {
  const match = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error("잘못된 이미지 형식");

  let buffer = Buffer.from(match[2], "base64");

  // PNG/webp 등 → JPEG 변환 (Instagram 요구사항)
  const { default: sharp } = await import("sharp");
  buffer = await sharp(buffer).jpeg({ quality: 92 }).toBuffer();

  const jpegFilename = filename.replace(/\.\w+$/, ".jpg");
  const blob = await put(`ig-temp/${jpegFilename}`, buffer, {
    access: "public",
    contentType: "image/jpeg",
  });
  return blob.url;
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

    // BLOB_READ_WRITE_TOKEN 체크
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      log("경고: BLOB_READ_WRITE_TOKEN 없음 — HTTP URL 이미지만 처리 가능");
    }

    // 1. 이미지 업로드 (base64 → Vercel Blob 공개 URL)
    const uploadedUrls = await Promise.all(
      images.map(async (img, i) => {
        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          throw new Error("BLOB_READ_WRITE_TOKEN 환경변수가 없습니다. Vercel Storage → Blob 설정 필요");
        }
        const filename = `card-${Date.now()}-${i}.jpg`;
        if (typeof img === "string" && img.startsWith("http")) {
          // HTTP URL도 Instagram 접근 보장을 위해 Vercel Blob으로 재업로드
          log(`이미지 ${i+1}: HTTP URL → Blob 재업로드 시작`, img.slice(0, 60));
          const url = await uploadHttpUrlToBlob(img, filename);
          blobUrls.push(url);
          log(`이미지 ${i+1}: Blob 재업로드 완료`, url);
          return url;
        }
        log(`이미지 ${i+1}: base64 → Blob 업로드 시작`);
        const url = await uploadBase64ToBlob(img, filename);
        blobUrls.push(url);
        log(`이미지 ${i+1}: Blob 업로드 완료 (JPEG)`, url);
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
