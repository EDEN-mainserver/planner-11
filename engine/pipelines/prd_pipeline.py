# PRD 생성 파이프라인
# requirements.json → prd.json (machine) + PRD.md (human)
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


def _load_resources() -> Tuple[str, dict, dict]:
    """프롬프트, 규칙, 예시(압축) 로드"""
    prompt_path = PROJECT_ROOT / "engine" / "prompts" / "generate_prd.md"
    rules_path = PROJECT_ROOT / "engine" / "rules" / "prd_structure.yaml"

    with open(prompt_path, encoding="utf-8") as f:
        prompt_template = f.read()

    with open(rules_path, encoding="utf-8") as f:
        rules = yaml.safe_load(f)

    # 예시: 프롬프트 크기 절감을 위해 핵심 구조만 포함한 압축 버전 사용
    example = {
        "meta": {"project_id": "PRJ-2026-001", "title": "크몽 문의 자동 응대 시스템", "version": "1.0.0", "created_at": "2026-04-09T14:00:00+09:00", "status": "draft", "author": "정대표", "client": "A사", "tags": ["자동화", "CS"]},
        "overview": {"category": "고객관리/CS", "one_liner": "크몽 문의 자동 감지 및 맞춤 응대 시스템", "background": "하루 30건 문의, 수동 응대로 평균 응답 4시간 초과.", "problem": "반복 질문에 수동 응대, 응답 지연으로 전환율 저하.", "solution": "문의 자동 감지 → AI 분류 → 자동 응답 또는 담당자 알림.", "differentiator": "단순 자동응답이 아닌 AI가 맥락 파악 후 맞춤 응대."},
        "target_users": [{"role": "크몽 판매자", "description": "문의 응대에 하루 2시간 이상 소모", "goals": ["응답 시간 5분 이내", "반복 작업 제거"], "pain_points": ["같은 질문 반복 응답", "바쁠 때 문의 누락"]}],
        "scenarios": [
            {"id": "SC-001", "title": "가격 문의 자동 응대", "actor": "크몽 구매자", "precondition": "시스템 로그인 상태", "steps": [{"order": 1, "action": "구매자가 가격 문의 발송", "expected_result": "메시지 수신 감지"}, {"order": 2, "action": "AI 분류 → price_inquiry", "expected_result": "유형 분류 완료"}, {"order": 3, "action": "응답 생성 및 자동 발송", "expected_result": "구매자에게 응답 도달"}], "postcondition": "5분 이내 응답 완료"},
            {"id": "SC-002", "title": "커스텀 문의 → 담당자 알림", "actor": "크몽 구매자", "precondition": "시스템 로그인 상태", "steps": [{"order": 1, "action": "복잡한 문의 수신", "expected_result": "감지"}, {"order": 2, "action": "AI 분류 → custom_consultation", "expected_result": "담당자 알림"}], "postcondition": "담당자 30분 이내 응대"}
        ],
        "features": [
            {"id": "F-001", "title": "크몽 메시지 자동 감지", "description": "메시지함 주기적 모니터링", "priority": "critical", "acceptance_criteria": ["1분 이내 감지", "중복 처리 방지"], "linked_scenario_ids": ["SC-001", "SC-002"], "linked_spec_id": "SPEC-001"},
            {"id": "F-002", "title": "문의 유형 AI 분류", "description": "5개 이상 유형 자동 분류", "priority": "critical", "acceptance_criteria": ["정확도 90% 이상"], "linked_scenario_ids": ["SC-001", "SC-002"], "linked_spec_id": "SPEC-002"},
            {"id": "F-003", "title": "맞춤 응답 생성 및 발송", "description": "템플릿+AI 조합 응답", "priority": "critical", "acceptance_criteria": ["금칙어 필터 통과"], "linked_scenario_ids": ["SC-001"], "linked_spec_id": "SPEC-003"},
            {"id": "F-004", "title": "담당자 알림", "description": "슬랙 webhook 알림", "priority": "high", "acceptance_criteria": ["3분 이내 알림"], "linked_scenario_ids": ["SC-002"], "linked_spec_id": "SPEC-004"},
            {"id": "F-005", "title": "응대 로그 기록", "description": "구글 시트 자동 기록", "priority": "medium", "acceptance_criteria": ["날짜/유형/응답내용 기록"], "linked_scenario_ids": ["SC-001", "SC-002"], "linked_spec_id": "SPEC-005"}
        ],
        "automation_context": {
            "target_systems": [{"name": "크몽", "type": "web_app", "access_method": "browser_automation", "auth_required": True, "notes": "공식 API 없음. Playwright 필요."}, {"name": "Google Sheets", "type": "spreadsheet", "access_method": "api", "auth_required": True}, {"name": "슬랙", "type": "other", "access_method": "webhook", "auth_required": False}],
            "triggers": [{"id": "TRG-001", "event": "새 문의 수신", "source": "크몽 메시지함", "condition": "읽지 않은 메시지"}, {"id": "TRG-002", "event": "스케줄 체크", "source": "시스템 크론", "condition": "매 5분"}],
            "actions": [
                {"id": "ACT-001", "order": 1, "action_type": "scrape", "description": "크몽 메시지함 스크래핑", "target_system": "크몽", "input_fields": [{"name": "session_cookie", "type": "string", "required": True, "source": "auth_manager"}], "output_fields": [{"name": "message_id", "type": "string"}, {"name": "message_content", "type": "string"}, {"name": "sender_name", "type": "string"}, {"name": "received_at", "type": "date"}], "trigger_id": "TRG-002", "depends_on": []},
                {"id": "ACT-002", "order": 2, "action_type": "decision", "description": "AI 문의 유형 분류", "target_system": "LLM API", "input_fields": [{"name": "message_content", "type": "string", "required": True, "source": "ACT-001.output"}], "output_fields": [{"name": "inquiry_type", "type": "string"}, {"name": "confidence_score", "type": "number"}], "depends_on": ["ACT-001"]},
                {"id": "ACT-003", "order": 3, "action_type": "generate_content", "description": "맞춤 응답 생성", "target_system": "LLM API", "input_fields": [{"name": "inquiry_type", "type": "string", "required": True, "source": "ACT-002.output"}, {"name": "message_content", "type": "string", "required": True, "source": "ACT-001.output"}], "output_fields": [{"name": "response_message", "type": "string"}], "depends_on": ["ACT-002"]},
                {"id": "ACT-004", "order": 4, "action_type": "data_write", "description": "크몽 자동 발송", "target_system": "크몽", "input_fields": [{"name": "message_id", "type": "string", "required": True, "source": "ACT-001.output"}, {"name": "response_message", "type": "string", "required": True, "source": "ACT-003.output"}], "output_fields": [{"name": "sent_status", "type": "boolean"}, {"name": "sent_at", "type": "date"}], "depends_on": ["ACT-003"]},
                {"id": "ACT-005", "order": 5, "action_type": "notify", "description": "담당자 슬랙 알림", "target_system": "슬랙", "input_fields": [{"name": "inquiry_type", "type": "string", "required": True, "source": "ACT-002.output"}, {"name": "sender_name", "type": "string", "required": True, "source": "ACT-001.output"}], "output_fields": [{"name": "notification_sent", "type": "boolean"}], "depends_on": ["ACT-002"]},
                {"id": "ACT-006", "order": 6, "action_type": "data_write", "description": "구글 시트 로그", "target_system": "Google Sheets", "input_fields": [{"name": "message_id", "type": "string", "required": True, "source": "ACT-001.output"}, {"name": "inquiry_type", "type": "string", "required": True, "source": "ACT-002.output"}, {"name": "sent_status", "type": "boolean", "required": True, "source": "ACT-004.output"}], "output_fields": [{"name": "row_number", "type": "number"}], "depends_on": ["ACT-004"]}
            ],
            "error_handling": [{"error_type": "auth_failure", "target_action_id": "ACT-001", "handling": "retry", "retry_count": 3, "fallback_action": "재로그인 후 실패 시 알림"}, {"error_type": "timeout", "target_action_id": "ACT-001", "handling": "retry", "retry_count": 2, "fallback_action": "5분 후 재시도"}],
            "data_flow": [{"field_name": "문의내용", "type": "string", "source": "크몽(ACT-001)", "destination": "AI분류(ACT-002)→응답생성(ACT-003)"}, {"field_name": "문의유형", "type": "string", "source": "AI분류(ACT-002)", "destination": "응답생성(ACT-003)/알림(ACT-005)/로그(ACT-006)"}]
        },
        "success_criteria": {"definition_of_done": ["자동 감지 및 발송 정상 동작", "분류 정확도 90% 이상", "담당자 알림 정상 도달"], "kpis": [{"metric": "평균 응답 시간", "target": "5분 이내", "current_baseline": "4시간"}, {"metric": "자동 응대 비율", "target": "70% 이상", "current_baseline": "0%"}]},
        "constraints": {"technical_constraints": ["크몽 API 없음 → Playwright 필수", "세션 만료 2시간 주기"], "business_constraints": ["구축 2주 이내", "월 20만원 이내"]},
        "risks": [{"description": "크몽 UI 변경 시 스크래핑 로직 수정 필요", "impact": "high", "probability": "medium", "mitigation": "선택자 설정 파일 분리"}, {"description": "AI 부적절 응답 생성 가능성", "impact": "critical", "probability": "low", "mitigation": "금칙어 필터 + 길이 검증"}],
        "_links": {"spec_json": "./spec.json", "flow_json": "./flow.json", "full_context": "./full_context.json"}
    }

    return prompt_template, rules, example


