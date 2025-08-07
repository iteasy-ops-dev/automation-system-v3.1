-- fix-workflow-schema-corrected.sql
-- 실제 테이블 구조에 맞게 수정

-- 1. workflow_executions 테이블 수정
-- Foreign Key 제약 조건 제거 (n8n ID와 workflow 테이블의 UUID 불일치 해결)
ALTER TABLE workflow_executions 
DROP CONSTRAINT IF EXISTS workflow_executions_workflow_id_fkey;

-- workflow_id 컬럼을 VARCHAR(255)로 변경 (n8n ID 형식 지원)
ALTER TABLE workflow_executions 
ALTER COLUMN workflow_id TYPE VARCHAR(255);

-- 2. workflow_execution_steps 테이블 수정 (정확한 테이블명)
-- Foreign Key 제약 조건 제거 (execution_id 타입 변경을 위해)
ALTER TABLE workflow_execution_steps
DROP CONSTRAINT IF EXISTS workflow_execution_steps_execution_id_fkey;

-- execution_id 컬럼을 VARCHAR(255)로 변경
ALTER TABLE workflow_execution_steps
ALTER COLUMN execution_id TYPE VARCHAR(255);

-- 3. 인덱스 재생성 (성능 최적화)
-- workflow_executions 테이블 인덱스
DROP INDEX IF EXISTS idx_workflow_executions_workflow_id;
CREATE INDEX idx_workflow_executions_workflow_id 
ON workflow_executions(workflow_id);

-- workflow_execution_steps 테이블 인덱스
DROP INDEX IF EXISTS idx_workflow_execution_steps_execution_id;
CREATE INDEX idx_workflow_execution_steps_execution_id 
ON workflow_execution_steps(execution_id);

-- 4. 추가 인덱스 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_workflow_executions_session_id 
ON workflow_executions(session_id);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_status 
ON workflow_executions(status);

CREATE INDEX IF NOT EXISTS idx_workflow_executions_started_at 
ON workflow_executions(started_at);

-- 5. 확인 쿼리 실행
SELECT 
    table_name,
    column_name, 
    data_type, 
    character_maximum_length,
    is_nullable
FROM information_schema.columns
WHERE table_name IN ('workflow_executions', 'workflow_execution_steps')
AND column_name IN ('workflow_id', 'execution_id')
ORDER BY table_name, column_name;