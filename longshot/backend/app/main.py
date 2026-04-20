"""LongShot FastAPI 메인 서버"""
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from app.core.config import settings
from app.api import health, projects, shorts

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 정적 파일 서빙 (생성된 쇼츠 영상/썸네일)
outputs_path = Path(settings.output_dir)
outputs_path.mkdir(exist_ok=True)
app.mount("/static/outputs", StaticFiles(directory=str(outputs_path)), name="outputs")

# 라우터 등록
app.include_router(health.router, tags=["health"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(shorts.router, prefix="/api/shorts", tags=["shorts"])
