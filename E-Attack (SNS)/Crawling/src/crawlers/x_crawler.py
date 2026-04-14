"""
X(Twitter) 크롤러
1. crawl_x_trends  — 한국 실시간 트렌드 (trends24.in/korea/, Playwright)
2. crawl_x_search  — 키워드 검색 결과 (x.com, Playwright + 쿠키)

- 기존 guest token + v1.1 API 방식은 X 정책 변경으로 사용 불가
- trends24.in은 JS 렌더링 필수 → Playwright 사용
  실제 DOM 구조: ol > li > span.trend-name > a.trend-link
"""
import re
from src.models.post import CrawledPost

TRENDS24_URL = "https://trends24.in/korea/"


def _parse_count(raw: str) -> int:
    """'123.4K', '1.2M', '5000' 등의 문자열을 정수로 변환"""
    raw = raw.strip().upper()
    if not raw:
        return 0
    try:
        num = float(re.sub(r"[^0-9.]", "", raw) or "0")
        if "M" in raw:
            return int(num * 1_000_000)
        if "K" in raw:
            return int(num * 1_000)
        return int(num)
    except (ValueError, TypeError):
        return 0


def crawl_x_trends(keyword_filter: str = "") -> list[CrawledPost]:
    """
    X 한국 실시간 트렌드를 가져옵니다.
    trends24.in/korea/ 를 Playwright로 스크래핑합니다.

    DOM 구조 (확인됨):
      ol > li > span.trend-name > a.trend-link  (트렌드명 + twitter.com 링크)
                              > span.tweet-count[data-count]  (트윗 수, 비어있을 수 있음)

    Args:
        keyword_filter: 비어있으면 전체, 입력하면 해당 키워드 포함 트렌드만 필터
    """
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="ko-KR",
        )

        # 이미지/미디어/폰트 차단
        page.route("**/*", lambda r: r.abort()
                   if r.request.resource_type in ("image", "media", "font")
                   else r.continue_())

        page.goto(TRENDS24_URL, wait_until="domcontentloaded", timeout=20000)

        # 트렌드 카드 로딩 대기
        try:
            page.wait_for_selector(".trend-link", timeout=8000)
        except Exception:
            pass

        # DOM 파싱
        raw_trends: list[dict] = page.evaluate("""
            () => {
                const results = [];
                const ol = document.querySelector('ol');
                if (!ol) return results;

                ol.querySelectorAll('li').forEach((li, idx) => {
                    const a = li.querySelector('a.trend-link');
                    if (!a) return;
                    const name = a.textContent.trim();
                    if (!name) return;

                    // 트윗 수 (data-count 속성 또는 텍스트)
                    const countEl = li.querySelector('.tweet-count');
                    const countRaw = countEl
                        ? (countEl.getAttribute('data-count') || countEl.textContent || '').trim()
                        : '';

                    // twitter.com → x.com 링크 변환
                    const href = a.getAttribute('href') || '';
                    const sourceUrl = href.replace('https://twitter.com/', 'https://x.com/');

                    results.push({ rank: idx + 1, name, countRaw, sourceUrl });
                });
                return results;
            }
        """)

        browser.close()

    # 키워드 필터
    if keyword_filter:
        raw_trends = [
            t for t in raw_trends
            if keyword_filter.lower() in t["name"].lower()
        ]

    posts: list[CrawledPost] = []
    for i, t in enumerate(raw_trends):
        posts.append(CrawledPost(
            rank=i + 1,
            title=t["name"],
            content_raw=f"X 실시간 트렌드 키워드: {t['name']}",
            author="X Korea Trends",
            views=_parse_count(t.get("countRaw", "")),
            likes=0,
            comments=0,
            shares=0,
            image_url="",
            source_url=t["sourceUrl"],
            created_at="실시간",
            platform="x",
        ))

    return posts


