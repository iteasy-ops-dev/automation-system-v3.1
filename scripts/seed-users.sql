-- ========================================
-- 초기 사용자 데이터 생성 스크립트
-- ========================================

-- 관리자 사용자 생성
INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    full_name,
    role,
    status,
    preferences,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    'admin',
    'admin@automation.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewcuZrXbH6PfZvDi', -- password: admin123
    '시스템 관리자',
    'admin',
    'active',
    '{"theme": "dark", "language": "ko"}'::jsonb,
    NOW(),
    NOW()
) ON CONFLICT (username) DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    updated_at = NOW();

-- 일반 사용자 생성
INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    full_name,
    role,
    status,
    preferences,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    'user',
    'user@automation.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewcuZrXbH6PfZvDi', -- password: user123
    '일반 사용자',
    'user',
    'active',
    '{"theme": "light", "language": "ko"}'::jsonb,
    NOW(),
    NOW()
) ON CONFLICT (username) DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    updated_at = NOW();

-- 데모 사용자 생성
INSERT INTO users (
    id,
    username,
    email,
    password_hash,
    full_name,
    role,
    status,
    preferences,
    created_at,
    updated_at
) VALUES (
    uuid_generate_v4(),
    'demo',
    'demo@automation.local',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewcuZrXbH6PfZvDi', -- password: demo123
    '데모 사용자',
    'user',
    'active',
    '{"theme": "auto", "language": "ko"}'::jsonb,
    NOW(),
    NOW()
) ON CONFLICT (username) DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    updated_at = NOW();

-- 생성된 사용자 확인
SELECT 
    id, 
    username, 
    email, 
    role, 
    status, 
    created_at 
FROM users 
ORDER BY created_at DESC;
