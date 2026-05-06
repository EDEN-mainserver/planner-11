# 쿠팡 Wing API HMAC-SHA256 인증
# 공식 문서: https://developers.coupangcorp.com/hc/ko

import hmac
import hashlib
import datetime
import urllib.parse


def _utc_now() -> str:
    """쿠팡 API 요구 형식: 'yyMMddTHHmmssZ'"""
    return datetime.datetime.utcnow().strftime('%y%m%dT%H%M%SZ')


def generate_hmac(
    method: str,
    path: str,
    query: str,
    secret_key: str,
    datetime_str: str | None = None,
) -> tuple[str, str]:
    """
    HMAC-SHA256 서명 생성.
    반환: (datetime_str, signature)
    """
    dt = datetime_str or _utc_now()

    # 서명 대상 문자열
    message = dt + method + path + query
    signature = hmac.new(
        secret_key.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256,
    ).hexdigest()

    return dt, signature


def build_authorization(
    access_key: str,
    secret_key: str,
    method: str,
    path: str,
    query: str = '',
) -> dict[str, str]:
    """
    Authorization 헤더 딕셔너리 반환.
    사용: headers = build_authorization(...)
    """
    dt, signature = generate_hmac(method, path, query, secret_key)
    auth = f"CEA algorithm=HmacSHA256, access-key={access_key}, signed-date={dt}, signature={signature}"
    return {
        'Authorization': auth,
        'Content-Type': 'application/json;charset=UTF-8',
    }
