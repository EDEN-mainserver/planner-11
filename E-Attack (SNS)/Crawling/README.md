# Crawling 모듈 — SNS 트렌드 분석 및 AI 재구성 자동 배포

## 개요
커뮤니티(아이보스, 스레드, X) 인기 게시물을 크롤링하여 트렌드를 분석하고,
AI가 레퍼런스 기반으로 채널 맞춤 콘텐츠를 재구성하여 자동 배포하는 시스템.

## 폴더 구조
```
Crawling/
├── src/
│   ├── crawlers/       # 플랫폼별 크롤러 (아이보스, 스레드, X)
│   ├── api/            # FastAPI 라우터 (인기글 목록, 프로젝트 CRUD, 배포)
│   ├── ai/             # LLM 프롬프트 엔지니어링 및 콘텐츠 재구성
│   ├── scheduler/      # 크롤링/예약배포 스케줄러
│   └── models/         # 데이터 모델 (Pydantic)
├── docs/               # 기능명세서, 유저플로우 원본
├── tests/              # 테스트
├── main.py             # 백엔드 엔트리포인트
└── requirements.txt    # 의존성
```

## 프론트엔드 (UI)
`web/planforge-ui/src/eattack/crawling/` 에 위치

## 핵심 기능 4가지
1. **인기글 트렌드 분석** — Playwright 크롤링 → 대시보드
2. **프로젝트/채널 관리** — 클라이언트별 채널 연동 + 톤앤매너
3. **AI 콘텐츠 재구성** — 레퍼런스 기반 LLM 생성
4. **게시/예약 관리** — 즉시 배포 or 예약 스케줄링

## 기술 스택
- Backend: Python 3.12+, FastAPI, Playwright
- AI: Gemini API (주력)
- Frontend: React (Vite) — 기존 E-Attack UI 내 탭
- DB: JSON 파일 기반 (v1)
