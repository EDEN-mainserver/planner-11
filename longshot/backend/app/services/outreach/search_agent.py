"""컴포넌트 1: Search Agent
Playwright로 구글 검색 결과 상위 N개 추출.
SerpAPI 키가 settings에 있으면 그쪽을 우선 사용.

단독 실행:
    python -m app.services.outreach.search_agent "치과 마케팅"
"""
from __future__ import annotations
import asyncio
import json
import sys
from urllib.parse import urlparse

import tldextract
import httpx

from app.core.config import settings
from app.services.outreach.db import get_setting


class CaptchaDetected(Exception):
    """구글이 CAPTCHA를 띄운 경우"""


def _domain_of(url: str) -> str:
    ext = tldextract.extract(url)
    return ".".join(p for p in [ext.domain, ext.suffix] if p)


async def search(keyword: str, top_n: int = 10, region: str = "kr", language: str = "ko") -> list[dict]:
    """디스패처: SerpAPI 키가 있으면 SerpAPI, 없으면 Playwright."""
    serpapi_key = get_setting("serpapi_key", "") or ""
    if serpapi_key:
        return await _search_serpapi(keyword, top_n, region, language, serpapi_key)
    return await _search_playwright(keyword, top_n, region, language)


async def _search_serpapi(keyword: str, top_n: int, region: str, language: str, api_key: str) -> list[dict]:
    """SerpAPI 경로 (유료, 안정적)"""
    params = {
        "engine": "google",
        "q": keyword,
        "gl": region,
        "hl": language,
        "num": top_n,
        "api_key": api_key,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get("https://serpapi.com/search.json", params=params)
        res.raise_for_status()
        data = res.json()

    organic = data.get("organic_results", [])[:top_n]
    return [
        {
            "rank": i + 1,
            "url": r.get("link", ""),
            "domain": _domain_of(r.get("link", "")),
            "title": r.get("title", ""),
            "snippet": r.get("snippet", ""),
        }
        for i, r in enumerate(organic)
        if r.get("link")
    ]


async def _search_playwright(keyword: str, top_n: int, region: str, language: str) -> list[dict]:
    """Playwright 직접 스크래핑 (무료, CAPTCHA 위험)"""
    # 지연 import: playwright 미설치 시 sender 등 다른 컴포넌트는 살아있게
    from playwright.async_api import async_playwright

    url = f"https://www.google.com/search?q={keyword}&gl={region}&hl={language}&num={top_n}"
    results: list[dict] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=settings.outreach_playwright_headless)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/130.0.0.0 Safari/537.36"
            ),
            locale="ko-KR" if language == "ko" else "en-US",
        )
        page = await context.new_page()
        try:
            await page.goto(url, wait_until="domcontentloaded", timeout=30000)

            # CAPTCHA 페이지 감지
            content_check = await page.content()
            if "/sorry/" in page.url or "unusual traffic" in content_check.lower():
                raise CaptchaDetected("Google가 CAPTCHA를 띄웠습니다 — SerpAPI 키 설정 권장")

            # 검색 결과는 div[data-snc] 또는 div.g 안에 a[href]
            anchors = await page.locator("div#search a[href^='http']").all()
            seen = set()
            for a in anchors:
                href = await a.get_attribute("href") or ""
                if not href or href.startswith("https://www.google."):
                    continue
                if href in seen:
                    continue
                seen.add(href)
                # 타이틀: 가장 가까운 h3
                title = ""
                try:
                    title = await a.locator("h3").inner_text(timeout=500)
                except Exception:
                    continue  # h3 없는 링크는 광고/이미지/페이지네이션
                if not title:
                    continue
                results.append({
                    "rank": len(results) + 1,
                    "url": href,
                    "domain": _domain_of(href),
                    "title": title,
                    "snippet": "",
                })
                if len(results) >= top_n:
                    break
        finally:
            await context.close()
            await browser.close()

    return results


# CLI 단독 실행
def _main():
    if len(sys.argv) < 2:
        print("사용법: python -m app.services.outreach.search_agent <키워드> [top_n]")
        sys.exit(1)
    keyword = sys.argv[1]
    top_n = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    results = asyncio.run(search(keyword, top_n=top_n))
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    _main()
