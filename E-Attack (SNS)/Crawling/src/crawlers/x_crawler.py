"""
X(Twitter) 실시간 트렌드 크롤러
trends24.in/south-korea/ 스크래핑 방식 (로그인 불필요)
- 기존 guest token + v1.1 API 방식은 X의 정책 변경으로 사용 불가
"""
import re
import httpx
from src.models.post import CrawledPost

TRENDS24_URL = "https://trends24.in/south-korea/"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def _parse_tweet_count(raw: str) -> int:
    """'123.4K', '1.2M', '5000' 등의 문자열을 정수로 변환"""
    raw = raw.strip().upper()
    if not raw:
        return 0
    try:
        num_str = re.sub(r"[^0-9.]", "", raw)
        num = float(num_str)
        if "M" in raw:
            return int(num * 1_000_000)
        if "K" in raw:
            return int(num * 1_000)
        return int(num)
    except (ValueError, TypeError):
        return 0


def _extract_trends_from_html(html: str) -> list[dict]:
    """
    trends24.in HTML에서 트렌드 목록을 추출합니다.
    첫 번째 트렌드 카드(가장 최신)의 <ol> 목록을 파싱합니다.
    """
    results: list[dict] = []

    # 첫 번째 <ol> 블록 추출 (가장 최신 트렌드 카드)
    ol_match = re.search(r"<ol[^>]*>(.*?)</ol>", html, re.DOTALL | re.IGNORECASE)
    if not ol_match:
        return results

    ol_content = ol_match.group(1)

    # <li> 아이템 순회
    li_blocks = re.findall(r"<li[^>]*>(.*?)</li>", ol_content, re.DOTALL | re.IGNORECASE)

    for idx, li in enumerate(li_blocks):
        # <a href="/south-korea/trend/키워드/">트렌드명</a>
        a_match = re.search(
            r'<a\s+href=["\']([^"\']*\/trend\/[^"\']*)["\'][^>]*>(.*?)</a>',
            li,
            re.DOTALL | re.IGNORECASE,
        )
        if not a_match:
            continue

        href = a_match.group(1).strip()
        name = re.sub(r"<[^>]+>", "", a_match.group(2)).strip()
        if not name:
            continue

        # 트윗 수 (있을 경우)
        count_match = re.search(
            r'class=["\'][^"\']*(?:tweet-count|trend-tweet-count)[^"\']*["\'][^>]*>(.*?)<',
            li,
            re.DOTALL | re.IGNORECASE,
        )
        tweet_count = 0
        if count_match:
            tweet_count = _parse_tweet_count(re.sub(r"<[^>]+>", "", count_match.group(1)))

        # x.com 검색 URL 생성 (href의 마지막 세그먼트 = 검색 키워드)
        kw = href.rstrip("/").split("/")[-1]
        source_url = f"https://x.com/search?q={kw}&src=trend_click"

        results.append({
            "rank": idx + 1,
            "name": name,
            "tweet_count": tweet_count,
            "source_url": source_url,
        })

    # 첫 번째 <ol>에서 결과가 없으면 전체 트렌드 링크 수집
    if not results:
        all_links = re.findall(
            r'<a\s+href=["\']([^"\']*\/trend\/[^"\']*)["\'][^>]*>(.*?)</a>',
            html,
            re.DOTALL | re.IGNORECASE,
        )
        seen: set[str] = set()
        rank = 1
        for href, raw_name in all_links:
            name = re.sub(r"<[^>]+>", "", raw_name).strip()
            if not name or name in seen:
                continue
            seen.add(name)
            kw = href.rstrip("/").split("/")[-1]
            results.append({
                "rank": rank,
                "name": name,
                "tweet_count": 0,
                "source_url": f"https://x.com/search?q={kw}&src=trend_click",
            })
            rank += 1

    return results


def crawl_x_trends(keyword_filter: str = "") -> list[CrawledPost]:
    """
    X 한국 실시간 트렌드를 가져옵니다.
    trends24.in/south-korea/ 를 스크래핑하여 반환합니다.

    Args:
        keyword_filter: 비어있으면 전체, 입력하면 해당 키워드 포함 트렌드만 필터
    """
    with httpx.Client(timeout=20, follow_redirects=True) as client:
        resp = client.get(TRENDS24_URL, headers=HEADERS)
        resp.raise_for_status()
        html = resp.text

    raw_trends = _extract_trends_from_html(html)

    # 키워드 필터 적용
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
            views=t["tweet_count"],
            likes=0,
            comments=0,
            shares=0,
            image_url="",
            source_url=t["source_url"],
            created_at="실시간",
            platform="x",
        ))

    return posts


def crawl_x_search(keyword: str, max_posts: int = 20, cookies: list[dict] | None = None) -> list[CrawledPost]:
    """
    X.com 키워드 검색 결과를 크롤링합니다.
    Playwright를 사용하여 실제 트윗을 가져옵니다.

    Args:
        keyword: 검색 키워드
        max_posts: 최대 수집 게시물 수
        cookies: 로그인 쿠키 목록 (없으면 비로그인 시도)
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
                    "name":    c["name"],
                    "value":   c["value"],
                    "domain":  c.get("domain", ".x.com"),
                    "path":    c.get("path", "/"),
                    "secure":  c.get("secure", True),
                    "httpOnly": c.get("httpOnly", False),
                }
                exp = c.get("expirationDate") or c.get("expires")
                if exp:
                    cookie["expires"] = int(float(exp))
                formatted.append(cookie)
            if formatted:
                context.add_cookies(formatted)

        page = context.new_page()

        # 이미지/폰트 차단
        def block_resources(route):
            if route.request.resource_type in ("image", "media", "font"):
                route.abort()
            else:
                route.continue_()
        page.route("**/*", block_resources)

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

        # DOM 파싱
        articles = page.query_selector_all('article[data-testid="tweet"]')

        for idx, art in enumerate(articles[:max_posts]):
            try:
                # 내용
                content_el = art.query_selector('[data-testid="tweetText"]')
                content = content_el.inner_text().strip() if content_el else ""
                if not content:
                    continue

                # 작성자
                handle = ""
                spans = art.query_selector_all("span")
                for s in spans:
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

                # 인게이지먼트
                def get_count(test_id: str) -> int:
                    btn = art.query_selector(f'[data-testid="{test_id}"]')
                    if not btn:
                        return 0
                    aria = btn.get_attribute("aria-label") or ""
                    import re
                    m = re.match(r"^([\d,]+(?:\.\d+)?[KMkm]?)", aria)
                    if m:
                        raw = m.group(1).replace(",", "").upper()
                        n = float(re.sub(r"[^0-9.]", "", raw) or "0")
                        if "M" in raw:
                            return int(n * 1_000_000)
                        if "K" in raw:
                            return int(n * 1_000)
                        return int(n)
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
    results = crawl_x_trends()
    print(f"총 {len(results)}개 트렌드")
    for post in results:
        vol = f"{post.views:,}" if post.views else "-"
        print(f"[{post.rank:2d}] {post.title:40s} | 트윗수: {vol}")
