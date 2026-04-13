"""
크롤링 API 라우터
"""
from fastapi import APIRouter
from src.models.post import CrawlResponse
from src.crawlers.iboss_crawler import crawl_iboss, crawl_iboss_detail
from src.crawlers.x_crawler import crawl_x_trends

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
