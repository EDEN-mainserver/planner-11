// ig-mcp 방식: 공개 URL → Instagram Graph API 직접 호출
// ref: github.com/jlbadano/ig-mcp

const IG_API = "https://graph.facebook.com/v22.0";

function normalizeToken(value) {
  return String(value || "").replace(/[\s​-‍﻿]+/g, "").trim();
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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { accountId, accessToken: rawToken, images, caption } = req.body || {};
  const accessToken = normalizeToken(rawToken);

  if (!accountId || !accessToken) {
    return res.status(400).json({ error: "accountId와 accessToken이 필요합니다" });
  }
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: "images 배열이 필요합니다 (공개 URL)" });
  }
  if (images.some(url => !String(url).startsWith("http"))) {
    return res.status(400).json({ error: "images는 공개 https:// URL이어야 합니다" });
  }

  try {
    let containerId;

    if (images.length === 1) {
      containerId = await createContainer(accountId, accessToken, images[0], caption || "", false);
    } else {
      const childIds = [];
      for (const url of images) {
        childIds.push(await createContainer(accountId, accessToken, url, "", true));
      }
      containerId = await createCarouselContainer(accountId, accessToken, childIds, caption || "");
    }

    const mediaId = await publishContainer(accountId, accessToken, containerId);
    const permalink = await getPermalink(mediaId, accessToken);

    return res.status(200).json({ ok: true, mediaId, permalink });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
