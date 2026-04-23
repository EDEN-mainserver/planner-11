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


def merge_subtitles_for_shorts(subtitles: List[Dict], max_chars_per_line: int = 18, max_lines: int = 2) -> List[Dict]:
    """잘게 쪼개진 자막을 숏폼용 1~2줄 단위로 병합

    규칙:
    - 인접한 자막을 합쳐서 한 블록의 텍스트가 max_lines줄 이내가 되도록
    - 각 줄은 max_chars_per_line 글자 이내
    - 문장 종결 어미(요, 다, 지, 야, 어, 죠, 까 등)에서 끊어서 문맥 유지
    """
    if not subtitles:
        return []

    sentence_endings = (
        "요", "다", "죠", "까", "야", "어", "지", "네",
        "는데", "거든", "잖아", "했어", "됐어", "같아",
        "인데", "하고", "해서", "니까", "더라", "래요",
        "세요", "해요", "나요", "던데", "대요",
    )
    max_block_chars = max_chars_per_line * max_lines

    merged = []
    buf_texts = []
    buf_start = subtitles[0]["start_seconds"]
    buf_end = subtitles[0]["end_seconds"]
    buf_chars = 0

    def flush_buf():
        nonlocal buf_texts, buf_start, buf_end, buf_chars
        if not buf_texts:
            return
        combined = " ".join(buf_texts)
        # 2줄 포맷: 글자수 기준으로 줄바꿈
        lines = _wrap_text(combined, max_chars_per_line, max_lines)
        merged.append({
            "index": len(merged) + 1,
            "start": format_srt_time(buf_start),
            "end": format_srt_time(buf_end),
            "start_seconds": buf_start,
            "end_seconds": buf_end,
            "text": "\n".join(lines),
        })
        buf_texts = []
        buf_chars = 0

    for sub in subtitles:
        text = sub["text"].strip()
        if not text:
            continue

        new_chars = buf_chars + len(text)

        # 블록이 너무 길어지면 현재 버퍼를 flush
        if buf_texts and new_chars > max_block_chars:
            flush_buf()
            buf_start = sub["start_seconds"]

        buf_texts.append(text)
        buf_end = sub["end_seconds"]
        buf_chars = sum(len(t) for t in buf_texts)

        # 문장 종결 어미로 끝나면 자연스러운 끊김 → flush
        if buf_chars >= max_chars_per_line and any(text.rstrip("?!.~").endswith(e) for e in sentence_endings):
            flush_buf()
            buf_start = sub["end_seconds"]

    flush_buf()
    return merged


def _wrap_text(text: str, max_per_line: int, max_lines: int) -> List[str]:
    """텍스트를 max_per_line 글자 기준으로 최대 max_lines줄로 분할"""
    if len(text) <= max_per_line:
        return [text]

    # 가운데 근처에서 공백 기준으로 자르기
    mid = len(text) // 2
    best_split = mid
    for offset in range(min(10, mid)):
        for pos in [mid + offset, mid - offset]:
            if 0 < pos < len(text) and text[pos] == " ":
                best_split = pos
                break
        else:
            continue
        break

    line1 = text[:best_split].strip()
    line2 = text[best_split:].strip()

    # max_lines 제한
    lines = [line1, line2][:max_lines]

    # 각 줄이 여전히 너무 길면 잘라내기
    return [l[:max_per_line * 2] for l in lines]


def format_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"
