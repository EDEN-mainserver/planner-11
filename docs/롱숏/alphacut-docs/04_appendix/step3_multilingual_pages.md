# Step 3: 다국어 페이지 구조 명세서 (Multilingual Pages)
## alphacut.video - /ja, /pt, /id

작성일: 2026-04-16
수집 방법: 로그인 없이 직접 접속

---

## 1. 다국어 지원 구조 개요

### 1-1. 지원 언어 목록 (hreflang 기준)

| 언어 코드 | Locale | URL 경로 | 비고 |
|-----------|--------|----------|------|
| ko-KR | ko_KR | https://alphacut.video | 기본(default) |
| ja-JP | ja_JP | https://alphacut.video/ja | 일본어 |
| pt-BR | pt_BR | https://alphacut.video/pt | 브라질 포르투갈어 |
| id-ID | id_ID | https://alphacut.video/id | 인도네시아어 |
| x-default | - | https://alphacut.video | 기본값(한국어) |

**발견 방법:** 모든 페이지 `<link rel="alternate" hreflang="...">` 태그로 4개 언어 명시

---

## 2. 언어별 페이지 분석

### 2-1. 일본어 페이지 (/ja)

**기본 정보**
- URL: https://alphacut.video/ja
- `<html lang="ja">`
- Title: AIハイライトショート自動作成 - Alphacut
- Canonical: https://alphacut.video/ja

**SEO 메타**
- description: AIが自動でロング動画を分析してYouTubeショートに変換します。ワンクリックでショート動画の制作時間を90%削減できます。
- keywords: 長尺動画ショート変換, AIハイライト抽出, YouTubeショート作成, YouTubeハイライト自動, AIショート生成 등 16개
- og:image: https://alphacut.video/images/ja/icons/og-image.png (언어별 전용 이미지)

**H1 / H2 구조**
- H1: 1本の長尺動画から10本のショート動画を作ってみましょう
- H2 (6개):
  1. マーケティング代理店に選ばれる信頼
  2. 힘들게 편집한 롱폼... (동일 구조로 번역)
  3. 누구나 쉽고 빠르게... (번역)
  4. 이미 1만 명... (번역)
  5. 자주 묻는 질문 (번역)
  6. 지금 바로 시작해보세요 (번역)

**네비게이션 구조 (KO vs JA 비교)**
| 항목 | 한국어 | 일본어 |
|------|--------|--------|
| pricing | /pricing | /ja/pricing |
| blog | /blog?category=guide | /ja/blog?category=guide |
| my_project | /my_project | /ja/my_project |
| terms | /terms | /ja/terms |
| privacy | /privacy | /ja/privacy |
| refund | /refund | /ja/refund |

→ **모든 내부 링크가 /ja/ prefix로 변환됨** (완전한 i18n 라우팅 적용)

---

### 2-2. 브라질 포르투갈어 페이지 (/pt)

**기본 정보**
- URL: https://alphacut.video/pt
- `<html lang="pt">`
- Title: Shorts com IA - Destaques Automáticos - AlphaCut
- Canonical: https://alphacut.video/pt

**SEO 메타**
- description: A IA analisa automaticamente vídeos longos e os converte em YouTube Shorts. Reduza em 90% o tempo de produção de shorts com um único clique.
- keywords: conversão de vídeo longo em Shorts, extração de destaques com IA, criar YouTube Shorts 등 16개
- og:image: https://alphacut.video/images/pt/icons/og-image.png (언어별 전용 이미지)

**H1 / H2 구조**
- H1: Transforme 1 vídeo longo em 10 Shorts.
- H2 (6개):
  1. Seu vídeo longo, editado com tanto esforço, está sendo desperdiçado?
  2. Qualquer pessoa cria Shorts profissionais em minutos
  3. Mais de 10 mil criadores já crescem com o AlphaCut
  4. A IA exclusiva do AlphaCut cria Shorts que geram muitas visualizações
  5. Dúvidas frequentes
  6. Comece agora mesmo

**Hero CTA 버튼 텍스트**
- "Cole o link e pronto" (링크 붙여넣기)
- Input placeholder: "Link do YouTube"
- Upload: "Upload de arquivo"
- CTA button: "Criar meus Shorts"

---

### 2-3. 인도네시아어 페이지 (/id)

**기본 정보**
- URL: https://alphacut.video/id
- `<html lang="id">`
- Title: Konversi Video Panjang ke Shorts dengan AI - Alphacut
- Canonical: https://alphacut.video/id

**SEO 메타**
- description: AI otomatis menganalisis video panjang dan mengubahnya jadi YouTube Shorts. Hemat 90% waktu produksi video pendek hanya dengan satu klik. Coba gratis sekarang!
- keywords: konversi video panjang ke shorts, video pendek AI, buat YouTube Shorts, YouTube Shorts Indonesia 등 15개
- og:image: https://alphacut.video/images/id/icons/og-image.png (언어별 전용 이미지)

**H1 / H2 구조**
- H1: Dari 1 video panjang, buat 10 shorts sekaligus.
- H2 (6개):
  1. Video panjang yang sudah susah payah diedit, sayang kalau cuma dibiarkan begitu saja, kan?
  2. Siapa pun bisa dengan mudah dan cepat bikin shorts berkualitas tinggi
  3. Sudah lebih dari 10.000 kreator yang bertumbuh bareng AlphaCut
  4. Dengan teknologi AI milik AlphaCut, bikin shorts yang banyak ditonton
  5. Pertanyaan yang Sering Diajukan
  6. Yuk, mulai sekarang!

