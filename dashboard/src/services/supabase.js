// 브라우저 Supabase 클라이언트 — anon public key 사용.
// 현재는 클라이언트 직접 호출보다 서버 API 라우트 경유가 기본 패턴.
// (RLS 정책이 닫혀있어서 anon으로 직접 조회 불가능)
// 향후 사용자별 자기 데이터 접근 흐름에서 사용 예정.

import { createClient } from "@supabase/supabase-js";

const URL = import.meta.env.VITE_SUPABASE_URL || "";
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

let client = null;

export function getSupabase() {
  if (client) return client;
  if (!URL || !ANON_KEY) return null;
  client = createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function isSupabaseConfigured() {
  return Boolean(URL && ANON_KEY);
}
