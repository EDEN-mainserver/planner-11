// HTML 문자열 → 1080×1350 스크린샷 API
// POST /api/html-screenshot  Body: { htmls: string[], format?: "png"|"jpeg" }
// Response: { ok: true, images: ["data:image/png;base64,...", ...] }
//
// @sparticuz/chromium-min 사용 — Chromium 바이너리를 번들에 포함하지 않고 런타임에
// GitHub 릴리즈에서 다운받아 /tmp에 풀음. libnss3.so 등 시스템 라이브러리 호환성
// 문제 해결 (threads-crawl, media, x-crawl과 동일 패턴).

const { default: chromium } = await import("@sparticuz/chromium-min");
const { default: puppeteer } = await import("puppeteer-core");

const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar";

export const config = { maxDuration: 120, memory: 1024 };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

  const { htmls, format } = req.body || {};
  if (!htmls || !Array.isArray(htmls) || htmls.length === 0) {
    return res.status(400).json({ error: "htmls 배열이 필요합니다" });
  }
  const fmt = format === "png" ? "png" : "jpeg";

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
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 25000 });
      await page.evaluate(() => document.fonts.ready);
      const shotOpts = fmt === "png"
        ? { type: "png", fullPage: false }
        : { type: "jpeg", quality: 92, fullPage: false };
      const buffer = await page.screenshot(shotOpts);
      const mime = fmt === "png" ? "image/png" : "image/jpeg";
      images.push(`data:${mime};base64,${buffer.toString("base64")}`);
    }

    await browser.close();
    return res.status(200).json({ ok: true, images });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return res.status(500).json({ error: err.message });
  }
}
