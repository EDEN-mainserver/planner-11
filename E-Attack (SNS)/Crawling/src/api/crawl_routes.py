"""
크롤링 API 라우터

- iboss/threads: async 크롤러 (Playwright async API)
- x: sync 크롤러 (Playwright sync API) → asyncio.to_thread 로 스레드 실행
  FastAPI는 asyncio 기반이므로 sync Playwright를 직접 호출하면 충돌 발생
"""
import asyncio
import base64
import json
from functools import partial

from fastapi import APIRouter
from src.models.post import CrawlResponse
from src.crawlers.iboss_crawler import crawl_iboss, crawl_iboss_detail
from src.crawlers.x_crawler import crawl_x_trends, crawl_x_search
from src.crawlers.threads_crawler import crawl_threads

router = APIRouter()


# ─── 아이보스 ───

@router.get("/iboss", response_model=CrawlResponse)
async def get_iboss_posts(limit: int = 10, month: str = "") -> CrawlResponse:
    """아이보스 월간 인기글 크롤링 (month: YYYYMM 형식, 비어있으면 현재 월)"""
    try:
        posts = await crawl_iboss(max_posts=limit, month=month)
        return CrawlResponse(platform="iboss", total=len(posts), posts=posts)
    except Exception as e:
        return CrawlResponse(platform="iboss", total=0, posts=[], error=str(e))


@router.get("/iboss/detail")
async def get_iboss_detail(url: str) -> dict:
    """아이보스 게시물 상세 본문 크롤링"""
    try:
        content = await crawl_iboss_detail(url)
        return {"content": content, "error": ""}
    except Exception as e:
        return {"content": "", "error": str(e)}


# ─── 쓰레드 ───

@router.get("/threads", response_model=CrawlResponse)
async def get_threads_posts(
    keyword: str = "",
    limit: int = 20,
    cookies: str = "",
) -> CrawlResponse:
    """쓰레드 검색 결과 크롤링 (cookies: Base64 인코딩된 쿠키 JSON)"""
    if not keyword.strip():
        return CrawlResponse(platform="threads", total=0, posts=[], error="keyword가 필요합니다.")
    try:
        parsed_cookies: list[dict] = _decode_cookies(cookies)
        posts = await crawl_threads(keyword=keyword, max_posts=limit, cookies=parsed_cookies or None)
        return CrawlResponse(platform="threads", total=len(posts), posts=posts)
    except Exception as e:
        return CrawlResponse(platform="threads", total=0, posts=[], error=str(e))


# ─── X (Twitter) ───

@router.get("/x", response_model=CrawlResponse)
async def get_x_trends(keyword: str = "") -> CrawlResponse:
    """X 한국 실시간 트렌드 (trends24.in/korea/, Playwright)"""
    try:
        # sync Playwright → 별도 스레드에서 실행
        posts = await asyncio.to_thread(crawl_x_trends, keyword)
        return CrawlResponse(platform="x", total=len(posts), posts=posts)
    except Exception as e:
        return CrawlResponse(platform="x", total=0, posts=[], error=str(e))


@router.get("/x/search", response_model=CrawlResponse)
@router.post("/x/search", response_model=CrawlResponse)
async def get_x_search(
    keyword: str = "",
    limit: int = 20,
    cookies: str = "",
) -> CrawlResponse:
    """X.com 키워드 검색 결과 크롤링 (Playwright + 쿠키 주입)"""
    if not keyword.strip():
        return CrawlResponse(platform="x", total=0, posts=[], error="keyword가 필요합니다.")
    try:
        parsed_cookies = _decode_cookies(cookies)
        fn = partial(
            crawl_x_search,
            keyword=keyword.strip(),
            max_posts=limit,
            cookies=parsed_cookies or None,
        )
        posts = await asyncio.to_thread(fn)
        return CrawlResponse(platform="x", total=len(posts), posts=posts)
    except Exception as e:
        return CrawlResponse(platform="x", total=0, posts=[], error=str(e))


# ─── 헬퍼 ───

def _decode_cookies(cookies_str: str) -> list[dict]:
    """Base64 또는 일반 JSON 쿠키 문자열을 파싱합니다."""
    if not cookies_str:
        return []
    try:
        return json.loads(base64.b64decode(cookies_str).decode("utf-8"))
    except Exception:
        pass
    try:
        return json.loads(cookies_str)
    except Exception:
        pass
    return []
