import { runInstagramUploadPostJob } from "./_instagram-upload-post.js";

export const config = { api: { bodyParser: { sizeLimit: "25mb" } } };

function normalizeToken(value) {
  return String(value || "").replace(/[\s\u200B-\u200D\uFEFF]+/g, "").trim();
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { accountId, accessToken, images, caption } = req.body || {};
  const normalizedAccountId = String(accountId || "").trim();
  const normalizedAccessToken = normalizeToken(accessToken);

  if (!normalizedAccountId || !normalizedAccessToken) {
    return res.status(400).json({ error: "accountId와 accessToken이 필요합니다" });
  }
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: "이미지가 없습니다" });
  }

  const logs = [];

  try {
    const result = await runInstagramUploadPostJob({
      accountId: normalizedAccountId,
      accessToken: normalizedAccessToken,
      title: caption || "",
      photos: images.map((image, index) => {
        if (typeof image === "string" && image.startsWith("http")) {
          return { url: image, filename: `image-${index + 1}.jpg`, contentType: "image/jpeg" };
        }

        const match = typeof image === "string"
          ? image.match(/^data:([^;]+);base64,(.+)$/)
          : null;
        if (!match) {
          throw new Error("잘못된 이미지 형식");
        }

        return {
          filename: `image-${index + 1}.jpg`,
          contentType: match[1] || "image/jpeg",
          body: Buffer.from(match[2], "base64"),
        };
      }),
      logs,
    });

    return res.status(200).json({
      ok: true,
      mediaId: result.post_id,
      permalink: result.url,
      containerId: result.container_id,
      changesPerImage: result.changes_per_image,
      logs,
    });
  } catch (err) {
    const safeMessage = err.message.includes("Cannot parse access token")
      ? "Instagram 액세스 토큰 형식이 올바르지 않습니다. 게시용 페이지 토큰을 다시 복사해 저장해주세요."
      : err.message;
    logs.push({
      msg: "오류 발생",
      data: { message: safeMessage },
      at: new Date().toISOString(),
    });
    return res.status(500).json({ error: safeMessage, logs });
  }
}
