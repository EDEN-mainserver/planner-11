// 서버 측 Supabase 관리자 클라이언트 — service_role key 사용.
// RLS 우회 + 모든 행 접근 가능. 반드시 서버 함수에서만 import.
//
// 환경변수 누락 시 null 반환 — 호출자는 fallback(Blob 등)으로 graceful degradation.

import { createClient } from "@supabase/supabase-js";

let client = null;

export function getSupabaseAdmin() {
  if (client) return client;
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceKey) return null;
  client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function isSupabaseAdminConfigured() {
  return Boolean(
    (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL) &&
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}
