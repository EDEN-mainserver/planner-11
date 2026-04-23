import subprocess
import os
import json
from typing import List, Dict, Optional
from srt_parser import format_time_ffmpeg, extract_subtitle_range


SUBTITLE_TEMPLATES = {
    "basic": {
        "name": "기본",
        "fontsize": 24,
        "fontcolor": "white",
        "borderw": 2,
        "bordcolor": "black",
        "font": "Arial",
        "position": "center",
        "bg": False,
    },
    "bold_yellow": {
        "name": "굵은 노랑",
        "fontsize": 28,
        "fontcolor": "yellow",
        "borderw": 3,
        "bordcolor": "black",
        "font": "Arial",
        "position": "center",
        "bg": False,
    },
    "boxed_white": {
        "name": "박스 흰색",
        "fontsize": 22,
        "fontcolor": "white",
        "borderw": 0,
        "bordcolor": "black",
        "font": "Arial",
        "position": "bottom",
        "bg": True,
        "bg_color": "black@0.6",
    },
    "big_impact": {
        "name": "임팩트",
        "fontsize": 36,
        "fontcolor": "white",
        "borderw": 4,
        "bordcolor": "black",
        "font": "Impact",
        "position": "center",
        "bg": False,
    },
    "pastel_pink": {
        "name": "파스텔 핑크",
        "fontsize": 26,
        "fontcolor": "#FFB6C1",
        "borderw": 2,
        "bordcolor": "#333333",
        "font": "Arial",
        "position": "center",
        "bg": False,
    },
    "neon_green": {
        "name": "네온 그린",
        "fontsize": 26,
        "fontcolor": "#00FF41",
        "borderw": 3,
        "bordcolor": "black",
        "font": "Arial",
        "position": "center",
        "bg": False,
    },
    "minimal": {
        "name": "미니멀",
        "fontsize": 20,
        "fontcolor": "white",
        "borderw": 1,
        "bordcolor": "#555555",
        "font": "Arial",
        "position": "bottom",
        "bg": False,
    },
    "news_style": {
        "name": "뉴스 스타일",
        "fontsize": 22,
        "fontcolor": "white",
        "borderw": 0,
        "bordcolor": "black",
        "font": "Arial",
        "position": "bottom",
        "bg": True,
        "bg_color": "#CC0000@0.8",
    },
}