def _build_prompt(
    prompt_template: str,
    rules: dict,
    example: dict,
    requirements: dict,
    project_id: str,
) -> str:
    """PRD 생성 프롬프트 구성"""
    now_kst = datetime.now(KST).isoformat()

    return f"""{prompt_template}

---

## 문서 뼈대 규칙 (prd_structure.yaml)

```yaml
{yaml.dump(rules, allow_unicode=True, default_flow_style=False)}
```

---

## 참고 예시 (크몽 프로젝트 — 동일 수준으로 생성할 것)

```json
{json.dumps(example, ensure_ascii=False, indent=2)}
```

---

## 이번 프로젝트 요구사항

```json
{json.dumps(requirements, ensure_ascii=False, indent=2)}
```

---

## 생성 지시

위 요구사항을 바탕으로 PRD JSON을 생성하세요.

필수 규칙:
1. project_id: "{project_id}", created_at: "{now_kst}" 사용
2. ID 패턴 엄수: F-001~F-NNN, SC-001~SC-NNN, TRG-001~TRG-NNN, ACT-001~ACT-NNN
3. features 각 항목에 linked_spec_id (SPEC-001, SPEC-002...) 반드시 포함
4. automation_context 완성 필수 (target_systems, triggers, actions, error_handling, data_flow)
5. actions의 depends_on은 선행 ACT ID 배열
6. 불확실한 기술 상세는 "TODO: [설명]"으로 명시
7. 문체: "~한다" 형식의 간결한 명세서 문체
8. JSON만 출력 (```json ... ``` 블록 사용)
"""


