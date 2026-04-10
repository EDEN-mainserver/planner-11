# LLM 클라이언트 모듈 — Gemini (주력) / Claude (폴백)
import os
import re
import json
import time
import logging
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent


def load_config() -> dict:
    """engine/config.yaml 로드"""
    config_path = PROJECT_ROOT / "engine" / "config.yaml"
    with open(config_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def call_llm(
    prompt: str,
    system: str = "",
    max_retries: int = 2,
    max_tokens: int = 8192,
) -> str:
    """LLM 호출. 실패 시 재시도, 최종 실패 시 폴백."""
    config = load_config()
    primary = config["llm"]["primary"]
    provider = primary.get("provider", "gemini")

    for attempt in range(max_retries + 1):
        try:
            logger.debug(f"{provider} API 호출 (시도 {attempt + 1}/{max_retries + 1})")

            if provider == "gemini":
                return _call_gemini(prompt, system, primary, max_tokens)
            elif provider == "anthropic":
                return _call_anthropic(prompt, system, primary, max_tokens)
            elif provider == "openai":
                return _call_openai(prompt, system, primary, max_tokens)
            else:
                raise ValueError(f"알 수 없는 provider: {provider}")

        except Exception as e:
            err_msg = str(e)

            # 크레딧/인증 오류는 즉시 폴백
            if any(k in err_msg.lower() for k in ["credit", "billing", "authentication", "api_key", "invalid_api_key", "api key"]):
                logger.warning(f"{provider} 인증/크레딧 오류. 폴백 시도...")
                return _call_fallback(prompt, system, config, max_tokens)

            if attempt < max_retries:
                wait = 30 if "timeout" in err_msg.lower() else 5
                logger.warning(f"오류: {e}. {wait}초 후 재시도 ({attempt + 1}/{max_retries})...")
                time.sleep(wait)
            else:
                logger.warning(f"{provider} 최종 실패: {e}. 폴백 시도...")
                return _call_fallback(prompt, system, config, max_tokens)

    raise RuntimeError("LLM 호출 모두 실패")


def _call_gemini(prompt: str, system: str, cfg: dict, max_tokens: int) -> str:
    """Google Gemini API 호출 (google-genai 패키지)"""
    from google import genai
    from google.genai import types

    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY 환경변수가 설정되지 않았습니다.")

    client = genai.Client(api_key=api_key)
    model_name = cfg.get("model", "gemini-2.5-pro")

    # system instruction이 있으면 prompt 앞에 붙임
    full_prompt = f"{system}\n\n{prompt}" if system else prompt

    # JSON 출력 강제 + 토큰 제한
    response = client.models.generate_content(
        model=model_name,
        contents=full_prompt,
        config=types.GenerateContentConfig(
            temperature=cfg.get("temperature", 0.3),
            max_output_tokens=max_tokens,
            response_mime_type="application/json",
        ),
    )
    return response.text


def _call_anthropic(prompt: str, system: str, cfg: dict, max_tokens: int) -> str:
    """Anthropic Claude API 호출"""
    import anthropic

    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.")

    client = anthropic.Anthropic(api_key=api_key)
    kwargs = {
        "model": cfg.get("model", "claude-sonnet-4-6"),
        "max_tokens": max_tokens,
        "temperature": cfg.get("temperature", 0.3),
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        kwargs["system"] = system

    response = client.messages.create(**kwargs)
    return response.content[0].text


def _call_openai(prompt: str, system: str, cfg: dict, max_tokens: int) -> str:
    """OpenAI GPT API 호출"""
    import openai as openai_lib

    api_key = os.environ.get("OPENAI_API_KEY", "")
    client = openai_lib.OpenAI(api_key=api_key)
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    response = client.chat.completions.create(
        model=cfg.get("model", "gpt-4o"),
        max_tokens=min(max_tokens, 4096),
        messages=messages,
    )
    return response.choices[0].message.content


def _call_fallback(prompt: str, system: str, config: dict, max_tokens: int) -> str:
    """폴백 LLM 호출"""
    fallback = config["llm"].get("fallback", {})
    provider = fallback.get("provider", "anthropic")
    logger.info(f"폴백 LLM 사용: {provider} / {fallback.get('model', '')}")

    if provider == "anthropic":
        return _call_anthropic(prompt, system, fallback, max_tokens)
    elif provider == "openai":
        return _call_openai(prompt, system, fallback, max_tokens)
    elif provider == "gemini":
        return _call_gemini(prompt, system, fallback, max_tokens)
    else:
        raise RuntimeError(f"폴백도 실패. provider: {provider}")


def sanitize_doc(data, _path=""):
    """
    LLM이 자주 쓰는 잘못된 enum 값을 스키마 허용 값으로 자동 교정한다.
    재귀적으로 dict/list 전체를 순회.
    """
    # type 필드 교정 맵 (data type)
    TYPE_MAP = {
        "datetime": "date", "timestamp": "date", "integer": "number",
        "float": "number", "int": "number", "object": "json",
        "dict": "json", "list": "array", "text": "string", "bool": "boolean",
    }
    # auth_type 교정 맵
    AUTH_MAP = {
        "oauth2_service_account": "oauth2", "service_account": "oauth2",
        "jwt": "bearer_token", "token": "bearer_token", "apikey": "api_key",
    }
    # target_systems.type 교정 맵
    SYSTEM_TYPE_MAP = {
        "ai_service": "other", "llm": "other", "chat": "messenger",
        "sheets": "spreadsheet", "notification": "messenger",
    }
    # action_type 교정 맵
    ACTION_TYPE_MAP = {
        "read": "data_read", "write": "data_write", "transform": "data_transform",
        "call": "api_call", "notification": "notify", "generate": "generate_content",
        "classify": "decision", "branch": "decision",
    }

    if isinstance(data, dict):
        for key, value in list(data.items()):
            if key == "type" and isinstance(value, str):
                # input/output 필드의 type
                if value in TYPE_MAP:
                    data[key] = TYPE_MAP[value]
            elif key == "auth_type" and isinstance(value, str):
                if value in AUTH_MAP:
                    data[key] = AUTH_MAP[value]
            elif key == "action_type" and isinstance(value, str):
                if value in ACTION_TYPE_MAP:
                    data[key] = ACTION_TYPE_MAP[value]
            # target_systems 내부의 type 필드 (web_app, api 등)
            elif key == "type" and isinstance(value, str) and value in SYSTEM_TYPE_MAP:
                # 상위 컨텍스트가 target_systems인지는 path로 판단
                if "target_systems" in _path:
                    data[key] = SYSTEM_TYPE_MAP[value]
            elif isinstance(value, (dict, list)):
                sanitize_doc(value, _path + f">{key}")
    elif isinstance(data, list):
        for i, item in enumerate(data):
            sanitize_doc(item, _path + f"[{i}]")

    return data


def extract_json(text: str) -> dict:
    """LLM 응답 텍스트에서 JSON 추출 (여러 형태 처리)"""
    # ```json ... ``` 블록
    match = re.search(r"```json\s*([\s\S]*?)\s*```", text)
    if match:
        return json.loads(match.group(1))

    # ``` ... ``` 블록
    match = re.search(r"```\s*([\s\S]*?)\s*```", text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 텍스트 전체가 JSON
    text_stripped = text.strip()
    if text_stripped.startswith("{"):
        return json.loads(text_stripped)

    # { ... } 블록 추출 (마지막 시도)
    match = re.search(r"\{[\s\S]*\}", text)
    if match:
        return json.loads(match.group(0))

    raise ValueError("LLM 응답에서 JSON을 추출할 수 없습니다.")
