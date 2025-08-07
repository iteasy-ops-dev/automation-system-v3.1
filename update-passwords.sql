-- 개발용 사용자 패스워드 업데이트
-- 모든 사용자의 패스워드를 "password123"으로 설정

-- bcrypt 해시 생성을 위한 확장 설치 (이미 설치되어 있을 수도 있음)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 모든 사용자의 패스워드를 "password123"으로 업데이트
UPDATE users SET password_hash = crypt('password123', gen_salt('bf', 10));

-- 업데이트된 사용자 정보 확인
SELECT username, email, full_name, role, status, 
       CASE WHEN password_hash IS NOT NULL AND length(password_hash) > 10 THEN '✓ 설정됨' ELSE '✗ 미설정' END as password_status
FROM users 
ORDER BY created_at;

-- 로그인 테스트를 위한 쿼리 (실제로는 애플리케이션에서 처리)
-- SELECT username, (password_hash = crypt('password123', password_hash)) as password_valid 
-- FROM users WHERE username = 'admin';
