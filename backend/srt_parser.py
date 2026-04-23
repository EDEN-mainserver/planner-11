import pysrt
import re
from typing import List, Dict


def parse_srt(file_path: str) -> List[Dict]:
    """SRT 파일을 파싱하여 자막 리스트를 반환"""
    subs = pysrt.open(file_path, encoding="utf-8")
    result = []
    for sub in subs:
        result.append({
            "index": sub.index,
            "start": str(sub.start),
            "end": str(sub.end),
            "start_seconds": time_to_seconds(sub.start),
            "end_seconds": time_to_seconds(sub.end),
            "text": sub.text.replace("\n", " "),
        })
    return result


def time_to_seconds(t) -> float:
    return t.hours * 3600 + t.minutes * 60 + t.seconds + t.milliseconds / 1000


def format_time_ffmpeg(seconds: float) -> str:
    """초를 FFmpeg 타임스탬프 포맷으로 변환"""
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = seconds % 60
    return f"{h:02d}:{m:02d}:{s:06.3f}"


def subtitles_to_text(subtitles: List[Dict]) -> str:
    """자막 리스트를 AI 분석용 텍스트로 변환"""
    lines = []
    for sub in subtitles:
        lines.append(f"[{sub['start']} --> {sub['end']}] {sub['text']}")
    return "\n".join(lines)


def extract_subtitle_range(subtitles: List[Dict], start_sec: float, end_sec: float) -> List[Dict]:
    """특정 시간 범위의 자막만 추출"""
    return [
        sub for sub in subtitles
        if sub["start_seconds"] >= start_sec - 0.5 and sub["end_seconds"] <= end_sec + 0.5
    ]
