# API Specification — AlphaCut Clone

> Base URL: `https://api.yourdomain.com/v1`
> Auth: Bearer Token (JWT)

---

## 1. 인증 (Auth)

### POST /auth/register
이메일 회원가입

**Request**
```json
{
  "email": "user@example.com",
  "password": "string (min 8)",
  "name": "홍길동",
  "referralCode": "ABC123" // optional
}
```
**Response** `201`
```json
{ "userId": "cuid", "email": "...", "accessToken": "...", "refreshToken": "..." }
```

### POST /auth/login
이메일 로그인

**Request**
```json
{ "email": "...", "password": "..." }
```
**Response** `200`
```json
{ "accessToken": "...", "refreshToken": "...", "user": { "id": "...", "email": "...", "name": "..." } }
```

### POST /auth/oauth/{provider}
소셜 로그인 (provider: google | kakao | naver)

**Request**
```json
{ "code": "oauth_code", "redirectUri": "..." }
```
**Response** `200` → 동일 토큰 구조

### POST /auth/refresh
토큰 갱신

**Request**
```json
{ "refreshToken": "..." }
```
**Response** `200`
```json
{ "accessToken": "...", "refreshToken": "..." }
```

### POST /auth/logout
로그아웃 (refreshToken 무효화)

---

## 2. 사용자 (User)

### GET /users/me
내 프로필 조회

**Response** `200`
```json
{
  "id": "...",
  "email": "...",
  "name": "...",
  "avatarUrl": "...",
  "role": "USER",
  "createdAt": "..."
}
```

### PATCH /users/me
프로필 수정

**Request**
```json
{ "name": "...", "avatarUrl": "..." }
```

### DELETE /users/me
회원 탈퇴 (소프트 삭제)

---

## 3. 크레딧 (Credit)

### GET /credits/balance
크레딧 잔액 조회

**Response** `200`
```json
{ "total": 3600, "used": 1200, "remaining": 2400 }
```

### GET /credits/transactions
크레딧 사용 내역

**Query Params**: `page`, `limit`, `type`

**Response** `200`
```json
{
  "items": [
    { "id": "...", "type": "USAGE", "amount": -60, "description": "쇼츠 생성", "createdAt": "..." }
  ],
  "total": 20, "page": 1, "limit": 10
}
```

---

## 4. 구독 (Subscription)

### GET /subscriptions/me
내 구독 정보 조회

**Response** `200`
```json
{
  "plan": "PRO",
  "status": "ACTIVE",
  "currentPeriodEnd": "2026-05-16T00:00:00Z",
  "cancelAtPeriodEnd": false
}
```

### POST /subscriptions/subscribe
구독 시작 / 플랜 변경

**Request**
```json
{ "plan": "PRO", "paymentKey": "toss_payment_key" }
```

### POST /subscriptions/cancel
구독 취소 (period end 시 해지)

---

## 5. 프로젝트 (Project)

### GET /projects
내 프로젝트 목록

**Query Params**: `page`, `limit`, `status`

**Response** `200`
```json
{
  "items": [
    {
      "id": "...", "title": "...", "status": "READY",
      "thumbnailUrl": "...", "duration": 3600,
      "shortsCount": 5, "createdAt": "..."
    }
  ],
  "total": 12, "page": 1, "limit": 10
}
```

### POST /projects
새 프로젝트 생성 (유튜브 URL)

**Request**
```json
{ "sourceType": "YOUTUBE", "sourceUrl": "https://youtube.com/watch?v=...", "language": "ko" }
```
**Response** `201`
```json
{ "id": "...", "status": "PENDING" }
```

### POST /projects/upload
새 프로젝트 생성 (파일 업로드)

**Request**: `multipart/form-data`
- `file`: 영상 파일 (mp4, mov, avi 등)
- `language`: 언어 코드

**Response** `201` → 동일 구조

### GET /projects/{id}
프로젝트 상세 조회

