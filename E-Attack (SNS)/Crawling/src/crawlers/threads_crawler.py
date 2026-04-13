"""
쓰레드(Threads.com) 인기글 크롤러 — Playwright 기반
로컬 환경 전용. Vercel에서는 api/threads-crawl.js를 사용.

사용법:
    posts = await crawl_threads("숏폼", max_posts=20, cookies=[...])
"""
import asyncio
import json
from playwright.async_api import async_playwright
from src.models.post import CrawledPost


_DOM_SCRIPT = """
() => {
    const containers = document.querySelectorAll('div[data-pressable-container="true"]');
    const results = [];
    containers.forEach((el, idx) => {
        try {
            const authorEl = el.querySelector('a[href^="/@"]');
            if (!authorEl) return;
            const author = authorEl.getAttribute("href").replace(/^\\//, "");

            const postLinkEl = el.querySelector('a[href*="/post/"]');
            const postUrl = postLinkEl
                ? "https://www.threads.com" + postLinkEl.getAttribute("href")
                : "";

            const timeEl = el.querySelector("time[datetime]");
            const datetime = timeEl ? timeEl.getAttribute("datetime") : "";
            const timeText = timeEl ? timeEl.textContent.trim() : "";

            // xat24cr 우선, 없으면 span[dir=auto] 전체 fallback
            const paragraphs = new Set();
            el.querySelectorAll("div.xat24cr span[dir='auto'], span[dir='auto']").forEach(span => {
                const t = span.textContent.trim();
                if (t && t.length > 4) paragraphs.add(t);
            });
            const content = [...paragraphs].join("\\n");
            if (!content) return;

            const getCount = label => {
                const svg = el.querySelector('svg[aria-label="' + label + '"]');
                if (!svg) return 0;
                let node = svg.parentElement;
                for (let i = 0; i < 4 && node && node !== el; i++) {
                    const span = node.querySelector("span.x1o0tod") || node.querySelector("span[class]");
                    if (span) {
                        const n = parseInt(span.textContent.replace(/[^0-9]/g, ""));
                        if (!isNaN(n)) return n;
                    }
                    node = node.parentElement;
                }
                return 0;
            };

            results.push({
                rank: idx + 1,
                author: "@" + author.replace(/^@/, ""),
                content: content,
                postUrl: postUrl,
                datetime: datetime,
                time: timeText || datetime.slice(0, 10),
                likes: getCount("좋아요"),
                comments: getCount("답글"),
                shares: getCount("리포스트"),
            });
        } catch (e) {}
    });
    return results;
}
"""


def _to_sameSite(raw) -> str:
    """Cookie-Editor sameSite 값 → Playwright 형식 변환"""
    if not raw:
        return "None"
    v = str(raw).lower().strip()
    if v == "strict":
        return "Strict"
    if v == "lax":
        return "Lax"
    return "None"  # no_restriction / none / null


async def crawl_threads(
    keyword: str,
    max_posts: int = 20,
    cookies: list[dict] | None = None,
) -> list[CrawledPost]:
    """
    Threads.com 검색 결과를 크롤링하여 게시물 목록 반환.

    Args:
        keyword:   검색 키워드
        max_posts: 최대 수집 게시물 수
        cookies:   Threads 세션 쿠키 목록 (없으면 비인증 상태로 시도)
    """
    results: list[CrawledPost] = []

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        )
        ctx = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 900},
            locale="ko-KR",
        )

        # 쿠키 주입 (Cookie-Editor 포맷 → Playwright 포맷 변환)
        if cookies:
            formatted = []
            for c in cookies:
                if not (c.get("name") and c.get("value")):
                    continue
                item: dict = {
                    "name": c["name"],
                    "value": c["value"],
                    "domain": c.get("domain", ".threads.com"),
                    "path": c.get("path", "/"),
                    "httpOnly": bool(c.get("httpOnly", False)),
                    "secure": bool(c.get("secure", True)),
                    "sameSite": _to_sameSite(c.get("sameSite")),
                }
                # Cookie-Editor: expirationDate → Playwright: expires
                exp = c.get("expirationDate") or c.get("expires")
                if exp:
                    item["expires"] = int(exp)
                formatted.append(item)
            await ctx.add_cookies(formatted)

        page = await ctx.new_page()

        # 이미지·미디어 차단 (속도 향상)
        await page.route(
            "**/*.{png,jpg,jpeg,gif,webp,svg,mp4,mp3,woff,woff2,ttf,eot}",
            lambda r: r.abort(),
        )

        url = f"https://www.threads.com/search?q={keyword}&serp_type=default"
        await page.goto(url, wait_until="domcontentloaded", timeout=25000)

        # 게시물 로딩 대기
        try:
            await page.wait_for_selector(
                'div[data-pressable-container="true"]',
                timeout=12000,
            )
        except Exception:
            pass

        # 스크롤로 추가 게시물 로드
        await page.evaluate("() => window.scrollBy(0, 1500)")
        await asyncio.sleep(1.5)

        # DOM 파싱
        posts_data: list[dict] = await page.evaluate(_DOM_SCRIPT)
        await browser.close()

    # CrawledPost 모델로 변환
    for p in posts_data[:max_posts]:
        results.append(
            CrawledPost(
                rank=p.get("rank", 0),
                title=p.get("author", ""),  # Threads는 제목 없음 → 작성자로 대체
                content_raw=p.get("content", ""),
                author=p.get("author", ""),
                likes=p.get("likes", 0),
                comments=p.get("comments", 0),
                shares=p.get("shares", 0),
                source_url=p.get("postUrl", ""),
                created_at=p.get("datetime", ""),
                platform="threads",
            )
        )

    return results
