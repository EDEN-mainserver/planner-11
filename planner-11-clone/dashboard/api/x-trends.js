/**
 * X(Twitter) 한국 실시간 트렌드 — Vercel Serverless Function
 * GET /api/x-trends?keyword=키워드
 *
 * trends24.in/south-korea/ 를 Puppeteer로 스크래핑하여
 * 로그인 없이 한국 X 트렌드를 반환합니다.
 */

// ── 1. dynamic import로 모듈 로드 ──
const { default: chromium } = await import("@sparticuz/chromium-min");
const { default: puppeteer } = await import("puppeteer-core");

// ── 2. Vercel 환경 Chromium 원격 URL ──
const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar";

export const config = { maxDuration: 60, memory: 1024 };

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const { keyword = "" } = req.query;

  let browser;
  try {
    browser = await puppeteer.launch({
      args:            chromium.args,
      executablePath:  await chromium.executablePath(CHROMIUM_PACK_URL),
      headless:        chromium.headless,
      defaultViewport: chromium.defaultViewport,
    });

    const page = await browser.newPage();

    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );
    await page.setViewport({ width: 1280, height: 900 });
    await page.setExtraHTTPHeaders({ "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8" });

    // 이미지·미디어·폰트 차단 (속도 향상)
    await page.setRequestInterception(true);
    page.on("request", (r) => {
      ["image", "media", "font"].includes(r.resourceType())
        ? r.abort()
        : r.continue();
    });

    await page.goto("https://trends24.in/korea/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // 트렌드 링크 로딩 대기 (실제 DOM 구조 확인됨: a.trend-link)
    await page
      .waitForSelector("a.trend-link", { timeout: 15000 })
      .catch(() => {});

    // ── DOM 파싱 (확인된 구조: ol > li > span.trend-name > a.trend-link) ──
    const rawTrends = await page.evaluate(() => {
      const results = [];

      const ol = document.querySelector("ol");
      if (!ol) return results;

      ol.querySelectorAll("li").forEach((li, idx) => {
        const a = li.querySelector("a.trend-link");
        if (!a) return;

        const name = a.textContent.trim();
        if (!name) return;

        // 트윗 수 (data-count 속성 우선, 없으면 텍스트)
        const countEl = li.querySelector(".tweet-count");
        let tweetCount = 0;
        if (countEl) {
          const raw = (countEl.getAttribute("data-count") || countEl.textContent || "").trim();
          if (raw) {
            const num = parseFloat(raw.replace(/[^0-9.]/g, "") || "0");
            const upper = raw.toUpperCase();
            if (upper.includes("M")) tweetCount = Math.round(num * 1_000_000);
            else if (upper.includes("K")) tweetCount = Math.round(num * 1_000);
            else tweetCount = Math.round(num) || 0;
          }
        }

        // twitter.com → x.com 링크 변환
        const href = a.getAttribute("href") || "";
        const sourceUrl = href.replace("https://twitter.com/", "https://x.com/");

        results.push({ rank: idx + 1, name, tweetCount, sourceUrl });
      });

      return results;
    });

    await browser.close();
    browser = null;

    // 키워드 필터
    const filtered = keyword
      ? rawTrends.filter((t) =>
          t.name.toLowerCase().includes(keyword.toLowerCase())
        )
      : rawTrends;

    // CrawlingPage가 기대하는 posts 형식으로 변환
    const posts = filtered.map((t, i) => ({
      rank:        i + 1,
      title:       t.name,
      content_raw: `X 실시간 트렌드 키워드: ${t.name}`,
      author:      "X Korea Trends",
      views:       t.tweetCount,   // 트윗 수를 조회수로 매핑
      likes:       0,
      comments:    0,
      shares:      0,
      image_url:   "",
      source_url:  t.sourceUrl,
      created_at:  "실시간",
      platform:    "x",
    }));

    return res.status(200).json({
      platform: "x",
      total:    posts.length,
      posts,
      source:   "trends24.in",
      error:    "",
    });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error("[x-trends] error:", err.message);
    return res.status(200).json({
      platform: "x",
      total:    0,
      posts:    [],
      error:    err.message || "X 트렌드 수집 실패",
    });
  }
}
