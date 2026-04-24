"""Whisper 기반 음성 인식 + 자막 생성 서비스"""
import json
from pathlib import Path

from app.core.config import settings


class Transcriber:
    """OpenAI Whisper API로 음성 → 자막 변환"""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=settings.openai_api_key)
        return self._client

    async def transcribe(self, audio_path: str, language: str = "ko") -> dict:
        """
        음성 파일을 자막으로 변환.

        Returns:
            {
                "text": str,            # 전체 텍스트
                "segments": [           # 단어/구간별 타임스탬프
                    {
                        "start": float, # 시작 시간 (초)
                        "end": float,   # 종료 시간 (초)
                        "text": str,    # 텍스트
                    }
                ],
                "words": [              # 단어 단위 타임스탬프
                    {
                        "start": float,
                        "end": float,
                        "word": str,
                    }
                ]
            }
        """
        with open(audio_path, "rb") as audio_file:
            response = self.client.audio.transcriptions.create(
                model=settings.whisper_model,
                file=audio_file,
                language=language,
                response_format="verbose_json",
                timestamp_granularities=["word", "segment"],
            )

        segments = []
        for seg in getattr(response, "segments", []):
            segments.append({
                "start": seg.get("start", seg.start) if hasattr(seg, "start") else seg["start"],
                "end": seg.get("end", seg.end) if hasattr(seg, "end") else seg["end"],
                "text": seg.get("text", seg.text) if hasattr(seg, "text") else seg["text"],
            })

        words = []
        for w in getattr(response, "words", []):
            words.append({
                "start": w.get("start", w.start) if hasattr(w, "start") else w["start"],
                "end": w.get("end", w.end) if hasattr(w, "end") else w["end"],
                "word": w.get("word", w.word) if hasattr(w, "word") else w["word"],
            })

        return {
            "text": response.text,
            "segments": segments,
            "words": words,
        }

    async def transcribe_segment(
        self, audio_path: str, start_sec: float, end_sec: float, language: str = "ko"
    ) -> dict:
        """특정 구간만 자막 생성 (클립용)"""
        # 전체 자막에서 해당 구간 필터링하는 방식
        full = await self.transcribe(audio_path, language)

        filtered_segments = [
            s for s in full["segments"]
            if s["end"] > start_sec and s["start"] < end_sec
        ]
        filtered_words = [
            w for w in full["words"]
            if w["end"] > start_sec and w["start"] < end_sec
        ]

        # 시간 오프셋 조정 (클립 기준 0초부터)
        for s in filtered_segments:
            s["start"] = max(0, s["start"] - start_sec)
            s["end"] = s["end"] - start_sec
        for w in filtered_words:
            w["start"] = max(0, w["start"] - start_sec)
            w["end"] = w["end"] - start_sec

        return {
            "text": " ".join(s["text"] for s in filtered_segments),
            "segments": filtered_segments,
            "words": filtered_words,
        }


transcriber = Transcriber()