def _generate_prd_md(prd: dict) -> str:
    """prd.json → PRD.md 변환 (사람용)"""
    meta = prd.get("meta", {})
    overview = prd.get("overview", {})
    lines = []

    # 제목 & 메타 테이블
    lines.append(f"# {meta.get('title', '제목 없음')}\n")
    lines.append("| 항목 | 내용 |")
    lines.append("|---|---|")
    lines.append(f"| **프로젝트 ID** | {meta.get('project_id', '')} |")
    lines.append(f"| **버전** | {meta.get('version', '')} |")
    lines.append(f"| **상태** | {meta.get('status', '')} |")
    if meta.get("client"):
        lines.append(f"| **클라이언트** | {meta['client']} |")
    if meta.get("created_at"):
        date_str = meta["created_at"][:10]
        lines.append(f"| **날짜** | {date_str} |")
    lines.append("")
    lines.append("---\n")

    # 개요
    lines.append("## 개요\n")
    if overview.get("category"):
        lines.append(f"**카테고리:** {overview['category']}\n")
    if overview.get("one_liner"):
        lines.append(f"**한 줄 정의:** {overview['one_liner']}\n")
    if overview.get("background"):
        lines.append(f"### 배경\n{overview['background']}\n")
    if overview.get("problem"):
        lines.append(f"### 문제\n{overview['problem']}\n")
    if overview.get("solution"):
        lines.append(f"### 해결 방식\n{overview['solution']}\n")
    if overview.get("differentiator"):
        lines.append(f"### 차별점\n{overview['differentiator']}\n")
    lines.append("---\n")

    # 타겟 사용자
    target_users = prd.get("target_users", [])
    if target_users:
        lines.append("## 타겟 사용자\n")
        for user in target_users:
            lines.append(f"### {user.get('role', '')}")
            lines.append(f"{user.get('description', '')}\n")
            if user.get("goals"):
                lines.append("**목표:**")
                for g in user["goals"]:
                    lines.append(f"- {g}")
                lines.append("")
            if user.get("pain_points"):
                lines.append("**페인포인트:**")
                for p in user["pain_points"]:
                    lines.append(f"- {p}")
                lines.append("")
        lines.append("---\n")

    # 시나리오
    scenarios = prd.get("scenarios", [])
    if scenarios:
        lines.append("## 사용 시나리오\n")
        for sc in scenarios:
            actor = sc.get("actor", "")
            precond = sc.get("precondition", "")
            lines.append(f"### {sc.get('id', '')}: {sc.get('title', '')}")
            lines.append(f"**주체:** {actor} | **전제조건:** {precond}\n")
            for step in sc.get("steps", []):
                expected = step.get("expected_result", "")
                lines.append(f"{step.get('order', '')}. {step.get('action', '')}")
                if expected:
                    lines.append(f"   → 기대결과: {expected}")
            if sc.get("postcondition"):
                lines.append(f"\n**완료 후 상태:** {sc['postcondition']}")
            lines.append("")
        lines.append("---\n")

    # 주요 기능
    features = prd.get("features", [])
    if features:
        lines.append("## 주요 기능\n")
        lines.append("| ID | 기능명 | 우선순위 | 명세서 |")
        lines.append("|---|---|---|---|")
        for f in features:
            spec_id = f.get("linked_spec_id", "-")
            lines.append(f"| {f.get('id','')} | {f.get('title','')} | {f.get('priority','')} | {spec_id} |")
        lines.append("")
        lines.append("---\n")

    # 자동화 컨텍스트
    ac = prd.get("automation_context", {})
    if ac:
        lines.append("## 자동화 컨텍스트\n")

        systems = ac.get("target_systems", [])
        if systems:
            lines.append("### 대상 시스템\n")
            lines.append("| 시스템 | 유형 | 접근방식 | 인증 |")
            lines.append("|---|---|---|---|")
            for s in systems:
                auth = "필요" if s.get("auth_required") else "불필요"
                lines.append(f"| {s.get('name','')} | {s.get('type','')} | {s.get('access_method','')} | {auth} |")
            lines.append("")

        triggers = ac.get("triggers", [])
        if triggers:
            lines.append("### 트리거\n")
            for t in triggers:
                cond = f" — 조건: {t['condition']}" if t.get("condition") else ""
                lines.append(f"- **{t.get('id','')}**: {t.get('event','')} (소스: {t.get('source','')}){cond}")
            lines.append("")

        actions = ac.get("actions", [])
        if actions:
            lines.append("### 액션 체인\n")
            lines.append("| 순서 | ID | 유형 | 설명 | 대상 |")
            lines.append("|---|---|---|---|---|")
            for a in actions:
                desc = (a.get("description", "") or "")[:50] + ("..." if len(a.get("description","")) > 50 else "")
                lines.append(f"| {a.get('order','')} | {a.get('id','')} | {a.get('action_type','')} | {desc} | {a.get('target_system','')} |")
            lines.append("")

        lines.append("---\n")

    # 성공 기준
    sc_obj = prd.get("success_criteria", {})
    if sc_obj:
        lines.append("## 성공 기준\n")
        dod = sc_obj.get("definition_of_done", [])
        if dod:
            lines.append("### 완료 판단 기준")
            for d in dod:
                lines.append(f"- {d}")
            lines.append("")
        kpis = sc_obj.get("kpis", [])
        if kpis:
            lines.append("### KPI\n")
            lines.append("| 지표 | 목표 | 현재 |")
            lines.append("|---|---|---|")
            for k in kpis:
                baseline = k.get("current_baseline", "-")
                lines.append(f"| {k.get('metric','')} | {k.get('target','')} | {baseline} |")
            lines.append("")
        lines.append("---\n")

    # 제약 사항
    constraints = prd.get("constraints", {})
    if constraints:
        lines.append("## 제약 사항\n")
        for item in constraints.get("technical_constraints", []):
            lines.append(f"- {item}")
        for item in constraints.get("business_constraints", []):
            lines.append(f"- {item}")
        lines.append("")

    # 리스크
    risks = prd.get("risks", [])
    if risks:
        lines.append("## 리스크\n")
        lines.append("| 리스크 | 영향 | 확률 | 대응 |")
        lines.append("|---|---|---|---|")
        for r in risks:
            desc = (r.get("description", "") or "")[:50] + ("..." if len(r.get("description","")) > 50 else "")
            mit = (r.get("mitigation", "-") or "-")[:50] + ("..." if len(r.get("mitigation","-")) > 50 else "")
            lines.append(f"| {desc} | {r.get('impact','')} | {r.get('probability','')} | {mit} |")
        lines.append("")

    return "\n".join(lines)


