"""에덴 아웃리치 API 라우터 (Day 1 골격)

엔드포인트:
  POST /tick               — launchd가 60초 간격으로 호출 (스케줄러+워커)
  GET  /settings           — outreach_settings 전체 조회
  PATCH /settings          — { key, value } upsert
  GET  /keywords           — 키워드 리스트
  POST /keywords           — 키워드 추가
  PATCH /keywords/{id}     — 부분 수정
  DELETE /keywords/{id}    — 삭제
  POST /test/search        — 단독 테스트: 검색만
  POST /test/send          — 단독 테스트: 발송 (드라이런 강제)
  POST /pause              — 글로벌 일시정지
  POST /resume             — 재개

Day 2~3에 /test/extract, /test/read, /test/proposal, /test/safety, /jobs/* 추가 예정.
"""
from __future__ import annotations
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.outreach import search_agent, email_sender
from app.services.outreach.db import get_client, get_setting, set_setting

router = APIRouter()


# ============ 모델 ============

class KeywordCreate(BaseModel):
    keyword: str
    region: str = "kr"
    language: str = "ko"
    top_n: int = 10
    auto_send: bool = False


class KeywordPatch(BaseModel):
    keyword: str | None = None
    region: str | None = None
    language: str | None = None
    top_n: int | None = None
    auto_send: bool | None = None
    enabled: bool | None = None


class SettingPatch(BaseModel):
    key: str
    value: Any


class SearchTestBody(BaseModel):
    keyword: str
    top_n: int = 10
    region: str = "kr"
    language: str = "ko"


class SendTestBody(BaseModel):
    to: str
    subject: str = "[에덴 아웃리치] 드라이런 테스트"
    body_html: str = "<p>드라이런 테스트입니다.</p>"
    body_text: str | None = "드라이런 테스트입니다."


# ============ Tick (스케줄러/워커 트리거) ============

@router.post("/tick")
async def tick():
    """launchd가 60초마다 호출. Day 3에 scheduler/worker 연결 예정."""
    paused = get_setting("paused", False)
    if paused:
        return {"status": "paused"}
    # TODO Day 3: scheduler.enqueue_due() + worker.run_next()
    return {"status": "noop", "reason": "scheduler/worker는 Day 3에 추가됩니다"}


# ============ Settings ============

@router.get("/settings")
async def list_settings():
    res = get_client().table("outreach_settings").select("*").execute()
    return {row["key"]: row["value"] for row in (res.data or [])}


@router.patch("/settings")
async def patch_setting(body: SettingPatch):
    set_setting(body.key, body.value)
    return {"ok": True, "key": body.key, "value": body.value}


@router.post("/pause")
async def pause():
    set_setting("paused", True)
    return {"paused": True}


@router.post("/resume")
async def resume():
    set_setting("paused", False)
    return {"paused": False}


# ============ Keywords ============

@router.get("/keywords")
async def list_keywords():
    res = (
        get_client()
        .table("outreach_keywords")
        .select("*")
        .order("created_at", desc=True)
        .execute()
    )
    return {"keywords": res.data or []}


@router.post("/keywords")
async def create_keyword(body: KeywordCreate):
    res = (
        get_client()
        .table("outreach_keywords")
        .insert(body.model_dump())
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail="키워드 생성 실패")
    return res.data[0]


@router.patch("/keywords/{keyword_id}")
async def patch_keyword(keyword_id: str, body: KeywordPatch):
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    if not patch:
        raise HTTPException(status_code=400, detail="수정할 필드가 없습니다")
    res = (
        get_client()
        .table("outreach_keywords")
        .update(patch)
        .eq("id", keyword_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")
    return res.data[0]


@router.delete("/keywords/{keyword_id}")
async def delete_keyword(keyword_id: str):
    get_client().table("outreach_keywords").delete().eq("id", keyword_id).execute()
    return {"ok": True}


# ============ 단독 테스트 ============

@router.post("/test/search")
async def test_search(body: SearchTestBody):
    """1. Search Agent 단독 실행"""
    try:
        results = await search_agent.search(
            keyword=body.keyword,
            top_n=body.top_n,
            region=body.region,
            language=body.language,
        )
        return {"ok": True, "count": len(results), "results": results}
    except search_agent.CaptchaDetected as e:
        return {"ok": False, "error": "captcha", "message": str(e)}
    except Exception as e:
        return {"ok": False, "error": type(e).__name__, "message": str(e)}


@router.post("/test/send")
async def test_send(body: SendTestBody):
    """5. Email Sender 단독 실행 (드라이런 강제)"""
    result = email_sender.send(
        to=body.to,
        subject=body.subject,
        body_html=body.body_html,
        body_text=body.body_text,
        unsubscribe_token="TEST_TOKEN",
        dry_run=True,  # UI에서는 항상 드라이런
    )
    return result
