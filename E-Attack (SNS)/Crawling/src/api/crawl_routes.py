"""
크롤링 API 라우터
"""
import base64
import json
from fastapi import APIRouter
from src.models.post import CrawlResponse
from src.crawlers.iboss_crawler import crawl_iboss, crawl_iboss_detail
from src.crawlers.x_crawler import crawl_x_trends
from src.crawlers.threads_crawler import crawl_threads

router = APIRouter()


@router.get("/iboss", response_model=CrawlResponse)
async def get_iboss_posts(limit: int = 10, month: str = "") -> CrawlResponse:
    """아이보스 월간 인기글 크롤링 후 반환 (month: YYYYMM 형식, 비어있으면 현재 월)"""
    try:
        posts = await crawl_iboss(max_posts=limit, month=month)
        return CrawlResponse(
            platform="iboss",
            total=len(posts),
            posts=posts,
        )
    except Exception as e:
        return CrawlResponse(
            platform="iboss",
            total=0,
            posts=[],
            error=str(e),
        )


@router.get("/iboss/detail")
async def get_iboss_detail(url: str) -> dict:
    """아이보스 게시물 상세 본문 크롤링"""
    try:
        content = await crawl_iboss_detail(url)
        return {"content": content, "error": ""}
    except Exception as e:
        return {"content": "", "error": str(e)}


@router.get("/threads", response_model=CrawlResponse)
async def get_threads_posts(
    keyword: str = "",
    limit: int = 20,
    cookies: str = "",  # Base64 인코딩된 쿠키 JSON (선택적)
) -> CrawlResponse:
    """쓰레드 검색 결과 크롤링 (keyword: 검색어, cookies: base64 쿠키 JSON)"""
    if not keyword.strip():
        return CrawlResponse(platform="threads", total=0, posts=[], error="keyword가 필요합니다.")
    try:
        parsed_cookies: list[dict] = []
        if cookies:
            try:
                parsed_cookies = json.loads(base64.b64decode(cookies).decode("utf-8"))
            except Exception:
                try:
                    parsed_cookies = json.loads(cookies)
                except Exception:
                    pass

        posts = await crawl_threads(keyword=keyword, max_posts=limit, cookies=parsed_cookies or None)
        return CrawlResponse(platform="threads", total=len(posts), posts=posts)
    except Exception as e:
        return CrawlResponse(platform="threads", total=0, posts=[], error=str(e))


@router.get("/x", response_model=CrawlResponse)
async def get_x_trends(keyword: str = "") -> CrawlResponse:
    """X 한국 실시간 트렌드 (keyword 입력 시 필터링)"""
    try:
        posts = crawl_x_trends(keyword_filter=keyword)
        return CrawlResponse(
            platform="x",
            total=len(posts),
            posts=posts,
        )
    except Exception as e:
        return CrawlResponse(
            platform="x",
            total=0,
            posts=[],
            error=str(e),
        )
