"""
PlanForge 메인 파이프라인 실행 스크립트

사용법:
    python scripts/run_pipeline.py --project PRJ-2026-001
    python scripts/run_pipeline.py --project PRJ-2026-001 --raw-file 요구사항.txt
    python scripts/run_pipeline.py --project PRJ-2026-001 --skip-parse

의존 패키지:
    pip install anthropic openai jsonschema pyyaml python-dotenv
"""
import argparse
import json
import logging
import sys
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path

# 프로젝트 루트를 Python path에 추가
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

# .env 로드
try:
    from dotenv import load_dotenv
    load_dotenv(PROJECT_ROOT / ".env")
except ImportError:
    pass  # python-dotenv 미설치 시 환경변수는 OS 레벨에서 설정

# 파이프라인 모듈
from engine.pipelines.parse_requirements import parse_requirements
from engine.pipelines.prd_pipeline import run_prd_pipeline
from engine.pipelines.spec_pipeline import run_spec_pipeline
from engine.pipelines.flow_pipeline import run_flow_pipeline
from engine.validators.schema_validator import validate_all
from engine.llm_client import load_config

KST = timezone(timedelta(hours=9))


def setup_logging(verbose: bool = False) -> None:
    """로깅 설정"""
    level = logging.DEBUG if verbose else logging.INFO
    fmt = "%(asctime)s [%(levelname)s] %(message)s"
    datefmt = "%Y-%m-%d %H:%M:%S"
    logging.basicConfig(level=level, format=fmt, datefmt=datefmt)
    # 외부 라이브러리 로그 레벨 낮춤
    logging.getLogger("anthropic").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("openai").setLevel(logging.WARNING)


def parse_args() -> argparse.Namespace:
    """CLI 인자 파싱"""
    parser = argparse.ArgumentParser(
        description="PlanForge: 클라이언트 요구사항 → PRD/SPEC/FLOW 3종 문서 자동 생성",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--project",
        required=True,
        help="프로젝트 ID (예: PRJ-2026-001)",
    )
    parser.add_argument(
        "--raw-file",
        default=None,
        help="input/raw/ 내 특정 파일 지정 (없으면 전체 읽음)",
    )
    parser.add_argument(
        "--skip-parse",
        action="store_true",
        help="이미 input/parsed/requirements.json이 있으면 파싱 단계 건너뜀",
    )
    parser.add_argument(
        "--skip-prd",
        action="store_true",
        help="이미 prd.json이 있으면 PRD 생성 건너뜀",
    )
    parser.add_argument(
        "--skip-spec",
        action="store_true",
        help="이미 spec.json이 있으면 SPEC 생성 건너뜀",
    )
    parser.add_argument(
        "--skip-flow",
        action="store_true",
        help="이미 flow.json이 있으면 FLOW 생성 건너뜀",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="디버그 로그 출력",
    )
    return parser.parse_args()


def get_paths(project_id: str) -> dict:
    """프로젝트 경로 딕셔너리 반환"""
    return {
        "raw_dir": PROJECT_ROOT / "input" / "raw",
        "parsed_dir": PROJECT_ROOT / "input" / "parsed",
        "requirements_json": PROJECT_ROOT / "input" / "parsed" / "requirements.json",
        "machine_dir": PROJECT_ROOT / "output" / project_id / "machine",
        "human_dir": PROJECT_ROOT / "output" / project_id / "human",
        "prd_json": PROJECT_ROOT / "output" / project_id / "machine" / "prd.json",
        "spec_json": PROJECT_ROOT / "output" / project_id / "machine" / "spec.json",
        "flow_json": PROJECT_ROOT / "output" / project_id / "machine" / "flow.json",
        "metadata_json": PROJECT_ROOT / "output" / project_id / "metadata.json",
    }