def run_prd_pipeline(
    project_id: str,
    requirements_path: Path,
    machine_output_dir: Path,
    human_output_dir: Path,
    max_retries: int = 2,
) -> dict:
    """
    PRD 생성 파이프라인 메인 함수.

    Args:
        project_id: 프로젝트 ID (예: PRJ-2026-001)
        requirements_path: input/parsed/requirements.json 경로
        machine_output_dir: output/{id}/machine/ 경로
        human_output_dir: output/{id}/human/ 경로
        max_retries: 재시도 횟수

    Returns:
        생성된 prd dict
    """
    logger.info("=== [STEP 2] PRD 생성 시작 ===")

    # 요구사항 로드
    with open(requirements_path, encoding="utf-8") as f:
        requirements = json.load(f)
    logger.info(f"requirements.json 로드: {requirements.get('project_title', '')}")

    # 리소스 로드
    prompt_template, rules, example = _load_resources()

    # 출력 디렉토리 준비
    machine_output_dir.mkdir(parents=True, exist_ok=True)
    human_output_dir.mkdir(parents=True, exist_ok=True)

    # PRD 생성 (재시도 포함)
    prd = None
    for attempt in range(max_retries + 1):
        logger.info(f"PRD 생성 시도 {attempt + 1}/{max_retries + 1}")
        prompt = _build_prompt(prompt_template, rules, example, requirements, project_id)

        try:
            response = call_llm(prompt, max_tokens=32768)
            prd = sanitize_doc(extract_json(response))

            # 스키마 검증
            valid, errors = validate_schema(prd, "prd")
            if not valid:
                error_summary = "; ".join(errors[:3])
                raise ValueError(f"스키마 검증 실패: {error_summary}")

            # 필수 구조 검증
            if not prd.get("features"):
                raise ValueError("features 배열이 비어있습니다.")
            if not prd.get("automation_context", {}).get("actions"):
                raise ValueError("automation_context.actions가 비어있습니다.")

            logger.info(f"PRD 검증 통과: 기능 {len(prd['features'])}개, 액션 {len(prd['automation_context']['actions'])}개")
            break

        except (ValueError, json.JSONDecodeError) as e:
            if attempt < max_retries:
                logger.warning(f"PRD 생성 실패: {e}. 재시도...")
            else:
                raise RuntimeError(f"PRD 생성 최종 실패: {e}")

    # prd.json 저장
    prd_path = machine_output_dir / "prd.json"
    with open(prd_path, "w", encoding="utf-8") as f:
        json.dump(prd, f, ensure_ascii=False, indent=2)
    logger.info(f"prd.json 저장: {prd_path}")

    # PRD.md 저장
    prd_md = _generate_prd_md(prd)
    md_path = human_output_dir / "PRD.md"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(prd_md)
    logger.info(f"PRD.md 저장: {md_path}")

    return prd
