/**
 * X(Twitter) 게시물 크롤링 — Vercel Serverless Function
 * POST /api/x-crawl  Body: { keyword, cookies[] }
 * GET  /api/x-crawl?keyword=...&cookies=BASE64
 *
 * X.com 검색 결과를 Puppeteer로 스크래핑합니다.
 * 쿠키를 주입하면 로그인 세션으로 더 많은 결과를 가져올 수 있습니다.
 */

const { default: chromium } = await import("@sparticuz/chromium-min");
const { default: puppeteer } = await import("puppeteer-core");

const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.0/chromium-v131.0.0-pack.tar";

export const config = { maxDuration: 60, memory: 1024 };

// Cookie-Editor sameSite → Puppeteer 형식
function toSameSite(raw) {
  if (!raw) return "None";
  const v = String(raw).toLowerCase().trim();
  if (v === "strict") return "Strict";
  if (v === "lax") return "Lax";
  return "None";
}

// Cookie-Editor 배열 → Puppeteer setCookie 포맷
function formatCookies(cookies) {
  return cookies
    .filter((c) => c.name && c.value)
    .map((c) => {
      const cookie = {
        name:     c.name,
        value:    c.value,
        domain:   c.domain || ".x.com",
        path:     c.path || "/",
        httpOnly: !!c.httpOnly,
        secure:   c.secure !== false,
        sameSite: toSameSite(c.sameSite),
      };
      const exp = c.expirationDate ?? c.expires;
      if (exp) cookie.expires = Math.floor(Number(exp));
      return cookie;
    });
}

