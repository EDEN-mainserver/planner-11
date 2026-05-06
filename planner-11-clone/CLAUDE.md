# CLAUDE.md — PlanForge 프로젝트 전역 지시문

## 프로젝트 정체성

PlanForge는 클라이언트 요구사항을 입력받아 PRD/기능명세서/유저플로우 3종을 자동 생성하는 **내부 도구**다.
운영자는 정대표 1인이며, 생성된 문서는 에덴 에이전트(Eden Agent)에 투입되어 AX 워크플로우 자동화를 구축하는 데 사용된다.

**핵심 공식:**
```
클라이언트 요구사항 → PlanForge → 구조화된 기획 문서 3종 → 에덴 에이전트 → 자동화 구축
```

## 기술 스택

- **언어**: Python 3.12+
- **LLM**: Claude API (주력), GPT API (폴백)
- **생성 방식**: 하이브리드 — 룰 기반(YAML) 구조 생성 + LLM 내용 채우기
- **검증**: JSON Schema 기반 (`templates/_schema/*.schema.json`)
- **데이터 저장**: JSON 파일 기반 (v1), DB 마이그레이션은 v2
- **버전 관리**: Git
- **UI**: CLI (v1), 웹 UI는 v2

## 폴더 구조 규칙

```
planforge/
├── agents/          # AI 에이전트 프롬프트 및 인격 정의
├── input/           # 클라이언트 요구사항 (raw → parsed)
│   ├── raw/         # 원본 (절대 수정 금지)
│   └── parsed/      # AI가 구조화한 requirements.json
├── engine/          # 핵심 생성 엔진
│   ├── rules/       # YAML 룰 (문서 뼈대 정의)
│   ├── prompts/     # LLM 프롬프트 템플릿
│   ├── pipelines/   # 생성 파이프라인 코드
│   └── validators/  # 스키마 검증 코드
├── templates/       # 표준 템플릿 + JSON 스키마
│   └── _schema/     # prd.schema.json, spec.schema.json, flow.schema.json
├── output/          # 생성 결과물 (프로젝트별)
│   └── [project_id]/
│       ├── human/   # 사람용 (MD, PDF, Mermaid)
│       └── machine/ # AI용 (JSON) ← 에덴 에이전트가 소비
├── memory/          # 프로젝트 메모리 (append only)
├── scripts/         # 유틸리티
├── web/             # v2 웹 UI (지금은 비어있음)
└── tests/           # 테스트
```

## 코딩 규칙

### 필수 준수
- 모든 JSON 출력은 `templates/_schema/*.schema.json`을 **100% 준수**할 것
- 한국어 주석 필수, 변수명/함수명은 영어 snake_case
- 파일 인코딩: UTF-8
- output/ 내 human/과 machine/은 **항상 동시 생성**할 것 (하나만 만들지 말 것)
- 에러 발생 시 자동 재시도(최대 2회) 후 실패하면 명확한 에러 메시지 출력
- 파이프라인 실행 결과는 항상 로그로 기록

### ID 패턴 규칙
| 대상 | 패턴 | 예시 |
|---|---|---|
| 프로젝트 | `PRJ-YYYY-NNN` | PRJ-2026-001 |
| 시나리오 | `SC-NNN` | SC-001 |
| 기능 | `F-NNN` | F-001 |
| 명세 | `SPEC-NNN` | SPEC-001 |
| 플로우 | `FLOW-NNN` | FLOW-001 |
| 노드 | `N-NNN` | N-001 |
| 트리거 | `TRG-NNN` | TRG-001 |
| 액션 | `ACT-NNN` | ACT-001 |

### ID 연결 규칙 (정합성)
```
PRD.features[].id (F-001) ←→ SPEC.specs[].linked_feature_id (F-001)
PRD.features[].linked_spec_id (SPEC-001) ←→ SPEC.specs[].spec_id (SPEC-001)
PRD.scenarios[].id (SC-001) ←→ FLOW.flows[].linked_scenario_id (SC-001)
PRD.automation_context.actions[].id (ACT-001) ←→ FLOW.nodes[].linked_action_id (ACT-001)
SPEC.specs[].spec_id (SPEC-001) ←→ FLOW.nodes[].linked_spec_id (SPEC-001)
```

## 절대 금지

- ❌ `input/raw/`의 파일을 수정하거나 삭제하지 말 것 (원본 보존)
- ❌ `memory/`의 파일을 삭제하지 말 것 (append only, 덮어쓰기 금지)
- ❌ `templates/_schema/*.schema.json`의 스키마를 임의로 변경하지 말 것 (변경 시 반드시 확인 요청)
- ❌ human/ 없이 machine/만 생성하거나, 그 반대로 하지 말 것
- ❌ ID 패턴을 임의로 바꾸지 말 것 (정합성 깨짐)
- ❌ LLM API 키를 코드에 하드코딩하지 말 것 (.env 사용)

## 파이프라인 실행 순서

```
1. input/raw/ → [parse] → input/parsed/requirements.json
2. requirements.json → [validate] → 통과/실패
3. requirements.json → [prd_pipeline] → output/machine/prd.json + output/human/PRD.md
4. prd.json → [validate] → 통과/실패
5. prd.json → [spec_pipeline] → output/machine/spec.json + output/human/기능명세서.md
6. spec.json → [validate] → 통과/실패
7. prd.json + spec.json → [flow_pipeline] → output/machine/flow.json + output/human/유저플로우.mermaid
8. flow.json → [validate] → 통과/실패
9. prd.json + spec.json + flow.json → [merge] → output/machine/full_context.json
10. 프로젝트 메모리 → memory/projects/[project_id]/
```

## 참고 문서

- `agents/AGENT.md` — 에이전트 행동 규칙
- `agents/SOUL.md` — 에이전트 인격 및 판단 기준
- `planforge_v1_기능명세서.md` — v1 기능 상세
- `prd_example_kmong.json` — 크몽 자동 응대 PRD 예시
