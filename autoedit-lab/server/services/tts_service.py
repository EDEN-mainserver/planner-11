"""
나레이션 TTS 서비스
OpenAI TTS API를 사용해 텍스트를 음성 파일로 변환
"""
import os
from pathlib import Path
from openai import OpenAI

# 지원 음성 목록 (OpenAI TTS)
VOICES = ["alloy", "echo", "fable", "onyx", "nova", "shimmer"]

def generate_tts(
    text: str,
    output_path: str,
    voice: str = "nova",
    speed: float = 1.0,
) -> str:
    """
    텍스트를 mp3 음성 파일로 변환

    Args:
        text: 변환할 텍스트
        output_path: 저장할 파일 경로 (.mp3)
        voice: 음성 종류 (alloy/echo/fable/onyx/nova/shimmer)
        speed: 재생 속도 (0.25~4.0, 기본 1.0)

    Returns:
        저장된 파일의 절대 경로
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.")

    client = OpenAI(api_key=api_key)

    Path(output_path).parent.mkdir(parents=True, exist_ok=True)

    response = client.audio.speech.create(
        model="tts-1",
        voice=voice,
        input=text,
        speed=speed,
    )

    response.stream_to_file(output_path)
    return str(Path(output_path).resolve())
