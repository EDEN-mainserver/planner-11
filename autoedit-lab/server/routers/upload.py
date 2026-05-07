"""
파일 업로드 라우터
이미지 / 영상 파일을 서버 uploads/ 폴더에 저장하고 경로를 반환
"""
import os
import uuid
import subprocess
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
import aiofiles

router = APIRouter()

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))

ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"}
ALLOWED_VIDEO_EXTS = {".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"}
ALLOWED_AUDIO_EXTS = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}


async def _save(file: UploadFile, ext: str) -> tuple[Path, int]:
    """파일 저장 공통 함수, (saved_path, size) 반환"""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    saved_path = UPLOAD_DIR / f"{uuid.uuid4().hex}{ext}"
    content = await file.read()
    async with aiofiles.open(saved_path, "wb") as f:
        await f.write(content)
    return saved_path, len(content)


@router.post("/upload/image")
async def upload_image(file: UploadFile = File(...)):
    """이미지 업로드 → { file_path, filename, size }"""
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        raise HTTPException(400, f"지원하지 않는 형식: {ext}")

    saved_path, size = await _save(file, ext)
    return {"file_path": str(saved_path.resolve()), "filename": file.filename, "size": size}


@router.post("/upload/video")
async def upload_video(file: UploadFile = File(...)):
    """
    영상 파일 업로드 → { file_path, filename, size, duration }
    ffprobe로 영상 길이도 함께 반환
    """
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_VIDEO_EXTS:
        raise HTTPException(400, f"지원하지 않는 형식: {ext}. 허용: {', '.join(sorted(ALLOWED_VIDEO_EXTS))}")

    saved_path, size = await _save(file, ext)

    # ffprobe로 영상 길이 확인
    duration = None
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                str(saved_path),
            ],
            capture_output=True, text=True, timeout=10,
        )
        duration = round(float(result.stdout.strip()), 2)
    except Exception:
        pass

    return {
        "file_path": str(saved_path.resolve()),
        "filename":  file.filename,
        "size":      size,
        "duration":  duration,
    }


@router.post("/upload/audio")
async def upload_audio(file: UploadFile = File(...)):
    """BGM / 오디오 파일 업로드 → { file_path, filename, size }"""
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTS:
        raise HTTPException(400, f"지원하지 않는 형식: {ext}. 허용: {', '.join(sorted(ALLOWED_AUDIO_EXTS))}")

    saved_path, size = await _save(file, ext)
    return {"file_path": str(saved_path.resolve()), "filename": file.filename, "size": size}
