# 유저플로우 생성 파이프라인
# prd.json + spec.json → flow.json (machine) + 유저플로우.mermaid.md (human) + full_context.json
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
    prompt_path = PROJECT_ROOT / "engine" / "prompts" / "generate_flow.md"
    rules_path = PROJECT_ROOT / "engine" / "rules" / "flow_structure.yaml"

    with open(prompt_path, encoding="utf-8") as f:
        prompt_template = f.read()
    with open(rules_path, encoding="utf-8") as f:
        rules = yaml.safe_load(f)

    return prompt_template, rules


def _load_flow_example() -> dict:
    """크몽 예시 flow.json 로드"""
    sample_path = PROJECT_ROOT / "output" / "PRJ-2026-001" / "machine" / "flow.json"
    if sample_path.exists():
        with open(sample_path, encoding="utf-8") as f:
            return json.load(f)
    return {}


def _build_prompt(
    prompt_template: str,
    rules: dict,
    example: dict,
    prd: dict,
    spec: dict,
) -> str:
    """유저플로우 생성 프롬프트 구성"""
    now_kst = datetime.now(KST).isoformat()
    project_id = prd.get("meta", {}).get("project_id", "")
    prd_version = prd.get("meta", {}).get("version", "1.0.0")

    # spec에서 spec_id 목록 추출 (노드 매핑 참조용)
    spec_ids = [s.get("spec_id") for s in spec.get("specs", [])]
    # prd에서 action ID 목록 추출
    action_ids = [a.get("id") for a in prd.get("automation_context", {}).get("actions", [])]
    scenario_ids = [sc.get("id") for sc in prd.get("scenarios", [])]

    return f"""{prompt_template}

---

## 플로우 구조 규칙 (flow_structure.yaml)

```yaml
{yaml.dump(rules, allow_unicode=True, default_flow_style=False)}
```

---

## 참고 예시 (크몽 프로젝트 — 동일 수준으로 생성할 것)

```json
{json.dumps(example, ensure_ascii=False, indent=2)}
```

---

## 입력: PRD + 기능명세서

### PRD
```json
{json.dumps(prd, ensure_ascii=False, indent=2)}
```

### 기능명세서 (spec.json)
```json
{json.dumps(spec, ensure_ascii=False, indent=2)}
```

---

## 생성 지시

위 PRD와 기능명세서를 바탕으로 유저플로우(flow.json)를 생성하세요.

필수 규칙:
1. meta.project_id: "{project_id}", meta.prd_version: "{prd_version}", meta.created_at: "{now_kst}"
2. PRD의 scenarios 기준으로 flow 생성 (시나리오 ID: {scenario_ids})
3. 사용 가능한 SPEC ID (linked_spec_id로 사용): {spec_ids}
4. 사용 가능한 ACT ID (linked_action_id로 사용): {action_ids}
5. node_id 패턴: N-001, N-002, ... (순서대로), 에러 노드는 N-091, N-092, ...
6. 모든 flow에 start/end 노드 필수
7. decision 노드에는 반드시 condition (field, operator, value) 포함한 edge 2개 이상
8. error_flows 최소 1개 필수
9. action 노드에는 linked_spec_id + linked_action_id 매핑
10. mermaid 다이어그램 코드 생성 (flows[].mermaid 필드에 포함)
    - decision → {{{{ }}}} 형식
    - error paths → -.-> 점선
    - start/end → (( )) 형식
    - style 지정 포함 (시작/종료=초록, 에러=빨강)
11. JSON만 출력 (```json ... ``` 블록 사용)

출력 구조:
{{
  "meta": {{ "project_id": ..., "prd_version": ..., "created_at": ... }},
  "flows": [
    {{
      "flow_id": "FLOW-001",
      "title": "...",
      "linked_scenario_id": "SC-001",
      "description": "...",
      "actor": "시스템",
      "nodes": [
        {{ "node_id": "N-001", "type": "start", "label": "...", "executor": "system" }},
        {{ "node_id": "N-002", "type": "action", "label": "...", "linked_spec_id": "SPEC-001", "linked_action_id": "ACT-001", "executor": "system", "data_snapshot": {{ "available_data": [...], "new_data": [...] }} }},
        {{ "node_id": "N-003", "type": "decision", "label": "...", "executor": "system" }},
        ...
      ],
      "edges": [
        {{ "from": "N-001", "to": "N-002" }},
        {{ "from": "N-003", "to": "N-004", "label": "Yes", "condition": {{ "field": "...", "operator": "equals", "value": true }} }},
        {{ "from": "N-002", "to": "N-091", "label": "에러", "is_error_path": true }},
        ...
      ],
      "error_flows": [
        {{ "trigger_node_id": "N-002", "error_type": "auth_failure", "handling_node_id": "N-091", "description": "..." }}
      ],
      "mermaid": "flowchart TD\\n  ..."
    }}
  ]
}}
"""


