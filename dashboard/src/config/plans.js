export const PLANS = {
  basic: {
    id: "basic",
    name: "베이직",
    price: 9900,
    monthlyLimit: 20,
    color: "blue",
    features: {
      text: true,
      image: true,
      video: false,
      crawling: false,
      fullAuto: false,
      instagram: true,
      growthdb: false,
    },
    highlights: [
      "글/블로그 생성",
      "카드뉴스 생성",
      "인스타그램 자동 게시",
      "월 20회 생성",
    ],
  },
  standard: {
    id: "standard",
    name: "스탠다드",
    price: 29900,
    monthlyLimit: 80,
    color: "purple",
    features: {
      text: true,
      image: true,
      video: true,
      crawling: true,
      fullAuto: false,
      instagram: true,
      growthdb: false,
    },
    highlights: [
      "베이직 모든 기능 포함",
      "영상(숏폼) 생성",
      "크롤링",
      "월 80회 생성",
    ],
  },
  premium: {
    id: "premium",
    name: "프리미엄",
    price: 79900,
    monthlyLimit: 200,
    color: "orange",
    features: {
      text: true,
      image: true,
      video: true,
      crawling: true,
      fullAuto: true,
      instagram: true,
      growthdb: true,
    },
    highlights: [
      "스탠다드 모든 기능 포함",
      "풀가동화 (전체 자동화)",
      "에쿠 GrowthDB",
      "월 200회 생성",
    ],
  },
};

export const PLAN_ORDER = ["basic", "standard", "premium"];

export function isFeatureAllowed(planId, featureKey) {
  const plan = PLANS[planId];
  if (!plan) return false;
  return plan.features[featureKey] === true;
}

export function isLimitReached(usageCount, planId) {
  const plan = PLANS[planId];
  if (!plan) return true;
  return usageCount >= plan.monthlyLimit;
}

export function getPlanByPrice(price) {
  return Object.values(PLANS).find((p) => p.price === price) || null;
}

export const INTERNAL_USERS = ["eden", "user2", "user3", "user4"];
