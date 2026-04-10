# 요구사항 파싱 파이프라인
# input/raw/ 원본 파일을 읽어 LLM으로 구조화 → input/parsed/requirements.json 출력
import json
import logging
from pathlib import Path
from typing import Optional

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from engine.llm_client import call_llm, extract_json

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent.parent


def _load_prompt_template() -> str:
    """engine/prompts/parse_requirements.md 로드"""
    path = PROJECT_ROOT / "engine" / "prompts" / "parse_requirements.md"
    with open(path, encoding="utf-8") as f:
        return f.read()


def _read_raw_files(raw_dir: Path, target_file: Optional[str] = None) -> str:
    """input/raw/ 디렉토리의 파일 내용 읽기"""
    if target_file:
        target_path = raw_dir / target_file
        if not target_path.exists():
            raise FileNotFoundError(f"지정한 파일을 찾을 수 없습니다: {target_path}")
        with open(target_path, encoding="utf-8") as f:
            return f"[파일: {target_file}]\n{f.read()}"

    # 디렉토리 내 모든 텍스트 파일 읽기 (references 하위 포함)
    contents = []
    extensions = {".txt", ".md", ".text"}
    for path in sorted(raw_dir.rglob("*")):
        if path.is_file() and path.suffix.lower() in extensions:
            rel = path.relative_to(raw_dir)
            try:
                with open(path, encoding="utf-8") as f:
                    text = f.read().strip()
                if text:
                    contents.append(f"[파일: {rel}]\n{text}")
            except Exception as e:
                logger.warning(f"파일 읽기 실패 {path}: {e}")

    if not contents:
        raise ValueError(f"input/raw/ 디렉토리에 읽을 수 있는 파일이 없습니다: {raw_dir}")

    return "\n\n---\n\n".join(contents)


def _build_prompt(prompt_template: str, raw_content: str) -> str:
    """파싱 프롬프트 구성"""
    return f"""{prompt_template}

---

## 클라이언트 원본 자료

{raw_content}

---

## 지시

위 원본 자료를 분석하여 requirements.json 형식의 JSON을 생성하세요.

규칙:
1. 원본에서 명시적으로 언급된 내용만 채울 것
2. 추측하지 말 것 — 불확실하면 missing_info에 추가
3. target_systems는 최소 1개 필수
4. category는 다음 중 선택: 고객관리/CS, 생산성/자동화, 마케팅/세일즈, 이커머스, 기타
5. JSON만 출력 (```json ... ``` 블록 사용)

출력 형식:
```json
{{
  "project_title": "프로젝트명",
  "client_name": "클라이언트명",
  "category": "카테고리",
  "problem_statement": "해결하려는 핵심 문제",
  "target_systems": [
    {{"name": "시스템명", "type": "web_app|api|messenger|spreadsheet|database|other", "access_method": "api|scraping|browser_automation|webhook|manual"}}
  ],
  "triggers": [
    {{"event": "트리거 이벤트", "source": "발생 소스", "condition": "조건"}}
  ],
  "desired_actions": [
    {{"description": "원하는 동작", "target_system": "대상 시스템"}}
  ],
  "data_fields": [
    {{"name": "필드명", "type": "string|number|boolean|date|array", "source": "출처", "destination": "목적지"}}
  ],
  "constraints": ["제약 사항"],
  "success_criteria": ["성공 기준"],
  "missing_info": ["추가 확인이 필요한 사항"]
}}
```
"""


def parse_requirements(
    raw_dir: Path,
    output_path: Path,
    target_file: Optional[str] = None,
    max_retries: int = 2,
) -> dict:
    """
    요구사항 파싱 메인 함수.

    Args:
        raw_dir: input/raw/ 디렉토리 경로
        output_path: 저장할 requirements.json 경로
        target_file: 특정 파일 지정 시 해당 파일만 읽음 (None이면 전체)
        max_retries: LLM 재시도 횟수

    Returns:
        파싱된 requirements dict
    """
    logger.info("=== [STEP 1] 요구사항 파싱 시작 ===")

    # 원본 파일 읽기
    logger.info(f"raw 디렉토리 읽기: {raw_dir}")
    raw_content = _read_raw_files(raw_dir, target_file)
    logger.info(f"원본 자료 로드 완료 ({len(raw_content)}자)")

    # 프롬프트 구성
    prompt_template = _load_prompt_template()
    prompt = _build_prompt(prompt_template, raw_content)

    # LLM 호출 및 JSON 추출 (재시도 포함)
    for attempt in range(max_retries + 1):
        logger.info(f"LLM 파싱 시도 {attempt + 1}/{max_retries + 1}")
        try:
            response = call_llm(prompt, max_tokens=4096)
            requirements = extract_json(response)

            # 필수 필드 검증
            required_fields = ["project_title", "target_systems"]
            missing = [f for f in required_fields if not requirements.get(f)]
            if missing:
                raise ValueError(f"필수 필드 누락: {missing}")

            # target_systems 최소 1개 검증
            if not requirements.get("target_systems"):
                raise ValueError("target_systems가 비어있습니다.")

            break

        except (ValueError, json.JSONDecodeError) as e:
            if attempt < max_retries:
                logger.warning(f"파싱 실패: {e}. 재시도...")
            else:
                raise RuntimeError(f"요구사항 파싱 최종 실패: {e}")

    # 저장
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(requirements, f, ensure_ascii=False, indent=2)

    logger.info(f"requirements.json 저장 완료: {output_path}")

    if requirements.get("missing_info"):
        logger.warning(f"⚠️  클라이언트 확인 필요 항목 {len(requirements['missing_info'])}개:")
        for item in requirements["missing_info"]:
            logger.warning(f"   - {item}")

    return requirements
