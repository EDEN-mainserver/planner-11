"""계약 배치/서명자 세션 저장소. R2 또는 로컬 JSON 파일 기반."""
import json
import secrets
from datetime import datetime

from services.storage import save_json, load_json

SESSIONS_KEY = "sessions/_sessions.json"


def _load() -> dict:
    raw = load_json(SESSIONS_KEY)
    if not raw:
        return {}
    try:
        return json.loads(raw)
    except Exception:
        return {}


def _save(data: dict) -> None:
    save_json(SESSIONS_KEY, json.dumps(data, ensure_ascii=False, indent=2))


def create_batch(payload: dict) -> str:
    sessions = _load()
    batch_id = secrets.token_hex(16)
    payload["batch_id"] = batch_id
    payload["created_at"] = datetime.utcnow().isoformat()
    sessions[batch_id] = payload
    _save(sessions)
    return batch_id


def get_batch(batch_id: str) -> dict | None:
    return _load().get(batch_id)


def get_by_token(token: str) -> tuple[dict, dict] | tuple[None, None]:
    for batch in _load().values():
        for signer in batch.get("signers", []):
            if signer.get("token") == token:
                return batch, signer
    return None, None


def update_batch(batch_id: str, batch: dict) -> None:
    sessions = _load()
    sessions[batch_id] = batch
    _save(sessions)
