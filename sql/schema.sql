-- =============================================================================
-- CJOTA Analytics - Database Schema for Supabase
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABELA: users (integrada com Supabase Auth)
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    meta_access_token TEXT, -- Token de acesso do Facebook/Meta
    meta_token_expires_at TIMESTAMPTZ,
    ad_account_id TEXT, -- ID da conta de anúncios do Meta
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABELA: user_settings (configurações de custos do usuário)
-- =============================================================================
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    -- Metas de performance
    roas_goal DECIMAL(10,2) DEFAULT 6.0,
    cpa_goal DECIMAL(10,2) DEFAULT 30.0,
    -- Configurações de custos
    preco_medio_venda DECIMAL(10,2) DEFAULT 35.00,
    custo_direto_unitario DECIMAL(10,2) DEFAULT 17.73,
    custo_variavel_unitario DECIMAL(10,2) DEFAULT 2.40,
    custos_fixos_mes DECIMAL(10,2) DEFAULT 13330.00,
    meta_vendas_mes INTEGER DEFAULT 1500,
    lucro_liquido_par_meta DECIMAL(10,2) DEFAULT 5.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABELA: campaigns_cache (cache de dados de campanhas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS campaigns_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL,
    campaign_name TEXT,
    objective TEXT,
    status TEXT,
    effective_status TEXT,
    daily_budget DECIMAL(10,2),
    lifetime_budget DECIMAL(10,2),
    data_json JSONB, -- Dados completos da campanha
    date_start DATE,
    date_end DATE,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, campaign_id, date_start, date_end)
);

-- =============================================================================
-- TABELA: adsets_cache (cache de dados de conjuntos de anúncios)
-- =============================================================================
CREATE TABLE IF NOT EXISTS adsets_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL,
    adset_id TEXT NOT NULL,
    adset_name TEXT,
    status TEXT,
    effective_status TEXT,
    daily_budget DECIMAL(10,2),
    optimization_goal TEXT,
    data_json JSONB,
    date_start DATE,
    date_end DATE,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, adset_id, date_start, date_end)
);

-- =============================================================================
-- TABELA: ads_cache (cache de dados de anúncios)
-- =============================================================================
CREATE TABLE IF NOT EXISTS ads_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    campaign_id TEXT NOT NULL,
    adset_id TEXT NOT NULL,
    ad_id TEXT NOT NULL,
    ad_name TEXT,
    status TEXT,
    effective_status TEXT,
    thumbnail_url TEXT,
    permalink_url TEXT,
    -- Métricas
    spend DECIMAL(12,2) DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    revenue DECIMAL(12,2) DEFAULT 0,
    conversations INTEGER DEFAULT 0,
    ctr DECIMAL(6,4) DEFAULT 0,
    cpc DECIMAL(10,2) DEFAULT 0,
    cpm DECIMAL(10,2) DEFAULT 0,
    frequency DECIMAL(6,2) DEFAULT 0,
    data_json JSONB,
    date_start DATE,
    date_end DATE,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ad_id, date_start, date_end)
);

-- =============================================================================
-- TABELA: historical_data (dados históricos diários)
-- =============================================================================
CREATE TABLE IF NOT EXISTS historical_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    spend DECIMAL(12,2) DEFAULT 0,
    revenue DECIMAL(12,2) DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    data_json JSONB,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- =============================================================================
-- TABELA: demographics_data (dados demográficos)
-- =============================================================================
CREATE TABLE IF NOT EXISTS demographics_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    breakdown_type TEXT NOT NULL, -- 'device_platform', 'age_gender'
    breakdown_value TEXT NOT NULL,
    spend DECIMAL(12,2) DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    revenue DECIMAL(12,2) DEFAULT 0,
    data_json JSONB,
    date_start DATE,
    date_end DATE,
    cached_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, breakdown_type, breakdown_value, date_start, date_end)
);

-- =============================================================================
-- TABELA: analysis_history (histórico de análises)
-- =============================================================================
CREATE TABLE IF NOT EXISTS analysis_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    analysis_type TEXT NOT NULL, -- 'automatic', 'manual'
    insights JSONB NOT NULL,
    date_start DATE,
    date_end DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- TABELA: action_log (log de ações realizadas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS action_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'pause_adset', 'activate_adset', 'update_budget', etc
    target_id TEXT NOT NULL, -- ID do adset/ad afetado
    target_name TEXT,
    old_value TEXT,
    new_value TEXT,
    success BOOLEAN DEFAULT TRUE,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- ÍNDICES para performance
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_cache_user_dates ON campaigns_cache(user_id, date_start, date_end);
CREATE INDEX IF NOT EXISTS idx_adsets_cache_user_dates ON adsets_cache(user_id, date_start, date_end);
CREATE INDEX IF NOT EXISTS idx_ads_cache_user_dates ON ads_cache(user_id, date_start, date_end);
CREATE INDEX IF NOT EXISTS idx_historical_data_user_date ON historical_data(user_id, date);
CREATE INDEX IF NOT EXISTS idx_analysis_history_user ON analysis_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_action_log_user ON action_log(user_id, created_at DESC);

-- =============================================================================
-- TRIGGERS para updated_at automático
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) - Segurança por usuário
-- =============================================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE adsets_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE historical_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE demographics_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_log ENABLE ROW LEVEL SECURITY;

-- Policies para users
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Policies para user_settings
CREATE POLICY "Users can manage own settings" ON user_settings
    FOR ALL USING (auth.uid() = user_id);

-- Policies para campaigns_cache
CREATE POLICY "Users can manage own campaigns cache" ON campaigns_cache
    FOR ALL USING (auth.uid() = user_id);

-- Policies para adsets_cache
CREATE POLICY "Users can manage own adsets cache" ON adsets_cache
    FOR ALL USING (auth.uid() = user_id);

-- Policies para ads_cache
CREATE POLICY "Users can manage own ads cache" ON ads_cache
    FOR ALL USING (auth.uid() = user_id);

-- Policies para historical_data
CREATE POLICY "Users can manage own historical data" ON historical_data
    FOR ALL USING (auth.uid() = user_id);

-- Policies para demographics_data
CREATE POLICY "Users can manage own demographics data" ON demographics_data
    FOR ALL USING (auth.uid() = user_id);

-- Policies para analysis_history
CREATE POLICY "Users can manage own analysis history" ON analysis_history
    FOR ALL USING (auth.uid() = user_id);

-- Policies para action_log
CREATE POLICY "Users can manage own action log" ON action_log
    FOR ALL USING (auth.uid() = user_id);

-- =============================================================================
-- FUNÇÃO: Criar usuário automaticamente após signup
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.raw_user_meta_data->>'full_name',
        NEW.raw_user_meta_data->>'avatar_url'
    );
    
    -- Criar configurações padrão para o novo usuário
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para criar usuário automaticamente
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
