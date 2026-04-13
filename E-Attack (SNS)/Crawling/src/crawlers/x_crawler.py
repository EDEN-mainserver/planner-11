"""
X(Twitter) 실시간 트렌드 크롤러
게스트 토큰 + v1.1 trends/place API 활용 (로그인 불필요)
한국 WOEID: 23424868
"""
import httpx
from src.models.post import CrawledPost

BEARER_TOKEN = (
    "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs"
    "=1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"
)
KOREA_WOEID = 23424868


def _get_guest_token() -> str:
    """X 게스트 토큰 발급"""
    headers = {
        "Authorization": f"Bearer {BEARER_TOKEN}",
        "User-Agent": "Mozilla/5.0",
    }
    resp = httpx.post("https://api.x.com/1.1/guest/activate.json", headers=headers)
    resp.raise_for_status()
    return resp.json()["guest_token"]


def crawl_x_trends(keyword_filter: str = "") -> list[CrawledPost]:
    """
    X 한국 실시간 트렌드를 가져옵니다.

    Args:
        keyword_filter: 비어있으면 전체, 입력하면 해당 키워드 포함 트렌드만 필터
    """
    gt = _get_guest_token()

    headers = {
        "Authorization": f"Bearer {BEARER_TOKEN}",
        "User-Agent": "Mozilla/5.0",
        "x-guest-token": gt,
    }

    resp = httpx.get(
        f"https://api.x.com/1.1/trends/place.json?id={KOREA_WOEID}",
        headers=headers,
    )
    resp.raise_for_status()
    data = resp.json()

    trends = data[0].get("trends", [])
    posts: list[CrawledPost] = []
    rank = 1

    for t in trends:
        name = t.get("name", "")
        tweet_volume = t.get("tweet_volume") or 0
        query = t.get("query", "")
        url = t.get("url", "")

        # 키워드 필터 적용
        if keyword_filter and keyword_filter.lower() not in name.lower():
            continue

        posts.append(CrawledPost(
            rank=rank,
            title=name,
            content_raw=f"트렌드 키워드: {name}",
            author="X Korea Trends",
            views=tweet_volume,
            likes=0,
            comments=0,
            shares=0,
            image_url="",
            source_url=url if url.startswith("http") else f"https://x.com/search?q={query}",
            created_at="실시간",
            platform="x",
        ))
        rank += 1

    return posts


# 단독 테스트
if __name__ == "__main__":
    results = crawl_x_trends()
    print(f"총 {len(results)}개 트렌드")
    for post in results:
        vol = f"{post.views:,}" if post.views else "-"
        print(f"[{post.rank:2d}] {post.title:40s} | 트윗수: {vol}")
