// 미디어/크롤링 통합 핸들러
// ?_fn=gif-proxy  → GIF 프록시 (GET ?url=...)
// ?_fn=screenshot → HTML 스크린샷 (POST { htmls })
// ?_fn=crawl      → URL 크롤러 (GET/POST { url })

export const config = { maxDuration: 120, memory: 1024 };

// ─── GIF 프록시 ───────────────────────────────────────────────────────────────
async function handleGifProxy(req, res) {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url 파라미터가 필요합니다." });

  const resp = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!resp.ok) return res.status(resp.status).end();

  const buffer = Buffer.from(await resp.arrayBuffer());
  res.setHeader("Content-Type", resp.headers.get("content-type") || "image/gif");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.end(buffer);
}

// ─── HTML 스크린샷 ────────────────────────────────────────────────────────────
async function handleScreenshot(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });
  const { htmls } = req.body || {};
  if (!htmls || !Array.isArray(htmls) || htmls.length === 0) {
    return res.status(400).json({ error: "htmls 배열이 필요합니다" });
  }

  const { default: chromium } = await import("@sparticuz/chromium-min");
  const { default: puppeteer } = await import("puppeteer-core");

  const CHROMIUM_PACK_URL = "https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar";

  process.env.LD_LIBRARY_PATH = [
    "/tmp",
    "/var/task/node_modules/@sparticuz/chromium-min/bin",
    process.env.LD_LIBRARY_PATH,
  ].filter(Boolean).join(":");

  let browser;
  try {
    browser = await puppeteer.launch({
      args: [...chromium.args, "--disable-gpu", "--disable-dev-shm-usage", "--disable-setuid-sandbox", "--no-first-run", "--no-sandbox", "--no-zygote", "--single-process", "--disable-features=site-per-process"],
      executablePath: await chromium.executablePath(CHROMIUM_PACK_URL),
      headless: "new",
      defaultViewport: { width: 1080, height: 1350, deviceScaleFactor: 1 },
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1350, deviceScaleFactor: 1 });

    const images = [];
    for (const html of htmls.slice(0, 10)) {
      await page.setContent(html, { waitUntil: "networkidle0", timeout: 25000 });
      await page.evaluate(() => document.fonts.ready);
      const buffer = await page.screenshot({ type: "jpeg", quality: 92, fullPage: false });
      images.push(`data:image/jpeg;base64,${buffer.toString("base64")}`);
    }

    await browser.close();
    return res.status(200).json({ ok: true, images });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    return res.status(500).json({ error: err.message });
  }
}

// ─── URL 크롤러 ───────────────────────────────────────────────────────────────
function crawlExtractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function crawlExtractMeta(html) {
  const title   = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() || '';
  const desc    = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)?.[1] ||
                  html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i)?.[1] || '';
  const ogTitle = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i)?.[1] || '';
  const ogDesc  = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)/i)?.[1] || '';
  const keywords = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']+)/i)?.[1] || '';
  return { title, desc, ogTitle, ogDesc, keywords };
}

async function handleCrawl(req, res) {
  const url = req.method === 'POST' ? req.body?.url : req.query?.url;
  if (!url) return res.status(400).json({ error: 'url이 필요합니다.' });

  let parsed;
  try {
    parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return res.status(400).json({ error: '유효하지 않은 URL입니다.' });
  }

  const resp = await fetch(parsed.href, {
    headers: {
      'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!resp.ok) return res.status(502).json({ error: `사이트 응답 오류: ${resp.status}` });

  const html = await resp.text();
  return res.status(200).json({
    url:    parsed.href,
    domain: parsed.hostname,
    meta:   crawlExtractMeta(html),
    text:   crawlExtractText(html).slice(0, 6000),
  });
}

// ─── 메인 라우터 ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const fn = req.query._fn;
  try {
    if (fn === 'gif-proxy')  return await handleGifProxy(req, res);
    if (fn === 'screenshot') return await handleScreenshot(req, res);
    if (fn === 'crawl')      return await handleCrawl(req, res);
    return res.status(400).json({ error: '_fn 파라미터가 필요합니다 (gif-proxy | screenshot | crawl)' });
  } catch (err) {
    const msg = err.name === 'TimeoutError' ? '사이트 응답 시간 초과 (10초)' : err.message;
    return res.status(500).json({ error: msg });
  }
}
