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

    await page.goto("https://trends24.in/south-korea/", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // 트렌드 카드 로딩 대기
    await page
      .waitForSelector(".trend-card, ol.trend-list, #trend-list", { timeout: 15000 })
      .catch(() => {});

    // ── DOM 파싱 ──
    const rawTrends = await page.evaluate(() => {
      const results = [];

      // 가장 최신 트렌드 카드의 <ol> 목록을 먼저 시도
      const firstCard = document.querySelector(".trend-card");
      const trendOl = firstCard
        ? firstCard.querySelector("ol")
        : document.querySelector("ol.trend-list, ol#trend-list, ol");

      if (trendOl) {
        const items = trendOl.querySelectorAll("li");
        items.forEach((li, idx) => {
          const a = li.querySelector("a");
          if (!a) return;

          const name = a.textContent.trim();
          if (!name) return;

          // 트윗 수 (있을 경우)
          const countEl = li.querySelector(
            ".tweet-count, .trend-tweet-count, span[class*='count'], small"
          );
          let tweetCount = 0;
          if (countEl) {
            const raw = countEl.textContent.replace(/[^0-9.KMkm]/g, "").trim();
            if (raw) {
              const num = parseFloat(raw);
              if (raw.toUpperCase().includes("M")) tweetCount = Math.round(num * 1_000_000);
              else if (raw.toUpperCase().includes("K")) tweetCount = Math.round(num * 1_000);
              else tweetCount = Math.round(num) || 0;
            }
          }

          // 원문 링크 (trends24 링크 → x.com 검색으로 변환)
          const href = a.getAttribute("href") || "";
          const keyword = href.split("/").filter(Boolean).pop() || name;
          const sourceUrl = `https://x.com/search?q=${encodeURIComponent(keyword)}&src=trend_click`;

          results.push({ rank: idx + 1, name, tweetCount, sourceUrl });
        });
      }

      // 카드 방식이 아니면 전체 페이지에서 트렌드 링크 수집
      if (results.length === 0) {
        const allLinks = document.querySelectorAll("a[href*='/trend/']");
        const seen = new Set();
        let rank = 1;
        allLinks.forEach((a) => {
          const name = a.textContent.trim();
          if (!name || seen.has(name)) return;
          seen.add(name);
          const href = a.getAttribute("href") || "";
          const kw = href.split("/").filter(Boolean).pop() || name;
          results.push({
            rank: rank++,
            name,
            tweetCount: 0,
            sourceUrl: `https://x.com/search?q=${encodeURIComponent(kw)}&src=trend_click`,
          });
        });
      }

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
