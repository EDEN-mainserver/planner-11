// 임시 확인용 — schedules 테이블 존재 여부 + 컬럼 수 확인. 검증 후 삭제 가능.
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "../_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  const envCheck = {
    SUPABASE_URL_set: Boolean(process.env.SUPABASE_URL),
    VITE_SUPABASE_URL_set: Boolean(process.env.VITE_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY_set: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    SUPABASE_URL_prefix: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").slice(0, 30),
    configured: isSupabaseAdminConfigured(),
  };

  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ envCheck, ok: false, error: "Supabase 미설정" });

  // 1) 기준점: subscriptions 테이블이 접근되는지 확인 (이미 동작 중인 테이블)
  const subsCheck = await supabase
    .from("subscriptions")
    .select("user_id", { count: "exact", head: true });

  // 2) schedules 테이블 확인
  const schedCheck = await supabase
    .from("schedules")
    .select("id", { count: "exact", head: true });

  return res.status(200).json({
    envCheck,
    supabaseConnected: !subsCheck.error,
    subscriptions: {
      error: subsCheck.error ? JSON.parse(JSON.stringify(subsCheck.error)) : null,
      errorString: subsCheck.error ? String(subsCheck.error) : null,
      rowCount: subsCheck.count,
      statusText: subsCheck.statusText || null,
      status: subsCheck.status || null,
    },
    schedules: {
      tableExists: !schedCheck.error,
      error: schedCheck.error ? JSON.parse(JSON.stringify(schedCheck.error)) : null,
      errorString: schedCheck.error ? String(schedCheck.error) : null,
      rowCount: schedCheck.count,
      statusText: schedCheck.statusText || null,
      status: schedCheck.status || null,
    },
  });
}
