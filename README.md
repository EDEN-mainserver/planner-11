# PlanForge

클라이언트 요구사항을 입력하면 PRD/기능명세서/유저플로우 3종을 자동 생성하는 내부 도구.

## Quick Start

```bash
# 1. 환경 설정
cp .env.example .env
# .env에 API 키 입력

# 2. 의존성 설치
pip install -r requirements.txt

# 3. 요구사항 입력
# input/raw/[project_id]/ 에 클라이언트 자료 저장

# 4. 파이프라인 실행
python scripts/run_pipeline.py --project PRJ-2026-001
```

## 폴더 구조

CLAUDE.md 참조

## 문서

- `CLAUDE.md` — 프로젝트 전역 지시문
- `agents/AGENT.md` — 에이전트 행동 규칙
- `agents/SOUL.md` — 에이전트 인격/판단 기준
- `planforge_v1_기능명세서.md` — v1 기능 상세
