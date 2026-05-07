"""
캡컷 초안 생성 라우터
타임라인 아이템(영상/자막/나레이션)을 받아 캡컷 초안 폴더를 zip으로 반환.
원격 서버 배포 기준 — 로컬 CapCut 폴더 불필요.
"""
import os
import uuid
import shutil
import tempfile
import zipfile
from pathlib import Path
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from typing import Literal, Optional
from services.capcut_builder import build_draft
from services.tts_service import generate_tts

router = APIRouter()

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))


# ── 아이템 스키마 ────────────────────────────────────────────────────

class SilenceCutSegment(BaseModel):
    start:    float
    end:      float
    duration: float

class ImageItem(BaseModel):
    type:         Literal["image"]
    file_path:    str
    start:        float
    duration:     float
    silence_cuts: list[SilenceCutSegment] | None = None

class SubtitleItem(BaseModel):
    type:           Literal["subtitle"]
    text:           str
    start:          float
    duration:       float
    font_size:      float       = 5.0
    color:          list[float] = Field(default=[1.0, 1.0, 1.0])
    bold:           bool        = False
    italic:         bool        = False
    underline:      bool        = False
    alpha:          float       = 1.0
    align:          int         = 1
    letter_spacing: int         = 0
    line_spacing:   int         = 0
    transform_x:    float       = 0.0
    transform_y:    float       = -0.8
    font:           Optional[str] = None
    border_enabled: bool        = False
    border_color:   list[float] = Field(default=[0.0, 0.0, 0.0])
    border_width:   float       = 40.0

class NarrationItem(BaseModel):
    type:  Literal["narration"]
    text:  str
    start: float
    voice: str   = "nova"
    speed: float = 1.0

class BgmItem(BaseModel):
    type:       Literal["bgm"]
    audio_path: str
    volume:     float = 0.5
    start:      float = 0.0
    fade_in:    float = 0.5
    fade_out:   float = 0.5

TimelineItem = ImageItem | SubtitleItem | NarrationItem | BgmItem


class DraftRequest(BaseModel):
    project_name:  str
    width:         int  = 1920
    height:        int  = 1080
    fps:           int  = 30
    items:         list[TimelineItem]
    allow_replace: bool = True


# ── 엔드포인트 ──────────────────────────────────────────────────────

@router.post("/draft/generate")
async def generate_draft(req: DraftRequest, background_tasks: BackgroundTasks):
    """
    캡컷 초안 생성 → zip 파일로 반환

    1. narration 아이템 → TTS mp3 생성
    2. pyCapCut으로 임시 폴더에 초안 빌드
    3. 초안 폴더를 zip 압축 후 다운로드 응답
    4. 응답 후 임시 폴더 자동 삭제

    사용법: 다운로드된 zip을 다음 경로에 압축 해제
    C:\\Users\\[계정]\\AppData\\Local\\CapCut\\User Data\\Projects\\com.lveditor.draft\\
    """
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # ── TTS 생성 ────────────────────────────────────────────────────
    resolved_items = []
    for item in req.items:
        d = item.model_dump()

        if d["type"] == "narration":
            tts_path = str(UPLOAD_DIR / f"tts_{uuid.uuid4().hex}.mp3")
            try:
                saved = generate_tts(
                    text=d["text"],
                    output_path=tts_path,
                    voice=d.get("voice", "nova"),
                    speed=d.get("speed", 1.0),
                )
                d["audio_path"] = saved
            except Exception as e:
                raise HTTPException(500, f"TTS 생성 실패: {e}")

        resolved_items.append(d)

    # ── 임시 폴더에 초안 생성 ────────────────────────────────────────
    tmp_dir = Path(tempfile.mkdtemp())

    try:
        name = build_draft(
            project_name=req.project_name,
            items=resolved_items,
            draft_dir=str(tmp_dir),
            width=req.width,
            height=req.height,
            fps=req.fps,
            allow_replace=req.allow_replace,
        )
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(500, f"초안 생성 실패: {e}")

    # ── zip 압축 ─────────────────────────────────────────────────────
    draft_folder = tmp_dir / name
    zip_path     = tmp_dir / f"{name}.zip"

    try:
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in draft_folder.rglob("*"):
                if f.is_file():
                    zf.write(f, f.relative_to(tmp_dir))
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(500, f"zip 압축 실패: {e}")

    # ── 응답 후 임시 폴더 삭제 ───────────────────────────────────────
    background_tasks.add_task(shutil.rmtree, str(tmp_dir), True)

    return FileResponse(
        path=str(zip_path),
        filename=f"{name}.zip",
        media_type="application/zip",
    )


@router.get("/draft/config")
async def get_config():
    """서버 설정 확인용"""
    return {
        "upload_dir": str(UPLOAD_DIR.resolve()),
        "mode":       "remote (zip download)",
    }
