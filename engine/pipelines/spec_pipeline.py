# 기능명세서 생성 파이프라인
# prd.json → spec.json (machine) + 기능명세서.md (human)
import json
import logging
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Tuple

import yaml
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from engine.llm_client import call_llm, extract_json, sanitize_doc
from engine.validators.schema_validator import validate_schema

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent.parent
KST = timezone(timedelta(hours=9))


def _load_resources() -> Tuple[str, dict]:
    """프롬프트, 규칙 로드"""
    prompt_path = PROJECT_ROOT / "engine" / "prompts" / "generate_spec.md"
    rules_path = PROJECT_ROOT / "engine" / "rules" / "spec_structure.yaml"

    with open(prompt_path, encoding="utf-8") as f:
        prompt_template = f.read()
    with open(rules_path, encoding="utf-8") as f:
        rules = yaml.safe_load(f)

    return prompt_template, rules


def _load_spec_example() -> dict:
    """크몽 예시 spec.json 로드"""
    sample_path = PROJECT_ROOT / "output" / "PRJ-2026-001" / "machine" / "spec.json"
    if sample_path.exists():
        with open(sample_path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def _build_prompt(
    prompt_template: str,
    rules: dict,
    example: dict,
    prd: dict,
) -> str:
    """기능명세서 생성 프롬프트 구성"""
    now_kst = datetime.now(KST).isoformat()
    project_id = prd.get("meta", {}).get("project_id", "")
    prd_version = prd.get("meta", {}).get("version", "1.0.0")

    # PRD에서 features와 automation_context만 추출하여 컨텍스트 제공
    prd_context = {
        "meta": prd.get("meta", {}),
        "overview": prd.get("overview", {}),
        "scenarios": prd.get("scenarios", []),
        "features": prd.get("features", []),
        "automation_context": prd.get("automation_context", {}),
    }

    return f"""{prompt_template}

---

## 명세서 구조 규칙 (spec_structure.yaml)

```yaml
{yaml.dump(rules, allow_unicode=True, default_flow_style=False)}
```

---

## 참고 예시 (크몽 프로젝트 — 동일 수준으로 생성할 것)

```json
{json.dumps(example, ensure_ascii=False, indent=2)}
```

---

## 입력: 확정된 PRD

```json
{json.dumps(prd_context, ensure_ascii=False, indent=2)}
```

---

## 생성 지시

위 PRD를 바탕으로 기능명세서(spec.json)를 생성하세요.

필수 규칙:
1. meta.project_id: "{project_id}", meta.prd_version: "{prd_version}", meta.created_at: "{now_kst}"
2. PRD의 features 배열 순서대로 정확히 1:1 매핑하여 SPEC 생성 (features 수 = specs 수)
3. spec_id: SPEC-001, SPEC-002, ... (features 순서대로)
4. linked_feature_id는 PRD features[].id와 정확히 일치 (F-001, F-002, ...)
5. technical_detail.approach는 구체적으로 (라이브러리, 구현 방식 명시)
6. input/output 필드는 PRD automation_context.actions의 입출력과 매핑
7. selectors: 실제 확인 전 "TODO: 실제 DOM 확인 필요"로 표시
8. error_cases 최소 2개, test_cases 최소 2개
9. 문체: "~한다" 형식
10. JSON만 출력 (```json ... ``` 블록 사용)

출력 구조:
{{
  "meta": {{ "project_id": ..., "prd_version": ..., "created_at": ... }},
  "specs": [
    {{
      "spec_id": "SPEC-001",
      "linked_feature_id": "F-001",
      "title": "...",
      "description": "...",
      "priority": "critical|high|medium|low",
      "status": "not_started",
      "user_scenario": {{ "actor": ..., "precondition": ..., "flow": [...], "postcondition": ... }},
      "acceptance_criteria": [...],
      "technical_detail": {{
        "approach": "...",
        "tech_stack": [...],
        "input": [...],
        "output": [...],
        "selectors": [...],
        "dependencies": [...],
        "estimated_effort": "..."
      }},
      "error_cases": [...],
      "test_cases": [...],
      "notes": "..."
    }}
  ]
}}
"""


def _generate_spec_md(spec: dict) -> str:
    """spec.json → 기능명세서.md 변환 (사람용)"""
    meta = spec.get("meta", {})
    specs = spec.get("specs", [])
    lines = []

    lines.append("# 기능명세서\n")
    lines.append("| 항목 | 내용 |")
    lines.append("|---|---|")
    lines.append(f"| **프로젝트 ID** | {meta.get('project_id', '')} |")
    lines.append(f"| **PRD 버전** | {meta.get('prd_version', '')} |")
    if meta.get("created_at"):
        lines.append(f"| **생성일** | {meta['created_at'][:10]} |")
    lines.append("")
    lines.append("---\n")

    # 목차
    lines.append("## 목차\n")
    for s in specs:
        spec_id = s.get("spec_id", "")
        title = s.get("title", "")
        lines.append(f"- [{spec_id}: {title}](#{spec_id.lower().replace('-', '')})")
    lines.append("")
    lines.append("---\n")

    for s in specs:
        spec_id = s.get("spec_id", "")
        linked_feat = s.get("linked_feature_id", "")
        priority = s.get("priority", "")
        status = s.get("status", "not_started")

        lines.append(f"## {spec_id}: {s.get('title', '')}\n")
        lines.append("| 항목 | 내용 |")
        lines.append("|---|---|")
        lines.append(f"| **연결 기능** | {linked_feat} |")
        lines.append(f"| **우선순위** | {priority} |")
        lines.append(f"| **상태** | {status} |")
        lines.append("")

        if s.get("description"):
            lines.append(f"{s['description']}\n")

        # 사용자 시나리오
        us = s.get("user_scenario", {})
        if us:
            lines.append("### 사용자 시나리오\n")
            if us.get("actor"):
                lines.append(f"**주체:** {us['actor']}")
            if us.get("precondition"):
                lines.append(f"**전제조건:** {us['precondition']}\n")
            for step in us.get("flow", []):
                expected = step.get("expected_result", "")
                lines.append(f"{step.get('step', '')}. {step.get('action', '')}")
                if expected:
                    lines.append(f"   → {expected}")
            if us.get("postcondition"):
                lines.append(f"\n**완료 후:** {us['postcondition']}")
            lines.append("")

        # 수용 기준
        ac = s.get("acceptance_criteria", [])
        if ac:
            lines.append("### 수용 기준\n")
            for criterion in ac:
                lines.append(f"- [ ] {criterion}")
            lines.append("")

        # 기술 상세
        td = s.get("technical_detail", {})
        if td:
            lines.append("### 기술 구현 상세\n")
            if td.get("approach"):
                lines.append(f"**구현 방식:** {td['approach']}\n")
            if td.get("tech_stack"):
                lines.append(f"**기술 스택:** {', '.join(td['tech_stack'])}\n")
            if td.get("estimated_effort"):
                lines.append(f"**예상 소요:** {td['estimated_effort']}\n")

            # 입력
            inputs = td.get("input", [])
            if inputs:
                lines.append("**입력 필드:**")
                lines.append("| 필드명 | 타입 | 출처 | 필수 |")
                lines.append("|---|---|---|---|")
                for inp in inputs:
                    required = "✓" if inp.get("required") else "-"
                    lines.append(f"| {inp.get('name','')} | {inp.get('type','')} | {inp.get('source','')} | {required} |")
                lines.append("")

            # 출력
            outputs = td.get("output", [])
            if outputs:
                lines.append("**출력 필드:**")
                lines.append("| 필드명 | 타입 | 목적지 |")
                lines.append("|---|---|---|")
                for out in outputs:
                    lines.append(f"| {out.get('name','')} | {out.get('type','')} | {out.get('destination','')} |")
                lines.append("")

            # API 엔드포인트
            apis = td.get("api_endpoints", [])
            if apis:
                lines.append("**API 엔드포인트:**")
                for api in apis:
                    lines.append(f"- `{api.get('method','')} {api.get('url','')}` (인증: {api.get('auth_type','')})")
                    if api.get("notes"):
                        lines.append(f"  - {api['notes']}")
                lines.append("")

            # 선택자 (스크래핑)
            selectors = td.get("selectors", [])
            if selectors:
                lines.append("**CSS/XPath 선택자:**")
                for sel in selectors:
                    lines.append(f"- {sel.get('name','')}: `{sel.get('selector','')}` ({sel.get('type','')})")
                lines.append("")

            # 선행 의존성
            deps = td.get("dependencies", [])
            if deps:
                lines.append(f"**선행 기능:** {', '.join(deps)}\n")

        # 에러 케이스
        error_cases = s.get("error_cases", [])
        if error_cases:
            lines.append("### 에러 케이스\n")
            lines.append("| 상황 | 처리 방법 | 심각도 |")
            lines.append("|---|---|---|")
            for ec in error_cases:
                lines.append(f"| {ec.get('case','')} | {ec.get('handling','')} | {ec.get('severity','')} |")
            lines.append("")

        # 테스트 케이스
        test_cases = s.get("test_cases", [])
        if test_cases:
            lines.append("### 테스트 케이스\n")
            lines.append("| 케이스 | 입력 | 기대 결과 |")
            lines.append("|---|---|---|")
            for tc in test_cases:
                inp = tc.get("input", "-")
                lines.append(f"| {tc.get('case','')} | {inp} | {tc.get('expected','')} |")
            lines.append("")

        # 메모
        if s.get("notes"):
            lines.append(f"### 메모\n{s['notes']}\n")

        lines.append("---\n")

    return "\n".join(lines)


def run_spec_pipeline(
    project_id: str,
    prd_path: Path,
    machine_output_dir: Path,
    human_output_dir: Path,
    max_retries: int = 2,
) -> dict:
    """
    기능명세서 생성 파이프라인 메인 함수.

    Args:
        project_id: 프로젝트 ID
        prd_path: prd.json 경로
        machine_output_dir: output/{id}/machine/ 경로
        human_output_dir: output/{id}/human/ 경로
        max_retries: 재시도 횟수

    Returns:
        생성된 spec dict
    """
    logger.info("=== [STEP 3] 기능명세서 생성 시작 ===")

    # PRD 로드
    with open(prd_path, encoding="utf-8") as f:
        prd = json.load(f)
    feature_count = len(prd.get("features", []))
    logger.info(f"PRD 로드: 기능 {feature_count}개")

    # 리소스 로드
    prompt_template, rules = _load_resources()
    example = _load_spec_example()

    # 출력 디렉토리 준비
    machine_output_dir.mkdir(parents=True, exist_ok=True)
    human_output_dir.mkdir(parents=True, exist_ok=True)

    # SPEC 생성 (재시도 포함)
    spec = None
    for attempt in range(max_retries + 1):
        logger.info(f"SPEC 생성 시도 {attempt + 1}/{max_retries + 1}")
        prompt = _build_prompt(prompt_template, rules, example, prd)

        try:
            response = call_llm(prompt, max_tokens=32768)
            spec = sanitize_doc(extract_json(response))

            # 스키마 검증
            valid, errors = validate_schema(spec, "spec")
            if not valid:
                error_summary = "; ".join(errors[:3])
                raise ValueError(f"스키마 검증 실패: {error_summary}")

            # specs 수 검증
            specs = spec.get("specs", [])
            if len(specs) != feature_count:
                logger.warning(
                    f"specs 수({len(specs)})가 features 수({feature_count})와 다릅니다."
                )

            # linked_feature_id 정합성 검증
            feature_ids = {f["id"] for f in prd.get("features", [])}
            spec_feature_ids = {s.get("linked_feature_id") for s in specs}
            missing = feature_ids - spec_feature_ids
            if missing:
                raise ValueError(f"linked_feature_id 누락: {missing}")

            logger.info(f"SPEC 검증 통과: {len(specs)}개 명세 생성")
            break

        except (ValueError, json.JSONDecodeError) as e:
            if attempt < max_retries:
                logger.warning(f"SPEC 생성 실패: {e}. 재시도...")
            else:
                raise RuntimeError(f"SPEC 생성 최종 실패: {e}")

    # spec.json 저장
    spec_path = machine_output_dir / "spec.json"
    with open(spec_path, "w", encoding="utf-8") as f:
        json.dump(spec, f, ensure_ascii=False, indent=2)
    logger.info(f"spec.json 저장: {spec_path}")

    # 기능명세서.md 저장
    spec_md = _generate_spec_md(spec)
    md_path = human_output_dir / "기능명세서.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(spec_md)
    logger.info(f"기능명세서.md 저장: {md_path}")

    return spec
