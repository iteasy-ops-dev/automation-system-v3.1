-- V6__Add_Device_ConnectionInfo.sql
-- Device 테이블에 connection_info JSONB 컬럼 추가
-- 연결 정보(IP, 포트, 인증 정보) 저장용

-- Device 테이블에 connection_info 컬럼 추가
ALTER TABLE devices 
ADD COLUMN connection_info JSONB;

-- connection_info 컬럼에 대한 GIN 인덱스 추가 (JSON 쿼리 성능 향상)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_devices_connection_info_gin 
ON devices USING GIN (connection_info);

-- 기존 데이터에 대한 기본값 설정 (선택사항)
-- UPDATE devices SET connection_info = '{}' WHERE connection_info IS NULL;

-- 컬럼 추가 완료 로그
INSERT INTO flyway_schema_history (
    installed_rank, 
    version, 
    description, 
    type, 
    script, 
    checksum, 
    installed_by, 
    installed_on, 
    execution_time, 
    success
) VALUES (
    (SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM flyway_schema_history),
    '6',
    'Add Device ConnectionInfo',
    'SQL',
    'V6__Add_Device_ConnectionInfo.sql',
    0,
    'postgres',
    NOW(),
    100,
    true
) ON CONFLICT DO NOTHING;
