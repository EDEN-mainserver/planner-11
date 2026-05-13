// HTML 문자열 → JPEG 스크린샷 API
// 카드뉴스 HTML을 받아 1080×1350 JPEG base64로 반환
// POST /api/html-screenshot  Body: { htmls: string[] }

const { default: chromium } = await import("@sparticuz/chromium");
const { default: puppeteer } = await import("puppeteer-core");

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

  // @sparticuz/chromium이 /tmp에 압축 해제한 .so 파일을 링커가 찾을 수 있도록 경로 추가
  const libPaths = [
    "/tmp",
    "/var/task/node_modules/@sparticuz/chromium/bin",
    process.env.LD_LIBRARY_PATH,
  ].filter(Boolean).join(":");
  process.env.LD_LIBRARY_PATH = libPaths;

  let browser;
  try {
    const executablePath = await chromium.executablePath();

    browser = await puppeteer.launch({
      args: [
        ...chromium.args,
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-setuid-sandbox",
        "--no-first-run",
        "--no-sandbox",
        "--no-zygote",
        "--single-process",
        "--disable-features=site-per-process",
      ],
      executablePath,
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
