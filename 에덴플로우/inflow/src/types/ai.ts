// AI 기획 관련 타입 정의

export type AiType = "reels" | "profile" | "name" | "direction";

export interface DirectionInput {
  nickname: string;
  topic: string;
  purpose: string;
  experience: "beginner" | "intermediate" | "advanced";
}
export interface DirectionResult {
  result: string;
}

export interface NameInput {
  keywords: string;
}
export interface NameItem {
  number: number;
  name: string;
  description: string;
}
export interface NameResult {
  names: NameItem[];
}

export interface ProfileInput {
  nickname: string;
  field: string;
  purpose: string;
  target: string;
}
export interface ProfileResult {
  bio: string;
  keywords: string[];
}

export interface ReelsPlanInput {
  job: string;
  target: string;
  topic: string;
  tone: string;
  request: string;
}
export interface ShootingGuide {
  angle: string;
  lighting: string;
  props: string;
  action: string;
}
export interface StoryboardScene {
  scene: string;
  script: string;
  shootingGuide: ShootingGuide;
}
export interface ReelsPlanResult {
  hooks: string[];
  caption: string;
  storyboard: StoryboardScene[];
}

export interface HistoryItem {
  id: string;
  type: AiType;
  title: string;
  content: string;
  thumbnail?: string;
  createdAt: string;
}
