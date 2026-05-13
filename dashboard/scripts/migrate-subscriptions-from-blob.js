#!/usr/bin/env node
/* eslint-disable no-console */
// ─────────────────────────────────────────────────────────────────────────────
// migrate-subscriptions-from-blob.js
// Vercel Blob의 subscriptions/{userId}.json → Supabase public.subscriptions 테이블 1회 이전.
//
// 실행 전 확보:
//   BLOB_READ_WRITE_TOKEN (Vercel Blob)
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//
// 사용:
//   cd dashboard
//   npm install @supabase/supabase-js @vercel/blob  # 이미 있을 수 있음
//   BLOB_READ_WRITE_TOKEN=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/migrate-subscriptions-from-blob.js
//
// 옵션: --dry-run (DB 쓰기 없이 어떤 행이 추가될지 출력만)
// ─────────────────────────────────────────────────────────────────────────────

import { list } from "@vercel/blob";
import { createClient } from "@supabase/supabase-js";

const DRY_RUN = process.argv.includes("--dry-run");
const PREFIX = "subscriptions/";

function envOrDie(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`✗ ${name} 환경변수가 필요합니다`);
    process.exit(1);
  }
  return v;
}

const SUPABASE_URL = envOrDie("SUPABASE_URL");
const SERVICE_KEY = envOrDie("SUPABASE_SERVICE_ROLE_KEY");
envOrDie("BLOB_READ_WRITE_TOKEN");

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function fetchBlobJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Blob fetch ${res.status}`);
  return res.json();
}

function blobToRow(json) {
  return {
    user_id: String(json.userId || "").trim(),
    plan_id: json.planId || "basic",
    status: json.status || "active",
    current_period_start: json.currentPeriodStart || null,
    current_period_end: json.currentPeriodEnd || null,
    usage_count: Number(json.usageCount) || 0,
    usage_reset_at: json.usageResetAt || null,
  };
}

async function main() {
  console.log(`[migrate] mode=${DRY_RUN ? "DRY-RUN" : "WRITE"}`);
  const { blobs } = await list({ prefix: PREFIX });
  console.log(`[migrate] ${blobs.length}개 Blob 발견`);

  let ok = 0;
  let fail = 0;
  for (const blob of blobs) {
    try {
      const json = await fetchBlobJson(blob.url);
      const row = blobToRow(json);
      if (!row.user_id) {
        console.warn(`  skip (no userId): ${blob.pathname}`);
        continue;
      }

      if (DRY_RUN) {
        console.log(`  [dry] ${row.user_id} → plan=${row.plan_id} usage=${row.usage_count}`);
        ok += 1;
        continue;
      }

      const { error } = await supabase
        .from("subscriptions")
        .upsert(row, { onConflict: "user_id" });

      if (error) throw error;
      console.log(`  ✓ ${row.user_id}`);
      ok += 1;
    } catch (e) {
      console.error(`  ✗ ${blob.pathname}: ${e.message}`);
      fail += 1;
    }
  }

  console.log(`[migrate] 완료: 성공 ${ok}건 · 실패 ${fail}건`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
