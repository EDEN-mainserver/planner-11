# 스키마 검증 + ID 정합성 크로스체크 모듈
import json
import logging
from pathlib import Path
from typing import Tuple, List, Dict, Any

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

try:
    import jsonschema
    from jsonschema import Draft7Validator
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent.parent
SCHEMA_DIR = PROJECT_ROOT / "templates" / "_schema"

# 스키마 캐시
_schema_cache: Dict[str, dict] = {}


def _load_schema(schema_name: str) -> dict:
    """JSON 스키마 로드 (캐시 적용)"""
    if schema_name not in _schema_cache:
        schema_path = SCHEMA_DIR / f"{schema_name}.schema.json"
        if not schema_path.exists():
            raise FileNotFoundError(f"스키마 파일 없음: {schema_path}")
        with open(schema_path, encoding="utf-8") as f:
            _schema_cache[schema_name] = json.load(f)
    return _schema_cache[schema_name]


def validate_schema(data: dict, schema_name: str) -> Tuple[bool, List[str]]:
    """
    JSON 스키마 검증.

    Args:
        data: 검증할 데이터
        schema_name: 스키마명 ("prd", "spec", "flow")

    Returns:
        (valid: bool, errors: list of error messages)
    """
    schema = _load_schema(schema_name)

    if not HAS_JSONSCHEMA:
        # jsonschema 미설치 시 기본 필수 필드 검증만 수행
        logger.warning("jsonschema 미설치. 기본 필수 필드 검증만 수행합니다.")
        return _basic_validate(data, schema)

    errors = []
    try:
        validator = Draft7Validator(schema)
        for error in validator.iter_errors(data):
            path = " > ".join(str(p) for p in error.absolute_path)
            msg = f"[{path}] {error.message}" if path else error.message
            errors.append(msg)
    except Exception as e:
        errors.append(f"검증 오류: {e}")

    return len(errors) == 0, errors


def _basic_validate(data: dict, schema: dict) -> Tuple[bool, List[str]]:
    """jsonschema 없을 때 기본 필수 필드 검증"""
    errors = []
    required = schema.get("required", [])
    for field in required:
        if field not in data or data[field] is None:
            errors.append(f"필수 필드 누락: {field}")
    return len(errors) == 0, errors


