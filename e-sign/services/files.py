"""파일 저장/조회 서비스 — Cloudflare R2 (boto3) 또는 로컬 폴백."""
import os
import uuid
import mimetypes
from pathlib import Path
from urllib.parse import quote, unquote

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from config import UPLOAD_FOLDER, ALLOWED_PDF, ALLOWED_DOC, MAX_PDF_BYTES, MAX_DOC_BYTES

# ── R2 설정 ────────────────────────────────────────────────────────────────
_R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "")
_R2_ENDPOINT   = os.environ.get("R2_ENDPOINT", "")
_R2_ACCESS_KEY = os.environ.get("R2_ACCESS_KEY_ID", "") or os.environ.get("R2_ACCESS_KEY", "")
_R2_SECRET_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "") or os.environ.get("R2_SECRET_KEY", "")
_R2_BUCKET     = os.environ.get("R2_BUCKET_NAME", "e-sign-files")


def _endpoint_url() -> str:
    """R2_ENDPOINT 또는 R2_ACCOUNT_ID로 엔드포인트 URL 생성."""
    ep = _R2_ENDPOINT.strip()
    if not ep and _R2_ACCOUNT_ID:
        acct = _R2_ACCOUNT_ID.strip()
        # 프로토콜 제거 후 순수 값 추출
        raw = acct.replace("https://", "").replace("http://", "").strip("/")
        if "cloudflarestorage.com" in raw:
            ep = "https://" + raw
        else:
            ep = f"https://{raw}.r2.cloudflarestorage.com"
    if not ep:
        return ""
    # 프로토콜 정리
    raw = ep.replace("https://", "").replace("http://", "").strip("/")
    return "https://" + raw


def _r2_client():
    ep = _endpoint_url()
    if not ep or not _R2_ACCESS_KEY:
        return None
    return boto3.client(
        "s3",
        endpoint_url=ep,
        aws_access_key_id=_R2_ACCESS_KEY,
        aws_secret_access_key=_R2_SECRET_KEY,
        region_name="auto",
        config=Config(connect_timeout=5, read_timeout=10, retries={"max_attempts": 2}),
    )


def _use_r2() -> bool:
    return bool(_endpoint_url() and _R2_ACCESS_KEY and _R2_SECRET_KEY)


# ── 확장자 검사 ────────────────────────────────────────────────────────────
def _allowed(filename: str) -> tuple[bool, int]:
    """(허용 여부, 최대 바이트). 허용되지 않으면 (False, 0)."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if ext in ALLOWED_PDF:
        return True, MAX_PDF_BYTES
    if ext in ALLOWED_DOC:
        return True, MAX_DOC_BYTES
    return False, 0


# ── 공개 API ───────────────────────────────────────────────────────────────
def save_upload(file_obj) -> dict:
    """
    Flask FileStorage 객체를 받아 R2(또는 로컬)에 저장.
    반환: {"ok": True, "doc_id": str, "filename": str}
          {"ok": False, "error": str}
    """
    if not file_obj or not file_obj.filename:
        return {"ok": False, "error": "파일이 없습니다."}

    filename = file_obj.filename
    allowed, max_bytes = _allowed(filename)
    if not allowed:
        return {"ok": False, "error": f"허용되지 않는 파일 형식입니다: {filename}"}

    data = file_obj.read()
    if len(data) > max_bytes:
        mb = max_bytes // (1024 * 1024)
        return {"ok": False, "error": f"파일 크기가 {mb}MB를 초과합니다."}

    doc_id = uuid.uuid4().hex
    ext = filename.rsplit(".", 1)[-1].lower()
    stored_name = f"{doc_id}.{ext}"

    if _use_r2():
        try:
            client = _r2_client()
            mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"
            client.put_object(
                Bucket=_R2_BUCKET,
                Key=f"uploads/{stored_name}",
                Body=data,
                ContentType=mime,
                Metadata={"original_filename": quote(filename)},
            )
        except (BotoCoreError, ClientError) as e:
            return {"ok": False, "error": f"R2 업로드 실패: {e}"}
    else:
        # 로컬 저장 폴백
        dest = Path(UPLOAD_FOLDER) / stored_name
        dest.write_bytes(data)

    return {"ok": True, "doc_id": doc_id, "filename": filename, "stored_name": stored_name}


def get_file_bytes(doc_id: str) -> tuple[str | None, bytes | None]:
    """
    doc_id 로 원본 파일명과 바이트를 반환.
    실패 시 (None, None).
    """
    if _use_r2():
        try:
            client = _r2_client()
            # 확장자를 모르므로 ListObjects로 prefix 검색
            resp = client.list_objects_v2(Bucket=_R2_BUCKET, Prefix=f"uploads/{doc_id}")
            contents = resp.get("Contents", [])
            if not contents:
                return None, None
            key = contents[0]["Key"]
            obj = client.get_object(Bucket=_R2_BUCKET, Key=key)
            data = obj["Body"].read()
            raw_name = obj.get("Metadata", {}).get("original_filename", key.split("/")[-1])
            original_filename = unquote(raw_name)
            return original_filename, data
        except (BotoCoreError, ClientError) as e:
            print(f"[files] R2 get_file_bytes 실패: {e}")
            return None, None
    else:
        # 로컬 폴백
        folder = Path(UPLOAD_FOLDER)
        matches = list(folder.glob(f"{doc_id}.*"))
        if not matches:
            return None, None
        f = matches[0]
        return f.name, f.read_bytes()
