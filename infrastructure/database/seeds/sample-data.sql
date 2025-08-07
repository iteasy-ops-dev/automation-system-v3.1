-- ========================================
-- 시드 데이터 - 개발 및 테스트용 샘플 데이터
-- 계약 스키마와 100% 일치하는 테스트 데이터
-- ========================================

-- 추가 사용자 생성
INSERT INTO users (username, email, password_hash, full_name, role, status) VALUES
('developer', 'dev@automation-system.com', '$2b$10$dummy.hash.for.development', 'Developer User', 'user', 'active'),
('operator', 'operator@automation-system.com', '$2b$10$dummy.hash.for.development', 'System Operator', 'operator', 'active'),
('viewer', 'viewer@automation-system.com', '$2b$10$dummy.hash.for.development', 'Read Only User', 'viewer', 'active')
ON CONFLICT (username) DO NOTHING;

-- 추가 장비 그룹 생성
INSERT INTO device_groups (name, description, metadata) VALUES
('Web Servers', '웹 서버 그룹', '{"environment": "production", "tier": "frontend"}'),
('Database Servers', '데이터베이스 서버 그룹', '{"environment": "production", "tier": "backend"}'),
('Load Balancers', '로드 밸런서 그룹', '{"environment": "production", "tier": "network"}'),
('Monitoring', '모니터링 시스템', '{"environment": "infrastructure", "tier": "monitoring"}')
ON CONFLICT (name, parent_id) DO NOTHING;

-- 샘플 장비 생성 (Storage API 계약의 Device 스키마와 완전 일치)
DO $$
DECLARE
    web_group_id UUID;
    db_group_id UUID;
    lb_group_id UUID;
    monitor_group_id UUID;
BEGIN
    -- 그룹 ID 조회
    SELECT id INTO web_group_id FROM device_groups WHERE name = 'Web Servers';
    SELECT id INTO db_group_id FROM device_groups WHERE name = 'Database Servers';
    SELECT id INTO lb_group_id FROM device_groups WHERE name = 'Load Balancers';
    SELECT id INTO monitor_group_id FROM device_groups WHERE name = 'Monitoring';
    
    -- 웹 서버들
    INSERT INTO devices (name, type, status, group_id, metadata, tags) VALUES
    ('web-server-01', 'server', 'active', web_group_id, 
     '{"ip": "192.168.1.101", "os": "Ubuntu 22.04", "cpu_cores": 4, "memory_gb": 8, "disk_gb": 100}',
     ARRAY['production', 'web', 'frontend', 'nginx']),
    ('web-server-02', 'server', 'active', web_group_id,
     '{"ip": "192.168.1.102", "os": "Ubuntu 22.04", "cpu_cores": 4, "memory_gb": 8, "disk_gb": 100}',
     ARRAY['production', 'web', 'frontend', 'nginx']),
    ('web-server-03', 'server', 'maintenance', web_group_id,
     '{"ip": "192.168.1.103", "os": "Ubuntu 22.04", "cpu_cores": 4, "memory_gb": 8, "disk_gb": 100}',
     ARRAY['production', 'web', 'frontend', 'nginx'])
    ON CONFLICT (name) DO NOTHING;
    
    -- 데이터베이스 서버들
    INSERT INTO devices (name, type, status, group_id, metadata, tags) VALUES
    ('db-primary-01', 'server', 'active', db_group_id,
     '{"ip": "192.168.1.201", "os": "Ubuntu 22.04", "cpu_cores": 8, "memory_gb": 32, "disk_gb": 500, "role": "primary"}',
     ARRAY['production', 'database', 'backend', 'postgresql', 'primary']),
    ('db-replica-01', 'server', 'active', db_group_id,
     '{"ip": "192.168.1.202", "os": "Ubuntu 22.04", "cpu_cores": 8, "memory_gb": 32, "disk_gb": 500, "role": "replica"}',
     ARRAY['production', 'database', 'backend', 'postgresql', 'replica']),
    ('cache-redis-01', 'server', 'active', db_group_id,
     '{"ip": "192.168.1.203", "os": "Ubuntu 22.04", "cpu_cores": 2, "memory_gb": 16, "disk_gb": 50}',
     ARRAY['production', 'cache', 'backend', 'redis'])
    ON CONFLICT (name) DO NOTHING;
    
    -- 네트워크 장비들
    INSERT INTO devices (name, type, status, group_id, metadata, tags) VALUES
    ('lb-haproxy-01', 'network', 'active', lb_group_id,
     '{"ip": "192.168.1.10", "model": "HAProxy", "version": "2.8", "ports": [80, 443]}',
     ARRAY['production', 'loadbalancer', 'haproxy']),
    ('switch-core-01', 'network', 'active', NULL,
     '{"ip": "192.168.1.1", "model": "Cisco Catalyst 2960", "ports": 48}',
     ARRAY['production', 'network', 'switch', 'core']),
    ('firewall-01', 'network', 'active', NULL,
     '{"ip": "192.168.1.254", "model": "pfSense", "version": "2.7"}',
     ARRAY['production', 'security', 'firewall'])
    ON CONFLICT (name) DO NOTHING;
    
    -- 스토리지 및 모니터링
    INSERT INTO devices (name, type, status, group_id, metadata, tags) VALUES
    ('storage-nfs-01', 'storage', 'active', NULL,
     '{"ip": "192.168.1.50", "capacity_tb": 10, "protocol": "NFS", "raid_level": "RAID6"}',
     ARRAY['production', 'storage', 'nfs']),
    ('monitor-prometheus', 'server', 'active', monitor_group_id,
     '{"ip": "192.168.1.90", "os": "Ubuntu 22.04", "cpu_cores": 2, "memory_gb": 4}',
     ARRAY['infrastructure', 'monitoring', 'prometheus']),
    ('sensor-temp-01', 'iot', 'active', monitor_group_id,
     '{"location": "server_room_a", "type": "temperature", "range": "-40 to 85C"}',
     ARRAY['iot', 'sensor', 'temperature'])
    ON CONFLICT (name) DO NOTHING;
    
