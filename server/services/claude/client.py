# Claude API 래퍼
# anthropic SDK를 직접 쓰되, 에러 처리·재시도·로깅을 한 곳에서 관리

import os
import json
import logging
from typing import Any

import anthropic
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ── 클라이언트 싱글턴 ─────────────────────────────────────────────
_client: anthropic.Anthropic | None = None

def get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY 환경 변수가 설정되지 않았습니다.")
        _client = anthropic.Anthropic(api_key=api_key)
    return _client


# ── 기본 텍스트 생성 ──────────────────────────────────────────────
async def generate_text(
    prompt: str,
    system: str = "",
    model: str = "claude-sonnet-4-6",
    max_tokens: int = 2048,
    max_retries: int = 2,
) -> str:
    """단순 텍스트 생성. 최대 max_retries회 재시도."""
    client = get_client()
    last_error: Exception | None = None

    for attempt in range(max_retries + 1):
        try:
            kwargs: dict[str, Any] = {
                "model": model,
                "max_tokens": max_tokens,
                "messages": [{"role": "user", "content": prompt}],
            }
            if system:
                kwargs["system"] = system

            message = client.messages.create(**kwargs)
            return message.content[0].text

        except anthropic.RateLimitError as e:
            last_error = e
            logger.warning(f"Rate limit (시도 {attempt + 1}/{max_retries + 1}): {e}")
            if attempt < max_retries:
                import asyncio
                await asyncio.sleep(2 ** attempt)  # 지수 백오프
        except anthropic.APIError as e:
            last_error = e
            logger.error(f"API 오류 (시도 {attempt + 1}/{max_retries + 1}): {e}")
            if attempt < max_retries:
                import asyncio
                await asyncio.sleep(1)

    raise RuntimeError(f"Claude API 호출 실패 ({max_retries + 1}회 시도): {last_error}")


# ── JSON 생성 (파싱 포함) ─────────────────────────────────────────
async def generate_json(
    prompt: str,
    system: str = "",
    model: str = "claude-sonnet-4-6",
    max_tokens: int = 2048,
) -> Any:
    """JSON을 반환받아 파싱까지 처리. 파싱 실패 시 ValueError."""
    raw = await generate_text(prompt, system=system, model=model, max_tokens=max_tokens)

    # 코드 블록 제거 후 JSON 추출
    clean = raw.strip()
    if clean.startswith("```"):
        lines = clean.split("\n")
        clean = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])

    # 배열 또는 객체 추출
    for pattern in (("[", "]"), ("{", "}")):
        start = clean.find(pattern[0])
        end   = clean.rfind(pattern[1])
        if start != -1 and end != -1 and end > start:
            try:
                return json.loads(clean[start:end + 1])
            except json.JSONDecodeError:
                continue

    raise ValueError(f"JSON 파싱 실패. 원본 응답:\n{raw[:300]}")
