"""Supabase 클라이언트 (백엔드 전용 service-role 키 사용)"""
from functools import lru_cache
from supabase import create_client, Client

from app.core.config import settings


@lru_cache(maxsize=1)
def get_client() -> Client:
    """싱글톤 Supabase 클라이언트.
    백엔드는 RLS를 우회하는 service-role 키를 사용한다.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env 에 설정되지 않았습니다"
        )
    return create_client(
        settings.supabase_url,
        settings.supabase_service_role_key,
    )


def get_setting(key: str, default=None):
    """outreach_settings 단일 값 조회"""
    res = get_client().table("outreach_settings").select("value").eq("key", key).maybe_single().execute()
    if not res.data:
        return default
    return res.data["value"]


def set_setting(key: str, value) -> None:
    """outreach_settings upsert"""
    get_client().table("outreach_settings").upsert(
        {"key": key, "value": value}
    ).execute()
