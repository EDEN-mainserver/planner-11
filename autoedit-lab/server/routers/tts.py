"""
TTS 미리듣기 라우터
나레이션 텍스트를 입력하면 mp3를 생성해 반환
"""
import os
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from services.tts_service import generate_tts, VOICES

router = APIRouter()

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))


class TtsRequest(BaseModel):
    text:  str
    voice: str = "nova"   # alloy / echo / fable / onyx / nova / shimmer
    speed: float = 1.0    # 0.25 ~ 4.0


@router.post("/tts/preview")
async def tts_preview(req: TtsRequest):
    """
    나레이션 텍스트 → mp3 생성 후 파일 경로 반환
    (초안 생성 전 미리듣기 & 실제 draft 생성에도 재사용)
    """
    if req.voice not in VOICES:
        raise HTTPException(400, f"지원 음성: {VOICES}")
    if not (0.25 <= req.speed <= 4.0):
        raise HTTPException(400, "speed는 0.25~4.0 범위여야 합니다.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    out_path = str(UPLOAD_DIR / f"tts_{uuid.uuid4().hex}.mp3")

    try:
        saved = generate_tts(req.text, out_path, voice=req.voice, speed=req.speed)
    except ValueError as e:
        raise HTTPException(500, str(e))
    except Exception as e:
        raise HTTPException(500, f"TTS 생성 실패: {e}")

    return {"audio_path": saved, "voice": req.voice}


@router.get("/tts/voices")
async def get_voices():
    """사용 가능한 음성 목록"""
    return {"voices": VOICES}
