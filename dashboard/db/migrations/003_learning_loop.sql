-- ─────────────────────────────────────────────────────────────────────────────
-- 003_learning_loop.sql
-- 헤르메스 자가 학습 루프 — 메트릭 수집·외부 인기글·학습 패턴 3개 테이블.
-- 플랜: ~/.claude/plans/2-virtual-grove.md
-- 실행 위치: Supabase 콘솔 → SQL Editor → 본 파일 내용 복붙 → Run
-- 의존: 002_schedules.sql 의 schedules 테이블 + set_updated_at() 함수
-- ─────────────────────────────────────────────────────────────────────────────

-- ① + ② 내 글 메트릭 시계열 ──────────────────────────────────────────────────
-- 같은 schedule_id에 대해 6시간마다 한 행씩 누적 (시계열).
-- 최신값만 보고 싶으면: select distinct on (schedule_id) ... order by schedule_id, fetched_at desc
create table if not exists public.post_metrics (
  schedule_id      text        not null references public.schedules(id) on delete cascade,
  fetched_at       timestamptz not null default now(),
  platform         text        not null,                  -- 'instagram' | 'threads'

  -- 공통 메트릭 (둘 다 지원)
  likes            integer,
  replies          integer,                               -- 인스타 = comments
  shares           integer,                               -- 인스타 = reposts/공유, 쓰레드 = reposts
  saves            integer,                               -- 인스타 전용 (쓰레드 미지원)
  views            integer,                               -- 쓰레드 전용 (인스타는 비디오만)

  -- 인스타 전용
  impressions      integer,
  reach            integer,
  profile_visits   integer,

  -- 쓰레드 전용 부가
  quotes           integer,

  -- 계산값
  engagement       integer,                               -- (likes + replies + shares + saves + quotes) 같은 합산
  engagement_rate  numeric(10, 6),                        -- engagement / impressions (또는 views)

  -- 원본 응답 보존 (스키마 변경 없이 새 메트릭 추가 대응)
  raw_payload      jsonb,

  constraint post_metrics_platform_check
    check (platform in ('instagram', 'threads')),
  constraint post_metrics_pkey
    primary key (schedule_id, fetched_at)
);

-- 인덱스: 최신값 빠른 조회 + 플랫폼별 시계열
create index if not exists post_metrics_schedule_latest_idx
  on public.post_metrics (schedule_id, fetched_at desc);

create index if not exists post_metrics_platform_fetched_idx
  on public.post_metrics (platform, fetched_at desc);

-- ⑦ 외부 인기글 풀 ─────────────────────────────────────────────────────────
-- 헤르메스의 "남 글 학습" 입력. post_url unique로 중복 방지.
create table if not exists public.external_trending (
  post_url         text        primary key,               -- 글 고유 URL
  username         text        not null,                  -- planforge 사용자 (어떤 사용자가 모은 풀인지)
  platform         text        not null,                  -- 'threads' | 'x'
  keyword          text,                                  -- 어떤 키워드 검색 결과인지

  author           text,                                  -- @handle
  content          text        not null,                  -- 본문 (cleaned)
  hashtags         text[]      default '{}',              -- 추출된 해시태그

  likes            integer,
  replies          integer,
  shares           integer,
  views            integer,                               -- 쓰레드/X 조회수 (있으면)

  posted_at        timestamptz,                           -- 외부 글 게시 시각 (확보 가능 시)
  crawled_at       timestamptz not null default now(),    -- 우리가 크롤한 시각

  raw_payload      jsonb,                                  -- 원본 크롤 응답 전체

  constraint external_trending_platform_check
    check (platform in ('threads', 'x'))
);

-- 인덱스: 사용자별 최신 + 플랫폼별 + 키워드별
create index if not exists external_trending_user_recent_idx
  on public.external_trending (username, platform, crawled_at desc);

create index if not exists external_trending_keyword_idx
  on public.external_trending (username, keyword);

-- ④ 학습 패턴 + ON/OFF 스위치 ──────────────────────────────────────────────
-- (username, platform) 당 한 행. UPSERT 패턴.
create table if not exists public.auto_patterns (
  username         text        not null,
  platform         text        not null,                  -- 'instagram' | 'threads'

  -- 헤르메스가 채우는 두 종류 패턴
  my_pattern       jsonb,                                  -- 내 글 top 10% 분석 결과
  external_pattern jsonb,                                  -- 외부 인기글 분석 결과

  -- 주입 스위치 (둘 다 기본 false → 셋업 후 사용자 판단으로 켬)
  my_enabled       boolean     not null default false,
  external_enabled boolean     not null default false,

  -- 메타
  sample_size_my       integer,                            -- my_pattern 추출에 쓴 표본 수
  sample_size_external integer,                            -- external_pattern 표본 수
  analyzed_at      timestamptz,                            -- 헤르메스 마지막 분석 시각
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now(),

  constraint auto_patterns_pkey
    primary key (username, platform),
  constraint auto_patterns_platform_check
    check (platform in ('instagram', 'threads'))
);

-- updated_at 자동 갱신
create trigger auto_patterns_updated_at_trigger
  before update on public.auto_patterns
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 운영 메모
-- ─────────────────────────────────────────────────────────────────────────────
-- • RLS는 schedules와 동일 정책(서버사이드 service_role만 사용). 클라이언트 직접 접근 X.
-- • post_metrics 는 schedule_id FK + ON DELETE CASCADE — 글 삭제 시 메트릭도 같이 정리.
-- • external_trending 은 post_url PK로 동일 글 중복 방지. 7일 이상 된 행 정리는 cron에서 처리.
-- • auto_patterns my_pattern / external_pattern 는 jsonb. 헤르메스가 자유롭게 스키마 진화 가능.
-- • 헤르메스 워크플로우 yaml 에서 SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY 환경변수로 직접 접근.
