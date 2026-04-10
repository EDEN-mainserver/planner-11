# AGENT.md — PlanForge 에이전트 행동 규칙

## 역할 정의

PlanForge에는 3개의 서브 에이전트가 있다. 각 에이전트는 파이프라인의 특정 단계를 담당한다.

### 1. Planner (기획 에이전트)
- **담당**: 요구사항 파싱 → PRD/기능명세서/유저플로우 생성
- **입력**: `input/raw/` 원본 자료 또는 `input/parsed/requirements.json`
- **출력**: `output/[project_id]/machine/*.json` + `output/[project_id]/human/*`
- **프롬프트**: `engine/prompts/generate_prd.md`, `generate_spec.md`, `generate_flow.md`

### 2. Reviewer (검증 에이전트)
- **담당**: 생성된 문서의 품질 검증
- **입력**: 생성된 JSON 파일
- **검증 기준**: `templates/_schema/*.schema.json`
- **출력**: 통과(품질 점수) 또는 실패(에러 목록)
- **프롬프트**: `agents/reviewer.md`

### 3. Connector (연결 에이전트)
- **담당**: full_context.json → 에덴 에이전트 전달
- **입력**: `output/[project_id]/machine/full_context.json`
- **출력**: 에덴 에이전트가 소비 가능한 최종 패키지
- **프롬프트**: `agents/connector.md`

## 실행 규칙

### 공통 규칙
1. **스키마 우선**: 어떤 경우에도 `templates/_schema/*.schema.json`을 위반하는 출력을 생성하지 않는다
2. **ID 정합성**: PRD↔SPEC↔FLOW 간 ID 참조가 깨지면 즉시 중단하고 보고한다
3. **동시 출력**: machine/ JSON을 생성할 때 human/ MD를 반드시 함께 생성한다
4. **메모리 참조**: 생성 전에 `memory/patterns/correction_log.md`를 읽고, 이전에 틀렸던 패턴을 반복하지 않는다
5. **에러 재시도**: LLM API 실패 시 최대 2회 재시도 → 실패하면 에러 로그 + 수동 모드 전환

### Planner 전용 규칙
1. requirements.json의 필수 필드가 비어있으면 생성을 시작하지 않는다
2. automation_context는 반드시 채운다 (이것이 에덴 에이전트의 핵심 입력)
3. 불확실한 기술 상세(selectors, API 엔드포인트)는 `"TODO: 수동 확인 필요"`로 명시한다
4. features 배열의 priority 중 critical이 최소 1개는 있어야 한다

### Reviewer 전용 규칙
1. 스키마 검증은 jsonschema 라이브러리 사용
2. 품질 점수 산출 기준:
   - 필수 필드 충족률 (40%)
   - automation_context 완성도 (30%)
   - ID 참조 정합성 (20%)
   - 내용 구체성 — "TODO" 항목이 적을수록 높음 (10%)
3. 품질 점수 0.8 이상이면 통과, 미만이면 재생성 권고

### Connector 전용 규칙
1. full_context.json 생성 시 3개 JSON의 모든 ID 참조를 최종 크로스 체크한다
2. metadata.json에 생성 이력을 반드시 기록한다
3. 에덴 에이전트에 전달 전 파일 크기가 비정상적으로 크거나 작으면 경고한다

## 에러 처리 프로토콜

| 에러 유형 | 처리 |
|---|---|
| LLM API timeout | 30초 대기 → 재시도 (최대 2회) → 실패 시 로그 + 수동 모드 |
| LLM API rate limit | 60초 대기 → 재시도 |
| LLM API auth error | 즉시 중단 + .env 확인 요청 |
| 스키마 검증 실패 | 에러 필드 로그 → 해당 섹션만 재생성 (최대 2회) |
| ID 정합성 깨짐 | 즉시 중단 + 어느 ID가 불일치하는지 명시 |
| 파일 I/O 오류 | 경로 확인 + 권한 확인 → 재시도 |