END $$;

-- MCP 서버 샘플 데이터
INSERT INTO mcp_servers (name, description, server_type, endpoint_url, connection_config, status, version, capabilities) VALUES
('SSH Management Server', 'SSH 기반 서버 관리 도구', 'ssh', 'ssh://mcp-ssh:22', 
 '{"timeout": 30, "max_connections": 10, "auth_method": "key"}', 'active', '1.0.0',
 '["execute_command", "file_transfer", "system_info"]'),
('HTTP API Server', 'REST API 통합 서버', 'http', 'http://mcp-http:8080', 
 '{"timeout": 10, "retry_count": 3}', 'active', '1.2.0',
 '["http_request", "api_call", "webhook"]'),
('Database Query Server', '데이터베이스 쿼리 실행', 'database', 'postgresql://mcp-db:5432', 
 '{"pool_size": 5, "timeout": 60}', 'active', '2.0.0',
 '["sql_query", "backup", "maintenance"]')
ON CONFLICT (name) DO NOTHING;

-- MCP 도구 샘플 데이터
DO $$
DECLARE
    ssh_server_id UUID;
    http_server_id UUID;
    db_server_id UUID;
BEGIN
    SELECT id INTO ssh_server_id FROM mcp_servers WHERE name = 'SSH Management Server';
    SELECT id INTO http_server_id FROM mcp_servers WHERE name = 'HTTP API Server';
    SELECT id INTO db_server_id FROM mcp_servers WHERE name = 'Database Query Server';
    
    INSERT INTO mcp_tools (server_id, name, description, version, schema, capabilities, is_enabled) VALUES
    (ssh_server_id, 'ssh_cpu_check', 'CPU 사용률 확인', '1.0.0', 
     '{"input": {"host": "string", "timeout": "number"}, "output": {"cpu_usage": "number"}}',
     '["monitoring", "system"]', true),
    (ssh_server_id, 'ssh_restart_service', '서비스 재시작', '1.0.0',
     '{"input": {"host": "string", "service": "string"}, "output": {"success": "boolean", "message": "string"}}',
     '["management", "service"]', true),
    (http_server_id, 'http_health_check', 'HTTP 헬스 체크', '1.0.0',
     '{"input": {"url": "string", "timeout": "number"}, "output": {"status": "number", "response_time": "number"}}',
     '["monitoring", "http"]', true),
    (db_server_id, 'db_backup', '데이터베이스 백업', '1.0.0',
     '{"input": {"database": "string", "location": "string"}, "output": {"backup_file": "string", "size": "number"}}',
     '["backup", "maintenance"]', true)
    ON CONFLICT (server_id, name) DO NOTHING;
END $$;

-- 워크플로우 샘플 데이터
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    SELECT id INTO admin_user_id FROM users WHERE username = 'admin';
    
    INSERT INTO workflows (name, description, definition, tags, created_by) VALUES
    ('Server Health Check', '서버 상태 확인 워크플로우',
     '{"steps": [{"type": "mcp_call", "tool": "ssh_cpu_check", "params": {"timeout": 30}}, {"type": "condition", "check": "cpu_usage > 90"}, {"type": "mcp_call", "tool": "ssh_restart_service", "condition": "previous_step_true"}]}',
     ARRAY['monitoring', 'health', 'automated'], admin_user_id),
    ('Daily Backup', '일일 백업 작업',
     '{"schedule": "0 2 * * *", "steps": [{"type": "mcp_call", "tool": "db_backup", "params": {"location": "/backups"}}]}',
     ARRAY['backup', 'scheduled', 'maintenance'], admin_user_id),
    ('Load Balancer Check', '로드 밸런서 상태 확인',
     '{"steps": [{"type": "mcp_call", "tool": "http_health_check", "params": {"url": "http://lb-haproxy-01/health"}}]}',
     ARRAY['network', 'monitoring'], admin_user_id)
    ON CONFLICT (name, version) DO NOTHING;
