-- ─────────────────────────────────────────────────────────────────────────────
-- 002_schedules.sql
-- 인스타그램/스레드 게시 예약 테이블.
-- 기존 Vercel Blob(threads-schedule/{username}/{id}.json + instagram-schedules/...)에서 이전.
-- 실행 위치: Supabase 콘솔 → SQL Editor → 본 파일 내용 복붙 → Run
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.schedules (
  -- 식별자
  id                 text        primary key,            -- "ig-1779...-abcd" 같은 기존 ID 그대로
  username           text        not null,               -- planforge 로그인 username
  platform           text        not null,               -- 'instagram' | 'threads'
  status             text        not null default 'pending',  -- 'pending' | 'posted' | 'failed' | 'cancelled'

  -- 시간 관련
  scheduled_at       timestamptz not null,               -- 예약된 게시 시각
  retry_at           timestamptz,                        -- 재시도 예정 시각 (failed 후)
  last_attempt_at    timestamptz,                        -- 마지막 시도 시각
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  -- 게시 콘텐츠
  caption            text,                               -- 인스타/스레드 본문
  image_urls         text[]      not null default '{}',  -- 합성 카드 PNG Blob URL 배열

  -- 계정 정보 (옵션 A: 평문 저장)
  account_id         text,                               -- IG account ID 또는 Threads userId
  access_token       text,                               -- 게시 시 사용할 토큰 (평문, 옵션 A)
  user_id            text,                               -- 일부 호출에서 accountId와 동일

  -- 자동화 메타
  auto               boolean     not null default false, -- 자동 cron이 만든 건지 수동인지
  retry_count        integer     not null default 0,
  last_error         text,                               -- 마지막 실패 사유 (사람말 + 원본 코드 둘 다 가능)

  -- 출처 / 콘텐츠 메타
  run_id             text,                               -- 자동 파이프라인 runId (ig-auto-…)
  topic              text,
  slide_count        integer,
  source_info        jsonb,                              -- keywords/brandName/tone/sourceUrls/bodyPreviews 등 전체 객체

  -- 무결성 제약
  constraint schedules_platform_check
    check (platform in ('instagram', 'threads')),

  constraint schedules_status_check
    check (status in ('pending', 'posted', 'failed', 'cancelled'))
);

-- 인덱스 ──
-- 1) 사용자별 큐 조회: 로그인 후 "내 예약 목록" 화면
create index if not exists schedules_username_scheduled_idx
  on public.schedules (username, scheduled_at desc);

-- 2) 스케줄러 cron: status='pending' AND scheduled_at <= now() 인 것만 픽업
create index if not exists schedules_pending_due_idx
  on public.schedules (platform, scheduled_at)
  where status = 'pending';

-- 3) 디버깅: runId 역추적
create index if not exists schedules_run_id_idx
  on public.schedules (run_id)
  where run_id is not null;

-- updated_at 자동 갱신 트리거 (subscriptions과 동일한 set_updated_at 함수 재사용)
create trigger schedules_updated_at_trigger
  before update on public.schedules
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 운영 메모
-- ─────────────────────────────────────────────────────────────────────────────
-- • 기존 Blob (threads-schedule/, instagram-schedules/) 데이터는 별도 임포트
--   스크립트로 1회 이전 후 dual-read 운영 → 검증 → Blob 폐기.
-- • access_token은 평문 (옵션 A). 향후 RLS + 별도 secrets 테이블로 분리 가능.
-- • source_info는 JSONB이므로 future-proof. 필드 추가 시 스키마 변경 불필요.
-- • image_urls는 Vercel Blob 공개 URL (image-gen/screenshots/...). cleanup-image-blobs
--   cron이 7일 후 삭제하므로 게시 완료된 schedule은 이미지 URL 깨질 수 있음. UI 표시
--   시점엔 status='posted'면 image_urls 없을 수도 있다고 가정.
