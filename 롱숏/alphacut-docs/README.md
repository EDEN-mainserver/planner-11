# AlphaCut Docs

> 서비스: AlphaCut (https://alphacut.video)  
> 작성일: 2026-04-16  
> 상태: 공개 자료 기반 분석 문서 (로그인 내부 화면은 추정 포함)

---

## 폴더 구조

```
alphacut-docs/
├── README.md                          ← 폴더 구조 및 URL 목록 (현재 파일)
│
├── 01_feature/                        ← 기능 명세 (11개)
│   ├── feature_overview.md            ← 전체 기능 목록 + 플랜 매트릭스
│   ├── feature_input.md               ← 유튜브 링크 / 파일 업로드 / 구간 설정
│   ├── feature_ai_generation.md       ← 하이라이트 / 자막 / 무음제거 / 후킹 / 제목추천
│   ├── feature_editing.md             ← 텍스트 / 레이아웃 / 컷 / 커스텀폰트 / 썸네일
│   ├── feature_template.md            ← 5종 템플릿 + 커스텀 저장
│   ├── feature_output.md              ← 결과확인 / 재생성 / 다운로드 / 유튜브 업로드
│   ├── feature_alphatopic.md          ← 트렌드 분석 / 알파지수 / 필터 (Beta)
│   ├── feature_auth.md                ← Google OAuth 가입 / 로그인 / 내 프로젝트
│   ├── feature_pricing.md             ← 무료~Business 전 플랜 + 가이드북 판매
│   ├── feature_referral.md            ← 추천 코드 / 커미션 구조 / 수익 계산기
│   └── feature_support.md             ← 챗봇 / FAQ / 블로그 / 이메일 문의
│
├── 02_ui/                             ← UI 명세 (9개)
│   ├── ui_design_system.md            ← 컬러 / 타이포 / 버튼·카드·탭·배지 컴포넌트
│   ├── ui_global_nav.md               ← GNB + 알림 배너 + 푸터
│   ├── ui_home.md                     ← 홈 11개 섹션 전체
│   ├── ui_pricing.md                  ← 토글 + 4열 플랜카드 + 가이드북 섹션
│   ├── ui_referral.md                 ← 수익 계산기 + 3단계 + FAQ + 약관
│   ├── ui_blog.md                     ← 블로그 홈 + 아티클 3단 레이아웃
│   ├── ui_my_project.md               ← 프로젝트 카드 + 이용권 잔량 UI
│   ├── ui_editor.md                   ← 4영역 레이아웃 + 타임라인 + 자막 편집
│   └── ui_floating.md                 ← 챗봇 버튼 / 알림 배너 / 모달 / 토스트
│
├── 03_user_flow/                      ← 유저 플로우 (8개)
│   ├── flow_overview.md               ← 전체 플로우 맵 + 사용자 유형별 경로
│   ├── flow_onboarding.md             ← 8단계 신규 가입 플로우 (FL-01)
│   ├── flow_shorts_youtube.md         ← 유튜브 링크 → 쇼츠 생성 9단계 (FL-02)
│   ├── flow_shorts_upload.md          ← 파일 업로드 → 쇼츠 생성 (FL-03)
│   ├── flow_editing.md                ← 편집 화면 전체 플로우 (FL-04)
│   ├── flow_download_upload.md        ← 다운로드 / 유튜브 업로드 분기 (FL-05)
│   ├── flow_pricing.md                ← 요금제 구매 7단계 (FL-06)
│   └── flow_referral.md               ← 추천인 등록 / 가입 / 정산 3개 플로우 (FL-07)
│
└── 04_appendix/                       ← 부록 (3개)
    ├── faq.md                         ← 공식 FAQ 6 + 추가 FAQ 6
    ├── pricing_table.md               ← 플랜 비교표 + 편당 단가 계산
    └── glossary.md                    ← 전용 용어 24개 + 약어 11개
```

---

## 주요 URL 목록

| 페이지 | URL | 관련 문서 |
|--------|-----|-----------|
| 홈 | https://alphacut.video/ | ui_home.md |
| 요금제 | /pricing | ui_pricing.md, feature_pricing.md |
| 내 프로젝트 | /my_project | ui_my_project.md |
| 블로그 | /blog | ui_blog.md, feature_support.md |
| 블로그(가이드) | /blog?category=guide | ui_blog.md |
| 추천인 프로그램 | /referral-promo | ui_referral.md, feature_referral.md |
| 이용약관 | /terms | — |
| 개인정보처리방침 | /privacy | — |
| 환불정책 | /refund | — |
| 알파토픽 | 무료 도구 메뉴 내 | feature_alphatopic.md |

---

## 문서 작성 규칙

- 모든 문서는 한국어로 작성
- 파일 인코딩: UTF-8
- 로그인 없이 확인 불가한 화면 명세는 `> 주의:` 블록으로 표시
- 추정 정보는 `(추정)` 또는 `공개 명시 없음` 으로 표기
