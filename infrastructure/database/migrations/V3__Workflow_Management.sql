-- ========================================
-- Flyway Migration V3__Workflow_Management.sql
-- 워크플로우 관리 테이블 추가
-- ========================================

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

-- 인덱스 생성
CREATE INDEX idx_workflows_status ON workflows(status);
CREATE INDEX idx_workflows_created_by ON workflows(created_by);
CREATE INDEX idx_workflow_executions_workflow_id ON workflow_executions(workflow_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at);
CREATE INDEX idx_workflow_execution_steps_execution_id ON workflow_execution_steps(execution_id);
