# 카드뉴스 관련 프롬프트 모음
# 프롬프트 수정이 필요할 때 이 파일만 건드리면 됩니다

# ── 옵션 레이블 매핑 ─────────────────────────────────────────────

TONE_LABELS = {
    "professional": "전문적·신뢰감",
    "friendly":     "친근한·편안한",
    "emotional":    "감성적·공감",
    "humorous":     "유머러스·재밌는",
    "luxury":       "고급스러운",
    "bold":         "강렬한·임팩트",
}

LAYOUT_LABELS = {
    "minimal":  "미니멀 (여백 중심)",
    "graphic":  "화려한 (그래픽 풍부)",
    "typo":     "타이포그래피 (텍스트 중심)",
    "info":     "인포그래픽 (정보 시각화)",
    "balanced": "균형잡힌 (이미지+텍스트)",
}

COLOR_LABELS = {
    "pastel": "파스텔 (부드러운)",
    "vivid":  "비비드 (선명한)",
    "mono":   "모노톤 (흑백)",
    "dark":   "다크 (고급스러운)",
    "brand":  "브랜드 컬러 그대로",
}

TARGET_LABELS = {
    "teen":   "10-20대",
    "worker": "직장인",
    "parent": "30-40대",
    "mz":     "MZ세대",
    "all":    "전 연령",
}

PURPOSE_LABELS = {
    "promo":    "제품 홍보",
    "event":    "이벤트 안내",
    "info":     "정보 제공",
    "branding": "브랜딩",
    "review":   "고객 후기",
}


def _label(mapping: dict, value: str) -> str:
    return mapping.get(value, value)


# ── 템플릿 생성 프롬프트 ─────────────────────────────────────────

TEMPLATE_SYSTEM = "당신은 인스타그램 카드뉴스 전문 디자이너입니다. 요청된 스타일에 맞는 카드뉴스 디자인 템플릿을 JSON으로만 반환합니다. 설명 없이 JSON만 출력하세요."

def build_template_prompt(
    brand_name: str,
    tone: str,
    layout_style: str,
    color_scheme: str,
    target: str,
    purpose: str,
    ref_image_count: int = 0,
) -> str:
    ref_note = f"참고 이미지 {ref_image_count}장 첨부됨 (스타일 참고)" if ref_image_count > 0 else ""

    return f"""인스타그램 카드뉴스 디자인 템플릿을 설계해주세요.

브랜드: {brand_name or '브랜드'}
톤/분위기: {_label(TONE_LABELS, tone)}
레이아웃: {_label(LAYOUT_LABELS, layout_style)}
색감: {_label(COLOR_LABELS, color_scheme)}
타겟: {_label(TARGET_LABELS, target)}
목적: {_label(PURPOSE_LABELS, purpose)}
{ref_note}

아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이:
{{
  "color1": "#주색상hex",
  "color2": "#보조색상hex",
  "font": "sans",
  "slides": [
    {{"type":"cover","headline":"커버 제목 예시","emoji":"🌟","layout":"center","bgStyle":"gradient"}},
    {{"type":"content","headline":"내용 제목","body":"본문 예시 텍스트입니다.","emoji":"💡","layout":"center","bgStyle":"gradient"}},
    {{"type":"content","headline":"두 번째 내용","body":"추가 내용 예시입니다.","emoji":"✨","layout":"center","bgStyle":"light"}},
    {{"type":"closing","headline":"마무리 문구","emoji":"👏","layout":"center","bgStyle":"solid"}}
  ]
}}

font는 sans/serif/mono 중 하나. 브랜드 톤에 맞는 색상과 예시 텍스트를 작성하세요."""


# ── 슬라이드 생성 프롬프트 ───────────────────────────────────────

SLIDES_SYSTEM = "당신은 인스타그램 카드뉴스 전문 기획자입니다. 주어진 정보로 카드뉴스 슬라이드 구성을 JSON 배열로만 반환합니다. 설명 없이 JSON만 출력하세요."

def build_slides_prompt(
    brand_name: str,
    color1: str,
    tone: str,
    target: str,
    purpose: str,
    topic: str,
    slide_count: int,
) -> str:
    return f"""아래 정보로 인스타그램 카드뉴스 슬라이드 {slide_count}장 구성을 만들어주세요.

브랜드명: {brand_name or '브랜드'}
브랜드 컬러: {color1}
톤/분위기: {_label(TONE_LABELS, tone)}
타겟: {_label(TARGET_LABELS, target)}
목적: {_label(PURPOSE_LABELS, purpose)}
주제: {topic}

규칙:
- 첫 장은 반드시 cover 타입
- 마지막 장은 반드시 closing 타입
- 나머지는 content 타입
- headline: 15자 이내, 짧고 강렬하게
- body: content 슬라이드에만 포함, 40자 이내
- emoji: 슬라이드 주제에 맞는 이모지 1개

JSON 배열만 반환하세요. 다른 텍스트 없이:
[
  {{"type":"cover","headline":"제목","emoji":"🎯","layout":"center","bgStyle":"gradient"}},
  {{"type":"content","headline":"소제목","body":"본문 내용","emoji":"💡","layout":"center","bgStyle":"gradient"}},
  ...
  {{"type":"closing","headline":"마무리","emoji":"👏","layout":"center","bgStyle":"solid"}}
]"""
