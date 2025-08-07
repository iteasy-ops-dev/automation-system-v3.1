-- ========================================
-- Flyway Migration V4__LLM_And_System_Tables.sql
-- LLM 관리 및 시스템 테이블 추가
-- ========================================

CREATE TABLE llm_providers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    provider_type VARCHAR(50) NOT NULL,
    api_endpoint VARCHAR(500),
    api_key_hash VARCHAR(255),
    models JSONB DEFAULT '[]',
    rate_limits JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE llm_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_id UUID NOT NULL REFERENCES llm_providers(id),
    model_name VARCHAR(100) NOT NULL,
    request_type VARCHAR(50) NOT NULL,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    total_tokens INTEGER,
    cost_estimate DECIMAL(10, 6),
    response_time_ms INTEGER,
    status VARCHAR(20) NOT NULL CHECK (status IN ('completed', 'failed', 'timeout')),
    error_message TEXT,
    requested_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50),
    is_encrypted BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID,
    user_id UUID REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX idx_llm_providers_status ON llm_providers(status);
CREATE INDEX idx_llm_requests_provider_id ON llm_requests(provider_id);
CREATE INDEX idx_llm_requests_created_at ON llm_requests(created_at);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- 기본 시스템 설정 삽입
INSERT INTO system_settings (key, value, description, category)
VALUES 
    ('system.version', '"v3.1.0"', '시스템 버전', 'system'),
    ('security.jwt_expiry', '"1h"', 'JWT 토큰 만료 시간', 'security'),
    ('metrics.collection_interval', '300', '메트릭 수집 간격 (초)', 'monitoring'),
    ('llm.default_provider', '"openai"', '기본 LLM 프로바이더', 'llm'),
    ('database.schema_version', '"1.0.0"', '데이터베이스 스키마 버전', 'system');
