// 에덴 아웃리치 API 래퍼 — Mac 로컬 FastAPI 호출
// 기존 page.tsx 패턴 그대로 NEXT_PUBLIC_API_URL 직접 사용.

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/outreach${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { detail?: string }).detail || `HTTP ${res.status}`);
  }
  return data as T;
}

export type Keyword = {
  id: string;
  keyword: string;
  region: string;
  language: string;
  top_n: number;
  auto_send: boolean;
  enabled: boolean;
  created_at: string;
};

export type SettingsMap = Record<string, unknown>;

export const outreachApi = {
  // Settings
  listSettings: () => request<SettingsMap>("/settings"),
  patchSetting: (key: string, value: unknown) =>
    request<{ ok: true; key: string; value: unknown }>("/settings", {
      method: "PATCH",
      body: JSON.stringify({ key, value }),
    }),
  pause: () => request<{ paused: true }>("/pause", { method: "POST" }),
  resume: () => request<{ paused: false }>("/resume", { method: "POST" }),

  // Keywords
  listKeywords: () => request<{ keywords: Keyword[] }>("/keywords"),
  createKeyword: (body: {
    keyword: string;
    region?: string;
    language?: string;
    top_n?: number;
    auto_send?: boolean;
  }) =>
    request<Keyword>("/keywords", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  patchKeyword: (id: string, body: Partial<Keyword>) =>
    request<Keyword>(`/keywords/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteKeyword: (id: string) =>
    request<{ ok: true }>(`/keywords/${id}`, { method: "DELETE" }),

  // 단독 테스트
  testSearch: (body: {
    keyword: string;
    top_n?: number;
    region?: string;
    language?: string;
  }) =>
    request<{
      ok: boolean;
      count?: number;
      results?: Array<{ rank: number; url: string; domain: string; title: string; snippet: string }>;
      error?: string;
      message?: string;
    }>("/test/search", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  testSend: (body: { to: string; subject?: string; body_html?: string; body_text?: string }) =>
    request<{
      status: string;
      message_id?: string;
      mime_preview?: string;
      error?: string;
    }>("/test/send", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};
