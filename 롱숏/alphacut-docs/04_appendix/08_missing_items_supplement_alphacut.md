# 08. 누락 항목 보완 명세서 — 비로그인 접근 가능 전체 (AlphaCut)
> 작성일: 2026-04-16
> 이 파일은 "계정 없이 접근 가능한 미수집 항목" 전체를 보완한 파일입니다.

---

## ✅ 현재까지 수집 vs 신규 발견 항목

| 항목 | 이전 상태 | 이번 수집 결과 |
|------|----------|--------------|
| 홈 / 요금제 / 블로그 / 추천인 / 팀소개 | ✅ 완료 | — |
| 법적 페이지 (약관/개인정보/환불) | ❌ 미수집 | ✅ 신규 수집 |
| 무료 도구 드롭다운 항목 | ❌ 미수집 (존재 미확인) | ✅ 10개 전체 신규 발견 |
| SEO/OG 메타 구조 | ❌ 미수집 | ✅ 신규 수집 |
| 다국어 지원 구조 | ❌ 미확인 | ✅ 신규 발견 (일본어/포르투갈어/인도네시아어) |
| Instagram/TikTok 직접 업로드 기능 | ❌ 미발견 | ✅ 약관에서 신규 발견 |
| 편집 기간 제한 정책 | ❌ 미수집 | ✅ 약관에서 신규 발견 |
| 서비스 Tech Stack 단서 | ❌ 미수집 | ✅ Next.js + Sentry 확인 |
| /tools 허브 페이지 | — | ❌ 404 (하위 페이지만 존재) |

---

## A. 무료 도구 페이지 전체 명세 (/tools/*)

### 드롭다운 메뉴 구조
```
무료 도구 ▼
├─ [비디오 도구]
│   ├─ 비디오 변환기     → /tools/video-converter
│   ├─ 비디오 압축기     → /tools/video-compressor
│   ├─ 오디오 추출기     → /tools/audio-extractor
│   ├─ 비디오 크롭       → /tools/video-crop
│   └─ 영상 구간 자르기  → /tools/video-trim
└─ [알파토픽]
    ├─ 채널 분석         → /tools/channel-analysis
    ├─ 주제 추천         → /tools/topic-recommendation
    ├─ 썸네일 생성기     → /tools/thumbnail-generator
    ├─ 영상 검색         → /tools/video-search
    └─ 채널 검색         → /tools/channel-search
```

---

### 무료 도구 공통 UI 패턴

**비디오 도구 5종 (로컬 처리)**
- Hero: 제목 + 서브카피 + 보안 배지 ("파일이 서버에 올라가지 않습니다")
- 드롭존: 드래그 앤 드롭 + 클릭 업로드 (점선 박스 UI)
- 특징 카드: 2x2 그리드 (아이콘 + 타이틀 + 설명)
- FAQ 아코디언
- CTA 섹션: "무료로 쇼츠 만들기" → 알파컷 메인으로 유도

**알파토픽 도구 5종 (AI 처리)**
- Hero: 제목 + 서브카피 + CTA 버튼
- 예시 결과물 인라인 표시 (실제 분석 샘플 노출)
- "이렇게 분석/검색해요" 3단계 가이드
- 특징 카드 섹션
- FAQ 아코디언

---

### 도구별 상세 명세

#### 1. 비디오 변환기 (/tools/video-converter)
- **기능**: MP4 ↔ WebM ↔ MOV ↔ MKV 포맷 변환
- **처리**: 100% 브라우저 내 (서버 미전송)
- **입력**: 드래그 앤 드롭 / 클릭 파일 선택
- **설정**: 출력 포맷 선택 (4종)
- **비용**: 완전 무료, 횟수/크기 제한 없음
- **특징**: 코덱 호환 시 초고속 변환, GB급 파일 가능

#### 2. 비디오 압축기 (/tools/video-compressor)
- **기능**: 화질 유지 최대화하며 파일 용량 압축
- **처리**: 100% 브라우저 내
- **입력**: MP4, WebM, MOV, MKV
- **설정 1**: 품질 프리셋 (높음/중간/낮음)
- **설정 2**: 목표 크기(MB) 직접 입력 → 자동 계산
- **설정 3**: 해상도 다운스케일 (4K→1080p, 1080p→720p)
- **비용**: 완전 무료

