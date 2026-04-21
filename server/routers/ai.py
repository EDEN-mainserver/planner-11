# AI 라우터 - Claude API 연동
# 엔드포인트: POST /ai/cardnews/template, POST /ai/cardnews/slides, POST /ai/funnel/blog

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from services.claude.client import generate_json
from services.claude.prompts import (
    TEMPLATE_SYSTEM, build_template_prompt,
    SLIDES_SYSTEM,   build_slides_prompt,
)

router = APIRouter(prefix="/ai", tags=["ai"])


# ── 요청 모델 ─────────────────────────────────────────────────────

class TemplateRequest(BaseModel):
    brand_name:      str = ""
    tone:            str = ""
    layout_style:    str = ""
    color_scheme:    str = ""
    target:          str = ""
    purpose:         str = ""
    ref_image_count: int = Field(default=0, ge=0, le=6)


class SlidesRequest(BaseModel):
    brand_name:  str = ""
    color1:      str = "#7c3aed"
    tone:        str = ""
    target:      str = ""
    purpose:     str = ""
    topic:       str
    slide_count: int = Field(default=5, ge=3, le=10)


class FunnelBlogRequest(BaseModel):
    prompt: str  # 프론트에서 조립된 완전한 프롬프트


# ── 응답 모델 ─────────────────────────────────────────────────────

class TemplateResponse(BaseModel):
    color1: str
    color2: str
    font:   str
    slides: list[dict]


class SlidesResponse(BaseModel):
    slides: list[dict]


class FunnelBlogSection(BaseModel):
    heading: str | None
    content: str

class FunnelBlogResponse(BaseModel):
    title:    str
    sections: list[FunnelBlogSection]
    cta:      str
    keywords: list[str]


# ── 엔드포인트 ────────────────────────────────────────────────────

@router.post("/cardnews/template", response_model=TemplateResponse)
async def generate_cardnews_template(req: TemplateRequest):
    """
    카드뉴스 템플릿 생성
    - 브랜드 스타일 설정을 받아 색상·폰트·예시 슬라이드 반환
    """
    prompt = build_template_prompt(
        brand_name=req.brand_name,
        tone=req.tone,
        layout_style=req.layout_style,
        color_scheme=req.color_scheme,
        target=req.target,
        purpose=req.purpose,
        ref_image_count=req.ref_image_count,
    )

    try:
        result = await generate_json(prompt, system=TEMPLATE_SYSTEM, max_tokens=1024)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=500, detail=str(e))

    # 필수 필드 검증
    if not isinstance(result, dict) or "slides" not in result:
        raise HTTPException(status_code=500, detail="템플릿 응답 형식 오류")

    return TemplateResponse(
        color1=result.get("color1", "#7c3aed"),
        color2=result.get("color2", "#4f46e5"),
        font=result.get("font", "sans"),
        slides=result.get("slides", []),
    )


@router.post("/cardnews/slides", response_model=SlidesResponse)
async def generate_cardnews_slides(req: SlidesRequest):
    """
    카드뉴스 슬라이드 내용 생성
    - 주제와 브랜드 정보를 받아 슬라이드 배열 반환
    """
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="주제(topic)를 입력해주세요.")

    prompt = build_slides_prompt(
        brand_name=req.brand_name,
        color1=req.color1,
        tone=req.tone,
        target=req.target,
        purpose=req.purpose,
        topic=req.topic,
        slide_count=req.slide_count,
    )

    try:
        result = await generate_json(prompt, system=SLIDES_SYSTEM, max_tokens=2048)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not isinstance(result, list):
        raise HTTPException(status_code=500, detail="슬라이드 응답 형식 오류")

    # slide_count 맞게 자르기
    slides = result[:req.slide_count]
    return SlidesResponse(slides=slides)


@router.post("/funnel/blog", response_model=FunnelBlogResponse)
async def generate_funnel_blog(req: FunnelBlogRequest):
    """
    퍼널 블로그 글 생성
    - 프론트에서 조립한 프롬프트를 받아 { title, sections, cta, keywords } 반환
    """
    if not req.prompt.strip():
        raise HTTPException(status_code=400, detail="프롬프트가 비어있습니다.")

    try:
        result = await generate_json(req.prompt, max_tokens=4096)
    except (ValueError, RuntimeError) as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not isinstance(result, dict) or "title" not in result:
        raise HTTPException(status_code=500, detail="블로그 응답 형식 오류")

    return FunnelBlogResponse(
        title=result.get("title", ""),
        sections=result.get("sections", []),
        cta=result.get("cta", ""),
        keywords=result.get("keywords", []),
    )
