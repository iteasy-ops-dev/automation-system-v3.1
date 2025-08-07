-- ========================================
-- 통합 자동화 시스템 PostgreSQL 스키마
-- 버전: v3.1.0
-- 계약 기반: shared/contracts/v1.0/rest/core/storage-api.yaml
-- ========================================

-- 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ========================================
-- 사용자 및 인증 관련 테이블
-- ========================================

-- 사용자 테이블
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username CITEXT UNIQUE NOT NULL,
    email CITEXT UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_login_at TIMESTAMP,
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 사용자 세션 테이블
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- 장비 관리 관련 테이블 (Storage API 계약 기반)
-- ========================================

-- 장비 그룹 테이블 (DeviceGroup 스키마 기반)
CREATE TABLE device_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    parent_id UUID REFERENCES device_groups(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_group_name_per_parent UNIQUE (name, parent_id)
);

-- 장비 테이블 (Device 스키마 기반 - 100% 일치)
CREATE TABLE devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('server', 'network', 'storage', 'iot')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    group_id UUID REFERENCES device_groups(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_device_name UNIQUE (name)
);

-- 장비 상태 히스토리 테이블
CREATE TABLE device_status_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
    previous_status VARCHAR(20),
    current_status VARCHAR(20) NOT NULL,
    reason TEXT,
    changed_by UUID REFERENCES users(id),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ========================================
-- MCP 서버 관리 테이블
-- ========================================

-- MCP 서버 테이블
CREATE TABLE mcp_servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    server_type VARCHAR(50) NOT NULL,
    endpoint_url VARCHAR(500) NOT NULL,
    connection_config JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'error', 'maintenance')),
    version VARCHAR(20),
    capabilities JSONB DEFAULT '[]',
    last_heartbeat TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MCP 도구 카탈로그 테이블
CREATE TABLE mcp_tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES mcp_servers(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    version VARCHAR(20),
    schema JSONB,
    capabilities JSONB DEFAULT '[]',
    is_enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_tool_per_server UNIQUE (server_id, name)
);

-- MCP 실행 이력 테이블
CREATE TABLE mcp_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES mcp_servers(id),
    tool_name VARCHAR(100) NOT NULL,
    execution_params JSONB,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    result JSONB,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    executed_by UUID REFERENCES users(id)
);

-- ========================================
-- 워크플로우 관리 테이블
-- ========================================

-- 워크플로우 정의 테이블
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    definition JSONB NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    tags TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_workflow_name_version UNIQUE (name, version)
);

-- 워크플로우 실행 테이블
CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflows(id),
    session_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    input_data JSONB,
    output_data JSONB,
    error_details JSONB,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    executed_by UUID REFERENCES users(id)
);

-- 워크플로우 실행 단계 테이블
CREATE TABLE workflow_execution_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES workflow_executions(id) ON DELETE CASCADE,
    step_id VARCHAR(100) NOT NULL,
    step_name VARCHAR(200) NOT NULL,
    step_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
    input_data JSONB,
    output_data JSONB,
    error_details JSONB,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_ms INTEGER,
    retry_count INTEGER DEFAULT 0
);

-- ========================================
-- LLM 관리 테이블
-- ========================================

-- LLM 프로바이더 테이블
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

-- LLM 요청 이력 테이블
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

-- ========================================
-- 시스템 설정 및 메타데이터 테이블
-- ========================================

-- 시스템 설정 테이블
CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    category VARCHAR(50),
    is_encrypted BOOLEAN DEFAULT false,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 감사 로그 테이블
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

-- ========================================
-- 인덱스 생성
-- ========================================

-- 사용자 관련 인덱스
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- 장비 관련 인덱스
CREATE INDEX idx_devices_name ON devices(name);
CREATE INDEX idx_devices_type ON devices(type);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_group_id ON devices(group_id);
CREATE INDEX idx_devices_created_at ON devices(created_at);
CREATE INDEX idx_devices_tags ON devices USING GIN(tags);
CREATE INDEX idx_devices_metadata ON devices USING GIN(metadata);

-- 장비 그룹 관련 인덱스
CREATE INDEX idx_device_groups_parent_id ON device_groups(parent_id);
CREATE INDEX idx_device_groups_name ON device_groups(name);

