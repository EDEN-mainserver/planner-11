# 🌊 INFLOW — 인스타그램 AI 기획 툴

> 인스타그램 운영의 모든 것을 AI로 해결하는 개인용 웹 애플리케이션  
> 원본 레퍼런스: https://inflow.agczero.com

---

## 📂 문서 목록

| 파일명 | 내용 |
|--------|------|
| `01_폴더구조.md` | Next.js 프로젝트 전체 폴더/파일 구조 |
| `02_UI명세서.md` | 디자인 토큰, 컬러, 컴포넌트별 UI 스펙 |
| `03_기능명세서.md` | 페이지별 기능 목록, API 명세, 우선순위 |
| `04_유저플로우.md` | 사용자 행동 흐름 다이어그램 |

---

## 🚀 빠른 시작

```bash
# 프로젝트 생성
npx create-next-app@latest inflow --typescript --tailwind --app

# 의존성 설치
npm install zustand openai html2canvas jspdf clsx lucide-react

# 환경변수 설정
cp .env.example .env.local
# OPENAI_API_KEY=sk-xxxx 입력

# 개발 서버 실행
npm run dev
```

---

## 🗺️ 페이지 라우트 맵

| 경로 | 페이지 |
|------|--------|
| `/` | 대시보드 (홈) |
| `/ai/direction` | 계정 방향성 기획 |
| `/ai/name` | 이름 추천 |
| `/ai/profile` | 프로필 세팅 |
| `/ai/reelsPlanning` | 릴스 기획 |
| `/ai/history` | AI기획 보관함 |
| `/diagnosis` | 계정진단 보고서 |
| `/findReels` | 릴스 모음 |
| `/board/notice` | 공지사항 목록 |
| `/board/notice/[id]` | 공지사항 상세 |

---

## 🎨 디자인 핵심 컬러

| 용도 | 컬러 |
|------|------|
| Primary | `#6C63FF` (보라) |
| Accent | `#FF6584` (핑크) |
| Background | `#F4F4F8` (연회색) |
| Card BG | `#FFFFFF` |

---

## 📌 구현 순서 가이드 (권장)

1. **레이아웃** — Sidebar, 라우팅 구조 세팅
2. **대시보드** — 홈 페이지 카드 UI
3. **릴스 기획** — 핵심 AI 기능 (스텝폼 → 생성 → 결과)
4. **보관함** — CRUD, 필터, PDF 저장
5. **이름 추천 / 방향성 기획 / 프로필 세팅** — AI 기능 추가
6. **릴스 모음** — 콘텐츠 탐색
7. **공지사항** — 정적 콘텐츠
8. **인증** — 로그인/세션 처리
9. **플랜 사용량** — 카운트 차감 로직

---

## ⚠️ 제외된 기능 (결제 관련)

- 구독 및 결제 페이지
- 플랜 업그레이드 (PRO/PREMIUM)
- 결제 수단 관리
- 청구서 / 영수증

> 나의 플랜 카드의 "구독 및 결제" 버튼은 UI만 표시하고 기능 없음으로 처리
