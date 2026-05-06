"""세션 데이터 전용 스토리지: Cloudflare R2 또는 로컬 폴백.

파일 업로드/다운로드는 files.py에서 직접 처리.
이 모듈은 sessions.py의 JSON 저장용.
"""
import os

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

_R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
_R2_ENDPOINT   = os.environ.get("R2_ENDPOINT", "")
_R2_ACCESS_KEY = os.environ.get("R2_ACCESS_KEY_ID", "") or os.environ.get("R2_ACCESS_KEY", "")
_R2_SECRET_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "") or os.environ.get("R2_SECRET_KEY", "")
_R2_BUCKET     = os.environ.get("R2_BUCKET_NAME", "e-sign-files")


def _endpoint_url() -> str:
    ep = _R2_ENDPOINT.strip()
    if not ep and _R2_ACCOUNT_ID:
        acct = _R2_ACCOUNT_ID.strip()
        raw = acct.replace("https://", "").replace("http://", "").strip("/")
        if "cloudflarestorage.com" in raw:
            ep = "https://" + raw
        else:
            ep = f"https://{raw}.r2.cloudflarestorage.com"
    if not ep:
        return ""
    raw = ep.replace("https://", "").replace("http://", "").strip("/")
    return "https://" + raw


def _use_r2() -> bool:
    return bool(_endpoint_url() and _R2_ACCESS_KEY and _R2_SECRET_KEY)


def _get_s3():
    return boto3.client(
        "s3",
        endpoint_url=_endpoint_url(),
        aws_access_key_id=_R2_ACCESS_KEY,
        aws_secret_access_key=_R2_SECRET_KEY,
        region_name="auto",
        config=Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 1}),
    )


def save_json(key: str, data: str) -> None:
    if _use_r2():
        try:
            _get_s3().put_object(Bucket=_R2_BUCKET, Key=key, Body=data.encode("utf-8"),
                                 ContentType="application/json")
            return
        except (BotoCoreError, ClientError) as e:
            print(f"[storage] R2 save_json 실패 ({key}): {e} — 로컬 폴백")
    from config import UPLOAD_FOLDER
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    with open(os.path.join(UPLOAD_FOLDER, os.path.basename(key)), "w", encoding="utf-8") as f:
        f.write(data)


def load_json(key: str) -> str | None:
    if _use_r2():
        try:
            resp = _get_s3().get_object(Bucket=_R2_BUCKET, Key=key)
            return resp["Body"].read().decode("utf-8")
        except (BotoCoreError, ClientError) as e:
            print(f"[storage] R2 load_json 실패 ({key}): {e} — 로컬 폴백 시도")
    # R2 미사용 또는 R2 실패 시 로컬 폴백
    from config import UPLOAD_FOLDER
    path = os.path.join(UPLOAD_FOLDER, os.path.basename(key))
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return None
