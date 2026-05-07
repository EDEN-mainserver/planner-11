"""
Whisper 전사 라우터
영상/오디오 업로드 → ffmpeg로 오디오 추출 → OpenAI Whisper API 전사
파일 크기 제한 없음 (ffmpeg가 오디오만 추출해 25MB 이하로 압축)
"""
import os
import uuid
import subprocess
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from openai import OpenAI

router = APIRouter()

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "./uploads"))

ALLOWED_EXTS = {
    ".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v",
    ".mp3", ".wav", ".m4a", ".flac", ".ogg", ".wma",
}

AUDIO_ONLY_EXTS = {".mp3", ".wav", ".m4a", ".flac", ".ogg", ".wma"}

WHISPER_MAX = 25 * 1024 * 1024  # Whisper API 25MB 제한


def extract_audio(input_path: Path, output_path: Path) -> None:
    """ffmpeg로 영상에서 오디오만 추출 (mono 16kHz mp3로 압축)"""
    result = subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", str(input_path),
            "-vn",                  # 영상 트랙 제거
            "-ac", "1",             # 모노
            "-ar", "16000",         # 16kHz (Whisper 최적)
            "-b:a", "64k",          # 64kbps (용량 절감)
            str(output_path),
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"ffmpeg 실패: {result.stderr[-300:]}")


@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    """
    영상/오디오 파일 → Whisper 전사
    - 영상이면 ffmpeg로 오디오 추출 (용량 대폭 감소)
    - 오디오가 여전히 25MB 초과이면 분할 없이 에러 안내
    Returns: { text, segments, count, duration }
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(500, "OPENAI_API_KEY 환경변수가 없습니다.")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(400, f"지원하지 않는 형식: {ext}. 허용: {', '.join(sorted(ALLOWED_EXTS))}")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    uid = uuid.uuid4().hex

    # ── 원본 파일 저장 ────────────────────────────────────────────────
    raw_path = UPLOAD_DIR / f"raw_{uid}{ext}"
    content = await file.read()
    raw_path.write_bytes(content)

    audio_path = raw_path  # 기본값: 오디오 파일은 그대로 사용

    try:
        # ── 영상이면 오디오 추출 ──────────────────────────────────────
        if ext not in AUDIO_ONLY_EXTS:
            audio_path = UPLOAD_DIR / f"audio_{uid}.mp3"
            try:
                extract_audio(raw_path, audio_path)
            except RuntimeError as e:
                raise HTTPException(500, f"오디오 추출 실패: {e}")

        # ── 파일 크기 확인 ────────────────────────────────────────────
        audio_size = audio_path.stat().st_size
        if audio_size > WHISPER_MAX:
            raise HTTPException(
                413,
                f"오디오 추출 후에도 파일이 큽니다 ({audio_size//1024//1024}MB). "
                "영상을 짧게 잘라 다시 시도해 주세요."
            )

        # ── Whisper 전사 ──────────────────────────────────────────────
        client = OpenAI(api_key=api_key)
        with open(audio_path, "rb") as f:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",
                timestamp_granularities=["segment", "word"],  # 단어별 타임스탬프 포함
            )

        segments = [
            {
                "start": round(seg.start, 3),
                "end":   round(seg.end,   3),
                "text":  seg.text.strip(),
                # 단어별 실제 타이밍 — splitByWords에서 정확한 자막 싱크에 활용
                "words": [
                    {
                        "word":  w.word.strip(),
                        "start": round(w.start, 3),
                        "end":   round(w.end,   3),
                    }
                    for w in (getattr(seg, "words", None) or [])
                ],
            }
            for seg in (response.segments or [])
        ]

        return {
            "text":          response.text,
            "segments":      segments,
            "count":         len(segments),
            "duration":      round(response.duration, 2) if response.duration else None,
            "original_size": len(content),
            "audio_size":    audio_size,
            # 캡컷 초안 생성에 쓸 수 있도록 저장된 원본 경로 반환
            "file_path":     str(raw_path.resolve()),
        }

    except HTTPException:
        # raw_path(원본 영상)는 삭제 안 함 — 캡컷 draft가 참조해야 함
        if audio_path != raw_path:
            audio_path.unlink(missing_ok=True)
        raise

    except Exception as e:
        if audio_path != raw_path:
            audio_path.unlink(missing_ok=True)
        raise HTTPException(500, f"전사 실패: {e}")

    finally:
        # 추출된 오디오(임시)만 정리, 원본 영상은 유지
        if audio_path != raw_path:
            audio_path.unlink(missing_ok=True)


# ── 서버 저장 파일 직접 전사 (업로드 없이) ─────────────────────────

class FromPathRequest(BaseModel):
    file_path: str


@router.post("/transcribe/from-path")
async def transcribe_from_path(req: FromPathRequest):
    """
    이미 서버에 저장된 영상/오디오 파일을 Whisper로 전사.
    무음 제거 없이 전체 영상 기준 타임스탬프 반환.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(500, "OPENAI_API_KEY 환경변수가 없습니다.")

    src = Path(req.file_path)
    if not src.exists():
        raise HTTPException(400, f"파일을 찾을 수 없습니다: {req.file_path}")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    uid_str    = uuid.uuid4().hex
    audio_path = UPLOAD_DIR / f"audio_{uid_str}.mp3"
    ext        = src.suffix.lower()

    try:
        if ext in AUDIO_ONLY_EXTS:
            audio_path = src
        else:
            extract_audio(src, audio_path)

        audio_size = audio_path.stat().st_size
        if audio_size > WHISPER_MAX:
            raise HTTPException(413,
                f"오디오가 {audio_size // 1024 // 1024}MB로 25MB 초과. "
                "영상을 짧게 줄이거나 무음 감지를 사용해 압축하세요.")

        client = OpenAI(api_key=api_key)
        with open(audio_path, "rb") as f:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",
                timestamp_granularities=["segment", "word"],
            )

        segments = [
            {
                "start": round(seg.start, 3),
                "end":   round(seg.end,   3),
                "text":  seg.text.strip(),
                "words": [
                    {"word": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)}
                    for w in (getattr(seg, "words", None) or [])
                ],
            }
            for seg in (response.segments or [])
        ]

        return {
            "text":      response.text,
            "segments":  segments,
            "count":     len(segments),
            "duration":  round(response.duration, 2) if response.duration else None,
            "file_path": str(src.resolve()),
        }

    finally:
        if audio_path != src:
            audio_path.unlink(missing_ok=True)