#### 3. 오디오 추출기 (/tools/audio-extractor)
- **기능**: 영상에서 오디오 추출
- **처리**: 100% 브라우저 내
- **입력**: MP4, WebM, MOV, MKV 등
- **출력 포맷**: MP3 / WAV / FLAC / OGG / AAC
- **특징**: 원본 음질 그대로 추출 (음질 손실 없음)
- **비용**: 완전 무료

#### 4. 비디오 크롭 (/tools/video-crop)
- **기능**: 영상 비율 자르기 (크롭)
- **처리**: 100% 브라우저 내
- **입력**: MP4, WebM, MOV, MKV
- **비율 프리셋**: 9:16 / 1:1 / 4:5 / 16:9 / 4:3 / 자유 비율
- **조작**: 미리보기에서 크롭 영역 드래그
- **출력**: 원본과 동일 포맷
- **비용**: 완전 무료

#### 5. 영상 구간 자르기 (/tools/video-trim)
- **기능**: 영상 특정 구간 추출 (트림)
- **처리**: 브라우저 내 (재인코딩 필요 → 시간 소요)
- **입력**: MP4, WebM, MOV, MKV
- **설정**: 슬라이더 드래그 또는 시간 직접 입력 (초 단위)
- **출력**: 원본과 동일 포맷
- **비용**: 완전 무료

#### 6. 채널 분석 (/tools/channel-analysis)
- **기능**: AI 기반 유튜브 채널 성장 전략 리포트
- **입력**: YouTube 채널 URL
- **처리 시간**: 핵심 요약 1~2분 / 전체 5~10분
- **분석 항목**:
  - 핵심 요약 (채널 핵심 가치, 브랜드 원형, 일치도)
  - 댓글 심리 분석
  - 시청자 정체성 프로파일
  - 메타데이터 성과 분석
  - 채널 성장 전략 로드맵 (단기/중기/장기)
  - 조회수 Top 3 영상
- **비용**: 첫 채널 핵심 요약은 무료 / 전체 리포트는 검색 이용권 필요
- **대상**: 자기 채널 + 경쟁 채널 모두 가능

#### 7. 주제 추천 (/tools/topic-recommendation)
- **기능**: AI 기반 다음 영상 주제 + 대본 + 썸네일 자동 생성
- **전제 조건**: 채널 분석 먼저 완료 필요
- **입력**: 채널 분석 기반 키워드 자동 생성 or 직접 입력
- **출력 (주제당)**:
  - 신뢰도 점수
  - 제목 후보 3종
  - 예상 조회수 / 예상 성과 (채널 평균 대비 배수)
  - 개요 / 썸네일 컨셉 / 대본 (첫 30초 후킹 대본 포함) / 가이드
  - 추천 근거
- **추천 수**: 1회 3가지 주제
- **비용**: 검색 이용권 필요

#### 8. 썸네일 생성기 (/tools/thumbnail-generator)
- **기능**: AI 유튜브 썸네일 자동 생성
- **입력 방식 3가지**:
  - YouTube URL 입력
  - 영상 파일 업로드
  - 주제 텍스트 입력
- **처리 시간**: 약 2분
- **특징**:
  - 한 영상에 여러 컨셉 생성 → A/B 테스트 최적화
  - 스타일 저장 (채널 톤 유지)
  - 페르소나 등록 (자주 등장 인물 일관성 유지)
- **비용**: 첫 3장 무료 / 이후 검색 이용권 필요

#### 9. 영상 검색 (/tools/video-search)
- **기능**: 유튜브 바이럴 영상 검색 + 알파지수 분석
- **입력**: 키워드
- **검색량**: 한 번에 수백 개 영상 수집
- **분석 지표**: 기여도 / 성과도 / 반응도 / 알파지수
- **필터**: 조회수, 구독자, 게시일, Shorts 여부, 기간/형식
- **정렬**: 각 지표별 정렬 가능
- **기록**: 이전 검색 결과 저장 재확인 가능
- **비용**: 검색 이용권 필요