**Response** `200`
```json
{
  "id": "...", "title": "...", "status": "READY",
  "sourceType": "YOUTUBE", "sourceUrl": "...",
  "duration": 3600, "language": "ko",
  "thumbnailUrl": "...", "createdAt": "...",
  "shorts": [ ... ]
}
```

### DELETE /projects/{id}
프로젝트 삭제 (소프트 삭제)

---

## 6. 쇼츠 (Shorts)

### GET /projects/{projectId}/shorts
프로젝트의 쇼츠 목록

**Query Params**: `sort` (score|createdAt), `topic`

**Response** `200`
```json
{
  "items": [
    {
      "id": "...", "title": "...", "status": "COMPLETED",
      "startTime": 120.5, "endTime": 180.0, "duration": 59.5,
      "score": 0.92, "topic": "정보전달",
      "outputUrl": "...", "thumbnailUrl": "..."
    }
  ]
}
```

### POST /projects/{projectId}/shorts/{id}/render
쇼츠 렌더링 요청 (크레딧 차감)

**Request**
```json
{
  "subtitleEnabled": true,
  "subtitleStyle": {
    "font": "Pretendard",
    "fontSize": 36,
    "color": "#FFFFFF",
    "position": "bottom",
    "highlight": true
  }
}
```
**Response** `202`
```json
{ "shortsId": "...", "status": "RENDERING", "creditUsed": 60 }
```

### GET /projects/{projectId}/shorts/{id}/status
쇼츠 렌더링 상태 폴링

**Response** `200`
```json
{ "status": "COMPLETED", "outputUrl": "https://cdn.yourdomain.com/...mp4" }
```

### GET /projects/{projectId}/shorts/{id}/download
쇼츠 다운로드 URL 발급

**Response** `200`
```json
{ "downloadUrl": "https://...?expires=..." }
```

---

## 7. 추천인 (Referral)

### GET /referral/me
내 추천인 코드 조회

**Response** `200`
```json
{ "code": "ABC123", "useCount": 5, "totalCommission": 15000 }
```

### GET /referral/commissions
커미션 내역 조회

**Query Params**: `page`, `limit`, `status`

**Response** `200`
```json
{
  "items": [
    { "id": "...", "amount": 3000, "status": "CONFIRMED", "createdAt": "..." }
  ],
  "total": 5
}
```

### POST /referral/validate
추천 코드 유효성 검증

**Request**
```json
{ "code": "ABC123" }
```
**Response** `200`
```json
{ "valid": true, "referrerName": "홍길동" }
```

---

## 8. 결제 웹훅 (Payment Webhook)

### POST /webhooks/tosspayments
토스페이먼츠 결제 결과 수신

**Headers**: `Toss-Signature` 검증 필수

**이벤트 처리**
| 이벤트 | 처리 내용 |
|--------|----------|
| PAYMENT_DONE | 구독 활성화, 크레딧 지급 |
| PAYMENT_FAILED | 구독 상태 PAST_DUE |
| CANCEL_DONE | 구독 취소, 크레딧 회수 |

---

## 9. 공통 에러 코드

| HTTP Status | Code | 설명 |
|-------------|------|------|
| 400 | INVALID_REQUEST | 요청 파라미터 오류 |
| 401 | UNAUTHORIZED | 인증 토큰 없음/만료 |
| 403 | FORBIDDEN | 권한 없음 |
| 404 | NOT_FOUND | 리소스 없음 |
| 402 | INSUFFICIENT_CREDIT | 크레딧 부족 |
| 409 | ALREADY_EXISTS | 중복 리소스 |
| 422 | UNPROCESSABLE | 처리 불가 형식 |
| 500 | INTERNAL_ERROR | 서버 오류 |

---

## 10. 인증 플로우

```
Client → POST /auth/login → accessToken (15min) + refreshToken (30d)
Client → API 요청 시 Header: Authorization: Bearer {accessToken}
accessToken 만료 → POST /auth/refresh → 새 accessToken 발급
refreshToken 만료 → 재로그인 필요
```
