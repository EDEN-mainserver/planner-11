/**
 * Threads 인기글 크롤링 — Vercel Serverless Function
 * POST /api/threads-crawl  Body: { keyword, cookies[] }
 * GET  /api/threads-crawl?keyword=...&cookies=<base64>
 */
import chromium from "@sparticuz/chromium-min";
import { chromium as pw } from "playwright-core";

export const config = { maxDuration: 60, memory: 1024 };

const CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar";

// ── Cookie-Editor 값 → Playwright SameSite 변환 ──
function toSameSite(raw) {
  if (!raw) return "None";
  const v = String(raw).toLowerCase().trim();
  if (v === "strict") return "Strict";
  if (v === "lax") return "Lax";
  // "no_restriction" / "none" / null → None
  return "None";
}

// ── Cookie-Editor 배열 → Playwright 포맷 변환 ──
function formatCookies(cookies) {
  return cookies
    .filter((c) => c.name && c.value)
    .map((c) => {
      const cookie = {
        name: c.name,
        value: c.value,
        domain: c.domain || ".threads.com",
        path: c.path || "/",
        httpOnly: !!c.httpOnly,
        secure: c.secure !== false,
        sameSite: toSameSite(c.sameSite),
      };
      // Cookie-Editor: expirationDate → Playwright: expires
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
    const execPath = await chromium.executablePath(
      process.env.CHROMIUM_URL || CHROMIUM_PACK_URL
    );

    browser = await pw.launch({
      args: chromium.args,
      executablePath: execPath,
      headless: chromium.headless,
    });

    const ctx = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
      locale: "ko-KR",
      extraHTTPHeaders: { "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8" },
    });

    // ── 쿠키 주입 ──
    if (cookies.length > 0) {
      try {
        await ctx.addCookies(formatCookies(cookies));
      } catch (e) {
        console.warn("[threads-crawl] addCookies warning:", e.message);
      }
    }

    const page = await ctx.newPage();

    // 이미지·폰트 차단 (속도)
    await page.route(
      "**/*.{png,jpg,jpeg,gif,webp,svg,mp4,mp3,woff,woff2,ttf,eot,ico}",
      (r) => r.abort()
    );

    const searchUrl = `https://www.threads.com/search?q=${encodeURIComponent(keyword)}&serp_type=default`;
    await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

    // 로그인 벽 감지
    const currentUrl = page.url();
    if (
      currentUrl.includes("/login") ||
      currentUrl.includes("accounts/login")
    ) {
      await browser.close();
      return res.status(200).json({
        error: "로그인 페이지로 리디렉션됐습니다. 쿠키를 다시 설정해주세요.",
        platform: "threads",
        keyword,
        total: 0,
        posts: [],
        debug: { redirectUrl: currentUrl },
      });
    }

    // 게시물 컨테이너 대기 (최대 20초)
    await page
      .waitForSelector('div[data-pressable-container="true"]', { timeout: 20000 })
      .catch(() => {});

    // 스크롤 후 추가 로딩 대기
    await page.evaluate(() => window.scrollBy(0, 2000));
    await page.waitForTimeout(2000);

    // ── DOM 파싱 ──
    const { posts, debugInfo } = await page.evaluate(() => {
      const containers = document.querySelectorAll(
        'div[data-pressable-container="true"]'
      );

      const posts = [];
      containers.forEach((el, idx) => {
        try {
          // 작성자
          const authorEl = el.querySelector('a[href^="/@"]');
          if (!authorEl) return;
          const author = authorEl.getAttribute("href").replace(/^\//, "");

          // 게시물 URL + 날짜
          const postLinkEl = el.querySelector('a[href*="/post/"]');
          const postUrl = postLinkEl
            ? "https://www.threads.com" + postLinkEl.getAttribute("href")
            : "";
          const timeEl = el.querySelector("time[datetime]");
          const datetime = timeEl?.getAttribute("datetime") || "";
          const timeText = timeEl?.textContent?.trim() || "";

          // 본문 — xat24cr 우선, 없으면 span[dir="auto"] 전체
          const paragraphs = new Set();
          const textNodes = el.querySelectorAll(
            "div.xat24cr span[dir='auto'], span[dir='auto']"
          );
          textNodes.forEach((span) => {
            const t = span.textContent.trim();
            // 5자 이상인 텍스트만 (버튼 라벨 등 제거)
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
                const n = parseInt(
                  span.textContent.replace(/[^0-9]/g, "")
                );
                if (!isNaN(n)) return n;
              }
              node = node.parentElement;
            }
            return 0;
          };

          posts.push({
            rank: idx + 1,
            author: "@" + author.replace(/^@/, ""),
            content,
            postUrl,
            datetime,
            time: timeText || datetime.slice(0, 10),
            likes: getCount("좋아요"),
            comments: getCount("답글"),
            shares: getCount("리포스트"),
          });
        } catch {}
      });

      return {
        posts,
        debugInfo: {
          containerCount: containers.length,
          pageTitle: document.title,
          url: location.href,
        },
      };
    });

    await browser.close();
    browser = null;

    return res.status(200).json({
      platform: "threads",
      keyword,
      total: posts.length,
      posts,
      authenticated: cookies.length > 0,
      debug: debugInfo,
    });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error("[threads-crawl] error:", err.message);
    return res.status(500).json({
      error: err.message,
      platform: "threads",
      keyword,
      total: 0,
      posts: [],
    });
  }
}
