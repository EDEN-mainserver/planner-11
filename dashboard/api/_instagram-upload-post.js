import { put, del } from "@vercel/blob";

const IG_API = "https://graph.facebook.com/v21.0";

function normalizeToken(value) {
  return String(value || "").replace(/[\s\u200B-\u200D\uFEFF]+/g, "").trim();
}

async function uploadToImgbb(base64Image, apiKey) {
  const params = new URLSearchParams({ key: apiKey, image: base64Image });
  const res = await fetch("https://api.imgbb.com/1/upload", {
    method: "POST",
    body: params,
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  if (!res.ok || !data?.success || !data?.data?.url) {
    const detail = data?.error || text.slice(0, 240).replace(/\s+/g, " ");
    throw new Error(`imgbb 업로드 실패 [${res.status}]: ${detail}`);
  }
  return data.data.url;
}

function toProxyUrl(blobUrl) {
  const appBase = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${appBase}/api/ig-serve?u=${encodeURIComponent(blobUrl)}`;
}

async function publishPublicBuffer(buffer, filename) {
  if (process.env.IMGBB_API_KEY) {
    try {
      return {
        publicUrl: await uploadToImgbb(buffer.toString("base64"), process.env.IMGBB_API_KEY),
        blobUrl: null,
        delivery: "imgbb",
      };
    } catch (err) {
      if (!process.env.BLOB_READ_WRITE_TOKEN) throw err;
      console.warn(`[local-upload-post] imgbb 실패, Blob 폴백: ${err.message}`);
    }
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("IMGBB_API_KEY 또는 BLOB_READ_WRITE_TOKEN 환경변수가 필요합니다");
  }

  const blob = await put(`ig-temp/${filename}`, buffer, {
    access: "public",
    contentType: "image/jpeg",
  });
  return {
    publicUrl: toProxyUrl(blob.url),
    blobUrl: blob.url,
    delivery: "blob-proxy",
  };
}

async function normalizePhotoItem(photo, index) {
  const sourceName = photo?.filename || `photo-${index + 1}.jpg`;
  const sourceType = String(photo?.contentType || "application/octet-stream").toLowerCase();
  let sourceKind = "binary";
  let binary;

  if (photo?.url) {
    sourceKind = "url";
    const downloadRes = await fetch(photo.url);
    if (!downloadRes.ok) {
      throw new Error(`이미지 다운로드 실패 [${downloadRes.status}]`);
    }
    binary = Buffer.from(await downloadRes.arrayBuffer());
  } else {
    binary = Buffer.from(photo.body || []);
  }

  const { default: sharp } = await import("sharp");
  const metadata = await sharp(binary).metadata().catch(() => null);
  const jpegBuffer = await sharp(binary).jpeg({ quality: 92 }).toBuffer();
  const filename = sourceName.replace(/\.\w+$/, ".jpg");
  const uploaded = await publishPublicBuffer(jpegBuffer, filename);

  return {
    publicUrl: uploaded.publicUrl,
    blobUrl: uploaded.blobUrl,
    change: {
      index,
      original_filename: sourceName,
      original_content_type: sourceType,
      source_kind: sourceKind,
      transformed: true,
      output_content_type: "image/jpeg",
      original_width: metadata?.width || null,
      original_height: metadata?.height || null,
      delivery: uploaded.delivery,
    },
  };
}

async function createMediaContainer(accountId, accessToken, imageUrl, caption, isCarouselItem) {
  const params = new URLSearchParams({
    image_url: imageUrl,
    access_token: normalizeToken(accessToken),
    media_type: "IMAGE",
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
  if (!res.ok || !data?.id) {
    throw new Error(`미디어 컨테이너 생성 실패 [${res.status}]: ${JSON.stringify(data.error || data)}`);
  }
  return data.id;
}

async function createCarouselContainer(accountId, accessToken, childIds, caption) {
  const params = new URLSearchParams({
    media_type: "CAROUSEL",
    children: childIds.join(","),
    caption: caption || "",
    access_token: normalizeToken(accessToken),
  });
  const res = await fetch(`${IG_API}/${accountId}/media`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data?.id) {
    throw new Error(data.error?.message || `캐러셀 컨테이너 생성 실패 (${res.status})`);
  }
  return data.id;
}

async function publishMedia(accountId, accessToken, creationId) {
  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: normalizeToken(accessToken),
  });
  const res = await fetch(`${IG_API}/${accountId}/media_publish`, {
    method: "POST",
    body: params,
  });
  const data = await res.json();
  if (!res.ok || !data?.id) {
    throw new Error(data.error?.message || `게시 실패 (${res.status})`);
  }
  return data.id;
}

async function getPermalink(mediaId, accessToken) {
  try {
    const res = await fetch(
      `${IG_API}/${mediaId}?fields=permalink&access_token=${normalizeToken(accessToken)}`
    );
    const data = await res.json();
    return data.permalink || null;
  } catch {
    return null;
  }
}

export async function runInstagramUploadPostJob({
  accountId,
  accessToken,
  photos,
  title,
  logs = [],
}) {
  if (!accountId || !accessToken) {
    throw new Error("instagram_account_id와 instagram_access_token이 필요합니다");
  }
  if (!Array.isArray(photos) || photos.length === 0) {
    throw new Error("photos[] 파일이 필요합니다");
  }

  const log = (msg, data) => {
    logs.push({ msg, data, at: new Date().toISOString() });
    console.log("[local-upload-post]", msg, data !== undefined ? JSON.stringify(data) : "");
  };

  const blobUrls = [];

  try {
    log("인스타 업로드 시작", { accountId, photos: photos.length });
    const normalized = [];
    const changes = [];

    for (let i = 0; i < photos.length; i += 1) {
      log(`이미지 ${i + 1} 정규화 시작`);
      const item = await normalizePhotoItem(photos[i], i);
      normalized.push(item.publicUrl);
      changes.push(item.change);
      if (item.blobUrl) blobUrls.push(item.blobUrl);
      log(`이미지 ${i + 1} 정규화 완료`, { url: item.publicUrl });
    }

    let containerId;
    let mediaId;

    if (normalized.length === 1) {
      containerId = await createMediaContainer(accountId, accessToken, normalized[0], title || "", false);
      mediaId = await publishMedia(accountId, accessToken, containerId);
    } else {
      const childIds = [];
      for (let i = 0; i < normalized.length; i += 1) {
        log(`캐러셀 아이템 ${i + 1} 컨테이너 생성`);
        childIds.push(await createMediaContainer(accountId, accessToken, normalized[i], "", true));
      }
      containerId = await createCarouselContainer(accountId, accessToken, childIds, title || "");
      mediaId = await publishMedia(accountId, accessToken, containerId);
    }

    const permalink = await getPermalink(mediaId, accessToken);
    log("인스타 게시 완료", { mediaId, permalink, containerId });

    return {
      success: true,
      url: permalink,
      post_id: mediaId,
      container_id: containerId,
      photos_were_processed: true,
      changes_per_image: changes,
      logs,
    };
  } finally {
    if (blobUrls.length > 0) {
      Promise.allSettled(blobUrls.map((url) => del(url))).catch(() => {});
    }
  }
}
