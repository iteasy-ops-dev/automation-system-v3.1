-- 통합 자동화 시스템 v3.1 - 추가 제약조건 스크립트
-- 이 파일은 초기 설치 시 올바른 제약조건을 설정합니다

-- 장비 상태 제약조건 수정 (Frontend와 Backend 모두 지원)
-- Frontend uses: 'online', 'offline', 'error', 'maintenance'
-- Backend uses: 'active', 'inactive', 'maintenance'
ALTER TABLE devices DROP CONSTRAINT IF EXISTS devices_status_check;
ALTER TABLE devices ADD CONSTRAINT devices_status_check 
CHECK (status IN ('online', 'offline', 'error', 'maintenance', 'active', 'inactive'));

-- MCP 서버 기본 데이터 설정 (초기 설치 시)
-- desktop-commander 서버가 없으면 추가
INSERT INTO mcp_servers (
  name, 
  transport, 
  command, 
  args, 
  status, 
  connection_status
) VALUES (
  'desktop-commander',
  'stdio',
  'npx',
  ARRAY['-y', '@modelcontextprotocol/server-desktop-commander', '--stdio'],
  'inactive',
  'disconnected'
) ON CONFLICT (name) DO NOTHING;

-- 기본 관리자 계정이 없으면 추가
INSERT INTO users (
  username,
  email,
  password_hash,
  full_name,
  role,
  status
) VALUES (
  'admin',
  'admin@automation.local',
  '$2a$10$VnQjAR1YUV5FdY8XH.KJg.oE1Rz7TfU2tYZtAHjPQG7bKdKdVVSO6', -- Admin123!@#
  'System Administrator',
  'administrator',
  'active'
) ON CONFLICT (username) DO NOTHING;
