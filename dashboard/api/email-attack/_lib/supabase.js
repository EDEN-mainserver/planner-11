// E-MAIL Attack 전용 Supabase 클라이언트 래퍼
// - 기존 api/_lib/supabaseAdmin.js를 재사용 (싱글톤 캐시 공유)
// - 별도 import 경로 제공해서 ea 컴포넌트끼리만 묶임

import { getSupabaseAdmin } from "../../_lib/supabaseAdmin.js";

export function db() {
  const client = getSupabaseAdmin();
  if (!client) {
    throw new Error("Supabase env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) 미설정");
  }
  return client;
}

// settings 단축
export async function getSetting(key, defaultValue = null) {
  const { data } = await db()
    .from("ea_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? defaultValue;
}

export async function setSetting(key, value) {
  const { error } = await db()
    .from("ea_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}
