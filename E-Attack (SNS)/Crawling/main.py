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

# CORS 설정 (로컬 개발 전용 — 모든 로컬호스트 허용)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


import os
import subprocess

@app.get("/")
def health_check() -> dict:
    """헬스 체크"""
    return {"status": "ok", "module": "crawling"}


@app.post("/api/util/launch-chrome")
def launch_chrome_debug() -> dict:
    """
    기존 Chrome 프로세스를 모두 종료한 뒤
    디버깅 포트 9222로 새로 실행.
    (Chrome이 이미 실행 중이면 debug 플래그가 무시되므로 종료 필수)
    """
    import time

    chrome_paths = [
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        r"C:\Users\gram\AppData\Local\Google\Chrome\Application\chrome.exe",
    ]

    debug_profile_dir = os.path.expandvars(r"%LOCALAPPDATA%\Google\ChromeDebug")

    chrome_exe = None
    for path in chrome_paths:
        if os.path.exists(path):
            chrome_exe = path
            break

    if not chrome_exe:
        return {"ok": False, "error": "Chrome 실행 파일을 찾을 수 없습니다."}

    # ── 1. 기존 Chrome 프로세스 종료 ──
    try:
        subprocess.run(
            ["taskkill", "/F", "/IM", "chrome.exe"],
            capture_output=True,
        )
        time.sleep(1.5)  # 완전히 닫힐 때까지 대기
    except Exception:
        pass

    # ── 2. 디버그 모드로 재실행 ──
    try:
        cmd = [
            chrome_exe,
            "--remote-debugging-port=9222",
            f"--user-data-dir={debug_profile_dir}",
            "--no-first-run",
            "--no-default-browser-check",
            "https://www.threads.com",
        ]
        subprocess.Popen(
            cmd,
            creationflags=subprocess.DETACHED_PROCESS
            if hasattr(subprocess, "DETACHED_PROCESS") else 0,
        )
        return {
            "ok": True,
            "message": "Chrome 디버그 모드로 실행됐습니다.",
            "note": "처음이라면 Threads 로그인 필요 (이후 자동 유지)",
        }
    except Exception as e:
        return {"ok": False, "error": str(e)}


@app.get("/api/util/chrome-status")
async def chrome_status() -> dict:
    """Chrome CDP 연결 가능 여부 확인"""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            r = await client.get("http://localhost:9222/json/version")
            if r.status_code == 200:
                data = r.json()
                return {"connected": True, "browser": data.get("Browser", "")}
    except Exception:
        pass
    return {"connected": False}


# 라우터 등록
from src.api.crawl_routes import router as crawl_router

app.include_router(crawl_router, prefix="/api/crawl", tags=["크롤링"])
