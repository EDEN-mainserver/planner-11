-- 에덴 아웃리치 스키마
-- Supabase SQL Editor에 그대로 붙여넣어 실행하세요.
-- 모든 테이블은 outreach_ 접두사를 사용하여 기존 스키마와 분리합니다.

-- 1. 전역 설정 (key/value)
CREATE TABLE IF NOT EXISTS outreach_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO outreach_settings (key, value) VALUES
  ('service_description', '"여기에 내 서비스 소개를 작성하세요"'),
  ('daily_cap', '30'),
  ('paused', 'false'),
  ('sender_name', '"에덴 마케팅"'),
  ('sender_email', '"EDEN@teamedenmarketing.com"'),
  ('serpapi_key', '""'),
  ('draft_mode_threshold', '10')
ON CONFLICT (key) DO NOTHING;

-- 2. 키워드
CREATE TABLE IF NOT EXISTS outreach_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  region TEXT DEFAULT 'kr',
  language TEXT DEFAULT 'ko',
  top_n INTEGER DEFAULT 10,
  auto_send BOOLEAN DEFAULT false,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 스케줄 (키워드별 cron)
CREATE TABLE IF NOT EXISTS outreach_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES outreach_keywords(id) ON DELETE CASCADE,
  cron_expr TEXT NOT NULL,
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  enabled BOOLEAN DEFAULT true
);

-- 4. 작업 큐
CREATE TABLE IF NOT EXISTS outreach_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword_id UUID REFERENCES outreach_keywords(id),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','searching','extracting','reading','generating',
                       'awaiting_approval','sending','sent','failed','skipped')),
  step_log JSONB DEFAULT '[]'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outreach_jobs_status_idx ON outreach_jobs (status, created_at);

-- 5. 검색 결과
CREATE TABLE IF NOT EXISTS outreach_search_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES outreach_jobs(id) ON DELETE CASCADE,
  rank INTEGER,
  url TEXT,
  domain TEXT,
  title TEXT,
  snippet TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. 사이트 (도메인별 캐시)
CREATE TABLE IF NOT EXISTS outreach_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT UNIQUE,
  domain TEXT,
  language TEXT,
  title TEXT,
  summary TEXT,
  emails TEXT[],
  last_scraped_at TIMESTAMPTZ
);

-- 7. 제안서
CREATE TABLE IF NOT EXISTS outreach_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES outreach_jobs(id),
  site_id UUID REFERENCES outreach_sites(id),
  recipient_email TEXT NOT NULL,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  language TEXT,
  model TEXT,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. 발송 로그
CREATE TABLE IF NOT EXISTS outreach_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES outreach_proposals(id),
  to_email TEXT,
  to_domain TEXT,
  status TEXT CHECK (status IN ('sent','failed','bounced','blocked')),
  smtp_response TEXT,
  error TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outreach_send_logs_domain_idx ON outreach_send_logs (to_domain, sent_at);
CREATE INDEX IF NOT EXISTS outreach_send_logs_email_idx ON outreach_send_logs (to_email);

-- 9. 블랙리스트
CREATE TABLE IF NOT EXISTS outreach_blacklist (
  domain TEXT PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. 수신거부
CREATE TABLE IF NOT EXISTS outreach_unsubscribes (
  email TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
