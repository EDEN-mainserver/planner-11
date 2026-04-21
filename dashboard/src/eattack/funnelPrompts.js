/**
 * 퍼널 단계별 블로그 글 생성 프롬프트 템플릿
 *
 * TOFU (Top of Funnel) — 인식/발견 단계
 * MOFU (Middle of Funnel) — 관심/비교 단계
 * BOFU (Bottom of Funnel) — 구매결정 단계
 */

// 플랫폼별 길이 및 어조 지침
const PLATFORM_GUIDE = {
  naver: {
    name: "네이버 블로그",
    minLength: 2000,
    tone: "친근하고 정보성이 강한 어조, 소제목과 목록 활용, 검색 최적화된 키워드 자연스럽게 배치",
    format: "소제목(##)으로 섹션 구분, 줄바꿈 자주 사용, 2000자 이상 작성",
  },
  tistory: {
    name: "티스토리",
    minLength: 1500,
    tone: "전문적이고 실용적인 어조, 데이터와 근거 중시, SEO 최적화",
    format: "소제목으로 구조화, 핵심 정보 강조, 1500자 이상 작성",
  },
  brunch: {
    name: "브런치",
    minLength: 1000,
    tone: "감성적이고 스토리텔링 중심, 개인적인 인사이트와 경험담 포함, 에세이 스타일",
    format: "자연스러운 문단 흐름, 감성적 표현 활용, 독자와의 공감대 형성",
  },
};

/**
 * TOFU 프롬프트 — 인식/발견 단계
 * 목적: 잠재 고객이 자신의 문제를 인식하고 해결책을 탐색하게 유도
 */
export function buildTofuPrompt({ productName, benefits, target, conversionGoal, platform }) {
  const pg = PLATFORM_GUIDE[platform] || PLATFORM_GUIDE.naver;

  return `당신은 퍼널 마케팅 전문가이자 ${pg.name} 블로그 작가입니다.
다음 정보를 바탕으로 TOFU(인식/발견) 단계에 최적화된 블로그 글을 작성하세요.

## 상품/서비스 정보
- 상품명: ${productName}
- 핵심 혜택: ${benefits.join(', ')}
- 타겟 고객: ${target}
- 전환 목표: ${conversionGoal}
- 플랫폼: ${pg.name}

## TOFU 단계 목표
잠재 고객이 아직 당신의 상품을 모르는 상태입니다. 타겟의 **일상적인 불편함이나 욕구**를 건드려서
"맞아, 나 이런 문제 있었는데"라는 공감을 먼저 끌어내세요. 상품 홍보는 최소화하고 정보성 콘텐츠로 접근하세요.

## 작성 지침
- 어조: ${pg.tone}
- 형식: ${pg.format}
- 글 구조: 후킹 제목 → 공감 도입부 → 문제 상황 묘사 → 문제의 원인 분석 → 해결 방향 제시 → 자연스러운 CTA
- SEO 제목: 타겟이 검색할 법한 키워드를 포함한 제목 (예: "[target]이라면 꼭 알아야 할...")
- CTA: 부드럽게 더 알아보도록 유도 (강매 금지)

## 출력 형식
다음 JSON 형식으로 정확하게 출력하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "title": "SEO 최적화 제목",
  "sections": [
    { "heading": "섹션 제목 또는 null", "content": "섹션 본문 내용" }
  ],
  "cta": "CTA 문구",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`;
}

/**
 * MOFU 프롬프트 — 관심/비교 단계
 * 목적: 해결책을 알고 비교하는 고객에게 우리 상품의 차별점을 설득
 */
