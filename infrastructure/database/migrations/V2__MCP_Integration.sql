-- ========================================
-- Flyway Migration V2__MCP_Integration.sql
-- MCP 서버 및 도구 관리 테이블 추가
-- ========================================

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

-- 인덱스 생성
CREATE INDEX idx_mcp_servers_status ON mcp_servers(status);
CREATE INDEX idx_mcp_servers_server_type ON mcp_servers(server_type);
CREATE INDEX idx_mcp_tools_server_id ON mcp_tools(server_id);
CREATE INDEX idx_mcp_tools_name ON mcp_tools(name);
CREATE INDEX idx_mcp_executions_server_id ON mcp_executions(server_id);
CREATE INDEX idx_mcp_executions_status ON mcp_executions(status);
CREATE INDEX idx_mcp_executions_started_at ON mcp_executions(started_at);
