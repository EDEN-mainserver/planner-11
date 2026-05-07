"""
무음 구간 감지 라우터
ffmpeg silencedetect 필터로 무음 구간을 찾아 비무음 구간 목록을 반환
"""
import re
import subprocess
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class SilenceRequest(BaseModel):
    file_path:        str
    threshold_db:     float = -40.0   # 무음 판정 dB (기본 -40dB)
    min_silence_sec:  float = 0.5     # 최소 무음 길이 (기본 0.5초)
    padding_sec:      float = 0.1     # 컷 앞뒤 여백 (잘림 방지)


def detect_silence(
    file_path: str,
    threshold_db: float = -40.0,
    min_silence_sec: float = 0.5,
) -> tuple[list[dict], float]:
    """
    ffmpeg silencedetect 실행 후 무음 구간 파싱

    Returns:
        (silence_intervals, total_duration)
        silence_intervals: [{start, end}]  ← 무음 구간
    """
    cmd = [
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file_path,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
    try:
        total_duration = float(r.stdout.strip())
    except ValueError:
        total_duration = 0.0

    # silencedetect 실행
    cmd = [
        "ffmpeg", "-y",
        "-i", file_path,
        "-af", f"silencedetect=noise={threshold_db}dB:d={min_silence_sec}",
        "-f", "null", "-",
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    output = result.stderr  # ffmpeg 로그는 stderr

    starts = [float(x) for x in re.findall(r"silence_start:\s*([\d.]+)", output)]
    ends   = [float(x) for x in re.findall(r"silence_end:\s*([\d.]+)",   output)]

    silence_intervals = []
    for s, e in zip(starts, ends):
        silence_intervals.append({"start": round(s, 3), "end": round(e, 3)})

    # 시작 전 무음 처리 (silence_end만 있고 start가 0인 경우)
    if len(ends) > len(starts):
        silence_intervals.insert(0, {"start": 0.0, "end": round(ends[0], 3)})

    return silence_intervals, total_duration


def compute_keep_segments(
    silence_intervals: list[dict],
    total_duration: float,
    padding_sec: float = 0.1,
) -> list[dict]:
    """
    무음 구간의 반대 = 비무음 구간 계산
    padding_sec: 컷 경계에서 앞뒤로 약간 남겨 입술 잘림 방지
    """
    # 무음 구간을 제거 후 남는 구간 계산
    boundaries = [0.0]
    for s in silence_intervals:
        boundaries.append(s["start"] + padding_sec)   # 무음 직전까지 유지
        boundaries.append(s["end"]   - padding_sec)   # 무음 직후부터 재개
    boundaries.append(total_duration)

    keep = []
    for i in range(0, len(boundaries) - 1, 2):
        start = round(boundaries[i],     3)
        end   = round(boundaries[i + 1], 3)
        dur   = round(end - start,        3)
        if dur > 0.05:   # 너무 짧은 조각 제거
            keep.append({"start": start, "end": end, "duration": dur})

    # 앞뒤 패딩 잔여 클립 제거
    # 영상이 무음으로 시작/끝날 때 padding_sec 크기의 작은 클립이 생기는 현상 방지
    if keep and keep[0]["start"] < 0.01 and keep[0]["duration"] < 0.3:
        keep = keep[1:]
    if keep and abs(keep[-1]["end"] - total_duration) < 0.05 and keep[-1]["duration"] < 0.3:
        keep = keep[:-1]

    return keep


@router.post("/silence/detect")
async def detect(req: SilenceRequest):
    """
    영상에서 무음 구간 감지 → 비무음 구간 목록 반환

    Returns:
      keep_segments  : 남길 구간 목록 [{start, end, duration}]
      cut_segments   : 제거할 구간 목록 [{start, end}]
      total_duration : 원본 영상 총 길이 (초)
      kept_duration  : 남는 구간 합계 (초)
      cut_duration   : 제거되는 구간 합계 (초)
      cut_count      : 제거 구간 수
    """
    try:
        silence_intervals, total_duration = detect_silence(
            req.file_path,
            req.threshold_db,
            req.min_silence_sec,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "ffmpeg 타임아웃 — 영상이 너무 깁니다.")
    except Exception as e:
        raise HTTPException(500, f"무음 감지 실패: {e}")

    keep_segments = compute_keep_segments(
        silence_intervals, total_duration, req.padding_sec
    )

    kept_duration = round(sum(s["duration"] for s in keep_segments), 2)
    cut_duration  = round(total_duration - kept_duration, 2)

    return {
        "keep_segments":   keep_segments,
        "cut_segments":    silence_intervals,
        "total_duration":  round(total_duration, 2),
        "kept_duration":   kept_duration,
        "cut_duration":    cut_duration,
        "cut_count":       len(silence_intervals),
    }
