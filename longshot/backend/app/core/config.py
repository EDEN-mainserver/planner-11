"""앱 설정 관리"""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 앱 기본 설정
    app_name: str = "LongShot API"
    debug: bool = False

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""

    # OpenAI (Whisper + GPT + TTS)
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    whisper_model: str = "whisper-1"
    tts_model: str = "tts-1"
    tts_voice: str = "alloy"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # CORS
    frontend_url: str = "http://localhost:3000"

    # 파일 저장
    upload_dir: str = "./uploads"
    output_dir: str = "./outputs"

    # FFmpeg (시스템 PATH에 있으면 자동 감지)
    ffmpeg_path: str = "ffmpeg"
    ffprobe_path: str = "ffprobe"

    # 쇼츠 생성 설정
    shorts_min_duration: int = 30       # 최소 클립 길이 (초)
    shorts_max_duration: int = 90       # 최대 클립 길이 (초)
    shorts_aspect_ratio: str = "9:16"   # 세로형
    silence_threshold_db: float = -35.0 # 무음 판별 임계값 (dB)
    silence_min_duration: float = 0.5   # 무음 최소 길이 (초)

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def ensure_dirs(self) -> None:
        """업로드/출력 디렉토리 생성"""
        os.makedirs(self.upload_dir, exist_ok=True)
        os.makedirs(self.output_dir, exist_ok=True)


settings = Settings()
settings.ensure_dirs()
