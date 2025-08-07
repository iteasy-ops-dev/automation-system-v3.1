-- ========================================
-- Flyway Migration V5__Triggers_And_Functions.sql
-- 트리거 및 함수 추가
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
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at 
    BEFORE UPDATE ON devices 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_device_groups_updated_at 
    BEFORE UPDATE ON device_groups 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_servers_updated_at 
    BEFORE UPDATE ON mcp_servers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mcp_tools_updated_at 
    BEFORE UPDATE ON mcp_tools 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workflows_updated_at 
    BEFORE UPDATE ON workflows 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_llm_providers_updated_at 
    BEFORE UPDATE ON llm_providers 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 시스템 헬스 뷰 생성
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
