// HTML 문자열 → PNG 스크린샷 API
// 카드뉴스 HTML을 받아 1080×1350 PNG base64로 반환
// POST /api/html-screenshot  Body: { htmls: string[] }

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

  const { htmls } = req.body || {};
  if (!htmls || !Array.isArray(htmls) || htmls.length === 0) {
    return res.status(400).json({ error: "htmls 배열이 필요합니다" });
  }

  let browser;
  try {
    browser = await puppeteer.launch({
      args:            chromium.args,
      executablePath:  await chromium.executablePath(CHROMIUM_PACK_URL),
      headless:        chromium.headless,
      defaultViewport: { width: 1080, height: 1350, deviceScaleFactor: 1 },
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });

    const images = [];
    // 최대 10장만 처리 (Instagram carousel 한도)
    const targets = htmls.slice(0, 10);

    for (const html of targets) {
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 20000 });
      // 폰트 로드 대기
      await page.evaluate(() => document.fonts.ready);
      const buffer = await page.screenshot({ type: "jpeg", quality: 90 });
      images.push(`data:image/jpeg;base64,${buffer.toString("base64")}`);
    }

    await browser.close();
    return res.status(200).json({ ok: true, images });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return res.status(500).json({ error: err.message });
  }
}
