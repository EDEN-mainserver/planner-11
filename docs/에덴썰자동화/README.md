# SunsakTool 기능명세서 문서 허브

> **내부 기획·개발팀 전용 문서**  
> 최종 업데이트: 2025-04  
> 대상 서비스: [sunsaktool.com](https://sunsaktool.com)

---

## 📌 개요

이 리포지토리는 **SunsakTool(순삭툴)** 서비스의 기능, UI, 유저플로우를 나노 단위로 분석한 내부 기획·개발 문서 모음입니다.  
각 폴더는 분석 영역별로 분리되어 있으며, 신규 팀원 온보딩·기능 개선·QA 체크리스트 등으로 활용할 수 있습니다.

---

## 📁 폴더 구조

```
sunsaktool-docs/
├── README.md                          ← 현재 파일 (문서 허브)
├── 01_overview/
│   └── service-overview.md            ← 서비스 전체 개요
├── 02_pages/
│   ├── landing.md                     ← 랜딩 페이지
│   ├── select-template.md             ← 템플릿 선택 페이지
│   └── editor.md                      ← 에디터 페이지
├── 03_features/
│   ├── ai-script.md                   ← AI 대본 자동 생성
│   ├── ai-image.md                    ← AI 이미지 생성
│   ├── tts.md                         ← TTS(텍스트 음성 변환)
│   ├── media.md                       ← 미디어 관리 (이미지/영상)
│   ├── audio.md                       ← 배경음악·오디오
│   ├── export.md                      ← 영상 내보내기
│   ├── save-load.md                   ← 저장·불러오기
│   ├── content-idea.md                ← 글감 찾기 (콘텐츠 아이디어)
│   └── template.md                    ← 템플릿 시스템
├── 04_ui/
│   ├── design-tokens.md               ← 디자인 토큰 (색상·타이포·간격)
│   ├── layout.md                      ← 레이아웃 구조
│   └── components.md                  ← UI 컴포넌트 명세
└── 05_userflow/
    ├── flow-overview.md               ← 전체 유저플로우 개요
    ├── flow-new-user.md               ← 신규 유저 온보딩 플로우
    └── flow-create-video.md           ← 영상 제작 핵심 플로우
```

---

## 📚 문서 목록 및 설명

### 01_overview — 서비스 개요

| 파일 | 설명 |
|------|------|
| [service-overview.md](./01_overview/service-overview.md) | 서비스 목적, 핵심 가치 제안, 지원 템플릿 유형, 주요 기능 요약, 기술 스택 추정, 대상 사용자 |

---

### 02_pages — 페이지별 상세 명세

| 파일 | 설명 |
|------|------|
| [landing.md](./02_pages/landing.md) | 랜딩 페이지 전체 구성 (히어로, 기능 소개, CTA 등) |
| [select-template.md](./02_pages/select-template.md) | 템플릿 선택 화면 레이아웃, 사이드바 메뉴, 템플릿 카드 구조, 공지사항 |
| [editor.md](./02_pages/editor.md) | 에디터 3패널 구조, 좌측·중앙·우측 패널 상세, 타임라인, 상단 툴바 |

---

### 03_features — 기능별 상세 명세

| 파일 | 핵심 기능 |
|------|----------|
| [ai-script.md](./03_features/ai-script.md) | AI 대본 자동 생성 모달 · 프롬프트 입력 · 결과 삽입 플로우 |
| [ai-image.md](./03_features/ai-image.md) | AI 이미지 생성 · 스타일 선택 · 결과 슬라이드 적용 |
| [tts.md](./03_features/tts.md) | 텍스트→음성 변환 · 화자 선택 · 속도/피치 조절 · 미리듣기 |
| [media.md](./03_features/media.md) | 이미지·영상 업로드 · 미디어 라이브러리 · 슬라이드 삽입 |
| [audio.md](./03_features/audio.md) | 배경음악 선택 · 음량 조절 · 페이드 인/아웃 |
| [export.md](./03_features/export.md) | 해상도·비율 설정 · 렌더링 큐 · 다운로드 |
| [save-load.md](./03_features/save-load.md) | 프로젝트 저장·불러오기 · 자동저장 · 버전 관리 |
| [content-idea.md](./03_features/content-idea.md) | 글감 찾기 모달 · 카테고리 탐색 · 대본 연동 |
| [template.md](./03_features/template.md) | 템플릿 유형(썰/지식/랭킹/댓글) · 슬라이드 구조 · 커스터마이징 범위 |

---

### 04_ui — UI/디자인 명세

| 파일 | 설명 |
|------|------|
| [design-tokens.md](./04_ui/design-tokens.md) | CSS 변수, 색상 팔레트, 타이포그래피 스케일, 간격·반경 시스템 |
| [layout.md](./04_ui/layout.md) | 전체 레이아웃 그리드, 반응형 분기점, 에디터 패널 비율 |
| [components.md](./04_ui/components.md) | 버튼·인풋·모달·드롭다운·토스트 등 공통 컴포넌트 상태별 스펙 |

---

### 05_userflow — 유저플로우

| 파일 | 설명 |
|------|------|
| [flow-overview.md](./05_userflow/flow-overview.md) | 전체 서비스 유저 여정 다이어그램 (Mermaid) |
| [flow-new-user.md](./05_userflow/flow-new-user.md) | 신규 방문 → 회원가입 → 첫 영상 완성까지 단계별 플로우 |
| [flow-create-video.md](./05_userflow/flow-create-video.md) | 기존 유저의 영상 제작 핵심 플로우 (AI 활용 포함) |

---

## 🔍 주요 분석 기준

이 문서는 다음 기준으로 작성되었습니다:

- **나노 단위 분석** — 컴포넌트 상태(Default / Hover / Active / Disabled / Loading), 색상값(HEX), px 단위 간격, z-index 레이어까지 기록
- **실제 브라우저 검증** — 추측 없이 직접 스크린샷·DOM 추출·CSS 변수 파싱을 통해 확인된 값만 기록
- **내부 전용** — 요금제(plans) 관련 내용은 의도적으로 제외

---

## ⚡ 빠른 참조

| 목적 | 바로가기 |
|------|---------|
| 서비스가 뭔지 파악하고 싶다 | [service-overview.md](./01_overview/service-overview.md) |
| 에디터 구조를 파악하고 싶다 | [editor.md](./02_pages/editor.md) |
| AI 기능 스펙이 필요하다 | [ai-script.md](./03_features/ai-script.md), [ai-image.md](./03_features/ai-image.md) |
| 색상·폰트 토큰이 필요하다 | [design-tokens.md](./04_ui/design-tokens.md) |
| 신규 유저 온보딩 플로우가 필요하다 | [flow-new-user.md](./05_userflow/flow-new-user.md) |
| 전체 유저 여정을 보고 싶다 | [flow-overview.md](./05_userflow/flow-overview.md) |

---

## 📋 문서 완성 현황

| # | 폴더 | 파일 수 | 상태 |
|---|------|--------|------|
| 01 | overview | 1 | ✅ 완성 |
| 02 | pages | 3 | ✅ 완성 |
| 03 | features | 9 | ✅ 완성 |
| 04 | ui | 3 | ✅ 완성 |
| 05 | userflow | 3 | ✅ 완성 |
| — | README | 1 | ✅ 완성 |
| **합계** | | **20** | ✅ **전체 완성** |

---

*본 문서는 SunsakTool 내부 기획·개발팀 전용입니다. 외부 공유 금지.*