def _generate_mermaid_md(flow: dict) -> str:
    """flow.json → 유저플로우.mermaid.md 변환 (사람용)"""
    meta = flow.get("meta", {})
    flows = flow.get("flows", [])
    lines = []

    lines.append("# 유저플로우\n")
    lines.append("| 항목 | 내용 |")
    lines.append("|---|---|")
    lines.append(f"| **프로젝트 ID** | {meta.get('project_id', '')} |")
    lines.append(f"| **PRD 버전** | {meta.get('prd_version', '')} |")
    if meta.get("created_at"):
        lines.append(f"| **생성일** | {meta['created_at'][:10]} |")
    lines.append("")
    lines.append("---\n")

    for fl in flows:
        flow_id = fl.get("flow_id", "")
        title = fl.get("title", "")
        scenario_id = fl.get("linked_scenario_id", "")
        description = fl.get("description", "")
        actor = fl.get("actor", "")

        lines.append(f"## {flow_id}: {title}\n")
        lines.append("| 항목 | 내용 |")
        lines.append("|---|---|")
        lines.append(f"| **연결 시나리오** | {scenario_id} |")
        lines.append(f"| **주체** | {actor} |")
        lines.append("")
        if description:
            lines.append(f"{description}\n")

        # 노드 요약 테이블
        nodes = fl.get("nodes", [])
        if nodes:
            lines.append("### 노드 목록\n")
            lines.append("| 노드 ID | 유형 | 레이블 | 실행 주체 | 연결 SPEC | 연결 ACT |")
            lines.append("|---|---|---|---|---|---|")
            for n in nodes:
                spec_link = n.get("linked_spec_id", "-")
                act_link = n.get("linked_action_id", "-")
                exec_by = n.get("executor", "system")
                lines.append(
                    f"| {n.get('node_id','')} | {n.get('type','')} | {n.get('label','')} | {exec_by} | {spec_link} | {act_link} |"
                )
            lines.append("")

        # 에러 플로우
        error_flows = fl.get("error_flows", [])
        if error_flows:
            lines.append("### 에러 처리 경로\n")
            lines.append("| 발생 노드 | 에러 유형 | 처리 노드 | 설명 |")
            lines.append("|---|---|---|---|")
            for ef in error_flows:
                lines.append(
                    f"| {ef.get('trigger_node_id','')} | {ef.get('error_type','')} | {ef.get('handling_node_id','')} | {ef.get('description','')} |"
                )
            lines.append("")

        # Mermaid 다이어그램
        mermaid_code = fl.get("mermaid", "")
        if mermaid_code:
            lines.append("### 플로우 다이어그램\n")
            lines.append("```mermaid")
            lines.append(mermaid_code)
            lines.append("```")
        else:
            # mermaid 없으면 기본 구조로 생성
            lines.append("### 플로우 다이어그램\n")
            lines.append("```mermaid")
            lines.append("flowchart TD")
            for n in nodes:
                nid = n.get("node_id", "").replace("-", "")
                label = n.get("label", "")
                ntype = n.get("type", "action")
                if ntype == "start" or ntype == "end":
                    lines.append(f"  {nid}(({label}))")
                elif ntype == "decision":
                    lines.append(f"  {nid}{{{{{label}}}}}")
                elif ntype == "error":
                    lines.append(f"  {nid}[{label}]")
                else:
                    lines.append(f"  {nid}[{label}]")
            edges = fl.get("edges", [])
            for e in edges:
                from_id = e.get("from", "").replace("-", "")
                to_id = e.get("to", "").replace("-", "")
                label = e.get("label", "")
                is_error = e.get("is_error_path", False)
                arrow = "-.->|" if is_error else "-->|"
                if label:
                    lines.append(f"  {from_id} {arrow}{label}| {to_id}")
                else:
                    lines.append(f"  {from_id} --> {to_id}")
            lines.append("```")
        lines.append("")
        lines.append("---\n")

    return "\n".join(lines)


