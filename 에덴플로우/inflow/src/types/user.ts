export type PlanType = "FREE" | "PRO" | "PREMIUM";

export interface User {
  id: string;
  name: string;
  email: string;
  avatarInitial: string;
  plan: PlanType;
}

export interface PlanUsage {
  diagnosis: number;
  direction: number;
  name: number;
  profile: number;
  reelsPlanning: number;
  reelsView: number;
}
