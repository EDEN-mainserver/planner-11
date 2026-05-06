# Component Specification — AlphaCut Clone

> Framework: Next.js 15 App Router / UI: shadcn/ui + Tailwind CSS

---

## 1. 컴포넌트 트리 전체 구조

```
app/
 ├── layout.tsx                    # RootLayout (폰트, Provider 주입)
 ├── (public)/                     # 비로그인 접근 가능
 │    ├── page.tsx                 # 랜딩 홈
 │    ├── pricing/page.tsx         # 요금제
 │    ├── blog/page.tsx            # 블로그 목록
 │    ├── blog/[slug]/page.tsx     # 블로그 상세
 │    └── referral-promo/page.tsx  # 추천인 프로모션
 ├── (auth)/                       # 인증 페이지
 │    ├── login/page.tsx
 │    └── register/page.tsx
 └── (dashboard)/                  # 로그인 필요
      ├── my_project/page.tsx      # 프로젝트 목록
      ├── my_project/[id]/page.tsx # 프로젝트 상세 + 쇼츠 목록
      ├── settings/page.tsx        # 계정 설정
      └── referral/page.tsx        # 추천인 대시보드
```

---

## 2. 공통 컴포넌트 (components/common/)

### Header
| Props | Type | 설명 |
|-------|------|------|
| user | User \| null | 로그인 상태에 따라 CTA 변경 |

**구성 요소**
- Logo (좌측)
- NavLinks: 서비스소개, 요금제, 블로그
- CTA: 비로그인 → '무료 시작' 버튼 / 로그인 → 크레딧 잔액 + 아바타 드롭다운
- MobileMenuButton (햄버거, 모바일만)

### Footer
- 회사명, 사업자번호, 이용약관, 개인정보처리방침 링크
- SNS 아이콘 (유튜브, 인스타그램)

### Button
| Props | Type | 기본값 |
|-------|------|-------|
| variant | primary \| secondary \| ghost \| danger | primary |
| size | sm \| md \| lg | md |
| loading | boolean | false |
| disabled | boolean | false |

### CreditBadge
- 현재 크레딧 잔액 표시
- 잔액 부족 시 빨간색 강조
- 클릭 시 크레딧 충전 모달 오픈

### Modal
| Props | Type | 설명 |
|-------|------|------|
| isOpen | boolean | 열림 상태 |
| onClose | () => void | 닫기 핸들러 |
| title | string | 모달 제목 |
| children | ReactNode | 모달 내용 |

### Toast
- 전역 토스트 알림 (성공/실패/정보)
- zustand store로 관리
- 3초 자동 사라짐

---

## 3. 랜딩 페이지 컴포넌트 (components/landing/)

### HeroSection
- 메인 헤드라인 + 서브카피
- '무료로 시작하기' CTA 버튼
- 영상 데모 썸네일 (클릭 시 영상 재생)
- 배경: 다크 그라데이션

### HowItWorksSection
- 3단계 프로세스 카드 (업로드 → AI 분석 → 쇼츠 다운로드)
- 각 카드: 아이콘 + 제목 + 설명

### FeaturesSection
- 기능 목록 (AI 하이라이트, 자동 자막, 알파토픽 등)
- 좌우 교차 레이아웃 (이미지 + 텍스트)

### PricingSection
- 플랜 카드 목록 (Free / Starter / Pro / Enterprise)
- 월간/연간 토글 스위치
- 추천 플랜 하이라이트 배지

### TestimonialSection
- 사용자 후기 카드 슬라이더
- 별점 + 이름 + 직책

### FAQSection
- 아코디언 형식 Q&A
- 카테고리별 필터 탭

### CTASection
- 하단 전환 유도 섹션
- '지금 시작하기' 버튼

---

## 4. 인증 컴포넌트 (components/auth/)

### LoginForm
- 이메일 + 비밀번호 입력
- 소셜 로그인 버튼 (Google, Kakao, Naver)
- 회원가입 링크
- 폼 유효성 검사 (react-hook-form + zod)

### RegisterForm
- 이름 + 이메일 + 비밀번호 + 비밀번호 확인
- 추천인 코드 입력 (optional)
- 이용약관 동의 체크박스

