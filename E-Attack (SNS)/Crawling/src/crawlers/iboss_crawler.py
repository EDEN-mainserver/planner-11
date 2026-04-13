"""
아이보스 월간 인기글 크롤러 (httpx + BeautifulSoup 기반)
Playwright 불필요 — Vercel Serverless에서도 작동
Target: https://www.i-boss.co.kr/ab-1886?month=YYYYMM
"""
import re
from datetime import datetime
import httpx
from bs4 import BeautifulSoup
from src.models.post import CrawledPost


def _get_current_month_param() -> str:
    """현재 연월을 YYYYMM 형식으로 반환"""
    return datetime.now().strftime("%Y%m")


def _parse_int(text: str) -> int:
    """문자열에서 숫자만 추출"""
    digits = re.sub(r"[^\d]", "", text.strip())
    return int(digits) if digits else 0


def _create_client() -> httpx.Client:
    """아이보스 접속용 httpx 클라이언트 (쿠키 자동 유지)"""
    client = httpx.Client(
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
            "Referer": "https://www.i-boss.co.kr/",
        },
        follow_redirects=True,
        timeout=15,
    )
    # 메인 페이지 방문하여 쿠키 획득 (403 방지)
    client.get("https://www.i-boss.co.kr/")
    return client


def crawl_iboss_sync(max_posts: int = 10, month: str = "") -> list[CrawledPost]:
    """
    아이보스 월간 인기글을 크롤링합니다. (동기 함수)

    Args:
        max_posts: 최대 크롤링 개수 (기본 10)
        month: YYYYMM 형식 (비어있으면 현재 월)
    """
    if not month:
        month = _get_current_month_param()

    url = f"https://www.i-boss.co.kr/ab-1886?month={month}"
    posts: list[CrawledPost] = []

    client = _create_client()
    try:
        resp = client.get(url)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "html.parser")
        rows = soup.find_all("tr")

        for row in rows[:max_posts]:
            try:
                # 순번
                rank_el = row.select_one("td.SerialNum span")
                if not rank_el:
                    continue
                rank = _parse_int(rank_el.get_text())

                # 제목 + 링크
                title_el = row.select_one(".articleSubject a")
                if not title_el:
                    continue
                title = title_el.get_text(strip=True)
                href = title_el.get("href", "")

                # 댓글수
                comment_el = row.select_one(".AB-comm")
                comments = _parse_int(comment_el.get_text()) if comment_el else 0

                # 작성자
                author_el = row.select_one(".mb_writer")
                author = author_el.get_text(strip=True) if author_el else ""

                # td 목록에서 날짜, 좋아요, 조회수 추출
                tds = row.find_all("td")
                created_at = tds[3].get_text(strip=True) if len(tds) > 3 else ""
                likes = _parse_int(tds[4].get_text()) if len(tds) > 4 else 0
                views = _parse_int(tds[5].get_text()) if len(tds) > 5 else 0

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
        client.close()

    return posts


async def crawl_iboss(max_posts: int = 10, month: str = "") -> list[CrawledPost]:
    """FastAPI용 async 래퍼"""
    return crawl_iboss_sync(max_posts=max_posts, month=month)


def crawl_iboss_detail_sync(url: str) -> str:
    """아이보스 게시물 상세 페이지에서 본문 원문을 크롤링합니다."""
    client = _create_client()
    try:
        resp = client.get(url)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # 본문 영역 추출
        content_el = soup.select_one(".fr-view, .content-body, .view-content, .article-body")
        if content_el:
            return content_el.get_text(strip=True)
        return ""
    except Exception as e:
        print(f"[iboss_crawler] 상세 크롤링 오류: {e}")
        return ""
    finally:
        client.close()


async def crawl_iboss_detail(url: str) -> str:
    """FastAPI용 async 래퍼"""
    return crawl_iboss_detail_sync(url)


# 단독 테스트
if __name__ == "__main__":
    results = crawl_iboss_sync(max_posts=5)
    for post in results:
        print(f"[{post.rank}] {post.title} | {post.author} | 조회:{post.views} 좋아요:{post.likes} 댓글:{post.comments}")
