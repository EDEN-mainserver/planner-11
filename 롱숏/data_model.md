# Data Model — AlphaCut Clone

> DB: PostgreSQL / ORM: Prisma

---

## 1. ERD 관계 요약

```
User
 ├── Subscription (1:1)
 ├── CreditBalance (1:1)
 ├── CreditTransaction (1:N)
 ├── Project (1:N)
 │    └── Shorts (1:N)
 ├── ReferralCode (1:1)
 └── Commission (1:N)
```

---

## 2. Prisma Schema

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ───────────────────────────
// USER
// ───────────────────────────
model User {
  id                String              @id @default(cuid())
  email             String              @unique
  name              String?
  avatarUrl         String?
  provider          AuthProvider        @default(EMAIL)
  providerAccountId String?
  passwordHash      String?
  role              UserRole            @default(USER)
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  deletedAt         DateTime?

  subscription      Subscription?
  creditBalance     CreditBalance?
  creditTransactions CreditTransaction[]
  projects          Project[]
  referralCode      ReferralCode?
  commissions       Commission[]

  @@index([email])
  @@index([provider, providerAccountId])
}

enum AuthProvider {
  EMAIL
  GOOGLE
  KAKAO
  NAVER
}

enum UserRole {
  USER
  ADMIN
}

// ───────────────────────────
// SUBSCRIPTION
// ───────────────────────────
model Subscription {
  id                String            @id @default(cuid())
  userId            String            @unique
  plan              PlanType          @default(FREE)
  status            SubStatus         @default(ACTIVE)
  currentPeriodStart DateTime
  currentPeriodEnd  DateTime
  cancelAtPeriodEnd Boolean           @default(false)
  paymentKey        String?           // 토스페이먼츠 결제 키
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt

  user              User              @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([status])
}

enum PlanType {
  FREE
  STARTER
  PRO
  ENTERPRISE
}

enum SubStatus {
  ACTIVE
  PAST_DUE
  CANCELED
  TRIALING
}

// ───────────────────────────
// CREDIT BALANCE
// ───────────────────────────
model CreditBalance {
  id          String   @id @default(cuid())
  userId      String   @unique
  total       Int      @default(0)  // 보유 크레딧 (단위: 초)
  used        Int      @default(0)
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id])
}

// ───────────────────────────
// CREDIT TRANSACTION
// ───────────────────────────
model CreditTransaction {
  id          String          @id @default(cuid())
  userId      String
  type        CreditTxType
  amount      Int             // 양수: 충전, 음수: 사용
  description String?
  refId       String?         // 연관 Project/Shorts ID
  createdAt   DateTime        @default(now())

  user        User            @relation(fields: [userId], references: [id])

  @@index([userId])
  @@index([createdAt])
}

enum CreditTxType {
  PURCHASE      // 크레딧 구매
  SUBSCRIPTION  // 구독 지급
  USAGE         // 쇼츠 생성 사용
  REFUND        // 환불
  REFERRAL      // 추천인 보상
  BONUS         // 프로모션 지급
}

// ───────────────────────────
// PROJECT
// ───────────────────────────
model Project {
  id            String        @id @default(cuid())
  userId        String
  title         String
  status        ProjectStatus @default(PENDING)
  sourceType    SourceType
  sourceUrl     String?       // 유튜브 URL 또는 업로드 파일 경로
  duration      Int?          // 원본 영상 길이 (초)
  language      String        @default("ko")
  thumbnailUrl  String?
  transcriptUrl String?       // STT 결과 JSON URL
  errorMessage  String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  deletedAt     DateTime?

  user          User          @relation(fields: [userId], references: [id])
  shorts        Shorts[]

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

enum ProjectStatus {
  PENDING       // 업로드 대기
  PROCESSING    // AI 분석 중
  READY         // 쇼츠 선택 가능
  FAILED        // 처리 실패
}

enum SourceType {
  YOUTUBE
  UPLOAD
}

// ───────────────────────────
// SHORTS
// ───────────────────────────
model Shorts {
  id              String        @id @default(cuid())
  projectId       String
  title           String
  status          ShortsStatus  @default(PENDING)
  startTime       Float         // 원본 영상 시작 시간 (초)
  endTime         Float         // 원본 영상 종료 시간 (초)
  duration        Float         // 쇼츠 길이 (초)
  score           Float?        // AI 하이라이트 점수 (0~1)
  topic           String?       // 알파토픽 분류
  subtitleEnabled Boolean       @default(true)
  subtitleStyle   Json?         // 자막 스타일 설정
  outputUrl       String?       // 완성된 쇼츠 영상 URL
  thumbnailUrl    String?       // 쇼츠 썸네일
  creditUsed      Int?          // 사용된 크레딧 (초 단위)
  errorMessage    String?
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  project         Project       @relation(fields: [projectId], references: [id])

  @@index([projectId])
  @@index([status])
  @@index([score])
}

enum ShortsStatus {
  PENDING       // 생성 대기
  RENDERING     // 렌더링 중
  COMPLETED     // 완료
  FAILED        // 실패
}

// ───────────────────────────
// REFERRAL CODE
// ───────────────────────────
model ReferralCode {
  id          String       @id @default(cuid())
  userId      String       @unique
  code        String       @unique
  useCount    Int          @default(0)
  createdAt   DateTime     @default(now())

  user        User         @relation(fields: [userId], references: [id])
  commissions Commission[]

  @@index([code])
}

// ───────────────────────────
// COMMISSION
// ───────────────────────────
model Commission {
  id              String         @id @default(cuid())
  referrerId      String
  referralCodeId  String
  refereeId       String
  amount          Int            // 커미션 금액 (원)
  rate            Float          // 커미션율 (예: 0.1 = 10%)
  status          CommissionStatus @default(PENDING)
  paidAt          DateTime?
  createdAt       DateTime       @default(now())

  referrer        User           @relation(fields: [referrerId], references: [id])
  referralCode    ReferralCode   @relation(fields: [referralCodeId], references: [id])

  @@index([referrerId])
  @@index([status])
}

enum CommissionStatus {
  PENDING
  CONFIRMED
  PAID
  CANCELED
}
```

---

## 3. 테이블 요약

| 테이블 | 역할 | 핵심 컬럼 |
|--------|------|----------|
| User | 사용자 계정 | email, provider, role |
| Subscription | 구독 플랜 | plan, status, currentPeriodEnd |
| CreditBalance | 크레딧 잔액 | total, used |
| CreditTransaction | 크레딧 이력 | type, amount, refId |
| Project | 영상 프로젝트 | sourceType, sourceUrl, status |
| Shorts | 생성된 쇼츠 | startTime, endTime, score, outputUrl |
| ReferralCode | 추천인 코드 | code, useCount |
| Commission | 추천 커미션 | amount, rate, status |

---

## 4. 주요 설계 결정

- **크레딧 단위는 '초'**: 쇼츠 duration 기준 차감 (300원/쇼츠 = 약 60초 기준)
- **소프트 삭제**: User, Project는 `deletedAt` 필드로 소프트 삭제 처리
- **자막 스타일**: JSON 타입으로 유연하게 폰트/색상/위치 저장
- **Shorts.score**: AI가 계산한 하이라이트 점수, 정렬/필터에 활용
- **ReferralCode**: 1인 1코드, 재사용 가능한 고유 코드