### SocialLoginButton
| Props | Type | 설명 |
|-------|------|------|
| provider | google \| kakao \| naver | 소셜 플랫폼 |
| onClick | () => void | OAuth 플로우 시작 |

---

## 5. 대시보드 컴포넌트 (components/dashboard/)

### ProjectCard
| Props | Type | 설명 |
|-------|------|------|
| project | Project | 프로젝트 데이터 |
| onClick | () => void | 카드 클릭 핸들러 |

**구성 요소**
- 썸네일 이미지
- 제목 + 생성일
- 상태 배지 (PENDING / PROCESSING / READY / FAILED)
- 쇼츠 개수 표시
- 더보기 메뉴 (삭제)

### UploadModal
**탭 구성**
1. YouTube URL 입력 탭
   - URL 입력 필드 + 유효성 검사
   - 미리보기 썸네일
2. 파일 업로드 탭
   - 드래그앤드롭 영역
   - 파일 크기/형식 제한 안내
   - 업로드 진행률 바

### ProcessingStatus
- 프로젝트 분석 중 상태 표시
- 단계별 프로그레스 (업로드 → STT → AI 분석 → 완료)
- 폴링 방식 (3초 간격 status API 호출)

### ShortsCard
| Props | Type | 설명 |
|-------|------|------|
| shorts | Shorts | 쇼츠 데이터 |
| onRender | () => void | 렌더링 요청 |
| onDownload | () => void | 다운로드 |

**구성 요소**
- 썸네일 + 재생 버튼 (미리보기)
- 제목 + 길이 + AI 점수
- 알파토픽 배지
- 자막 설정 토글
- '쇼츠 만들기' 버튼 (크레딧 차감 확인 모달)
- 렌더링 중 스피너
- 완료 시 다운로드 버튼

### SubtitleStyleEditor
- 폰트 선택 드롭다운
- 폰트 크기 슬라이더
- 글자색 컬러피커
- 위치 선택 (상/중/하)
- 하이라이트 색상 토글
- 실시간 미리보기

### CreditChargeModal
- 크레딧 패키지 선택 카드
- 선택 시 토스페이먼츠 결제창 연동
- 결제 완료 후 잔액 자동 갱신

---

## 6. 요금제 페이지 컴포넌트 (components/pricing/)

### PlanCard
| Props | Type | 설명 |
|-------|------|------|
| plan | PlanType | 플랜 종류 |
| price | number | 가격 |
| isRecommended | boolean | 추천 배지 |
| isCurrentPlan | boolean | 현재 구독 중 |

**구성 요소**
- 플랜명 + 가격
- 기능 목록 (체크마크)
- CTA 버튼 (구독하기 / 현재 플랜 / 다운그레이드)

### BillingToggle
- 월간 / 연간 토글 스위치
- 연간 선택 시 할인율 배지 표시

---

## 7. 상태 관리 (Zustand Stores)

### useAuthStore
```typescript
interface AuthStore {
  user: User | null;
  accessToken: string | null;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  logout: () => void;
}
```

### useCreditStore
```typescript
interface CreditStore {
  balance: number;
  setBalance: (n: number) => void;
  deduct: (amount: number) => void;
}
```

### useToastStore
```typescript
interface ToastStore {
  toasts: Toast[];
  addToast: (msg: string, type: 'success'|'error'|'info') => void;
  removeToast: (id: string) => void;
}
```

---

## 8. 폴더 구조

```
src/
 ├── app/                    # Next.js App Router
 ├── components/
 │    ├── common/            # 공통 컴포넌트
 │    ├── landing/           # 랜딩 페이지
 │    ├── auth/              # 인증
 │    ├── dashboard/         # 대시보드
 │    ├── pricing/           # 요금제
 │    └── ui/                # shadcn/ui 기본 컴포넌트
 ├── stores/                 # Zustand stores
 ├── hooks/                  # 커스텀 훅
 ├── lib/                    # API 클라이언트, 유틸
 ├── types/                  # TypeScript 타입 정의
 └── styles/                 # 전역 CSS
```