def check_id_integrity(prd: dict, spec: dict, flow: dict) -> Tuple[bool, List[str]]:
    """
    PRD ↔ SPEC ↔ FLOW 간 ID 정합성 크로스체크.

    검증 항목:
    - PRD.features[].id ↔ SPEC.specs[].linked_feature_id
    - PRD.features[].linked_spec_id ↔ SPEC.specs[].spec_id
    - PRD.scenarios[].id ↔ FLOW.flows[].linked_scenario_id
    - PRD.automation_context.actions[].id ↔ FLOW.nodes[].linked_action_id
    - SPEC.specs[].spec_id ↔ FLOW.nodes[].linked_spec_id

    Returns:
        (valid: bool, issues: list of issue messages)
    """
    issues = []

    # --- PRD 데이터 수집 ---
    prd_feature_ids = {f["id"] for f in prd.get("features", []) if f.get("id")}
    prd_feature_spec_map = {
        f["id"]: f.get("linked_spec_id")
        for f in prd.get("features", [])
        if f.get("id")
    }
    prd_scenario_ids = {sc["id"] for sc in prd.get("scenarios", []) if sc.get("id")}
    prd_action_ids = {
        a["id"]
        for a in prd.get("automation_context", {}).get("actions", [])
        if a.get("id")
    }

    # --- SPEC 데이터 수집 ---
    spec_spec_ids = {s["spec_id"] for s in spec.get("specs", []) if s.get("spec_id")}
    spec_linked_feature_ids = {
        s["linked_feature_id"]
        for s in spec.get("specs", [])
        if s.get("linked_feature_id")
    }

    # --- FLOW 데이터 수집 ---
    flow_scenario_ids = set()
    flow_spec_ids = set()
    flow_action_ids = set()

    for fl in flow.get("flows", []):
        if fl.get("linked_scenario_id"):
            flow_scenario_ids.add(fl["linked_scenario_id"])
        for node in fl.get("nodes", []):
            if node.get("linked_spec_id"):
                flow_spec_ids.add(node["linked_spec_id"])
            if node.get("linked_action_id"):
                flow_action_ids.add(node["linked_action_id"])

    # === 체크 1: PRD feature.id → SPEC.linked_feature_id ===
    spec_unlinked_features = prd_feature_ids - spec_linked_feature_ids
    if spec_unlinked_features:
        issues.append(
            f"[PRD→SPEC] SPEC에서 참조하지 않는 PRD feature ID: {sorted(spec_unlinked_features)}"
        )

    extra_spec_features = spec_linked_feature_ids - prd_feature_ids
    if extra_spec_features:
        issues.append(
            f"[SPEC→PRD] PRD에 없는 feature ID를 SPEC이 참조: {sorted(extra_spec_features)}"
        )

    # === 체크 2: PRD feature.linked_spec_id → SPEC.spec_id ===
    for feat_id, linked_spec_id in prd_feature_map_items(prd):
        if linked_spec_id and linked_spec_id not in spec_spec_ids:
            issues.append(
                f"[PRD feature {feat_id}] linked_spec_id '{linked_spec_id}'가 SPEC에 없음"
            )

    # === 체크 3: PRD scenario.id → FLOW.linked_scenario_id ===
    unlinked_scenarios = prd_scenario_ids - flow_scenario_ids
    if unlinked_scenarios:
        issues.append(
            f"[PRD→FLOW] FLOW에서 참조하지 않는 시나리오 ID: {sorted(unlinked_scenarios)}"
        )

    extra_flow_scenarios = flow_scenario_ids - prd_scenario_ids
    if extra_flow_scenarios:
        issues.append(
            f"[FLOW→PRD] PRD에 없는 시나리오 ID를 FLOW가 참조: {sorted(extra_flow_scenarios)}"
        )

    # === 체크 4: FLOW.nodes.linked_action_id → PRD.actions.id ===
    invalid_action_refs = flow_action_ids - prd_action_ids
    if invalid_action_refs:
        # TRG-XXX는 action이 아닌 trigger이므로 필터링
        non_trg_invalid = {id_ for id_ in invalid_action_refs if not id_.startswith("TRG-")}
        if non_trg_invalid:
            issues.append(
                f"[FLOW→PRD] PRD action에 없는 ID를 FLOW 노드가 참조: {sorted(non_trg_invalid)}"
            )

    # === 체크 5: FLOW.nodes.linked_spec_id → SPEC.specs.spec_id ===
    invalid_spec_refs = flow_spec_ids - spec_spec_ids
    if invalid_spec_refs:
        issues.append(
            f"[FLOW→SPEC] SPEC에 없는 spec_id를 FLOW 노드가 참조: {sorted(invalid_spec_refs)}"
        )

    valid = len(issues) == 0
    return valid, issues


def prd_feature_map_items(prd: dict):
    """PRD features의 (id, linked_spec_id) 튜플 반복자"""
    for f in prd.get("features", []):
        yield f.get("id", ""), f.get("linked_spec_id")


