-- ─────────────────────────────────────────────────────────────────────────────
-- 001_subscriptions.sql
-- 구독 사용량 테이블. 기존 Vercel Blob(subscriptions/{userId}.json)에서 이전.
-- 실행 위치: Supabase 콘솔 → SQL Editor → 본 파일 내용 복붙 → Run
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.subscriptions (
  user_id              text        primary key,
  plan_id              text        not null default 'basic',
  status               text        not null default 'active',
  current_period_start timestamptz,
  current_period_end   timestamptz,
  usage_count          integer     not null default 0,
  usage_reset_at       timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint subscriptions_status_check
    check (status in ('active', 'canceled', 'expired', 'past_due')),

  constraint subscriptions_plan_check
    check (plan_id in ('basic', 'standard', 'premium'))
);

-- usage_reset_at 자주 조회되므로 인덱스
create index if not exists subscriptions_usage_reset_at_idx
  on public.subscriptions (usage_reset_at);

-- updated_at 자동 갱신 트리거
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- 클라이언트(anon)는 자기 데이터만 조회·갱신 가능하도록 추후 정책 추가.
-- 현 단계는 서버(service_role)만 접근하므로 RLS 활성 + 정책 0개로 닫아둠.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.subscriptions enable row level security;
