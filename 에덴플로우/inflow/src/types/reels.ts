export type ReelsCategory =
  | "all"
  | "marketing"
  | "ai"
  | "beauty"
  | "health"
  | "daily"
  | "food";

export interface Reel {
  id: string;
  thumbnail: string;
  date: string;
  account: string;
  avatar: string;
  category: ReelsCategory;
  caption: string;
  hashtags: string[];
  link: string;
}

export interface ReelsListResponse {
  reels: Reel[];
  total: number;
  page: number;
}
