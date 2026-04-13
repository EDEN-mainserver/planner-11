"""
아이보스 월간 인기글 크롤러 (Playwright 기반)
Target: https://www.i-boss.co.kr/ab-1886?month=YYYYMM
- month=202604 → 2026년 4월 인기글
- month=202603 → 2026년 3월 인기글
"""
import asyncio
import re
from datetime import datetime
from playwright.async_api import async_playwright
from src.models.post import CrawledPost


def _get_current_month_param() -> str:
    """현재 연월을 YYYYMM 형식으로 반환"""
    return datetime.now().strftime("%Y%m")


def _parse_int(text: str) -> int:
    """문자열에서 숫자만 추출"""
    digits = re.sub(r"[^\d]", "", text.strip())
    return int(digits) if digits else 0


async def _create_iboss_context(playwright):
    """아이보스 접속용 브라우저 컨텍스트 생성 (403 방지)"""
    browser = await playwright.chromium.launch(headless=True)
    context = await browser.new_context(
        user_agent=(
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/131.0.0.0 Safari/537.36"
        ),
        viewport={"width": 1920, "height": 1080},
        locale="ko-KR",
        extra_http_headers={
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
            "Referer": "https://www.i-boss.co.kr/",
        },
    )
    page = await context.new_page()

    # 메인 페이지 먼저 방문하여 쿠키 획득
    await page.goto("https://www.i-boss.co.kr/", wait_until="domcontentloaded", timeout=15000)
    await page.wait_for_timeout(1500)

    return browser, context, page


async def crawl_iboss(max_posts: int = 10, month: str = "") -> list[CrawledPost]:
    """
    아이보스 월간 인기글을 크롤링합니다.

    Args:
        max_posts: 최대 크롤링 개수 (기본 10)
        month: YYYYMM 형식 (비어있으면 현재 월)
    """
    if not month:
        month = _get_current_month_param()

    url = f"https://www.i-boss.co.kr/ab-1886?month={month}"
    posts: list[CrawledPost] = []

    async with async_playwright() as p:
        browser, context, page = await _create_iboss_context(p)

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_timeout(2500)

            # 게시물 행 선택 — <table> > <tbody> > <tr>
            rows = await page.query_selector_all("table tbody tr")

            for idx, row in enumerate(rows[:max_posts], start=1):
                try:
                    # 순번
                    rank_el = await row.query_selector("td.SerialNum span")
                    rank = _parse_int(await rank_el.inner_text()) if rank_el else idx

                    # 제목 + 링크
                    title_el = await row.query_selector(".articleSubject a")
                    title = ""
                    href = ""
                    if title_el:
                        title = (await title_el.inner_text()).strip()
                        href = await title_el.get_attribute("href") or ""

                    if not title:
                        continue

                    # 댓글수
                    comment_el = await row.query_selector(".AB-comm")
                    comments = _parse_int(await comment_el.inner_text()) if comment_el else 0

                    # 작성자
                    author_el = await row.query_selector(".mb_writer")
                    author = (await author_el.inner_text()).strip() if author_el else ""

                    # 날짜
                    date_el = await row.query_selector("td.tdvel-2 + td + td, td:nth-child(4)")
                    created_at = ""
                    if date_el:
                        date_text = (await date_el.inner_text()).strip()
                        if re.match(r"\d{2}\.\d{2}", date_text):
                            created_at = date_text

                    # 좋아요 (추천수)
                    likes = 0
                    likes_el = await row.query_selector("td:nth-child(5)")
                    if likes_el:
                        likes = _parse_int(await likes_el.inner_text())

                    # 조회수
                    views = 0
                    views_el = await row.query_selector("td:nth-child(6)")
                    if views_el:
                        views = _parse_int(await views_el.inner_text())

                    # 원문 URL
                    source_url = f"https://www.i-boss.co.kr{href}" if href and not href.startswith("http") else href

                    posts.append(CrawledPost(
                        rank=rank,
                        title=title,
                        content_raw="",
                        author=author,
                        views=views,
                        likes=likes,
                        comments=comments,
                        shares=0,
                        image_url="",
                        source_url=source_url,
                        created_at=created_at,
                        platform="iboss",
                    ))
                except Exception:
                    continue

        except Exception as e:
            print(f"[iboss_crawler] 크롤링 오류: {e}")
        finally:
            await browser.close()

    return posts


async def crawl_iboss_detail(url: str) -> str:
    """아이보스 게시물 상세 페이지에서 본문 원문을 크롤링합니다."""
    content = ""

    async with async_playwright() as p:
        browser, context, page = await _create_iboss_context(p)

        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=15000)
            await page.wait_for_timeout(2000)

            # 본문 영역 추출
            content_el = await page.query_selector(
                ".fr-view, .content-body, .view-content, .article-body"
            )
            if content_el:
                content = (await content_el.inner_text()).strip()

        except Exception as e:
            print(f"[iboss_crawler] 상세 크롤링 오류: {e}")
        finally:
            await browser.close()

    return content


# 단독 테스트
if __name__ == "__main__":
    results = asyncio.run(crawl_iboss(max_posts=10))
    for post in results:
        print(f"[{post.rank}] {post.title} | 작성자: {post.author} | 조회: {post.views} | 좋아요: {post.likes} | 댓글: {post.comments}")