-- 장비 상태 히스토리 인덱스
CREATE INDEX idx_device_status_history_device_id ON device_status_history(device_id);
CREATE INDEX idx_device_status_history_changed_at ON device_status_history(changed_at);

-- MCP 관련 인덱스
CREATE INDEX idx_mcp_servers_status ON mcp_servers(status);
CREATE INDEX idx_mcp_servers_server_type ON mcp_servers(server_type);
CREATE INDEX idx_mcp_tools_server_id ON mcp_tools(server_id);
CREATE INDEX idx_mcp_tools_name ON mcp_tools(name);
CREATE INDEX idx_mcp_executions_server_id ON mcp_executions(server_id);
CREATE INDEX idx_mcp_executions_status ON mcp_executions(status);
CREATE INDEX idx_mcp_executions_started_at ON mcp_executions(started_at);

-- 워크플로우 관련 인덱스
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_created_by ON workflows(created_by);
CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at);
CREATE INDEX idx_workflow_execution_steps_execution_id ON workflow_execution_steps(execution_id);

-- LLM 관련 인덱스
CREATE INDEX idx_llm_providers_status ON llm_providers(status);
CREATE INDEX idx_llm_requests_provider_id ON llm_requests(provider_id);
CREATE INDEX idx_llm_requests_created_at ON llm_requests(created_at);

-- 감사 로그 인덱스
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ========================================
-- 트리거 및 함수
-- ========================================

-- updated_at 컬럼 자동 업데이트 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 트리거 생성
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_device_groups_updated_at BEFORE UPDATE ON device_groups FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mcp_servers_updated_at BEFORE UPDATE ON mcp_servers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_mcp_tools_updated_at BEFORE UPDATE ON mcp_tools FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_workflows_updated_at BEFORE UPDATE ON workflows FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_llm_providers_updated_at BEFORE UPDATE ON llm_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========================================
-- 초기 데이터 삽입
-- ========================================

-- 기본 사용자 (admin)
INSERT INTO users (username, email, password_hash, full_name, role)
VALUES ('admin', 'admin@automation-system.com', '$2b$10$dummy.hash.for.development', 'System Administrator', 'admin');

-- 기본 장비 그룹
INSERT INTO device_groups (name, description)
VALUES 
    ('Production', '프로덕션 환경 장비'),
    ('Development', '개발 환경 장비'),
    ('Testing', '테스트 환경 장비');

-- 기본 시스템 설정
INSERT INTO system_settings (key, value, description, category)
VALUES 
    ('system.version', '"v3.1.0"', '시스템 버전', 'system'),
    ('security.jwt_expiry', '"1h"', 'JWT 토큰 만료 시간', 'security'),
    ('metrics.collection_interval', '300', '메트릭 수집 간격 (초)', 'monitoring'),
    ('llm.default_provider', '"openai"', '기본 LLM 프로바이더', 'llm');

-- ========================================
-- 권한 및 보안 설정
-- ========================================

-- RLS (Row Level Security) 활성화 (필요시)
-- ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;

-- 백업 및 복구를 위한 뷰 생성
CREATE VIEW system_health AS
SELECT 
    'devices' as resource_type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    COUNT(*) FILTER (WHERE status = 'inactive') as inactive_count,
    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance_count
FROM devices
UNION ALL
SELECT 
    'workflows' as resource_type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    COUNT(*) FILTER (WHERE status = 'inactive') as inactive_count,
    0 as maintenance_count
FROM workflows
UNION ALL
SELECT 
    'mcp_servers' as resource_type,
    COUNT(*) as total_count,
    COUNT(*) FILTER (WHERE status = 'active') as active_count,
    COUNT(*) FILTER (WHERE status = 'inactive') as inactive_count,
    COUNT(*) FILTER (WHERE status = 'maintenance') as maintenance_count
FROM mcp_servers;

-- ========================================
-- 스키마 버전 정보
-- ========================================

INSERT INTO system_settings (key, value, description, category)
VALUES ('database.schema_version', '"1.0.0"', '데이터베이스 스키마 버전', 'system')
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = CURRENT_TIMESTAMP;
