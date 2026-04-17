# Eden Dashboard 백엔드 서버
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ai, video, schedule

app = FastAPI(title="Eden Dashboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://planforge-ui.vercel.app", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ai.router)
app.include_router(video.router)
app.include_router(schedule.router)

@app.get("/health")
def health():
    return {"status": "ok"}
