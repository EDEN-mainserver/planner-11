// 임시 확인용 — schedules 테이블 존재 여부 + 컬럼 수 확인. 검증 후 삭제 가능.
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ ok: false, error: "Supabase 미설정 — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수 확인" });

  // 1) 기준점: subscriptions 테이블이 접근되는지 확인 (이미 동작 중인 테이블)
  const subsCheck = await supabase
    .from("subscriptions")
    .select("user_id", { count: "exact", head: true });

  // 2) schedules 테이블 확인
  const schedCheck = await supabase
    .from("schedules")
    .select("id", { count: "exact", head: true });

  return res.status(200).json({
    supabaseConnected: !subsCheck.error,
    subscriptions: {
      error: subsCheck.error ? {
        message: subsCheck.error.message,
        code: subsCheck.error.code,
        details: subsCheck.error.details,
        hint: subsCheck.error.hint,
      } : null,
      rowCount: subsCheck.count,
    },
    schedules: {
      tableExists: !schedCheck.error,
      error: schedCheck.error ? {
        message: schedCheck.error.message,
        code: schedCheck.error.code,
        details: schedCheck.error.details,
        hint: schedCheck.error.hint,
      } : null,
      rowCount: schedCheck.count,
    },
  });
}
