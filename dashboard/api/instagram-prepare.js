// Instagram 예약용 이미지 공개 URL 준비 API
// POST /api/instagram-prepare  Body: { images: [] }
// base64 또는 http URL을 Vercel Blob 공개 URL로 변환해서 반환

import { prepareInstagramImages } from "./instagram-post.js";

export const config = {
  api: {
    bodyParser: { sizeLimit: "50mb" },
    maxDuration: 120,
  },
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { images } = req.body || {};
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: "이미지가 없습니다" });
  }

  try {
    const { publicUrls } = await prepareInstagramImages(images);
    return res.status(200).json({ ok: true, imageUrls: publicUrls });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
