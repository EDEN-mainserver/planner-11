-- LongShot Supabase 스키마
-- 실행 순서: Supabase SQL Editor에서 실행

-- ============================================
-- 1. 사용자 (users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    google_id TEXT UNIQUE,
    -- 이용권 (분 단위)
    credits_remaining INTEGER NOT NULL DEFAULT 30,  -- 가입 시 30분 무료
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'basic', 'pro', 'max')),
    plan_expires_at TIMESTAMPTZ,
    -- 추천인
    referral_code TEXT UNIQUE,
    referred_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 2. 프로젝트 (projects)
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT '새 프로젝트',
    -- 소스 타입
    source_type TEXT NOT NULL CHECK (source_type IN ('youtube', 'upload')),
    youtube_url TEXT,
    original_filename TEXT,
    -- 영상 정보
    duration_seconds INTEGER,            -- 원본 영상 길이 (초)
    credits_used INTEGER NOT NULL DEFAULT 0,  -- 소모한 이용권 (분)
    -- 구간 설정
    trim_start_sec INTEGER,
    trim_end_sec INTEGER,
    -- 상태
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    error_message TEXT,
    -- 파일 경로
    source_file_path TEXT,               -- S3/R2 원본 파일 경로
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);

-- ============================================
-- 3. 쇼츠 (shorts)
-- ============================================
CREATE TABLE IF NOT EXISTS shorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    -- 쇼츠 정보
    title TEXT,
    description TEXT,
    hashtags TEXT[],
    category TEXT,
    -- 하이라이트 구간
    highlight_start_sec NUMERIC NOT NULL,
    highlight_end_sec NUMERIC NOT NULL,
    duration_sec NUMERIC GENERATED ALWAYS AS (highlight_end_sec - highlight_start_sec) STORED,
    -- 파일
    video_file_path TEXT,                -- 생성된 쇼츠 파일
    thumbnail_path TEXT,
    -- 상태
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    -- 설정
    template_id UUID REFERENCES templates(id),
    has_hooking_voice BOOLEAN DEFAULT false,
    has_highlight_hook BOOLEAN DEFAULT true,
    -- 재생성
    is_regenerated BOOLEAN DEFAULT false,
    original_short_id UUID REFERENCES shorts(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shorts_project_id ON shorts(project_id);

-- ============================================
-- 4. 자막 (subtitles)
-- ============================================
CREATE TABLE IF NOT EXISTS subtitles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    short_id UUID NOT NULL REFERENCES shorts(id) ON DELETE CASCADE,
    -- 자막 데이터
    start_time_ms INTEGER NOT NULL,
    end_time_ms INTEGER NOT NULL,
    text TEXT NOT NULL,
    -- 스타일
    font_family TEXT DEFAULT 'Pretendard',
    font_size INTEGER DEFAULT 24,
    color TEXT DEFAULT '#FFFFFF',
    background_color TEXT,
    position_x NUMERIC DEFAULT 50,       -- 퍼센트 (중앙 = 50)
    position_y NUMERIC DEFAULT 80,       -- 퍼센트 (하단 = 80)
    animation TEXT DEFAULT 'none' CHECK (animation IN ('none', 'karaoke', 'bounce', 'karaoke_bounce', 'box', 'bounce_group', 'typing')),
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subtitles_short_id ON subtitles(short_id);

-- ============================================
-- 5. 템플릿 (templates)
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,  -- NULL = 시스템 템플릿
    name TEXT NOT NULL,
    is_system BOOLEAN NOT NULL DEFAULT false,
    -- 설정 JSON (자막 스타일, 레이아웃, 배경 등)
    config JSONB NOT NULL DEFAULT '{}',
    thumbnail_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 6. 이용권 거래 내역 (credit_transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 변동
    amount INTEGER NOT NULL,             -- 양수 = 충전, 음수 = 소모
    balance_after INTEGER NOT NULL,      -- 거래 후 잔액
    -- 사유
    type TEXT NOT NULL CHECK (type IN ('signup_bonus', 'purchase', 'usage', 'regeneration', 'refund', 'referral_bonus')),
    project_id UUID REFERENCES projects(id),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_tx_user_id ON credit_transactions(user_id);

-- ============================================
-- 7. 결제 (payments)
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- 결제 정보
    plan TEXT NOT NULL,
    amount INTEGER NOT NULL,             -- 원 단위
    currency TEXT NOT NULL DEFAULT 'KRW',
    -- 토스페이먼츠 연동
    payment_key TEXT,
    order_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'failed', 'cancelled', 'refunded')),
    -- 구독
    is_subscription BOOLEAN DEFAULT false,
    subscription_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 8. updated_at 자동 갱신 트리거
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_projects_updated_at BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 9. RLS (Row Level Security) 정책
-- ============================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE shorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtitles ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- 사용자는 자기 데이터만 접근
CREATE POLICY users_own ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY projects_own ON projects FOR ALL USING (auth.uid() = user_id);
CREATE POLICY shorts_own ON shorts FOR ALL USING (
    project_id IN (SELECT id FROM projects WHERE user_id = auth.uid())
);
CREATE POLICY subtitles_own ON subtitles FOR ALL USING (
    short_id IN (SELECT s.id FROM shorts s JOIN projects p ON s.project_id = p.id WHERE p.user_id = auth.uid())
);
CREATE POLICY templates_own ON templates FOR ALL USING (
    user_id = auth.uid() OR is_system = true
);
CREATE POLICY credit_tx_own ON credit_transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY payments_own ON payments FOR ALL USING (auth.uid() = user_id);