def get_video_info(video_path: str) -> Dict:
    """영상 메타데이터 조회"""
    cmd = [
        "ffprobe", "-v", "quiet",
        "-print_format", "json",
        "-show_format", "-show_streams",
        video_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    return json.loads(result.stdout)


def build_subtitle_filter(template: Dict, srt_path: str, start_seconds: float) -> str:
    """자막 필터 문자열 생성"""
    escaped_srt = srt_path.replace(":", "\\:").replace("'", "\\'")

    y_pos = "h-th-40" if template.get("position") == "bottom" else "(h-th)/2"

    filter_parts = [
        f"subtitles='{escaped_srt}'"
        f":force_style='Fontsize={template['fontsize']}"
        f",PrimaryColour=&H00FFFFFF"
        f",OutlineColour=&H00000000"
        f",BorderStyle=1"
        f",Outline={template['borderw']}"
        f",Alignment=2"
        f"'"
    ]
    return filter_parts[0]


def cut_video(
    video_path: str,
    start_seconds: float,
    end_seconds: float,
    output_path: str,
    crop_vertical: bool = False,
    srt_path: Optional[str] = None,
    subtitle_template: str = "basic",
    subtitles_data: Optional[List[Dict]] = None,
) -> str:
    """영상 구간을 잘라서 MP4로 출력"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    start_ts = format_time_ffmpeg(start_seconds)
    duration = end_seconds - start_seconds
    duration_ts = format_time_ffmpeg(duration)

    filters = []

    # 세로 크롭 (9:16) - 숏폼 세이프존 적용
    # 상단 ~13%, 하단 ~27% 가 플랫폼 UI로 가려지므로
    # 원본에서 세이프존(60%) 기준으로 크롭하여 핵심 콘텐츠가 중앙에 오도록 처리
    if crop_vertical:
        # 1) 9:16 비율로 크롭 (가로 기준)
        # 2) 세이프존: 상단 13%, 하단 27% 여백을 고려해 콘텐츠를 약간 위로 배치
        # crop=w:h:x:y → 너비=높이*9/16, 높이=원본높이, x=가운데, y=0
        # 그 후 scale로 최종 1080x1920 출력
        filters.append("crop=ih*9/16:ih:(iw-ih*9/16)/2:0")
        filters.append("scale=1080:1920")

    # 자막 번인 - FFmpeg에 subtitles 필터(libass)가 있는지 확인
    subtitle_filter = None
    if srt_path and subtitles_data:
        check = subprocess.run(["ffmpeg", "-filters"], capture_output=True, text=True)
        has_subtitles_filter = "subtitles" in check.stdout
        if has_subtitles_filter:
            import tempfile
            temp_srt_file = tempfile.NamedTemporaryFile(suffix=".srt", delete=False, prefix="sub_")
            temp_srt = temp_srt_file.name
            temp_srt_file.close()
            write_temp_srt(subtitles_data, start_seconds, temp_srt)
            template = SUBTITLE_TEMPLATES.get(subtitle_template, SUBTITLE_TEMPLATES["basic"])
            subtitle_filter = {"srt_path": temp_srt, "template": template}
        else:
            print("[VideoProcessor] FFmpeg에 subtitles 필터(libass)가 없어 자막 번인을 건너뜁니다.")

    cmd = [
        "ffmpeg", "-y",
        "-ss", start_ts,
        "-i", video_path,
        "-t", str(duration),
    ]

    # 자막과 크롭을 별도 필터로 구성
    if filters or subtitle_filter:
        if subtitle_filter:
            t = subtitle_filter["template"]
            escaped_path = subtitle_filter["srt_path"].replace(":", "\\:")
            # force_style 내 콤마를 \, 로 이스케이프하여 필터 구분자 충돌 방지
            force_style = (
                f"Fontsize={t['fontsize']}\\,"
                f"PrimaryColour={hex_to_ass_color(t['fontcolor'])}\\,"
                f"OutlineColour={hex_to_ass_color(t['bordcolor'])}\\,"
                f"BorderStyle={'3' if t.get('bg') else '1'}\\,"
                f"Outline={t['borderw']}\\,"
                f"Alignment=2"
            )
            sub_part = f"subtitles={escaped_path}:force_style={force_style}"
            all_filters = filters + [sub_part]
            cmd += ["-vf", ",".join(all_filters)]
        else:
            cmd += ["-vf", ",".join(filters)]

    cmd += [
        "-c:v", "libx264",
        "-c:a", "aac",
        "-preset", "fast",
        "-crf", "23",
        output_path
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg 오류: {result.stderr}")

    return output_path


def write_temp_srt(subtitles: List[Dict], offset_seconds: float, output_path: str):
    """자막 데이터를 숏폼용 1~2줄로 병합 후, 시간 오프셋 적용하여 임시 SRT로 저장"""
    from srt_parser import merge_subtitles_for_shorts

    # 먼저 잘게 쪼개진 자막을 문맥 단위 1~2줄로 병합
    merged = merge_subtitles_for_shorts(subtitles)

    with open(output_path, "w", encoding="utf-8") as f:
        for i, sub in enumerate(merged, 1):
            start = sub["start_seconds"] - offset_seconds
            end = sub["end_seconds"] - offset_seconds
            if start < 0:
                start = 0
            f.write(f"{i}\n")
            f.write(f"{seconds_to_srt_time(start)} --> {seconds_to_srt_time(end)}\n")
            f.write(f"{sub['text']}\n\n")


def seconds_to_srt_time(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    s = int(seconds % 60)
    ms = int((seconds % 1) * 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def hex_to_ass_color(color: str) -> str:
    """HEX/이름 색상을 ASS 색상 코드로 변환"""
    color_map = {
        "white": "&H00FFFFFF",
        "black": "&H00000000",
        "yellow": "&H0000FFFF",
        "red": "&H000000FF",
    }
    if color in color_map:
        return color_map[color]
    if color.startswith("#"):
        hex_color = color.lstrip("#")
        r, g, b = hex_color[0:2], hex_color[2:4], hex_color[4:6]
        return f"&H00{b}{g}{r}"
    return "&H00FFFFFF"


def batch_cut_videos(
    video_path: str,
    clips: List[Dict],
    output_dir: str,
    crop_vertical: bool = False,
    srt_path: Optional[str] = None,
    subtitle_template: str = "basic",
    all_subtitles: Optional[List[Dict]] = None,
    progress_callback=None,
) -> List[str]:
    """여러 구간을 한번에 잘라서 출력"""
    results = []
    total = len(clips)
    for i, clip in enumerate(clips, 1):
        start = parse_time_to_seconds(clip["start_time"])
        end = parse_time_to_seconds(clip["end_time"])

        safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in clip["title"])
        filename = f"{i:02d}_{safe_title[:30]}.mp4"
        output_path = os.path.join(output_dir, filename)

        sub_data = None
        if all_subtitles:
            sub_data = extract_subtitle_range(all_subtitles, start, end)

        cut_video(
            video_path=video_path,
            start_seconds=start,
            end_seconds=end,
            output_path=output_path,
            crop_vertical=crop_vertical,
            srt_path=srt_path,
            subtitle_template=subtitle_template,
            subtitles_data=sub_data,
        )
        results.append(output_path)
        if progress_callback:
            progress_callback(i, total)

    return results


def parse_time_to_seconds(time_str: str) -> float:
    """HH:MM:SS,mmm 또는 HH:MM:SS.mmm를 초로 변환"""
    time_str = time_str.replace(",", ".")
    parts = time_str.split(":")
    h, m = int(parts[0]), int(parts[1])
    s = float(parts[2])
    return h * 3600 + m * 60 + s