def crawl_x_search(
    keyword: str,
    max_posts: int = 20,
    cookies: list[dict] | None = None,
) -> list[CrawledPost]:
    """
    X.com 키워드 검색 결과를 Playwright로 크롤링합니다.
    쿠키를 주입하면 로그인 세션으로 더 많은 결과를 가져옵니다.

    Args:
        keyword:   검색 키워드
        max_posts: 최대 수집 게시물 수
        cookies:   로그인 쿠키 목록 (Cookie-Editor JSON 형식)
    """
    from playwright.sync_api import sync_playwright

    posts: list[CrawledPost] = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
            locale="ko-KR",
        )

        # 쿠키 주입
        if cookies:
            formatted = []
            for c in cookies:
                if not c.get("name") or not c.get("value"):
                    continue
                cookie: dict = {
                    "name":     c["name"],
                    "value":    c["value"],
                    "domain":   c.get("domain", ".x.com"),
                    "path":     c.get("path", "/"),
                    "secure":   c.get("secure", True),
                    "httpOnly": c.get("httpOnly", False),
                }
                exp = c.get("expirationDate") or c.get("expires")
                if exp:
                    cookie["expires"] = int(float(exp))
                formatted.append(cookie)
            if formatted:
                context.add_cookies(formatted)

        page = context.new_page()

        # 이미지/미디어/폰트 차단
        page.route("**/*", lambda r: r.abort()
                   if r.request.resource_type in ("image", "media", "font")
                   else r.continue_())

        search_url = f"https://x.com/search?q={keyword}&f=top&src=typed_query"
        page.goto(search_url, wait_until="domcontentloaded", timeout=30000)

        # 로그인 벽 감지
        current_url = page.url
        if "/i/flow/login" in current_url or "/login" in current_url:
            browser.close()
            raise RuntimeError("X 로그인이 필요합니다. 쿠키를 설정해주세요.")

        # 트윗 로딩 대기
        try:
            page.wait_for_selector('article[data-testid="tweet"]', timeout=20000)
        except Exception:
            pass

        # 스크롤로 추가 로딩
        page.evaluate("window.scrollBy(0, 2000)")
        page.wait_for_timeout(2000)

        articles = page.query_selector_all('article[data-testid="tweet"]')

        for idx, art in enumerate(articles[:max_posts]):
            try:
                # 내용
                content_el = art.query_selector('[data-testid="tweetText"]')
                content = content_el.inner_text().strip() if content_el else ""
                if not content:
                    continue

                # 작성자 (@handle)
                handle = ""
                for s in art.query_selector_all("span"):
                    text = s.inner_text().strip()
                    if text.startswith("@"):
                        handle = text
                        break
                if not handle:
                    user_el = art.query_selector('[data-testid="User-Name"] a')
                    if user_el:
                        href = user_el.get_attribute("href") or ""
                        handle = "@" + href.strip("/")

                # 시간
                time_el = art.query_selector("time[datetime]")
                datetime_str = time_el.get_attribute("datetime") if time_el else ""
                time_text = time_el.inner_text().strip() if time_el else ""

                # 인게이지먼트 수치
                def get_count(test_id: str) -> int:
                    btn = art.query_selector(f'[data-testid="{test_id}"]')
                    if not btn:
                        return 0
                    aria = btn.get_attribute("aria-label") or ""
                    m = re.match(r"^([\d,]+(?:\.\d+)?[KMkm]?)", aria)
                    if m:
                        return _parse_count(m.group(1).replace(",", ""))
                    return 0

                # 트윗 링크
                link_el = art.query_selector("a[href*='/status/']")
                post_url = ("https://x.com" + link_el.get_attribute("href")) if link_el else ""

                posts.append(CrawledPost(
                    rank=idx + 1,
                    title=content[:80] + ("..." if len(content) > 80 else ""),
                    content_raw=content,
                    author=handle or "unknown",
                    views=0,
                    likes=get_count("like"),
                    comments=get_count("reply"),
                    shares=get_count("retweet"),
                    image_url="",
                    source_url=post_url,
                    created_at=time_text or (datetime_str[:10] if datetime_str else ""),
                    platform="x",
                ))
            except Exception:
                continue

        browser.close()

    return posts


# 단독 테스트
if __name__ == "__main__":
    print("=== X 한국 실시간 트렌드 ===")
    results = crawl_x_trends()
    print(f"총 {len(results)}개 트렌드")
    for post in results:
        vol = f"{post.views:,}" if post.views else "-"
        print(f"[{post.rank:2d}] {post.title:40s} | 트윗수: {vol}")
