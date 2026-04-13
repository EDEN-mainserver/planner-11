"""
크롤링 모듈 — SNS 트렌드 분석 및 AI 재구성 자동 배포 시스템
백엔드 엔트리포인트 (FastAPI)
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="E-Attack Crawling API",
    description="SNS 트렌드 분석 및 AI 재구성 자동 배포",
    version="0.1.0",
)

# CORS 설정 (프론트엔드 연동)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check() -> dict:
    """헬스 체크"""
    return {"status": "ok", "module": "crawling"}


# 라우터 등록
from src.api.crawl_routes import router as crawl_router

app.include_router(crawl_router, prefix="/api/crawl", tags=["크롤링"])