END $$;

-- LLM 프로바이더 샘플 데이터
INSERT INTO llm_providers (name, provider_type, api_endpoint, models, rate_limits, status) VALUES
('OpenAI', 'openai', 'https://api.openai.com/v1', 
 '["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"]',
 '{"requests_per_minute": 60, "tokens_per_minute": 90000}', 'active'),
('Anthropic', 'anthropic', 'https://api.anthropic.com/v1',
 '["claude-3-opus", "claude-3-sonnet", "claude-3-haiku"]',
 '{"requests_per_minute": 50, "tokens_per_minute": 80000}', 'active'),
('Local Ollama', 'ollama', 'http://ollama:11434',
 '["llama2", "codellama", "mistral"]',
 '{"requests_per_minute": 100, "tokens_per_minute": 50000}', 'inactive')
ON CONFLICT (name) DO NOTHING;

-- 시스템 설정 추가
INSERT INTO system_settings (key, value, description, category) VALUES
('ui.theme', '"dark"', '기본 UI 테마', 'ui'),
('ui.language', '"ko"', '기본 언어', 'ui'),
('monitoring.alert_email', '"admin@automation-system.com"', '알림 이메일', 'monitoring'),
('monitoring.slack_webhook', '""', 'Slack 웹훅 URL', 'monitoring'),
('backup.retention_days', '30', '백업 보존 기간', 'backup'),
('security.session_timeout', '3600', '세션 타임아웃 (초)', 'security'),
('security.max_login_attempts', '5', '최대 로그인 시도 횟수', 'security'),
('workflow.max_concurrent_executions', '10', '최대 동시 실행 워크플로우 수', 'workflow'),
('mcp.connection_timeout', '30', 'MCP 연결 타임아웃 (초)', 'mcp'),
('llm.default_model', '"gpt-4"', '기본 LLM 모델', 'llm'),
('llm.max_tokens', '4000', '최대 토큰 수', 'llm')
ON CONFLICT (key) DO NOTHING;

-- 샘플 장비 상태 히스토리
DO $$
DECLARE
    device_id UUID;
BEGIN
    SELECT id INTO device_id FROM devices WHERE name = 'web-server-03';
    
    INSERT INTO device_status_history (device_id, previous_status, current_status, reason, changed_at) VALUES
    (device_id, 'active', 'maintenance', 'Scheduled maintenance for security updates', NOW() - INTERVAL '2 hours');
END $$;

-- 샘플 감사 로그
DO $$
DECLARE
    admin_user_id UUID;
    device_id UUID;
BEGIN
    SELECT id INTO admin_user_id FROM users WHERE username = 'admin';
    SELECT id INTO device_id FROM devices WHERE name = 'web-server-01';
    
    INSERT INTO audit_logs (action, resource_type, resource_id, user_id, ip_address, details) VALUES
    ('CREATE', 'device', device_id, admin_user_id, '192.168.1.100'::inet, 
     '{"action": "device_created", "device_name": "web-server-01", "device_type": "server"}'),
    ('UPDATE', 'device', device_id, admin_user_id, '192.168.1.100'::inet,
     '{"action": "device_updated", "changed_fields": ["status"], "old_status": "inactive", "new_status": "active"}');
END $$;

-- 성능을 위한 통계 정보 업데이트
ANALYZE users;
ANALYZE devices;
ANALYZE device_groups;
ANALYZE mcp_servers;
ANALYZE mcp_tools;
ANALYZE workflows;
ANALYZE llm_providers;
ANALYZE system_settings;

-- 완료 메시지
DO $$
BEGIN
    RAISE NOTICE '시드 데이터 삽입이 완료되었습니다.';
    RAISE NOTICE '- 사용자: % 명', (SELECT COUNT(*) FROM users);
    RAISE NOTICE '- 장비: % 대', (SELECT COUNT(*) FROM devices);
    RAISE NOTICE '- 장비 그룹: % 개', (SELECT COUNT(*) FROM device_groups);
    RAISE NOTICE '- MCP 서버: % 개', (SELECT COUNT(*) FROM mcp_servers);
    RAISE NOTICE '- MCP 도구: % 개', (SELECT COUNT(*) FROM mcp_tools);
    RAISE NOTICE '- 워크플로우: % 개', (SELECT COUNT(*) FROM workflows);
    RAISE NOTICE '- LLM 프로바이더: % 개', (SELECT COUNT(*) FROM llm_providers);
    RAISE NOTICE '- 시스템 설정: % 개', (SELECT COUNT(*) FROM system_settings);
END $$;
