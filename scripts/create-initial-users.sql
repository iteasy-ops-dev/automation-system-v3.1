-- 초기 사용자 생성 SQL
-- 통합 자동화 시스템 v3.1

-- 관리자 계정 생성
INSERT INTO users (username, email, password_hash, full_name, role, status)
VALUES (
  'admin',
  'admin@automation.local',
  '$2a$10$wZDS9rqehRCfOIEvvhK/DumafdbMGZyHNv4qdymULVRIoEJ4wialu',
  'System Administrator',
  'admin',
  'active'
) ON CONFLICT (username) DO NOTHING;

-- 데모 사용자 계정 생성
INSERT INTO users (username, email, password_hash, full_name, role, status)
VALUES (
  'demo',
  'demo@automation.local',
  '$2a$10$wZDS9rqehRCfOIEvvhK/Du1bXI4j8oiZBOFkZdq3v1C2A3Ui2m1VO',
  'Demo User',
  'user',
  'active'
) ON CONFLICT (username) DO NOTHING;

-- 생성된 사용자 확인
SELECT id, username, email, full_name, role, status, created_at 
FROM users 
ORDER BY created_at;
