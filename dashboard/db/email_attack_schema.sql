-- ==========================================================================
-- E-MAIL Attack 스키마
-- - 모든 테이블 ea_ prefix (Email Attack)
-- - 기존 outreach_* 테이블과 완전 분리 (충돌 방지)
-- - Supabase SQL Editor에 그대로 붙여넣어 한 번만 실행
-- ==========================================================================

-- 1. 전역 설정
CREATE TABLE IF NOT EXISTS ea_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO ea_settings (key, value) VALUES
  ('service_description', '"여기에 에덴 서비스 소개를 작성하세요"'),
  ('daily_cap', '30'),
  ('paused', 'false'),
  ('sender_name', '"에덴 마케팅"'),
  ('sender_email', '"EDEN@teamedenmarketing.com"')
ON CONFLICT (key) DO NOTHING;

-- 2. 작업 (키워드 1개당 1개의 job)
CREATE TABLE IF NOT EXISTS ea_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword TEXT NOT NULL,
  related_keywords TEXT[] DEFAULT '{}',  -- 유관 키워드 자동 확장된 것들
  sources TEXT[] DEFAULT '{google,naver}',  -- 어떤 소스에서 검색했나
  region TEXT DEFAULT 'kr',
  language TEXT DEFAULT 'ko',
  target_count INTEGER DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','done','failed','canceled')),
  progress JSONB DEFAULT '{}',  -- {phase: "extracting", current: 12, total: 49}
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ea_jobs_status_idx ON ea_jobs (status, created_at DESC);

-- 3. 발굴 결과 (브랜드 1개 = 1행)
CREATE TABLE IF NOT EXISTS ea_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES ea_jobs(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  homepage_url TEXT,
  brand_name TEXT,              -- og:site_name 또는 <title>
  emails TEXT[] DEFAULT '{}',
  language TEXT,
  summary TEXT,                 -- 사이트 본문 요약 (제안서 생성용, 선택)
  source TEXT,                  -- 'google' | 'naver' | 'both'
  source_keyword TEXT,          -- 어느 유관 키워드에서 발견됐나
  rank INTEGER,                 -- 검색 순위
  excluded BOOLEAN DEFAULT false, -- 사용자가 수동으로 제외 표시
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ea_results_job_idx ON ea_results (job_id, created_at);
CREATE INDEX IF NOT EXISTS ea_results_domain_idx ON ea_results (domain);

-- 4. 제안서 (선택 — 사용자가 결과 보고 발송 클릭 시 생성)
CREATE TABLE IF NOT EXISTS ea_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id UUID REFERENCES ea_results(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject TEXT,
  body_html TEXT,
  body_text TEXT,
  language TEXT,
  model TEXT,
  approved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. 발송 로그
CREATE TABLE IF NOT EXISTS ea_send_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID REFERENCES ea_proposals(id),
  to_email TEXT,
  to_domain TEXT,
  status TEXT CHECK (status IN ('sent','failed','bounced','blocked')),
  error TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ea_send_logs_domain_idx ON ea_send_logs (to_domain, sent_at);

-- 6. 도메인 블랙리스트 (수동 차단)
CREATE TABLE IF NOT EXISTS ea_blacklist (
  domain TEXT PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. 수신거부
CREATE TABLE IF NOT EXISTS ea_unsubscribes (
  email TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  unsubscribed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
