// HTML 문자열 → 1080×1350 스크린샷 API
// POST /api/html-screenshot
//   Body: { htmls: string[], format?: "png"|"jpeg", upload?: boolean }
//   upload=false (기본): images에 data URL 반환 (base64)
//   upload=true:        images에 Blob 공개 URL 반환 (큰 파일 다음 단계 전송용)
// Response: { ok: true, images: [...] }
//
// @sparticuz/chromium-min 사용 — Chromium 바이너리를 번들에 포함하지 않고 런타임에
// GitHub 릴리즈에서 다운받아 /tmp에 풀음. libnss3.so 등 시스템 라이브러리 호환성
// 문제 해결 (threads-crawl, media, x-crawl과 동일 패턴).

import { Buffer } from "node:buffer";
import { put } from "@vercel/blob";
const { default: chromium } = await import("@sparticuz/chromium-min");
const { default: puppeteer } = await import("puppeteer-core");

// Vercel Node 22(Amazon Linux 2023, x64) 호환 pack. v138부터 x64/arm64 분리됨.
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v148.0.0/chromium-v148.0.0-pack.x64.tar";

export const config = { maxDuration: 120, memory: 1024 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { htmls, format, upload } = req.body || {};
  if (!htmls || !Array.isArray(htmls) || htmls.length === 0) {
    return res.status(400).json({ error: "htmls 배열이 필요합니다" });
  }
  const fmt = format === "png" ? "png" : "jpeg";
  const uploadToBlob = upload === true;

  let browser;
  try {
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: chromium.headless,
      defaultViewport: { width: 1080, height: 1350, deviceScaleFactor: 1 },
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });

    const images = [];
    const targets = htmls.slice(0, 10); // Instagram carousel 최대 10장

    for (const html of targets) {
      // waitUntil:"load" = DOM + 리소스(이미지 등) 로드까지만. networkidle0은
      // Pretendard 같은 폰트 CDN의 lazy woff 요청 때문에 영원히 끝나지 않을 수 있음.
      // 폰트는 아래 document.fonts.ready로 별도 대기.
      await page.setContent(html, { waitUntil: "load", timeout: 40000 });
      // 폰트 + 모든 <img> 디코드 완료까지 대기 (5초 안전망)
      await page.evaluate(async () => {
        await document.fonts.ready;
        const imgs = Array.from(document.images);
        await Promise.all(imgs.map((img) => {
          if (img.complete && img.naturalWidth > 0) return Promise.resolve();
          return new Promise((resolve) => {
            const done = () => resolve();
            img.addEventListener("load", done, { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, 5000); // 이미지 1장이 5초 넘으면 포기하고 진행
          });
        }));
      });
      const shotOpts = fmt === "png"
        ? { type: "png", fullPage: false }
        : { type: "jpeg", quality: 92, fullPage: false };
      const buffer = await page.screenshot(shotOpts);
      const mime = fmt === "png" ? "image/png" : "image/jpeg";
      if (uploadToBlob) {
        // image-gen/ 프리픽스로 업로드 → cleanup-image-blobs cron이 7일 후 정리
        const ext = fmt === "png" ? "png" : "jpg";
        const filename = `image-gen/screenshots/${Date.now()}-${images.length}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
        const blob = await put(filename, buffer, { access: "public", contentType: mime });
        images.push(blob.url);
      } else {
        images.push(`data:${mime};base64,${buffer.toString("base64")}`);
      }
    }

    await browser.close();
    return res.status(200).json({ ok: true, images });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return res.status(500).json({ error: err.message });
  }
}
