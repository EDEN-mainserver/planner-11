"""
X(Twitter) 키워드 기반 크롤러 (Playwright 기반)
로그인 없이 X 검색 페이지를 크롤링합니다.
Target: https://x.com/search?q={keyword}&src=typed_query&f=top
"""
import asyncio
import re
from playwright.async_api import async_playwright
from src.models.post import CrawledPost


def _parse_int(text: str) -> int:
    """문자열에서 숫자만 추출 (1.2K → 1200, 3.5M → 3500000)"""
    text = text.strip().upper()
    if not text:
        return 0
    if "K" in text:
        num = float(re.sub(r"[^\d.]", "", text))
        return int(num * 1000)
    if "M" in text:
        num = float(re.sub(r"[^\d.]", "", text))
        return int(num * 1_000_000)
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else 0


async def crawl_x(keyword: str, max_posts: int = 20) -> list[CrawledPost]:
    """
    X에서 키워드 검색 후 인기 트윗을 크롤링합니다.

    Args:
        keyword: 검색 키워드
        max_posts: 최대 크롤링 개수
    """
    posts: list[CrawledPost] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1920, "height": 1080},
            locale="ko-KR",
        )
        page = await context.new_page()

        try:
            # X 검색 페이지 (인기순)
            search_url = f"https://x.com/search?q={keyword}&src=typed_query&f=top"
            await page.goto(search_url, wait_until="domcontentloaded", timeout=20000)
            await page.wait_for_timeout(4000)

            # 스크롤하여 더 많은 트윗 로드
            for _ in range(3):
                await page.evaluate("window.scrollBy(0, 1000)")
                await page.wait_for_timeout(1500)

            # 트윗 article 요소 선택
            articles = await page.query_selector_all('article[data-testid="tweet"]')

            for idx, article in enumerate(articles[:max_posts], start=1):
                try:
                    # 작성자 (@handle)
                    author = ""
                    handle_els = await article.query_selector_all('a[role="link"] span')
                    for el in handle_els:
                        text = (await el.inner_text()).strip()
                        if text.startswith("@"):
                            author = text
                            break

                    # 트윗 본문
                    content = ""
                    content_el = await article.query_selector('div[data-testid="tweetText"]')
                    if content_el:
                        content = (await content_el.inner_text()).strip()

                    if not content:
                        continue

                    # 제목 (본문의 첫 줄 또는 50자)
                    title = content.split("\n")[0][:80]

                    # 트윗 링크
                    source_url = ""
                    time_el = await article.query_selector("time")
                    if time_el:
                        link_el = await time_el.evaluate_handle("el => el.closest('a')")
                        if link_el:
                            href = await link_el.get_property("href")
                            source_url = await href.json_value() if href else ""

                    # 날짜
                    created_at = ""
                    if time_el:
                        created_at = await time_el.get_attribute("datetime") or ""
                        # datetime 속성에서 날짜만 추출
                        if created_at:
                            created_at = created_at[:10]

                    # 통계 (좋아요, 리트윗, 답글, 조회수)
                    likes = 0
                    comments = 0
                    shares = 0
                    views = 0

                    # 통계 그룹에서 추출
                    stat_groups = await article.query_selector_all('[role="group"] button')
                    for i, btn in enumerate(stat_groups):
                        aria = await btn.get_attribute("aria-label") or ""
                        aria_lower = aria.lower()
                        # 숫자 추출
                        num_match = re.search(r"[\d,.]+[KkMm]?", aria)
                        num = _parse_int(num_match.group()) if num_match else 0

                        if "repl" in aria_lower or "답글" in aria_lower:
                            comments = num
                        elif "repost" in aria_lower or "retweet" in aria_lower or "리포스트" in aria_lower:
                            shares = num
                        elif "like" in aria_lower or "좋아요" in aria_lower:
                            likes = num
                        elif "view" in aria_lower or "조회" in aria_lower:
                            views = num

                    posts.append(CrawledPost(
                        rank=idx,
                        title=title,
                        content_raw=content,
                        author=author,
                        views=views,
                        likes=likes,
                        comments=comments,
                        shares=shares,
                        image_url="",
                        source_url=source_url,
                        created_at=created_at,
                        platform="x",
                    ))
                except Exception:
                    continue

        except Exception as e:
            print(f"[x_crawler] 크롤링 오류: {e}")
        finally:
            await browser.close()

    return posts


# 단독 테스트
if __name__ == "__main__":
    results = asyncio.run(crawl_x("마케팅", max_posts=5))
    for post in results:
        print(f"[{post.rank}] {post.author}: {post.title} | 좋아요:{post.likes} 조회:{post.views}")