**Hero CTA 버튼 텍스트**
- Input placeholder: "Tautan YouTube"
- Upload: "Upload File"
- CTA button: "Konversi ke Shorts"

---

## 3. 언어별 공통 구조 비교표

| 항목 | ko (기본) | ja | pt | id |
|------|-----------|-----|-----|-----|
| html lang | ko | ja | pt | id |
| URL 구조 | / | /ja | /pt | /id |
| 내부 링크 prefix | 없음 | /ja/ | /pt/ | /id/ |
| og:image | /images/ko/... | /images/ja/... | /images/pt/... | /images/id/... |
| 페이지 구조 동일 | 기준 | ✅ 동일 | ✅ 동일 | ✅ 동일 |
| 섹션 수 | 6개 H2 | 6개 H2 | 6개 H2 | 6개 H2 |
| 요금제 페이지 | /pricing | /ja/pricing | /pt/pricing (추정) | /id/pricing (추정) |
| 통화 표기 | ₩ (원화) | ₩ (원화 그대로) | ₩ (원화 추정) | ₩ (원화 추정) |
| 언어 전환 UI | 없음 | 없음 | 없음 | 없음 |

---

## 4. /ja/pricing 페이지 확인 결과

**접속 URL:** https://alphacut.video/ja/pricing
**Title:** ショート1本約30円、AIショート料金プラン - Alphacut

**요금제 구조 (한국어와 동일)**
| 플랜 | 월 금액 | 연간 금액 | 제공량 |
|------|---------|-----------|--------|
| Free | 무료 | - | 30분 (가입 직후) |
| Basic | ₩6,135/월 | ₩73,621/년 | 월 50분 변환 |
| Pro | ₩17,180/월 | ₩206,165/년 | 월 150분 변환 |
| Max | ₩50,316/월 | ₩603,796/년 | 월 450분 변환 |

⚠️ **주의:** 일본어 페이지임에도 요금제는 **원화(₩) 그대로 표기**
→ 현지화 통화 전환 미적용 (글로벌 서비스이지만 결제는 단일 통화)

---

## 5. 다국어 구현 방식 (기술 명세)

### 5-1. URL 라우팅 방식
```
/ → 한국어 (기본)
/ja → 일본어
/ja/* → 일본어 전체 서브경로
/pt → 포르투갈어
/pt/* → 포르투갈어 전체 서브경로
/id → 인도네시아어
/id/* → 인도네시아어 전체 서브경로
```

### 5-2. 언어 감지 방식 추정
- 자동 감지: 브라우저 Accept-Language 헤더 기반 자동 리다이렉트 **없음** (직접 URL 접속 필요)
- 언어 전환 UI: **없음** (헤더/푸터에 언어 선택 버튼 미발견)
- 수동 접속: URL 경로로만 언어 전환 가능

⚠️ 로그인 불가 상태 기반 추정: 로그인 후에도 동일 URL 구조 유지될 가능성 높음

### 5-3. OG 이미지 언어별 분리
각 언어마다 별도 OG 이미지 경로 존재:
- `/images/ko/icons/og-image.png` (추정)
- `/images/ja/icons/og-image.png`
- `/images/pt/icons/og-image.png`
- `/images/id/icons/og-image.png`

### 5-4. Next.js i18n 구현 방식 (추정)
- Next.js의 `pages/[locale]/...` 또는 `i18n routing` 기능 활용
- 각 언어별 독립된 SEO 메타 (title, description, keywords 완전 현지화)
- hreflang 태그로 다국어 페이지 관계 명시

---

## 6. 미결 항목

1. **자동 언어 감지 여부:** 브라우저 언어 설정에 따라 자동 리다이렉트 되는지 불명 (로그인/비로그인 공통)
2. **pt, id pricing 페이지 통화:** /pt/pricing, /id/pricing의 실제 통화 표기 미확인
3. **언어별 블로그 콘텐츠:** /ja/blog?category=guide 등에 번역된 아티클이 존재하는지 미확인
4. **언어별 무료도구 페이지:** /ja/tools/* 등 존재 여부 미확인
5. **영어(en) 지원 여부:** hreflang에 en 없음 → 영어 미지원 확인됨
6. **언어 전환 로직:** 유저가 언어를 바꾸는 인터랙션 UI가 없다면, 다국어 서비스의 타겟 유저 진입 경로가 SEO 검색 위주일 가능성 높음

---

## 7. UX 시사점

- **언어 전환 UI 없음** → 각 언어 사용자는 검색엔진을 통해 해당 언어 페이지로 직접 진입
- **통화 미현지화** → 일본/브라질/인도네시아 사용자도 원화(₩)로 결제해야 함 → 전환율 저하 가능성
- **페이지 구조 완전 동일** → 번역 비용 최소화, 유지보수 용이
- **영어 미지원** → 4개 언어 타겟팅 (한/일/포/인도네시아)

---

_파일명: step3_multilingual_pages.md_
_생성: Claude (alphacut.video 로그인 없이 분석)_