#### 10. 채널 검색 (/tools/channel-search)
- **기능**: 키워드 기반 유튜브 채널 발굴 + 벤치마킹
- **입력**: 키워드
- **검색량**: 한 번에 수백 개 채널 수집
- **분석 지표**: 구독자 수 / 총 영상 수 / 누적 조회수 / 평균 조회수 / 조회/구독 비율 / 일평균 성장률
- **채널 상세**: 동영상 Top 10 / Shorts Top 10 / 최신 영상
- **필터**: 구독자 범위, 조회수 범위, 채널 개설일
- **정렬**: 모든 지표별 자유 정렬
- **비용**: 검색 이용권 필요

---

## B. 법적 페이지 명세 (/terms, /privacy, /refund)

### B-1. 이용약관 (/terms) — 주요 발견 사항

| 조항 | 핵심 내용 |
|------|---------|
| 제4조 | Instagram 릴스/스토리 업로드, TikTok 동영상 업로드 기능 존재 확인 |
| 제4조 4항 | **편집 기간 제한**: 최초 생성일로부터 1개월(멤버십 미가입 시 10일) 후 편집 제한 |
| 제6조의1 | 환불: 7일 이내 미사용 시에만 가능 |
| 제6조의2 | 멤버십 해지 후 다음 결제일부터 자동결제 중단 |
| 제10조 | YouTube API 서비스 고지 |
| 제11조 | Instagram API (Meta Platform API) 고지 |
| 제12조 | TikTok API (Content Posting API) 고지 |
| 시행일 | 2026년 3월 10일 |

**⚠️ 기획 반영 필요**: 편집 기간 제한 기능 (멤버십 10일 / 유료 1개월)

### B-2. 개인정보처리방침 (/privacy) — 주요 발견 사항

**수집 항목**
- 필수: 이메일, 이름, 로그인ID, 비밀번호
- 자동 수집: IP, 쿠키, 서비스 이용 기록
- YouTube 연동: Google 계정 정보 + YouTube 채널 권한(업로드 + 분석 데이터 yt.analytics.readonly)
- Instagram 연동: 사용자 ID, 사용자명 + 콘텐츠 게시 권한(instagram_content_publish)
- TikTok 연동: 사용자 ID, 프로필 + 동영상 업로드 권한(video.publish)

**제3자 제공**
- 결제 대행 업체
- 클라우드 서비스 (Google Cloud Platform)
- Meta Platforms (Instagram 업로드)
- TikTok/ByteDance (영상 업로드)

**플랫폼 연동 해제**
- YouTube: Google 보안 설정 페이지 또는 서비스 내 '내 정보 관리' 페이지
- Instagram: Instagram 설정에서 직접 해제
- TikTok: TikTok 설정에서 직접 해제

### B-3. 환불정책 (/refund) — 주요 발견 사항

**환불 가능 조건**
- 이용권 구매 후 7일 이내 + 전혀 미사용

**환불 불가 조건**
- 이용권 사용한 경우
- 7일 경과 후
- 생성된 영상을 다운로드한 경우

**멤버십 해지**
- 언제든 해지 가능
- 해지 후 다음 결제일까지 정상 이용
- 이미 결제된 금액 환불 없음

**환불 절차** (5단계)
1. teamweexe@gmail.com 문의
2. 환불 신청서 + 증빙자료 제출
3. 환불 심사 (영업일 3~5일)
4. 환불 승인 시 결제 취소
5. 환불 완료 (카드사별 3~10일)

**고객센터 운영**
- 이메일: teamweexe@gmail.com
- 평일 09:00~18:00
- 응답: 영업일 24시간 이내
- 휴무: 토/일/공휴일

---

## C. SEO / 기술 스택 분석

### C-1. 메타 태그 구조

