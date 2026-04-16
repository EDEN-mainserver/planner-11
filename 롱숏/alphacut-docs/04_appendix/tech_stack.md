# Tech Stack Analysis — AlphaCut Clone

## 1. 현재 AlphaCut 기술 스택 (역공학 분석)

### 1.1 Frontend

| 항목 | 기술 | 근거 |
|------|------|------|
| Framework | Next.js 15 (App Router) | `_next/static`, `self.__next_f` 패턴 감지 |
| Styling | Tailwind CSS | 클래스 패턴 (`flex`, `gap-`, `text-`, `bg-`) |
| Font | Pretendard | CSS `@font-face` Pretendard 확인 |
| Language | TypeScript | `.tsx` 파일 패턴 |
| State | React 내장 (useState, useContext 추정) | - |

### 1.2 Backend

| 항목 | 기술 | 근거 |
|------|------|------|
| Hosting | Google Cloud Run | `.run.app` 도메인 네트워크 요청 감지 |
| API | REST API (추정) | XHR 패턴 분석 |
| AI 처리 | Python FastAPI (추정) | Cloud Run + AI 파이프라인 구조 |

### 1.3 Analytics & Marketing

| 항목 | 기술 |
|------|------|
| Product Analytics | PostHog |
| Web Analytics | Google Analytics 4 (GA4) |
| Tag Management | Google Tag Manager (GTM) |
| Ad Tracking | Meta Pixel |

---

## 2. 클론 개발 추천 기술 스택

### 2.1 Frontend

| 항목 | 선택 기술 | 이유 |
|------|----------|------|
| Framework | Next.js 15 (App Router) | AlphaCut 동일, SSR/SSG 최적 |
| Language | TypeScript | 타입 안정성 |
| Styling | Tailwind CSS v4 | 빠른 UI 구성 |
| Font | Pretendard | AlphaCut 동일 폰트 |
| 상태관리 | Zustand | 경량, App Router 호환 |
| 서버상태 | TanStack Query v5 | API 캐싱/동기화 |
| UI 컴포넌트 | shadcn/ui | Tailwind 기반, 커스터마이징 용이 |
| 애니메이션 | Framer Motion | 랜딩 인터랙션 |

### 2.2 Backend

| 항목 | 선택 기술 | 이유 |
|------|----------|------|
| API 서버 | FastAPI (Python) | AI 파이프라인 연동 최적 |
| 웹 서버 | Next.js API Routes | 간단한 BFF 레이어 |
| ORM | Prisma | TypeScript 친화적 |
| DB | PostgreSQL (Supabase) | 관계형 + 실시간 기능 |
| Cache | Redis (Upstash) | 세션, 큐 관리 |
| 파일 저장 | AWS S3 / Cloudflare R2 | 영상 파일 저장 |
| CDN | Cloudflare | 전역 영상 배포 |

### 2.3 AI 파이프라인

| 항목 | 선택 기술 | 이유 |
|------|----------|------|
| STT (자막) | OpenAI Whisper | 한국어 정확도 최고 |
| LLM (요약/토픽) | GPT-4o | 쇼츠 스크립트 생성 |
| 영상 편집 | FFmpeg | 컷편집, 인코딩 |
| 작업 큐 | Celery + Redis | 비동기 영상 처리 |
| 컨테이너 | Docker | 배포 일관성 |

### 2.4 인증 & 결제

| 항목 | 선택 기술 | 이유 |
|------|----------|------|
| 인증 | NextAuth.js v5 | 소셜 로그인 통합 |
| 결제 | 토스페이먼츠 | 한국 서비스 최적 |
| 구독 관리 | 자체 구현 | AlphaCut 크레딧 모델 반영 |

### 2.5 인프라

| 항목 | 선택 기술 | 이유 |
|------|----------|------|
| 프론트 배포 | Vercel | Next.js 최적 |
| AI 서버 배포 | Google Cloud Run | 서버리스, 오토스케일 |
| 모니터링 | Sentry + PostHog | 에러 추적 + 사용자 분석 |
| CI/CD | GitHub Actions | 자동 배포 파이프라인 |

---

## 3. 아키텍처 다이어그램

```
[사용자 브라우저]
     |
     v
[Next.js 15 - Vercel]  <-->  [PostgreSQL - Supabase]
     |                              |
     v                              v
[FastAPI - Cloud Run]  <-->  [Redis - Upstash]
     |                              |
     v                              v
[AI Pipeline]               [Celery Worker]
  - Whisper STT                     |
  - GPT-4o                          v
  - FFmpeg                   [S3 / R2 Storage]
```

---

## 4. 개발 환경 설정

```bash
# 프론트엔드
node >= 20.x
pnpm >= 9.x

# 백엔드
python >= 3.11
poetry (패키지 관리)

# 로컬 DB
docker-compose (PostgreSQL + Redis)
```