def save_metadata(
    project_id: str,
    prd: dict,
    validation_result: dict,
    paths: dict,
    pipeline_start: float,
) -> None:
    """metadata.json 저장"""
    config = load_config()
    elapsed = round(time.time() - pipeline_start, 1)
    now_kst = datetime.now(KST).isoformat()

    metadata = {
        "project_id": project_id,
        "title": prd.get("meta", {}).get("title", ""),
        "generated_at": now_kst,
        "prd_version": prd.get("meta", {}).get("version", ""),
        "llm_model": config["llm"]["primary"]["model"],
        "quality_scores": {
            "prd_schema_pass": validation_result.get("prd_schema_pass", False),
            "spec_schema_pass": validation_result.get("spec_schema_pass", False),
            "flow_schema_pass": validation_result.get("flow_schema_pass", False),
            "id_integrity": validation_result.get("id_integrity", False),
            "quality_score": validation_result.get("quality_score", 0.0),
            "todo_count": validation_result.get("todo_count", 0),
        },
        "schema_errors": validation_result.get("schema_errors", {}),
        "id_issues": validation_result.get("id_issues", []),
        "generation_time_sec": elapsed,
        "manual_edit_ratio": 0.0,
    }

    # 출력 디렉토리 상위에 저장 (output/PRJ-XXXX/metadata.json)
    meta_dir = paths["machine_dir"].parent
    meta_dir.mkdir(parents=True, exist_ok=True)
    with open(paths["metadata_json"], "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False, indent=2)

    logger = logging.getLogger(__name__)
    logger.info(f"metadata.json 저장: {paths['metadata_json']}")
    return metadata


def print_summary(project_id: str, metadata: dict, paths: dict) -> None:
    """파이프라인 완료 요약 출력"""
    q = metadata["quality_scores"]
    schema_ok = all([q["prd_schema_pass"], q["spec_schema_pass"], q["flow_schema_pass"]])
    quality_score = q["quality_score"]

    print("\n" + "=" * 60)
    print(f"  PlanForge 생성 완료: {project_id}")
    print("=" * 60)
    print(f"  제목:          {metadata.get('title', '')}")
    print(f"  LLM 모델:      {metadata.get('llm_model', '')}")
    print(f"  소요 시간:     {metadata.get('generation_time_sec', 0)}초")
    print()
    print(f"  스키마 검증:   {'[OK] 전체 통과' if schema_ok else '[NG] 일부 실패'}")
    print(f"  ID 정합성:     {'[OK] 통과' if q['id_integrity'] else '[NG] 이슈 있음'}")
    print(f"  품질 점수:     {quality_score:.3f} {'[OK]' if quality_score >= 0.8 else '[!!] 0.8 미달'}")
    print(f"  TODO 항목:     {q['todo_count']}개 (수동 확인 필요)")
    print()
    print("  생성 파일:")
    machine_dir = paths["machine_dir"]
    human_dir = paths["human_dir"]
    for fname in ["prd.json", "spec.json", "flow.json", "full_context.json"]:
        p = machine_dir / fname
        size = f"({p.stat().st_size // 1024}KB)" if p.exists() else "(없음)"
        print(f"    machine/{fname} {size}")
    for fname in ["PRD.md", "기능명세서.md", "유저플로우.mermaid.md"]:
        p = human_dir / fname
        size = f"({p.stat().st_size // 1024}KB)" if p.exists() else "(없음)"
        print(f"    human/{fname} {size}")
    print("=" * 60 + "\n")


def update_memory(project_id: str, metadata: dict) -> None:
    """memory/projects/{project_id}/ 에 생성 이력 기록 (append only)"""
    logger = logging.getLogger(__name__)
    mem_dir = PROJECT_ROOT / "memory" / "projects" / project_id
    mem_dir.mkdir(parents=True, exist_ok=True)

    log_path = mem_dir / "generation_log.md"
    now_kst = datetime.now(KST).strftime("%Y-%m-%d %H:%M:%S")
    q = metadata["quality_scores"]

    log_entry = (
        f"\n## {now_kst}\n"
        f"- 모델: {metadata.get('llm_model', '')}\n"
        f"- 품질 점수: {q.get('quality_score', 0):.3f}\n"
        f"- TODO 수: {q.get('todo_count', 0)}개\n"
        f"- 스키마: PRD={'✓' if q['prd_schema_pass'] else '✗'} "
        f"SPEC={'✓' if q['spec_schema_pass'] else '✗'} "
        f"FLOW={'✓' if q['flow_schema_pass'] else '✗'}\n"
        f"- ID 정합성: {'✓' if q['id_integrity'] else '✗'}\n"
    )

    with open(log_path, "a", encoding="utf-8") as f:
        f.write(log_entry)

    logger.info(f"생성 이력 기록: {log_path}")


def main() -> None:
    args = parse_args()
    setup_logging(args.verbose)
    logger = logging.getLogger(__name__)

    project_id = args.project
    paths = get_paths(project_id)
    pipeline_start = time.time()

    logger.info("=" * 60)
    logger.info(f"PlanForge 파이프라인 시작: {project_id}")
    logger.info("=" * 60)

    # ─── STEP 1: 요구사항 파싱 ───────────────────────────────
    requirements_path = paths["requirements_json"]
    if args.skip_parse and requirements_path.exists():
        logger.info("[STEP 1] 건너뜀 (--skip-parse, 기존 파일 사용)")
        with open(requirements_path, encoding="utf-8") as f:
            requirements = json.load(f)
    else:
        t0 = time.time()
        requirements = parse_requirements(
            raw_dir=paths["raw_dir"],
            output_path=requirements_path,
            target_file=args.raw_file,
        )
        logger.info(f"[STEP 1] 완료 ({time.time() - t0:.1f}초)")

    # ─── STEP 2: PRD 생성 ────────────────────────────────────
    prd_path = paths["prd_json"]
    if args.skip_prd and prd_path.exists():
        logger.info("[STEP 2] 건너뜀 (--skip-prd, 기존 파일 사용)")
        with open(prd_path, encoding="utf-8") as f:
            prd = json.load(f)
    else:
        t0 = time.time()
        prd = run_prd_pipeline(
            project_id=project_id,
            requirements_path=requirements_path,
            machine_output_dir=paths["machine_dir"],
            human_output_dir=paths["human_dir"],
        )
        logger.info(f"[STEP 2] 완료 ({time.time() - t0:.1f}초)")

    # ─── STEP 3: 기능명세서 생성 ──────────────────────────────
    spec_path = paths["spec_json"]
    if args.skip_spec and spec_path.exists():
        logger.info("[STEP 3] 건너뜀 (--skip-spec, 기존 파일 사용)")
        with open(spec_path, encoding="utf-8") as f:
            spec = json.load(f)
    else:
        t0 = time.time()
        spec = run_spec_pipeline(
            project_id=project_id,
            prd_path=prd_path,
            machine_output_dir=paths["machine_dir"],
            human_output_dir=paths["human_dir"],
        )
        logger.info(f"[STEP 3] 완료 ({time.time() - t0:.1f}초)")

    # ─── STEP 4: 유저플로우 생성 ──────────────────────────────
    flow_path = paths["flow_json"]
    if args.skip_flow and flow_path.exists():
        logger.info("[STEP 4] 건너뜀 (--skip-flow, 기존 파일 사용)")
        with open(flow_path, encoding="utf-8") as f:
            flow = json.load(f)
    else:
        t0 = time.time()
        flow = run_flow_pipeline(
            project_id=project_id,
            prd_path=prd_path,
            spec_path=spec_path,
            machine_output_dir=paths["machine_dir"],
            human_output_dir=paths["human_dir"],
        )
        logger.info(f"[STEP 4] 완료 ({time.time() - t0:.1f}초)")

    # ─── STEP 5: 전체 검증 ───────────────────────────────────
    t0 = time.time()
    validation_result = validate_all(prd, spec, flow)
    logger.info(f"[STEP 5] 완료 ({time.time() - t0:.1f}초)")

    # ─── STEP 6: metadata.json + memory 기록 ─────────────────
    metadata = save_metadata(project_id, prd, validation_result, paths, pipeline_start)
    update_memory(project_id, metadata)

    # 최종 요약
    print_summary(project_id, metadata, paths)

    # 품질 미달 시 경고
    if not validation_result.get("quality_pass"):
        logger.warning(
            f"⚠️  품질 점수({validation_result.get('quality_score', 0):.3f})가 "
            f"기준(0.8) 미달입니다. 문서 검토 후 수동 보완을 권장합니다."
        )

    # ID 이슈 있으면 상세 출력
    id_issues = validation_result.get("id_issues", [])
    if id_issues:
        logger.warning("⚠️  ID 정합성 이슈:")
        for issue in id_issues:
            logger.warning(f"   {issue}")

    logger.info("파이프라인 완료.")


if __name__ == "__main__":
    main()
