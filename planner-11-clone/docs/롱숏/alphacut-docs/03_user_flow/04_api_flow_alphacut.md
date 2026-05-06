# 04. API/데이터 플로우 추정 명세 (AlphaCut)
> 작성일: 2026-04-16
> ⚠️ 주의: 이 문서는 공개된 UI/UX 및 기능 가이드를 기반으로 프론트-백 연동 흐름을 추정한 것입니다.
> 실제 API 구현과 다를 수 있으며, 개발 시 서버 측 확인 필요.

---

## 1. 인증 플로우 (Authentication)

### 1-1. Google OAuth 로그인

```
[클라이언트]                     [서버]                    [Google]
로그인 버튼 클릭
  └─> GET /auth/google ──────────────────────────────> Google OAuth 리다이렉트
                                                               │
                                              Google 인증 완료 │
                                                               ▼
                              ◄── Callback: /auth/google/callback ──────────
                                   (code, state)
                                        │
                              유저 조회 또는 생성
                              JWT / 세션 발급
                                        │
◄── 인증 토큰 발급 ────────────────────┘
쿠키 또는 localStorage 저장
```

**예상 엔드포인트:**
- `GET /auth/google` — OAuth 시작
- `GET /auth/google/callback` — OAuth 콜백
- `POST /auth/logout` — 로그아웃
- `GET /auth/me` — 현재 유저 정보 조회

---

## 2. 쇼츠 생성 플로우

### 2-1. YouTube 링크 입력 → 쇼츠 생성

```
[클라이언트]                          [서버]                    [AI 처리]
URL 입력 후 "쇼츠로 변환하기" 클릭
  └─> POST /api/projects
      { url: "youtube.com/...", 
        settings: {
          segment: { start, end },
          duration: "30-60",
          title_lang: "ko",
          caption_lang: "auto",
          template_id: "xxx"
        }
      }
              │
              ├─ URL 유효성 검사
              ├─ 이용권 잔여 확인
              ├─ YouTube 영상 메타데이터 조회
              └─ AI 처리 큐에 작업 등록
                        │
                        ▼ (비동기)
                   영상 다운로드
                   AI 하이라이트 분석
                   자막 생성 (STT)
                   쇼츠 클립 추출
                   템플릿 합성
                   MP4 렌더링
                        │
◄── 프로젝트 ID 반환 ────┘
                        │
폴링: GET /api/projects/{id}/status
  ├─ status: "processing" → 계속 폴링 (5초 간격 추정)
  └─ status: "completed" → 결과 카드 렌더링
```

**예상 엔드포인트:**
- `POST /api/projects` — 프로젝트 생성 (생성 요청)
- `GET /api/projects` — 내 프로젝트 목록
- `GET /api/projects/{id}` — 프로젝트 상세
- `GET /api/projects/{id}/status` — 처리 상태 폴링
- `GET /api/projects/{id}/shorts` — 생성된 쇼츠 목록

### 2-2. 파일 업로드 → 쇼츠 생성

```
[클라이언트]                          [서버]
파일 선택/드롭
  └─> POST /api/upload (multipart/form-data)
      Content-Type: multipart/form-data
      file: [영상 파일]
              │
              ├─ 파일 형식 검증
              ├─ 파일 크기 검증
              └─> S3 또는 클라우드 스토리지 업로드
                        │
◄── upload_id 반환 ─────┘

업로드 진행 중: 프로그레스바 (퍼센트 표시)
업로드 완료 후:
  └─> POST /api/projects
      { upload_id: "xxx", settings: {...} }
              └─> YouTube 링크 방식과 동일 처리
```

**예상 엔드포인트:**
- `POST /api/upload` — 파일 업로드 (청크 업로드 가능성)
- `GET /api/upload/{id}/progress` — 업로드 진행률

---

## 3. 이용권 (크레딧) 플로우

```
[이용권 차감 시점]
  쇼츠 생성 시작 시 → 차감 (편집/다운로드 시 미차감)
  
  차감 계산:
  - 입력 영상 길이 (초 단위 내림 → 분 단위)
  - 재생성 시 50% 차감
  
[이용권 충전]
  멤버십 가입 → 매월 플랜별 이용권 자동 지급
  이용권 이월 불가 (매월 초기화)
  
[예상 엔드포인트]
GET /api/user/credits         — 잔여 이용권 조회
POST /api/credits/deduct      — 이용권 차감 (서버 사이드)
POST /api/credits/refund      — 오류 시 복구 (서버 사이드)
```

---

## 4. 편집 저장 플로우

```
[편집 화면에서 실시간 변경]
  └─> 텍스트 수정, 레이아웃 변경, 자막 편집 등
        └─ 자동 저장 또는 수동 저장 트리거

[예상 엔드포인트]
PUT /api/shorts/{id}
  {
    title: "수정된 제목",
    layout: { type: "dual", ratio: "50:50", ... },
    captions: [ { start, end, text }, ... ],
    template_id: "xxx",
    hooking: { type: "highlight", start, end },
    elements: [...],
    background: { type: "color", value: "#000" },
    speed: 1.2
  }
```

---

## 5. 다운로드 플로우

```
[완성된 쇼츠 다운로드 버튼 클릭]
  └─> GET /api/shorts/{id}/download
        ├─ 멤버십 확인 (다운로드 권한)
        ├─ 최종 렌더링 (편집 반영)
        └─ MP4 파일 서빙 또는 다운로드 URL 반환

[예상 엔드포인트]
GET  /api/shorts/{id}/download          — 완성 MP4 다운로드
GET  /api/shorts/{id}/download-url      — 임시 다운로드 URL (presigned URL)
POST /api/shorts/{id}/render            — 최종 렌더링 요청
```