# ── 무음 제거 후 정렬 전사 ──────────────────────────────────────────

class KeepSegment(BaseModel):
    start:    float
    end:      float
    duration: float

class AlignedRequest(BaseModel):
    file_path:     str
    keep_segments: list[KeepSegment]


@router.post("/transcribe/aligned")
async def transcribe_aligned(req: AlignedRequest):
    """
    무음 제거된 압축 오디오를 Whisper로 전사.

    ffmpeg의 atrim+concat 필터로 keep_segments만 이어 붙인 오디오를 생성한 뒤
    Whisper로 전사하므로 반환 타임스탬프가 이미 압축 타임라인 기준.
    클라이언트에서 리매핑 없이 그대로 자막으로 사용 가능.

    Returns: { text, segments(with words), count, duration }
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(500, "OPENAI_API_KEY 환경변수가 없습니다.")

    src = Path(req.file_path)
    if not src.exists():
        raise HTTPException(400, f"파일을 찾을 수 없습니다: {req.file_path}")
    if not req.keep_segments:
        raise HTTPException(400, "keep_segments가 비어있습니다.")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    uid_str   = uuid.uuid4().hex
    out_path  = UPLOAD_DIR / f"aligned_{uid_str}.mp3"

    try:
        # ── ffmpeg filter_complex: keep_segments만 잘라 이어 붙이기 ────
        # [0:a]atrim=start=S:end=E,asetpts=PTS-STARTPTS[a0]; ...
        # [a0][a1]...concat=n=N:v=0:a=1[out]
        segs = req.keep_segments
        parts   = []
        labels  = []
        for i, seg in enumerate(segs):
            lbl = f"a{i}"
            parts.append(
                f"[0:a]atrim=start={seg.start}:end={seg.end},"
                f"asetpts=PTS-STARTPTS[{lbl}]"
            )
            labels.append(f"[{lbl}]")

        n = len(segs)
        filter_str = "; ".join(parts) + f"; {''.join(labels)}concat=n={n}:v=0:a=1[out]"

        result = subprocess.run(
            [
                "ffmpeg", "-y",
                "-i", str(src),
                "-filter_complex", filter_str,
                "-map", "[out]",
                "-ac", "1", "-ar", "16000", "-b:a", "64k",
                str(out_path),
            ],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            raise HTTPException(500, f"ffmpeg 압축 오디오 생성 실패: {result.stderr[-400:]}")

        audio_size = out_path.stat().st_size
        if audio_size > WHISPER_MAX:
            raise HTTPException(
                413,
                f"압축 오디오가 {audio_size // 1024 // 1024}MB로 25MB 초과. "
                "영상을 짧게 줄이거나 무음 감지 감도를 높여주세요."
            )

        # ── Whisper 전사 (타임스탬프 = 압축 타임라인 기준) ───────────
        client = OpenAI(api_key=api_key)
        with open(out_path, "rb") as f:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",
                timestamp_granularities=["segment", "word"],
            )

        segments = [
            {
                "start": round(seg.start, 3),
                "end":   round(seg.end,   3),
                "text":  seg.text.strip(),
                "words": [
                    {
                        "word":  w.word.strip(),
                        "start": round(w.start, 3),
                        "end":   round(w.end,   3),
                    }
                    for w in (getattr(seg, "words", None) or [])
                ],
            }
            for seg in (response.segments or [])
        ]

        return {
            "text":     response.text,
            "segments": segments,
            "count":    len(segments),
            "duration": round(response.duration, 2) if response.duration else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"전사 실패: {e}")
    finally:
        out_path.unlink(missing_ok=True)
