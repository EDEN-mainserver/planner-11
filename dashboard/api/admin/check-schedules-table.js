// 임시 확인용 — schedules 테이블 존재 여부 + 컬럼 수 확인. 검증 후 삭제 가능.
import { getSupabaseAdmin } from "../_lib/supabaseAdmin.js";

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return res.status(503).json({ ok: false, error: "Supabase 미설정" });

  // count() 쿼리: 테이블 존재 확인 + 행 수 반환
  const { count, error } = await supabase
    .from("schedules")
    .select("*", { count: "exact", head: true });

  if (error) {
    return res.status(500).json({
      ok: false,
      tableExists: false,
      error: error.message,
      hint: error.hint || null,
    });
  }

  return res.status(200).json({
    ok: true,
    tableExists: true,
    rowCount: count,
  });
}