| 항목 | 값 |
|------|---|
| description | "AI가 자동으로 롱폼 영상을 분석해 유튜브 쇼츠로 변환해 줘요. 클릭 1번으로 숏폼 제작 시간을 90% 줄여 보세요." |
| keywords | 긴 영상 쇼츠 변환, AI 하이라이트 추출, 유튜브 쇼츠 만들기 등 17개 |
| author | Alphacut Team |
| robots | index, follow |
| googlebot | index, follow, max-video-preview:-1, max-image-preview:large |
| og:type | website |
| og:locale | ko_KR |
| og:image | /images/ko/icons/og-image.png (1200x630) |
| twitter:card | summary_large_image |
| canonical | https://alphacut.video |

### C-2. 다국어(i18n) 지원

| 언어 | alternate 링크 |
|------|--------------|
| 한국어 (기본) | https://alphacut.video |
| 일본어 | https://alphacut.video/ja |
| 포르투갈어(브라질) | https://alphacut.video/pt |
| 인도네시아어 | https://alphacut.video/id |

**→ /ja, /pt, /id 각 언어별 랜딩 페이지 존재 가능성 높음**

### C-3. 기술 스택 단서

| 스택 | 근거 |
|------|------|
| Next.js | next_f 변수, next-size-adjust 메타 태그, /_next/ 정적 파일 경로 |
| Sentry | sentry-trace, baggage 메타 태그 (에러 모니터링) |
| Google Cloud Platform | 개인정보처리방침 데이터 처리 위탁 |
| Vercel/클라우드 배포 | Next.js 기반 정황 |
| YouTube API v3 | Terms 제10조, 권한: 업로드 + yt.analytics.readonly |
| Instagram Graph API | Terms 제11조, 권한: instagram_content_publish |
| TikTok Content Posting API | Terms 제12조, 권한: video.publish |
| Schema.org 구조화 데이터 | Organization, FAQPage, SoftwareApplication, HowTo |
| PWA | /manifest.webmanifest, apple-touch-icon 존재 |

### C-4. 구조화 데이터 유형별 사용 현황

| 페이지 | Schema 유형 |
|--------|------------|
| 홈 | Organization + FAQPage |
| 도구 페이지들 | SoftwareApplication + HowTo + FAQPage + BreadcrumbList |

---

## D. SNS 직접 업로드 기능 (약관 기반 추정)

> 이용약관 제4조, 개인정보처리방침 제3조에서 발견된 미공개 기능

| 플랫폼 | API | 기능 | 권한 |
|--------|-----|------|------|
| Instagram | Meta Platform API | 릴스(Reels) + 스토리(Stories) 업로드 대행 | instagram_content_publish |
| TikTok | Content Posting API | 동영상 업로드 대행 | video.publish |
| YouTube | YouTube Data API | 영상 업로드 + 채널 분석 | upload + yt.analytics.readonly |

**처리 흐름 (추정)**
```
[편집 완료 쇼츠]
  └─> [플랫폼 연동 설정]
        └─> Instagram/TikTok/YouTube 계정 연동 (OAuth)
              └─> 업로드 설정 (제목, 설명, 공개 범위 등)
                    └─> 직접 업로드 실행
                          └─> 완료 알림
```

---

## E. 편집 기간 제한 정책 (약관 신규 발견)

> 이용약관 제4조 4항

| 구분 | 편집 가능 기간 |
|------|-------------|
| 비멤버십 (무료 이용권 포함) | 최초 생성일로부터 **10일** |
| 멤버십 가입자 | 최초 생성일로부터 **1개월** |

**UX 반영 필요 항목**
- 편집 기간 만료 전 알림 (D-3 등)
- 편집 화면 접근 시 기간 만료 에러 처리
- 프로젝트 목록에서 만료 예정/만료됨 상태 배지

---

## F. 다국어 페이지 구조 (/ja, /pt, /id)

```
alphacut.video
├─ / (한국어, 기본)
├─ /ja (일본어)
├─ /pt (포르투갈어, 브라질)
└─ /id (인도네시아어)
```

각 언어별로 동일한 서비스 구조가 복제될 가능성 높음.
hreflang alternate 태그로 다국어 SEO 처리 중.
