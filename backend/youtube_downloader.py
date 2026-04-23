import os
import re
import yt_dlp


def is_youtube_url(url: str) -> bool:
    """YouTube URL인지 확인"""
    patterns = [
        r"(https?://)?(www\.)?youtube\.com/watch\?v=",
        r"(https?://)?(www\.)?youtu\.be/",
        r"(https?://)?(www\.)?youtube\.com/shorts/",
    ]
    return any(re.match(p, url) for p in patterns)


def download_youtube(url: str, output_dir: str) -> dict:
    """YouTube 영상 + 자막 다운로드. 반환: {video_path, srt_path(있으면)}"""
    os.makedirs(output_dir, exist_ok=True)

    # 먼저 자막 다운로드 시도
    srt_path = None
    sub_opts = {
        "skip_download": True,
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitleslangs": ["ko", "en"],
        "subtitlesformat": "srt",
        "outtmpl": os.path.join(output_dir, "%(title)s.%(ext)s"),
        "quiet": True,
    }

    try:
        with yt_dlp.YoutubeDL(sub_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            title = info.get("title", "video")
            # 자막 파일 찾기
            for lang in ["ko", "en"]:
                possible = os.path.join(output_dir, f"{title}.{lang}.srt")
                if os.path.exists(possible):
                    srt_path = possible
                    break
    except Exception:
        pass

    # 영상 다운로드
    video_opts = {
        "format": "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
        "outtmpl": os.path.join(output_dir, "%(title)s.%(ext)s"),
        "merge_output_format": "mp4",
        "quiet": True,
    }

    with yt_dlp.YoutubeDL(video_opts) as ydl:
        info = ydl.extract_info(url, download=True)
        title = info.get("title", "video")
        video_path = os.path.join(output_dir, f"{title}.mp4")

        # 실제 파일 찾기 (제목에 특수문자 있을 수 있음)
        if not os.path.exists(video_path):
            for f in os.listdir(output_dir):
                if f.endswith(".mp4"):
                    video_path = os.path.join(output_dir, f)
                    break

    return {
        "video_path": video_path,
        "srt_path": srt_path,
        "title": title,
    }
