import { clsx, type ClassValue } from "clsx";

// Tailwind 클래스 병합 유틸
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

// 날짜 포맷 (2026.04.10)
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

// UUID 생성
export function generateId(): string {
  return crypto.randomUUID();
}