def calculate_quality_score(prd: dict, spec: dict, flow: dict) -> float:
    """
    문서 품질 점수 계산 (0.0 ~ 1.0).

    배점:
    - 필수 필드 충족률 (40%)
    - automation_context 완성도 (30%)
    - ID 참조 정합성 (20%)
    - 내용 구체성 — TODO 최소화 (10%)
    """
    scores = {}

    # --- 1. 필수 필드 충족률 (40%) ---
    required_checks = [
        bool(prd.get("meta", {}).get("project_id")),
        bool(prd.get("overview", {}).get("one_liner")),
        bool(prd.get("target_users")),
        bool(prd.get("features")),
        bool(prd.get("success_criteria")),
        bool(spec.get("specs")),
        bool(flow.get("flows")),
        all(s.get("technical_detail", {}).get("approach") for s in spec.get("specs", [])),
        all(s.get("acceptance_criteria") for s in spec.get("specs", [])),
        all(s.get("error_cases") for s in spec.get("specs", [])),
    ]
    scores["required_fields"] = sum(required_checks) / len(required_checks) * 0.40

    # --- 2. automation_context 완성도 (30%) ---
    ac = prd.get("automation_context", {})
    ac_checks = [
        bool(ac.get("target_systems")),
        bool(ac.get("triggers")),
        bool(ac.get("actions")),
        bool(ac.get("error_handling")),
        bool(ac.get("data_flow")),
        len(ac.get("actions", [])) >= 2,
        all(a.get("input_fields") for a in ac.get("actions", [])),
        all(a.get("output_fields") for a in ac.get("actions", [])),
    ]
    scores["automation_context"] = sum(ac_checks) / len(ac_checks) * 0.30

    # --- 3. ID 참조 정합성 (20%) ---
    _, id_issues = check_id_integrity(prd, spec, flow)
    id_score = 1.0 if not id_issues else max(0.0, 1.0 - len(id_issues) * 0.2)
    scores["id_integrity"] = id_score * 0.20

    # --- 4. 내용 구체성 — TODO 비율 (10%) ---
    full_text = json.dumps({"prd": prd, "spec": spec, "flow": flow}, ensure_ascii=False)
    todo_count = full_text.lower().count("todo")
    total_fields = full_text.count('"')  # 대략적인 필드 수 추정
    todo_ratio = todo_count / max(1, total_fields / 10)  # 정규화
    concreteness_score = max(0.0, 1.0 - todo_ratio)
    scores["concreteness"] = concreteness_score * 0.10

    total = sum(scores.values())

    logger.info("품질 점수 상세:")
    logger.info(f"  필수 필드 충족률:       {scores['required_fields']:.3f} / 0.400")
    logger.info(f"  automation_context:     {scores['automation_context']:.3f} / 0.300")
    logger.info(f"  ID 참조 정합성:         {scores['id_integrity']:.3f} / 0.200")
    logger.info(f"  내용 구체성 (TODO↓):   {scores['concreteness']:.3f} / 0.100")
    logger.info(f"  합계:                   {total:.3f} / 1.000")

    return round(total, 3)


def count_todos(prd: dict, spec: dict, flow: dict) -> int:
    """TODO 항목 개수 반환"""
    full_text = json.dumps({"prd": prd, "spec": spec, "flow": flow}, ensure_ascii=False)
    return full_text.count("TODO")


def validate_all(
    prd: dict,
    spec: dict,
    flow: dict,
) -> Dict[str, Any]:
    """
    전체 검증 수행.

    Returns:
        검증 결과 딕셔너리 (metadata.json에 저장됨)
    """
    logger.info("=== [STEP 5] 전체 검증 시작 ===")

    # 스키마 검증
    prd_valid, prd_errors = validate_schema(prd, "prd")
    spec_valid, spec_errors = validate_schema(spec, "spec")
    flow_valid, flow_errors = validate_schema(flow, "flow")

    # ID 정합성 검증
    id_ok, id_issues = check_id_integrity(prd, spec, flow)

    # 품질 점수
    quality = calculate_quality_score(prd, spec, flow)
    todo_count = count_todos(prd, spec, flow)

    config_threshold = 0.8
    try:
        import yaml
        config_path = PROJECT_ROOT / "engine" / "config.yaml"
        with open(config_path, encoding="utf-8") as f:
            cfg = yaml.safe_load(f)
        config_threshold = cfg.get("validation", {}).get("quality_threshold", 0.8)
    except Exception:
        pass

    result = {
        "prd_schema_pass": prd_valid,
        "spec_schema_pass": spec_valid,
        "flow_schema_pass": flow_valid,
        "id_integrity": id_ok,
        "quality_score": quality,
        "quality_pass": quality >= config_threshold,
        "todo_count": todo_count,
        "schema_errors": {
            "prd": prd_errors[:5],
            "spec": spec_errors[:5],
            "flow": flow_errors[:5],
        },
        "id_issues": id_issues[:10],
    }

    # 로그 출력
    logger.info(f"PRD 스키마:    {'✓ 통과' if prd_valid else '✗ 실패'} ({len(prd_errors)}개 오류)")
    logger.info(f"SPEC 스키마:   {'✓ 통과' if spec_valid else '✗ 실패'} ({len(spec_errors)}개 오류)")
    logger.info(f"FLOW 스키마:   {'✓ 통과' if flow_valid else '✗ 실패'} ({len(flow_errors)}개 오류)")
    logger.info(f"ID 정합성:     {'✓ 통과' if id_ok else f'✗ {len(id_issues)}개 이슈'}")
    logger.info(f"품질 점수:     {quality:.3f} ({'✓ 통과' if quality >= config_threshold else '✗ 권고 미달'})")
    logger.info(f"TODO 항목:     {todo_count}개")

    if not id_ok:
        for issue in id_issues:
            logger.warning(f"   ID 이슈: {issue}")

    return result
