"""
캡컷 초안 생성 라우터
타임라인 아이템(이미지/자막/나레이션)을 받아 캡컷 초안 파일을 생성
"""
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Literal, Optional
from services.capcut_builder import build_draft
from services.tts_service import generate_tts

router = APIRouter()

UPLOAD_DIR  = Path(os.getenv("UPLOAD_DIR",       "./uploads"))
CAPCUT_DIR  = os.getenv("CAPCUT_DRAFT_DIR", "")


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
    silence_cuts: list[SilenceCutSegment] | None = None  # 무음 제거 구간

class SubtitleItem(BaseModel):
    type:           Literal["subtitle"]
    text:           str
    start:          float
    duration:       float
    font_size:      float      = 5.0
    color:          list[float]= Field(default=[1.0, 1.0, 1.0])  # RGB 0~1
    bold:           bool       = False
    italic:         bool       = False
    underline:      bool       = False
    alpha:          float      = 1.0
    align:          int        = 1        # 0=왼쪽 1=가운데 2=오른쪽
    letter_spacing: int        = 0
    line_spacing:   int        = 0
    transform_x:    float      = 0.0
    transform_y:    float      = -0.8    # 캡컷 자막 기본 위치 (하단)
    font:           Optional[str] = None  # cc.FontType 이름 (None=시스템 기본)
    border_enabled: bool       = False
    border_color:   list[float]= Field(default=[0.0, 0.0, 0.0])  # RGB 0~1
    border_width:   float      = 40.0    # 0~100 (캡컷 기준)

class NarrationItem(BaseModel):
    type:       Literal["narration"]
    text:       str
    start:      float
    voice:      str   = "nova"
    speed:      float = 1.0

class BgmItem(BaseModel):
    type:      Literal["bgm"]
    audio_path: str
    volume:    float = 0.5
    start:     float = 0.0
    fade_in:   float = 0.5   # 페이드인 길이 (초)
    fade_out:  float = 0.5   # 페이드아웃 길이 (초)

# union
TimelineItem = ImageItem | SubtitleItem | NarrationItem | BgmItem


class DraftRequest(BaseModel):
    project_name:  str
    width:         int   = 1920
    height:        int   = 1080
    fps:           int   = 30
    items:         list[TimelineItem]
    allow_replace: bool  = True


# ── 엔드포인트 ──────────────────────────────────────────────────────

@router.post("/draft/generate")
async def generate_draft(req: DraftRequest):
    """
    캡컷 초안 생성

    1. narration 아이템 → TTS mp3 생성
    2. pyCapCut으로 초안 파일 빌드
    3. 캡컷 앱에서 확인 가능한 초안 이름 반환
    """
    if not CAPCUT_DIR:
        raise HTTPException(
            500,
            "CAPCUT_DRAFT_DIR 환경변수가 설정되지 않았습니다. "
            "server/.env 파일을 확인하세요."
        )
    if not Path(CAPCUT_DIR).exists():
        raise HTTPException(
            500,
            f"캡컷 초안 폴더를 찾을 수 없습니다: {CAPCUT_DIR}"
        )

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    # ── 아이템을 dict로 변환 후 narration은 TTS 먼저 처리 ───────────
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

    # ── pyCapCut으로 초안 생성 ───────────────────────────────────────
    try:
        name = build_draft(
            project_name=req.project_name,
            items=resolved_items,
            draft_dir=CAPCUT_DIR,
            width=req.width,
            height=req.height,
            fps=req.fps,
            allow_replace=req.allow_replace,
        )
    except Exception as e:
        raise HTTPException(500, f"초안 생성 실패: {e}")

    return {
        "ok":           True,
        "project_name": name,
        "item_count":   len(resolved_items),
        "message":      f"캡컷을 열어 '{name}' 초안을 확인하세요.",
    }


@router.get("/draft/config")
async def get_config():
    """현재 서버 설정 확인용"""
    return {
        "capcut_dir":    CAPCUT_DIR or "(미설정)",
        "upload_dir":    str(UPLOAD_DIR.resolve()),
        "capcut_exists": Path(CAPCUT_DIR).exists() if CAPCUT_DIR else False,
    }
