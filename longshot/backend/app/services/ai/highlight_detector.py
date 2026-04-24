"""GPT 기반 하이라이트 구간 감지 서비스"""
import json

from app.core.config import settings


HIGHLIGHT_SYSTEM_PROMPT = """당신은 영상 콘텐츠 전문가입니다.
주어진 영상의 자막 텍스트를 분석하여 쇼츠(숏폼 영상)로 만들기 좋은 하이라이트 구간을 찾아주세요.

## 선정 기준
1. 강한 감정 표현이 있는 구간 (놀람, 분노, 기쁨, 감동)
2. 임팩트 있는 한 마디 (펀치라인, 명언, 핵심 주장)
3. 반전이나 서프라이즈가 있는 구간
4. 유용한 정보가 압축된 구간 (팁, 방법론)
5. 논쟁적이거나 호기심을 유발하는 발언

## 규칙
- 각 클립은 {min_duration}~{max_duration}초 사이
- 원본 영상 N분당 약 N/2개의 클립 추천
- 클립 간 최소 5초 이상 간격 유지
- 자막이 자연스럽게 시작/끝나는 지점에서 잘라야 함

## 출력 형식
JSON 배열로 반환. 각 항목:
{{
    "start": 시작시간(초),
    "end": 종료시간(초),
    "reason": "선정 이유 (한국어, 1줄)",
    "hook_text": "이 클립의 첫 3초에 띄울 후킹 텍스트 (한국어, 15자 이내)",
    "title": "이 클립의 추천 제목 (한국어, 30자 이내)",
    "score": 1~10 (추천 점수)
}}"""


class HighlightDetector:
    """GPT로 자막 분석 → 하이라이트 구간 추출"""

    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            from openai import OpenAI
            self._client = OpenAI(api_key=settings.openai_api_key)
        return self._client

    async def detect(self, segments: list[dict], total_duration: int) -> list[dict]:
        """
        자막 세그먼트를 분석하여 하이라이트 구간 목록 반환.

        Args:
            segments: Whisper 자막 세그먼트 목록
            total_duration: 원본 영상 전체 길이 (초)

        Returns:
            [
                {
                    "start": float,
                    "end": float,
                    "reason": str,
                    "hook_text": str,
                    "title": str,
                    "score": int,
                }
            ]
        """
        # 자막을 타임스탬프 포함 텍스트로 변환
        transcript_text = self._format_transcript(segments)

        system_prompt = HIGHLIGHT_SYSTEM_PROMPT.format(
            min_duration=settings.shorts_min_duration,
            max_duration=settings.shorts_max_duration,
        )

        user_prompt = f"""## 영상 정보
- 전체 길이: {total_duration}초 ({total_duration // 60}분 {total_duration % 60}초)
- 추천 클립 수: 약 {max(1, total_duration // 120)}개

## 자막 전문
{transcript_text}

위 자막을 분석하여 쇼츠로 만들기 좋은 하이라이트 구간을 JSON 배열로 반환해주세요."""

        response = self.client.chat.completions.create(
            model=settings.openai_model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
        )

        content = response.choices[0].message.content
        result = json.loads(content)

        # GPT가 다양한 키로 반환할 수 있으므로 정규화
        highlights = result if isinstance(result, list) else result.get("highlights", result.get("clips", []))

        # 점수 순 정렬
        highlights.sort(key=lambda h: h.get("score", 0), reverse=True)

        return highlights

    def _format_transcript(self, segments: list[dict]) -> str:
        """자막 세그먼트를 분석용 텍스트로 포맷"""
        lines = []
        for seg in segments:
            start = seg["start"]
            end = seg["end"]
            text = seg["text"].strip()
            if text:
                lines.append(f"[{self._fmt_time(start)} ~ {self._fmt_time(end)}] {text}")
        return "\n".join(lines)

    @staticmethod
    def _fmt_time(seconds: float) -> str:
        """초를 MM:SS 형식으로"""
        m, s = divmod(int(seconds), 60)
        return f"{m:02d}:{s:02d}"


highlight_detector = HighlightDetector()
