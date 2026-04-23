import anthropic
import json
import os
from typing import List, Dict
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


def analyze_subtitles(subtitle_text: str, num_clips: int = 5, custom_prompt: str = "", clip_duration: int = 60) -> List[Dict]:
    """Claude API로 자막을 분석하여 숏폼 구간을 추천"""
    try:
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

        system_prompt = f"""당신은 숏폼 영상 전문 편집자입니다.
긴 영상의 자막을 분석하여, 숏폼({clip_duration}초 이내)으로 만들기 좋은 구간을 추천해야 합니다.

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
    except Exception as e:
        print(f"[AI Analyzer] API 호출 실패, 폴백 분석 사용: {e}")
        return _fallback_analyze(subtitle_text, num_clips, clip_duration)


def _fallback_analyze(subtitle_text: str, num_clips: int = 5, clip_duration: int = 60) -> List[Dict]:
    """API 실패 시 자막 기반 규칙 분석으로 숏폼 구간 추천"""
    import re

    lines = subtitle_text.strip().split("\n")
    segments = []
    current_segment = {"start": None, "end": None, "texts": [], "score": 0}

    # 자막을 파싱하여 타임스탬프와 텍스트 추출
    time_pattern = re.compile(r'\[(\d{2}:\d{2}:\d{2})[,.\d]* --> (\d{2}:\d{2}:\d{2})[,.\d]*\]\s*(.*)')
    parsed_lines = []
    for line in lines:
        m = time_pattern.match(line)
        if m:
            parsed_lines.append({
                "start": m.group(1),
                "end": m.group(2),
                "text": m.group(3)
            })

    if not parsed_lines:
        return []

    # 감정/바이럴 키워드 기반 점수 매기기
    viral_keywords = {
        "emotional": ["울", "눈물", "힘들", "슬프", "미안", "고마", "사랑", "그리", "아프", "죽"],
        "funny": ["ㅋㅋ", "웃", "미친", "대박", "헐", "장난", "개그", "빵"],
        "controversial": ["논란", "싸움", "디스", "욕", "시발", "씨발", "존나", "대마", "합법"],
        "insight": ["깨달", "배우", "인생", "성장", "변화", "중요", "진짜", "핵심"],
        "informative": ["방법", "이유", "비결", "노하우", "팁", "전략"]
    }

    # 슬라이딩 윈도우로 60초 단위 구간 점수 매기기
    def time_to_sec(t):
        parts = t.split(":")
        seconds_part = parts[2].split(",")[0].split(".")[0]  # "30,000" → "30"
        return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(seconds_part)

    def sec_to_time(s):
        h = s // 3600
        m = (s % 3600) // 60
        sec = s % 60
        return f"{h:02d}:{m:02d}:{sec:02d},000"

    window_size = clip_duration  # 사용자 설정 러닝타임
    step = max(10, clip_duration // 2)  # 윈도우 스텝
    candidates = []

    max_time = time_to_sec(parsed_lines[-1]["end"])

    min_texts = max(3, clip_duration // 10)  # 최소 자막 수 (짧은 클립은 기준 완화)
    for start_sec in range(0, max_time - 10, step):
        end_sec = start_sec + window_size
        window_texts = []
        actual_start = None
        actual_end = None

        for pl in parsed_lines:
            pl_start = time_to_sec(pl["start"])
            pl_end = time_to_sec(pl["end"])
            if pl_start >= start_sec and pl_start < end_sec:
                window_texts.append(pl["text"])
                if actual_start is None:
                    actual_start = pl["start"]
                actual_end = pl["end"]

        # 실제 클립 길이가 설정값을 넘지 않도록 강제
        if actual_start and actual_end:
            actual_dur = time_to_sec(actual_end) - time_to_sec(actual_start)
            if actual_dur > clip_duration:
                actual_end = sec_to_time(time_to_sec(actual_start) + clip_duration)

        if len(window_texts) < min_texts:
            continue

        combined = " ".join(window_texts)
        score = 0
        category = "informative"
        max_cat_score = 0

        for cat, keywords in viral_keywords.items():
            cat_score = sum(1 for kw in keywords if kw in combined)
            score += cat_score
            if cat_score > max_cat_score:
                max_cat_score = cat_score
                category = cat

        # 텍스트 밀도 보너스 (대화가 활발한 구간)
        score += len(window_texts) * 0.3

        if actual_start and actual_end:
            candidates.append({
                "start": actual_start,
                "end": actual_end,
                "texts": window_texts[:3],
                "score": score,
                "category": category
            })

    # 점수 기준 정렬 후 겹치지 않는 상위 N개 선택
    candidates.sort(key=lambda x: x["score"], reverse=True)

    selected = []
    used_ranges = []
    for c in candidates:
        c_start = time_to_sec(c["start"])
        c_end = time_to_sec(c["end"])
        overlap = False
        for us, ue in used_ranges:
            if c_start < ue and c_end > us:
                overlap = True
                break
        if not overlap:
            selected.append(c)
            used_ranges.append((c_start, c_end))
        if len(selected) >= num_clips:
            break

    # 결과 포맷팅
    results = []
    for i, s in enumerate(selected):
        hook_text = s["texts"][0] if s["texts"] else ""
        title_text = " ".join(s["texts"][:2])[:30]
        results.append({
            "title": title_text or f"하이라이트 {i+1}",
            "start_time": s["start"] + (",000" if "," not in s["start"] else ""),
            "end_time": s["end"] + (",000" if "," not in s["end"] else ""),
            "reason": f"감정/바이럴 키워드 밀도가 높은 구간 (점수: {s['score']:.1f})",
            "hook": hook_text,
            "virality_score": min(10, max(5, int(s["score"]))),
            "category": s["category"]
        })

    return results
