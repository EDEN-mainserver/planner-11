"""캡컷 드래프트 파일 생성 모듈

pyCapCut을 이용하여 AI가 추천한 클립 구간을 캡컷 프로젝트로 자동 생성합니다.
사용자는 생성된 드래프트를 캡컷에서 열어 최종 편집/내보내기만 하면 됩니다.
"""

import os
import shutil
import pycapcut as cc
from pycapcut import trange, tim
from typing import List, Dict, Optional


# 캡컷 드래프트 기본 저장 경로 (macOS)
DEFAULT_DRAFT_BASE = os.path.expanduser("~/Movies/CapCut/User Data/Projects/com.lveditor.draft")


def parse_time_to_seconds(time_str: str) -> float:
    """HH:MM:SS,mmm 또는 HH:MM:SS.mmm를 초로 변환"""
    time_str = time_str.replace(",", ".")
    parts = time_str.split(":")
    h, m = int(parts[0]), int(parts[1])
    s = float(parts[2])
    return h * 3600 + m * 60 + s


def generate_capcut_draft(
    video_path: str,
    clips: List[Dict],
    output_dir: str,
    draft_name: str = "롱숏_자동생성",
    vertical: bool = False,
    subtitles: Optional[List[Dict]] = None,
    progress_callback=None,
) -> str:
    """AI 추천 클립들을 캡컷 드래프트로 생성

    Args:
        video_path: 원본 영상 파일 경로
        clips: AI가 추천한 클립 리스트 [{title, start_time, end_time, ...}]
        output_dir: 드래프트 저장 디렉토리
        draft_name: 캡컷 드래프트 이름
        vertical: 세로(9:16) 모드 여부
        subtitles: 자막 데이터 (있으면 텍스트 트랙으로 추가)
        progress_callback: 진행률 콜백 (done, total)

    Returns:
        생성된 드래프트 폴더 경로
    """
    os.makedirs(output_dir, exist_ok=True)

    # 드래프트 폴더 설정
    draft_folder = cc.DraftFolder(output_dir)

    # 해상도 설정
    if vertical:
        width, height = 1080, 1920
    else:
        width, height = 1920, 1080

    script = draft_folder.create_draft(draft_name, width, height, allow_replace=True)

    # 트랙 추가: 영상 + 텍스트(자막용)
    script.add_track(cc.TrackType.video)
    script.add_track(cc.TrackType.text)

    total = len(clips)
    current_pos = 0.0  # 타임라인에서의 현재 위치 (초)

    for i, clip in enumerate(clips):
        start_sec = parse_time_to_seconds(clip["start_time"])
        end_sec = parse_time_to_seconds(clip["end_time"])
        clip_duration = end_sec - start_sec

        if clip_duration <= 0:
            continue

        # 영상 세그먼트 추가
        # target_timerange: 타임라인 상 위치
        # source_timerange: 원본 영상에서 가져올 구간
        target_range = trange(f"{current_pos}s", f"{clip_duration}s")
        source_range = trange(f"{start_sec}s", f"{clip_duration}s")

        video_seg = cc.VideoSegment(
            video_path,
            target_timerange=target_range,
            source_timerange=source_range,
        )

        script.add_segment(video_seg, track_index=0)

        # 자막이 있으면 해당 구간 자막을 텍스트 트랙에 추가
        if subtitles:
            clip_subs = [
                s for s in subtitles
                if s["start_seconds"] >= start_sec - 0.5
                and s["end_seconds"] <= end_sec + 0.5
            ]
            for sub in clip_subs:
                sub_start = sub["start_seconds"] - start_sec + current_pos
                sub_dur = sub["end_seconds"] - sub["start_seconds"]
                if sub_start < 0:
                    sub_start = 0

                text_seg = cc.TextSegment(
                    sub["text"],
                    trange(f"{sub_start}s", f"{sub_dur}s"),
                    style=cc.TextStyle(
                        size=8.0,
                        color=(1.0, 1.0, 1.0),
                    ),
                    border=cc.TextBorder(
                        color=(0.0, 0.0, 0.0),
                        width=2.0,
                    ),
                )
                script.add_segment(text_seg, track_index=1)

        current_pos += clip_duration

        if progress_callback:
            progress_callback(i + 1, total)

    script.save()

    # 생성된 드래프트 경로
    draft_path = os.path.join(output_dir, draft_name)
    return draft_path


def generate_individual_drafts(
    video_path: str,
    clips: List[Dict],
    output_dir: str,
    vertical: bool = False,
    subtitles: Optional[List[Dict]] = None,
    progress_callback=None,
) -> List[str]:
    """각 클립별로 개별 캡컷 드래프트 생성

    Returns:
        생성된 드래프트 폴더 경로 리스트
    """
    results = []
    total = len(clips)

    for i, clip in enumerate(clips):
        safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in clip["title"])
        draft_name = f"{i + 1:02d}_{safe_title[:30]}"

        draft_path = generate_capcut_draft(
            video_path=video_path,
            clips=[clip],
            output_dir=output_dir,
            draft_name=draft_name,
            vertical=vertical,
            subtitles=subtitles,
        )
        results.append(draft_path)

        if progress_callback:
            progress_callback(i + 1, total)

    return results


def copy_drafts_to_capcut(draft_paths: List[str], capcut_draft_dir: str = "") -> List[str]:
    """생성된 드래프트를 캡컷 기본 폴더로 복사

    Returns:
        복사된 경로 리스트
    """
    if not capcut_draft_dir:
        capcut_draft_dir = DEFAULT_DRAFT_BASE

    if not os.path.exists(capcut_draft_dir):
        os.makedirs(capcut_draft_dir, exist_ok=True)

    copied = []
    for path in draft_paths:
        if os.path.exists(path):
            dest = os.path.join(capcut_draft_dir, os.path.basename(path))
            if os.path.exists(dest):
                shutil.rmtree(dest)
            shutil.copytree(path, dest)
            copied.append(dest)

    return copied
