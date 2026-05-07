"""
AutoEdit Lab — FastAPI 서버
실행: uvicorn main:app --reload --port 8000
"""
from dotenv import load_dotenv
load_dotenv()  # .env 파일 로드 (반드시 import 전에)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import draft, tts, upload, transcribe, silence

app = FastAPI(title="AutoEdit Lab API", version="0.1.0")

# ── CORS (Vite 개발 서버 허용) ───────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://localhost:5175", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── 라우터 등록 ──────────────────────────────────────────────────────
app.include_router(draft.router,      prefix="/api")
app.include_router(tts.router,        prefix="/api")
app.include_router(upload.router,     prefix="/api")
app.include_router(transcribe.router, prefix="/api")
app.include_router(silence.router,    prefix="/api")


@app.get("/")
def root():
    return {"status": "ok", "message": "AutoEdit Lab API"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
