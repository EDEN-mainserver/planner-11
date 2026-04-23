import anthropic
import json
import os
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def analyze_subtitles(subtitle_text: str, num_clips: int = 5, custom_prompt: str = "") -> List[Dict]:
    """Claude API로 자막을 분석하여 숏폼 구간을 추천"""
    client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

    system_prompt = """당신은 숏폼 영상 전문 편집자입니다.
긴 영상의 자막을 분석하여, 숏폼(15초~90초)으로 만들기 좋은 구간을 추천해야 합니다.

추천 기준:
1. 독립적으로 의미가 통하는 완결된 이야기/주제
2. 강한 감정(웃김, 놀라움, 감동, 공감)을 유발하는 구간
3. 핵심 정보나 인사이트가 담긴 구간
4. 논쟁적이거나 호기심을 자극하는 발언
5. 시작과 끝이 자연스러운 구간

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트는 포함하지 마세요:
[
  {
    "title": "클립 제목 (숏폼 제목으로 적합한)",
    "start_time": "HH:MM:SS,mmm",
    "end_time": "HH:MM:SS,mmm",
    "reason": "선정 이유 (한 줄)",
    "hook": "추천 훅 멘트 (시청자를 끌어들일 첫 문장)",
    "virality_score": 8,
    "category": "funny|insight|emotional|controversial|informative"
  }
]"""

    user_message = f"""다음 자막에서 숏폼으로 만들기 좋은 구간을 {num_clips}개 추천해주세요.
{f'추가 요청: {custom_prompt}' if custom_prompt else ''}

자막:
{subtitle_text}"""

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    text = response.content[0].text.strip()
    # JSON 블록 추출
    if "```json" in text:
        text = text.split("```json")[1].split("```")[0].strip()
    elif "```" in text:
        text = text.split("```")[1].split("```")[0].strip()

    return json.loads(text)