---

## 6. 템플릿 플로우

```
[템플릿 CRUD]
GET    /api/templates              — 내 템플릿 목록
GET    /api/templates/recommended  — 추천 템플릿 목록
POST   /api/templates              — 템플릿 생성
PUT    /api/templates/{id}         — 템플릿 수정 (덮어쓰기)
DELETE /api/templates/{id}         — 템플릿 삭제

[템플릿 적용]
POST /api/shorts/{id}/apply-template
  { template_id: "xxx" }
```

---

## 7. 업로드 정보 추천 (AI 메타데이터)

```
[편집 완료 후 "업로드 정보 추천" 버튼 클릭]
  └─> POST /api/shorts/{id}/upload-info
        └─ AI가 영상 내용 분석
              └─ 반환:
                   {
                     title: "추천 제목",
                     description: "추천 설명글",
                     tags: ["태그1", "태그2", ...],
                     category: "카테고리명"
                   }

[쇼츠 제목 재생성]
POST /api/shorts/{id}/regen-title
  { prompt: "조금 더 자극적인 질문형으로" }
  └─ 반환: [ "제목1", "제목2", "제목3", "제목4", "제목5" ]
```

---

## 8. 영상 재생성 플로우

```
[재생성하기 버튼 클릭]
  └─> POST /api/projects/{id}/regenerate
        ├─ 이용권 50% 차감
        ├─ 기존 설정 그대로 재처리
        └─ 새 쇼츠들이 기존 프로젝트에 추가
              └─ 기존 쇼츠 유지 (삭제 없음)
```

---

## 9. AI 나레이션 플로우

```
[AI 나레이션 설정 모달]
  └─> POST /api/shorts/{id}/narration
        {
          text: "이 영상 절대 놓치지 마세요!",
          voice_id: "voice_A",
          speed: 1.0,
          volume: 1.0
        }
        └─ TTS 처리 (1분 이용권 1매 소모)
              └─ 반환: { audio_url, duration }
                    └─ [쇼츠에 추가하기] 클릭
                          └─ PUT /api/shorts/{id} 업데이트
```

---

## 10. 알파토픽 플로우

```
[키워드 검색]
  └─> POST /api/alphatopic/search
        { keyword: "재테크", filters: {...} }
        └─ AI 유튜브 데이터 수집 + 분석 (검색 이용권 1회 차감)
              └─ 반환:
                   {
                     videos: [
                       {
                         id, title, thumbnail,
                         channel: { name, subscribers },
                         metrics: {
                           contribution: "Great",
                           performance: "Good",
                           reaction: "Average",
                           alpha_score: 87
                         },
                         published_at, views
                       }
                     ]
                   }

[추가 검색]
  └─> POST /api/alphatopic/search/more
        { search_id: "xxx" }   — 검색 이용권 1회 추가 차감

[필터 적용 (클라이언트 사이드)]
  └─ 수집된 데이터를 클라이언트에서 필터링 (API 재호출 없음)
```

---

## 11. 추천인 (Referral) 플로우

```
[추천인 코드 생성]
  └─> POST /api/referral/code
        └─ 반환: { code: "ABCDEF", link: "alphacut.video/?ref=ABCDEF" }

[추천인 대시보드]
  └─> GET /api/referral/dashboard
        └─ 반환: { total_invited, total_commission, pending_commission, history: [...] }

[커미션 정산]
  └─> POST /api/referral/payout (내부 처리)
        - 매월 자동 실행
        - 3.3% 원천징수 후 지급
```

---

## 12. 결제 플로우

```
[멤버십 가입]
  └─> POST /api/payments/subscribe
        {
          plan_id: "pro_annual",
          payment_method: { ... }
        }
        └─ PG사 (결제 대행사) 연동 처리
              └─ 성공 시: 멤버십 활성화 + 이용권 지급
              └─ 실패 시: 에러 메시지 반환

[결제 내역]
  └─> GET /api/payments/history

[멤버십 해지]
  └─> DELETE /api/payments/subscription
        └─ 현재 결제 주기 만료 시까지 유지
```

---

## 주요 데이터 모델 (추정)

### User
```json
{
  "id": "user_xxx",
  "email": "user@gmail.com",
  "name": "홍길동",
  "profile_image": "url",
  "plan": "pro",
  "credits_remaining": 120,
  "credits_total": 150,
  "created_at": "2026-01-01",
  "referral_code": "ABCDEF"
}
```

### Project
```json
{
  "id": "proj_xxx",
  "user_id": "user_xxx",
  "source_type": "youtube | file",
  "source_url": "youtube.com/...",
  "status": "processing | completed | error",
  "settings": { "duration": "30-60", "lang": "ko", ... },
  "shorts": [ "short_xxx", "short_yyy" ],
  "created_at": "2026-04-16T10:00:00"
}
```

### Short
```json
{
  "id": "short_xxx",
  "project_id": "proj_xxx",
  "title": "AI가 생성한 후킹 제목",
  "thumbnail_url": "url",
  "video_url": "url",
  "duration": 45,
  "captions": [ { "start": 0.0, "end": 2.5, "text": "자막 텍스트" } ],
  "layout": { "type": "single", "ratio": "9:16" },
  "template_id": "tmpl_xxx",
  "hooking": { "type": "highlight", "start": 120, "end": 124 },
  "status": "draft | rendered | downloaded"
}
```