export function buildMofuPrompt({ productName, benefits, target, conversionGoal, platform }) {
  const pg = PLATFORM_GUIDE[platform] || PLATFORM_GUIDE.naver;

  return `당신은 퍼널 마케팅 전문가이자 ${pg.name} 블로그 작가입니다.
다음 정보를 바탕으로 MOFU(관심/비교) 단계에 최적화된 블로그 글을 작성하세요.

## 상품/서비스 정보
- 상품명: ${productName}
- 핵심 혜택: ${benefits.join(', ')}
- 타겟 고객: ${target}
- 전환 목표: ${conversionGoal}
- 플랫폼: ${pg.name}

## MOFU 단계 목표
잠재 고객이 이미 해결책을 찾고 있으며 여러 옵션을 비교 중입니다.
**${productName}의 차별화된 강점**을 구체적인 근거(수치, 사례, 비교)로 설득하세요.
"왜 이걸 선택해야 하는가?"에 명확히 답하는 글이어야 합니다.

## 작성 지침
- 어조: ${pg.tone}
- 형식: ${pg.format}
- 글 구조: 후킹 제목 → 독자 상황 공감 → 기존 방법의 한계 → ${productName} 차별점 3가지 → 실제 효과/사례 → 강력한 CTA
- 핵심 혜택 강조: ${benefits.map((b, i) => `혜택${i + 1}: ${b}`).join(' / ')}
- CTA: 구체적인 행동 유도 (${conversionGoal}으로 연결)

## 출력 형식
다음 JSON 형식으로 정확하게 출력하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "title": "SEO 최적화 제목",
  "sections": [
    { "heading": "섹션 제목 또는 null", "content": "섹션 본문 내용" }
  ],
  "cta": "CTA 문구",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`;
}

/**
 * BOFU 프롬프트 — 구매결정 단계
 * 목적: 구매/신청 직전 단계의 고객 마지막 장벽을 제거하고 전환 유도
 */
export function buildBofuPrompt({ productName, benefits, target, conversionGoal, platform }) {
  const pg = PLATFORM_GUIDE[platform] || PLATFORM_GUIDE.naver;

  return `당신은 퍼널 마케팅 전문가이자 ${pg.name} 블로그 작가입니다.
다음 정보를 바탕으로 BOFU(구매결정) 단계에 최적화된 블로그 글을 작성하세요.

## 상품/서비스 정보
- 상품명: ${productName}
- 핵심 혜택: ${benefits.join(', ')}
- 타겟 고객: ${target}
- 전환 목표: ${conversionGoal}
- 플랫폼: ${pg.name}

## BOFU 단계 목표
잠재 고객이 구매/신청을 거의 결심했지만 망설이고 있습니다.
**마지막 불안/의심을 해소**하고 "지금 당장 해야 하는 이유"를 만들어주세요.
사회적 증거(후기, 사례), 희소성, 보장 등을 활용하세요.

## 작성 지침
- 어조: ${pg.tone}
- 형식: ${pg.format}
- 글 구조: 강력한 후킹 제목 → 결정 망설임 공감 → 선택하지 않았을 때의 손실 → 선택했을 때의 변화 → 자주 묻는 질문(FAQ) 형식 불안 해소 → 긴급성/희소성 + 강력한 CTA
- 전환 목표: ${conversionGoal}을 위한 직접적인 행동 촉구
- 보장/신뢰: 상품 혜택(${benefits[0]})을 근거로 안심시키기

## 출력 형식
다음 JSON 형식으로 정확하게 출력하세요. 다른 텍스트는 절대 포함하지 마세요:
{
  "title": "SEO 최적화 제목",
  "sections": [
    { "heading": "섹션 제목 또는 null", "content": "섹션 본문 내용" }
  ],
  "cta": "CTA 문구",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}`;
}

/**
 * 퍼널 단계에 맞는 프롬프트 반환
 */
export function buildFunnelPrompt(stage, params) {
  switch (stage) {
    case 'TOFU': return buildTofuPrompt(params);
    case 'MOFU': return buildMofuPrompt(params);
    case 'BOFU': return buildBofuPrompt(params);
    default: return buildTofuPrompt(params);
  }
}
