"""YouTube 영상 다운로드 서비스 (yt-dlp 기반)"""
import os
import uuid
import subprocess
import json
from pathlib import Path

from app.core.config import settings


class VideoDownloader:
    """YouTube 영상 다운로드 및 메타데이터 추출"""

    def __init__(self):
        self.upload_dir = Path(settings.upload_dir)

    async def download(self, youtube_url: str, project_id: str) -> dict:
        """
        YouTube 영상 다운로드 후 메타데이터 반환.

        Returns:
            {
                "file_path": str,        # 다운로드된 파일 경로
                "title": str,            # 영상 제목
                "duration": int,         # 영상 길이 (초)
                "thumbnail_url": str,    # 썸네일 URL
                "channel": str,          # 채널명
            }
        """
        # 프로젝트별 디렉토리 생성
        project_dir = self.upload_dir / project_id
        project_dir.mkdir(parents=True, exist_ok=True)

        # 메타데이터 먼저 추출
        meta = await self._extract_metadata(youtube_url)

        # 영상 다운로드 (최대 1080p, mp4)
        output_path = project_dir / f"source_{uuid.uuid4().hex[:8]}.mp4"
        cmd = [
            "yt-dlp",
            "-f", "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best",
            "--merge-output-format", "mp4",
            "-o", str(output_path),
            "--no-playlist",
            "--no-warnings",
            youtube_url,
        ]

        process = subprocess.run(
            cmd, capture_output=True, text=True, timeout=600
        )

        if process.returncode != 0:
            raise RuntimeError(f"yt-dlp 다운로드 실패: {process.stderr[:500]}")

        # 실제 파일 경로 확인 (yt-dlp가 확장자를 바꿀 수 있음)
        actual_path = self._find_downloaded_file(project_dir, output_path)

        return {
            "file_path": str(actual_path),
            "title": meta.get("title", ""),
            "duration": meta.get("duration", 0),
            "thumbnail_url": meta.get("thumbnail", ""),
            "channel": meta.get("channel", ""),
        }

    async def _extract_metadata(self, youtube_url: str) -> dict:
        """yt-dlp로 영상 메타데이터만 추출"""
        cmd = [
            "yt-dlp",
            "--dump-json",
            "--no-download",
            "--no-playlist",
            "--no-warnings",
            youtube_url,
        ]

        process = subprocess.run(
            cmd, capture_output=True, text=True, timeout=30
        )

        if process.returncode != 0:
            raise RuntimeError(f"메타데이터 추출 실패: {process.stderr[:300]}")

        return json.loads(process.stdout)

    def _find_downloaded_file(self, project_dir: Path, expected_path: Path) -> Path:
        """다운로드된 실제 파일 경로 찾기"""
        if expected_path.exists():
            return expected_path

        # yt-dlp가 다른 확장자로 저장한 경우 탐색
        stem = expected_path.stem
        for ext in [".mp4", ".mkv", ".webm"]:
            candidate = expected_path.with_suffix(ext)
            if candidate.exists():
                return candidate

        # 가장 최근 파일 반환
        files = sorted(project_dir.glob("source_*"), key=lambda f: f.stat().st_mtime, reverse=True)
        if files:
            return files[0]

        raise FileNotFoundError(f"다운로드된 파일을 찾을 수 없습니다: {project_dir}")

    async def get_video_info(self, file_path: str) -> dict:
        """ffprobe로 로컬 영상 정보 추출"""
        cmd = [
            settings.ffprobe_path,
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            file_path,
        ]

        process = subprocess.run(
            cmd, capture_output=True, text=True, timeout=30
        )

        if process.returncode != 0:
            raise RuntimeError(f"ffprobe 실패: {process.stderr[:300]}")

        data = json.loads(process.stdout)
        duration = float(data.get("format", {}).get("duration", 0))
        video_stream = next(
            (s for s in data.get("streams", []) if s["codec_type"] == "video"), {}
        )

        return {
            "duration": int(duration),
            "width": int(video_stream.get("width", 0)),
            "height": int(video_stream.get("height", 0)),
            "fps": eval(video_stream.get("r_frame_rate", "30/1")),
        }


downloader = VideoDownloader()
