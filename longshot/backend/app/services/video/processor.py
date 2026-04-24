"""FFmpeg 기반 영상 처리 서비스 — 클립 추출, 세로 변환, 자막 임베딩, 무음 제거"""
import subprocess
import json
import uuid
from pathlib import Path

from app.core.config import settings


class VideoProcessor:
    """영상 편집 처리 엔진"""

    def __init__(self):
        self.ffmpeg = settings.ffmpeg_path
        self.ffprobe = settings.ffprobe_path

    async def extract_clip(
        self, source_path: str, start_sec: float, end_sec: float, output_path: str
    ) -> str:
        """원본 영상에서 특정 구간 클립 추출"""
        cmd = [
            self.ffmpeg, "-y",
            "-ss", str(start_sec),
            "-i", source_path,
            "-t", str(end_sec - start_sec),
            "-c:v", "libx264",
            "-c:a", "aac",
            "-preset", "fast",
            "-crf", "23",
            output_path,
        ]
        self._run(cmd)
        return output_path

    async def convert_to_vertical(
        self, input_path: str, output_path: str, width: int = 1080, height: int = 1920
    ) -> str:
        """
        16:9 → 9:16 세로 변환.
        중앙 크롭 방식 (얼굴 감지 없이 단순 중앙 기준).
        """
        cmd = [
            self.ffmpeg, "-y",
            "-i", input_path,
            "-vf", f"scale=-2:{height},crop={width}:{height}",
            "-c:v", "libx264",
            "-c:a", "aac",
            "-preset", "fast",
            "-crf", "23",
            output_path,
        ]
        self._run(cmd)
        return output_path

    async def add_subtitles(
        self, input_path: str, ass_path: str, output_path: str
    ) -> str:
        """ASS 자막 파일을 영상에 임베딩 (하드 서브)"""
        # ASS 경로의 특수문자 이스케이프
        escaped_ass = ass_path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")
        cmd = [
            self.ffmpeg, "-y",
            "-i", input_path,
            "-vf", f"ass='{escaped_ass}'",
            "-c:v", "libx264",
            "-c:a", "copy",
            "-preset", "fast",
            "-crf", "23",
            output_path,
        ]
        self._run(cmd)
        return output_path

    async def remove_silence(
        self, input_path: str, output_path: str,
        threshold_db: float | None = None, min_duration: float | None = None
    ) -> str:
        """무음 구간 감지 후 제거"""
        threshold = threshold_db or settings.silence_threshold_db
        min_dur = min_duration or settings.silence_min_duration

        # 1단계: 무음 구간 감지
        silence_ranges = await self._detect_silence(input_path, threshold, min_dur)

        if not silence_ranges:
            # 무음 없으면 그냥 복사
            cmd = [self.ffmpeg, "-y", "-i", input_path, "-c", "copy", output_path]
            self._run(cmd)
            return output_path

        # 2단계: 유음 구간만 추출하여 합치기
        duration = await self._get_duration(input_path)
        keep_ranges = self._invert_ranges(silence_ranges, duration)

        # 각 유음 구간을 임시 파일로 추출
        temp_dir = Path(output_path).parent / f"temp_{uuid.uuid4().hex[:6]}"
        temp_dir.mkdir(exist_ok=True)
        concat_list = temp_dir / "concat.txt"

        segment_files = []
        for i, (start, end) in enumerate(keep_ranges):
            seg_path = str(temp_dir / f"seg_{i:03d}.mp4")
            cmd = [
                self.ffmpeg, "-y",
                "-ss", str(start),
                "-i", input_path,
                "-t", str(end - start),
                "-c:v", "libx264", "-c:a", "aac",
                "-preset", "ultrafast", "-crf", "23",
                seg_path,
            ]
            self._run(cmd)
            segment_files.append(seg_path)

        # concat 파일 생성
        with open(concat_list, "w") as f:
            for seg in segment_files:
                f.write(f"file '{seg}'\n")

        # 합치기
        cmd = [
            self.ffmpeg, "-y",
            "-f", "concat", "-safe", "0",
            "-i", str(concat_list),
            "-c:v", "libx264", "-c:a", "aac",
            "-preset", "fast", "-crf", "23",
            output_path,
        ]
        self._run(cmd)

        # 임시 파일 정리
        for seg in segment_files:
            Path(seg).unlink(missing_ok=True)
        concat_list.unlink(missing_ok=True)
        temp_dir.rmdir()

        return output_path

    async def prepend_hook_audio(
        self, video_path: str, hook_audio_path: str, hook_text: str, output_path: str
    ) -> str:
        """후킹 보이스(TTS)를 영상 앞에 삽입"""
        # 후킹 오디오 길이 확인
        hook_duration = await self._get_duration(hook_audio_path)

        # 후킹 구간: 검정 배경 + 텍스트 + TTS 음성
        hook_video = str(Path(output_path).parent / f"hook_{uuid.uuid4().hex[:6]}.mp4")

        # 텍스트 이스케이프
        safe_text = hook_text.replace("'", "").replace(":", "")

        cmd = [
            self.ffmpeg, "-y",
            "-f", "lavfi",
            "-i", f"color=c=black:s=1080x1920:d={hook_duration}",
            "-i", hook_audio_path,
            "-vf", (
                f"drawtext=text='{safe_text}'"
                f":fontsize=56:fontcolor=white"
                f":x=(w-text_w)/2:y=(h-text_h)/2"
                f":font=Pretendard"
            ),
            "-c:v", "libx264", "-c:a", "aac",
            "-shortest",
            "-preset", "ultrafast",
            hook_video,
        ]
        self._run(cmd)

        # 후킹 영상 + 메인 영상 합치기
        concat_file = str(Path(output_path).parent / f"concat_{uuid.uuid4().hex[:6]}.txt")
        with open(concat_file, "w") as f:
            f.write(f"file '{hook_video}'\n")
            f.write(f"file '{video_path}'\n")

        cmd = [
            self.ffmpeg, "-y",
            "-f", "concat", "-safe", "0",
            "-i", concat_file,
            "-c:v", "libx264", "-c:a", "aac",
            "-preset", "fast", "-crf", "23",
            output_path,
        ]
        self._run(cmd)

        # 정리
        Path(hook_video).unlink(missing_ok=True)
        Path(concat_file).unlink(missing_ok=True)

        return output_path

    async def generate_thumbnail(self, video_path: str, output_path: str, time_sec: float = 1.0) -> str:
        """영상에서 썸네일 추출"""
        cmd = [
            self.ffmpeg, "-y",
            "-ss", str(time_sec),
            "-i", video_path,
            "-frames:v", "1",
            "-q:v", "2",
            output_path,
        ]
        self._run(cmd)
        return output_path

    # --- 내부 헬퍼 ---

    async def _detect_silence(
        self, input_path: str, threshold_db: float, min_duration: float
    ) -> list[tuple[float, float]]:
        """ffmpeg silencedetect 필터로 무음 구간 감지"""
        cmd = [
            self.ffmpeg,
            "-i", input_path,
            "-af", f"silencedetect=noise={threshold_db}dB:d={min_duration}",
            "-f", "null", "-",
        ]
        process = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        ranges = []
        start = None
        for line in process.stderr.split("\n"):
            if "silence_start:" in line:
                start = float(line.split("silence_start:")[1].strip().split()[0])
            elif "silence_end:" in line and start is not None:
                end = float(line.split("silence_end:")[1].strip().split()[0])
                ranges.append((start, end))
                start = None

        return ranges

    async def _get_duration(self, file_path: str) -> float:
        """파일 재생 길이 (초)"""
        cmd = [
            self.ffprobe,
            "-v", "quiet",
            "-show_entries", "format=duration",
            "-of", "csv=p=0",
            file_path,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=10)
        return float(result.stdout.strip())

    @staticmethod
    def _invert_ranges(silence_ranges: list[tuple[float, float]], total: float) -> list[tuple[float, float]]:
        """무음 구간의 역 = 유음 구간"""
        keep = []
        prev_end = 0.0
        for s_start, s_end in sorted(silence_ranges):
            if s_start > prev_end:
                keep.append((prev_end, s_start))
            prev_end = s_end
        if prev_end < total:
            keep.append((prev_end, total))
        return keep

    def _run(self, cmd: list[str], timeout: int = 300) -> subprocess.CompletedProcess:
        """subprocess 실행 래퍼"""
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=timeout
        )
        if result.returncode != 0:
            raise RuntimeError(
                f"FFmpeg 명령 실패: {' '.join(cmd[:5])}...\n{result.stderr[:500]}"
            )
        return result


video_processor = VideoProcessor()
