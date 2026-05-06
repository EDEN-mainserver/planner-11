# Eden Dashboard 백엔드 서버
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ai, video, schedule, coupang

app = FastAPI(title="Eden Dashboard API", version="0.1.0")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "").split(",") if os.getenv("ALLOWED_ORIGINS") else []
DEFAULT_ORIGINS = ["http://localhost:5173", "http://localhost:3000", "https://planforge-ui.vercel.app"]
ORIGINS = list(set(DEFAULT_ORIGINS + [o.strip() for o in ALLOWED_ORIGINS if o.strip()]))

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router)
app.include_router(video.router)
app.include_router(schedule.router)
app.include_router(coupang.router)

@app.get("/health")
def health():
    return {"status": "ok"}