def _merge_full_context(prd: dict, spec: dict, flow: dict) -> dict:
    """prd + spec + flow → full_context.json 병합"""
    return {
        "_meta": {
            "description": "PlanForge 통합 컨텍스트 — 에덴 에이전트 소비용",
            "generated_at": datetime.now(KST).isoformat(),
            "project_id": prd.get("meta", {}).get("project_id", ""),
        },
        "prd": prd,
        "spec": spec,
        "flow": flow,
    }


def run_flow_pipeline(
    project_id: str,
    prd_path: Path,
    spec_path: Path,
    machine_output_dir: Path,
    human_output_dir: Path,
    max_retries: int = 2,
) -> dict:
    """
    유저플로우 생성 파이프라인 메인 함수.

    Args:
        project_id: 프로젝트 ID
        prd_path: prd.json 경로
        spec_path: spec.json 경로
        machine_output_dir: output/{id}/machine/ 경로
        human_output_dir: output/{id}/human/ 경로
        max_retries: 재시도 횟수

    Returns:
        생성된 flow dict
    """
    logger.info("=== [STEP 4] 유저플로우 생성 시작 ===")

    # PRD + SPEC 로드
    with open(prd_path, encoding="utf-8") as f:
        prd = json.load(f)
    with open(spec_path, encoding="utf-8") as f:
        spec = json.load(f)

    scenario_count = len(prd.get("scenarios", []))
    logger.info(f"PRD 로드: 시나리오 {scenario_count}개 → 플로우 {scenario_count}개 생성 예정")

    # 리소스 로드
    prompt_template, rules = _load_resources()
    example = _load_flow_example()

    # 출력 디렉토리 준비
    machine_output_dir.mkdir(parents=True, exist_ok=True)
    human_output_dir.mkdir(parents=True, exist_ok=True)

    # FLOW 생성 (재시도 포함)
    flow = None
    for attempt in range(max_retries + 1):
        logger.info(f"FLOW 생성 시도 {attempt + 1}/{max_retries + 1}")
        prompt = _build_prompt(prompt_template, rules, example, prd, spec)

        try:
            response = call_llm(prompt, max_tokens=32768)
            flow = sanitize_doc(extract_json(response))

            # 스키마 검증
            valid, errors = validate_schema(flow, "flow")
            if not valid:
                error_summary = "; ".join(errors[:3])
                raise ValueError(f"스키마 검증 실패: {error_summary}")

            # flows 구조 검증
            flows = flow.get("flows", [])
            if not flows:
                raise ValueError("flows 배열이 비어있습니다.")

            # 각 flow에 start/end 노드 확인
            for fl in flows:
                node_types = {n.get("type") for n in fl.get("nodes", [])}
                if "start" not in node_types:
                    raise ValueError(f"flow {fl.get('flow_id')}: start 노드 없음")
                if "end" not in node_types:
                    raise ValueError(f"flow {fl.get('flow_id')}: end 노드 없음")
                if not fl.get("error_flows"):
                    raise ValueError(f"flow {fl.get('flow_id')}: error_flows 없음")

            logger.info(f"FLOW 검증 통과: {len(flows)}개 플로우 생성")
            break

        except (ValueError, json.JSONDecodeError) as e:
            if attempt < max_retries:
                logger.warning(f"FLOW 생성 실패: {e}. 재시도...")
            else:
                raise RuntimeError(f"FLOW 생성 최종 실패: {e}")

    # flow.json 저장
    flow_path = machine_output_dir / "flow.json"
    with open(flow_path, "w", encoding="utf-8") as f:
        json.dump(flow, f, ensure_ascii=False, indent=2)
    logger.info(f"flow.json 저장: {flow_path}")

    # 유저플로우.mermaid.md 저장
    mermaid_md = _generate_mermaid_md(flow)
    md_path = human_output_dir / "유저플로우.mermaid.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(mermaid_md)
    logger.info(f"유저플로우.mermaid.md 저장: {md_path}")

    # full_context.json 생성 & 저장
    with open(prd_path, encoding="utf-8") as f:
        prd_final = json.load(f)
    with open(spec_path, encoding="utf-8") as f:
        spec_final = json.load(f)

    full_context = _merge_full_context(prd_final, spec_final, flow)
    fc_path = machine_output_dir / "full_context.json"
    with open(fc_path, "w", encoding="utf-8") as f:
        json.dump(full_context, f, ensure_ascii=False, indent=2)
    logger.info(f"full_context.json 저장: {fc_path}")

    return flow
