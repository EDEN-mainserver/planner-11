/**
 * Threads 인기글 크롤링 — Vercel Serverless Function
 * POST /api/threads-crawl  Body: { keyword, cookies[] }
 * GET  /api/threads-crawl?keyword=...&cookies=<base64>
 *
 * @sparticuz/chromium + puppeteer-core 조합 (공식 지원)
 */
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

export const config = { maxDuration: 60, memory: 1024 };

/**
 * @sparticuz/chromium은 AWS Lambda 환경변수가 있을 때만
 * libnss3.so 등 필수 시스템 라이브러리(al2.tar.br, al2023.tar.br)를 추출합니다.
 * Vercel은 이 변수를 자동 노출하지 않으므로 모듈 로드 시 직접 설정합니다.
 * (??= : 이미 값이 있으면 덮어쓰지 않음)
 */
process.env.AWS_EXECUTION_ENV     ??= "AWS_Lambda_nodejs18.x"; // al2.tar.br  추출
process.env.AWS_LAMBDA_JS_RUNTIME ??= "nodejs20.x";            // al2023.tar.br 추출

// ── Cookie-Editor sameSite → Puppeteer 형식 ──
function toSameSite(raw) {
  if (!raw) return "None";
  const v = String(raw).toLowerCase().trim();
  if (v === "strict") return "Strict";
  if (v === "lax")    return "Lax";
  return "None"; // no_restriction / null 등
}

// ── Cookie-Editor 배열 → Puppeteer setCookie 포맷 ──
function formatCookies(cookies) {
  return cookies
    .filter((c) => c.name && c.value)
    .map((c) => {
      const cookie = {
        name:     c.name,
        value:    c.value,
        domain:   c.domain || ".threads.com",
        path:     c.path   || "/",
        httpOnly: !!c.httpOnly,
        secure:   c.secure !== false,
        sameSite: toSameSite(c.sameSite),
      };
      // Cookie-Editor: expirationDate → Puppeteer: expires
      const exp = c.expirationDate ?? c.expires;
      if (exp) cookie.expires = Math.floor(Number(exp));
      return cookie;
    });
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
  if (cookies.length === 0 && process.env.THREADS_COOKIES) {
    try { cookies = JSON.parse(Buffer.from(process.env.THREADS_COOKIES, "base64").toString()); } catch {}
    if (!cookies.length) { try { cookies = JSON.parse(process.env.THREADS_COOKIES); } catch {} }
  }

  if (!keyword) {
    return res.status(400).json({ error: "keyword 파라미터가 필요합니다." });
  }

  let browser;
  try {
    // ── Puppeteer + @sparticuz/chromium (공식 지원 조합) ──
    browser = await puppeteer.launch({
      args:            chromium.args,
      executablePath:  await chromium.executablePath(),
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

    // ── 쿠키 주입 ──
    if (cookies.length > 0) {
      try {
        await page.setCookie(...formatCookies(cookies));
      } catch (e) {
        console.warn("[threads-crawl] setCookie warning:", e.message);
      }
    }

    // ── 이미지·폰트 차단 (속도 향상) ──
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const type = request.resourceType();
      if (["image", "media", "font", "stylesheet"].includes(type)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    const searchUrl = `https://www.threads.com/search?q=${encodeURIComponent(keyword)}&serp_type=default`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // 로그인 벽 감지
    const currentUrl = page.url();
    if (currentUrl.includes("/login") || currentUrl.includes("accounts/login")) {
      await browser.close();
      return res.status(200).json({
        error: "로그인 페이지로 리디렉션됐습니다. 쿠키를 다시 설정해주세요.",
        platform: "threads", keyword, total: 0, posts: [],
        debug: { redirectUrl: currentUrl },
      });
    }

    // 게시물 컨테이너 대기 (최대 20초)
    await page
      .waitForSelector('div[data-pressable-container="true"]', { timeout: 20000 })
      .catch(() => {});

    // 스크롤 후 추가 로딩 대기
    await page.evaluate(() => window.scrollBy(0, 2000));
    await new Promise((r) => setTimeout(r, 2000));

    // ── DOM 파싱 ──
    const { posts, debugInfo } = await page.evaluate(() => {
      const containers = document.querySelectorAll(
        'div[data-pressable-container="true"]'
      );
      const posts = [];

      containers.forEach((el, idx) => {
        try {
          const authorEl = el.querySelector('a[href^="/@"]');
          if (!authorEl) return;
          const author = authorEl.getAttribute("href").replace(/^\//, "");

          const postLinkEl = el.querySelector('a[href*="/post/"]');
          const postUrl = postLinkEl
            ? "https://www.threads.com" + postLinkEl.getAttribute("href")
            : "";

          const timeEl = el.querySelector("time[datetime]");
          const datetime = timeEl?.getAttribute("datetime") || "";
          const timeText = timeEl?.textContent?.trim() || "";

          // 본문 (xat24cr 우선, 없으면 span[dir=auto] fallback)
          const paragraphs = new Set();
          el.querySelectorAll(
            "div.xat24cr span[dir='auto'], span[dir='auto']"
          ).forEach((span) => {
            const t = span.textContent.trim();
            if (t && t.length > 4) paragraphs.add(t);
          });
          const content = [...paragraphs].join("\n");
          if (!content) return;

          // 반응 수
          const getCount = (label) => {
            const svg = el.querySelector(`svg[aria-label="${label}"]`);
            if (!svg) return 0;
            let node = svg.parentElement;
            for (let i = 0; i < 4 && node && node !== el; i++) {
              const span =
                node.querySelector("span.x1o0tod") ||
                node.querySelector("span[class]");
              if (span) {
                const n = parseInt(span.textContent.replace(/[^0-9]/g, ""));
                if (!isNaN(n)) return n;
              }
              node = node.parentElement;
            }
            return 0;
          };

          posts.push({
            rank:     idx + 1,
            author:   "@" + author.replace(/^@/, ""),
            content,
            postUrl,
            datetime,
            time:     timeText || datetime.slice(0, 10),
            likes:    getCount("좋아요"),
            comments: getCount("답글"),
            shares:   getCount("리포스트"),
          });
        } catch {}
      });

      return {
        posts,
        debugInfo: {
          containerCount: containers.length,
          pageTitle:      document.title,
          url:            location.href,
        },
      };
    });

    await browser.close();
    browser = null;

    return res.status(200).json({
      platform:      "threads",
      keyword,
      total:         posts.length,
      posts,
      authenticated: cookies.length > 0,
      debug:         debugInfo,
    });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error("[threads-crawl] error:", err.message);
    return res.status(500).json({
      error:    err.message,
      platform: "threads",
      keyword,
      total:    0,
      posts:    [],
    });
  }
}