// "5", "1.2K", "10M" 등의 문자열 → 정수
function parseCount(text) {
  if (!text) return 0;
  const s = text.trim().toUpperCase();
  const num = parseFloat(s.replace(/[^0-9.]/g, "") || "0");
  if (s.includes("M")) return Math.round(num * 1_000_000);
  if (s.includes("K")) return Math.round(num * 1_000);
  return Math.round(num) || 0;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  // ── 요청 파싱 ──
  let keyword, cookies = [];
  if (req.method === "POST") {
    const body =
      typeof req.body === "string"
        ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })()
        : req.body || {};
    keyword = body.keyword;
    cookies = Array.isArray(body.cookies) ? body.cookies : [];
  } else {
    keyword = req.query?.keyword;
    const cp = req.query?.cookies;
    if (cp) {
      try { cookies = JSON.parse(Buffer.from(cp, "base64").toString("utf-8")); } catch {}
      if (!cookies.length) { try { cookies = JSON.parse(cp); } catch {} }
    }
  }

  // 환경변수 쿠키 폴백
  if (cookies.length === 0 && process.env.X_COOKIES) {
    try { cookies = JSON.parse(Buffer.from(process.env.X_COOKIES, "base64").toString()); } catch {}
    if (!cookies.length) { try { cookies = JSON.parse(process.env.X_COOKIES); } catch {} }
  }

  if (!keyword?.trim()) {
    return res.status(400).json({ error: "keyword 파라미터가 필요합니다." });
  }

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

    // 이미지·미디어·폰트 차단
    await page.setRequestInterception(true);
    page.on("request", (r) => {
      ["image", "media", "font"].includes(r.resourceType())
        ? r.abort()
        : r.continue();
    });

    // 쿠키 주입
    if (cookies.length > 0) {
      try { await page.setCookie(...formatCookies(cookies)); } catch (e) {
        console.warn("[x-crawl] setCookie:", e.message);
      }
    }

    const searchUrl = `https://x.com/search?q=${encodeURIComponent(keyword.trim())}&f=top&src=typed_query`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // 로그인 벽 감지
    const currentUrl = page.url();
    if (
      currentUrl.includes("/i/flow/login") ||
      currentUrl.includes("/login") ||
      currentUrl.includes("accounts/login")
    ) {
      await browser.close();
      return res.status(200).json({
        error: "로그인 페이지로 리디렉션됐습니다. X 쿠키를 설정해주세요.",
        platform: "x", keyword: keyword.trim(), total: 0, posts: [],
        debug: { redirectUrl: currentUrl },
      });
    }

    // 트윗 로딩 대기
    await page
      .waitForSelector('article[data-testid="tweet"]', { timeout: 20000 })
      .catch(() => {});

    // 스크롤로 추가 트윗 로딩
    await page.evaluate(() => window.scrollBy(0, 2000));
    await new Promise((r) => setTimeout(r, 2000));

    // ── DOM 파싱 ──
    const { posts, debugInfo } = await page.evaluate(() => {
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      const posts = [];

      articles.forEach((art, idx) => {
        try {
          // 작성자 정보
          const userBlock = art.querySelector('[data-testid="User-Name"]');
          let displayName = "", handle = "";
          if (userBlock) {
            const links = userBlock.querySelectorAll("a");
            displayName = links[0]?.innerText?.trim() || "";
            // @handle 찾기
            const spans = art.querySelectorAll('span');
            for (const s of spans) {
              if (s.textContent.trim().startsWith("@")) {
                handle = s.textContent.trim();
                break;
              }
            }
            if (!handle && links[1]) handle = "@" + links[1].getAttribute("href")?.replace("/", "");
          }

          // 트윗 내용
          const contentEl = art.querySelector('[data-testid="tweetText"]');
          const content = contentEl?.innerText?.trim() || "";
          if (!content) return;

          // 시간
          const timeEl = art.querySelector("time[datetime]");
          const datetime = timeEl?.getAttribute("datetime") || "";
          const timeText = timeEl?.textContent?.trim() || "";

          // 인게이지먼트 수치 파싱
          const getEngagement = (testId) => {
            const btn = art.querySelector(`[data-testid="${testId}"]`);
            if (!btn) return 0;
            // aria-label에서 숫자 추출 (예: "5 replies. Reply")
            const ariaLabel = btn.getAttribute("aria-label") || "";
            const ariaMatch = ariaLabel.match(/^([\d,]+|[\d.]+[KMkm]?)/);
            if (ariaMatch) {
              const raw = ariaMatch[1].replace(/,/g, "");
              const n = parseFloat(raw);
              if (!isNaN(n)) {
                if (raw.toUpperCase().includes("M")) return Math.round(n * 1_000_000);
                if (raw.toUpperCase().includes("K")) return Math.round(n * 1_000);
                return Math.round(n);
              }
            }
            // 내부 span에서 텍스트 추출
            const inner = btn.querySelector("span[data-testid='app-text-transition-container'] span span");
            const innerText = inner?.textContent?.trim() || "";
            if (innerText) {
              const n = parseFloat(innerText.replace(/[^0-9.]/g, ""));
              const upper = innerText.toUpperCase();
              if (!isNaN(n)) {
                if (upper.includes("M")) return Math.round(n * 1_000_000);
                if (upper.includes("K")) return Math.round(n * 1_000);
                return Math.round(n);
              }
            }
            return 0;
          };

          // 트윗 링크
          const statusLink = art.querySelector("a[href*='/status/']");
          const postUrl = statusLink
            ? "https://x.com" + statusLink.getAttribute("href")
            : "";

          posts.push({
            rank:     idx + 1,
            author:   handle || displayName || "unknown",
            content,
            postUrl,
            datetime,
            time:     timeText || (datetime ? datetime.slice(0, 10) : ""),
            likes:    getEngagement("like"),
            comments: getEngagement("reply"),
            shares:   getEngagement("retweet"),
          });
        } catch {}
      });

      return {
        posts,
        debugInfo: {
          articleCount: articles.length,
          pageTitle:    document.title,
          url:          location.href,
        },
      };
    }, parseCount.toString()); // 파싱 함수를 page.evaluate에 문자열로 전달

    await browser.close();
    browser = null;

    return res.status(200).json({
      platform:      "x",
      keyword:       keyword.trim(),
      total:         posts.length,
      posts,
      authenticated: cookies.length > 0,
      debug:         debugInfo,
    });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error("[x-crawl] error:", err.message);
    return res.status(500).json({
      error:    err.message,
      platform: "x",
      keyword:  keyword?.trim() || "",
      total:    0,
      posts:    [],
    });
  }
}
