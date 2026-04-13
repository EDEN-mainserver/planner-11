"""
크롤링 게시물 데이터 모델
"""
from pydantic import BaseModel


class CrawledPost(BaseModel):
    """크롤링된 게시물"""
    rank: int                           # 순번
    title: str                          # 제목
    content_raw: str = ""               # 본문 원문
    author: str = ""                    # 작성자 아이디
    views: int = 0                      # 조회수
    likes: int = 0                      # 좋아요
    comments: int = 0                   # 댓글수
    shares: int = 0                     # 공유수
    image_url: str = ""                 # 대표 이미지 URL
    source_url: str = ""                # 원문 링크
    created_at: str = ""                # 작성일/활동시간
    platform: str = "iboss"             # 출처 플랫폼


class CrawlResponse(BaseModel):
    """크롤링 응답"""
    platform: str
    total: int
    posts: list[CrawledPost]
    error: str = ""
