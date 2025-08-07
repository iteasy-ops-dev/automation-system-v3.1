#!/bin/bash
# ========================================
# PostgreSQL 초기화 스크립트
# Docker 컨테이너 시작 시 자동 실행
# ========================================

set -e

# 데이터베이스가 이미 초기화되었는지 확인
if [ ! -f /var/lib/postgresql/data/.automation_initialized ]; then
    echo "Initializing automation system database..."
    
    # automation 데이터베이스 생성 (이미 존재할 수 있음)
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
        -- 확장 기능 설치
        CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
        CREATE EXTENSION IF NOT EXISTS "citext";
        
        -- 애플리케이션 사용자 생성
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'automation_app') THEN
                CREATE USER automation_app WITH PASSWORD 'automation_app_password';
            END IF;
        END
        \$\$;
        
        -- 권한 부여
        GRANT CONNECT ON DATABASE automation TO automation_app;
        GRANT USAGE ON SCHEMA public TO automation_app;
        GRANT CREATE ON SCHEMA public TO automation_app;
        
        -- 기본 테이블 스페이스 확인
        SELECT tablespace_name FROM pg_tablespaces;
        
    EOSQL
    
    echo "PostgreSQL initialization completed successfully."
    
    # 초기화 완료 마커 파일 생성
    touch /var/lib/postgresql/data/.automation_initialized
else
    echo "PostgreSQL already initialized, skipping..."
fi

echo "PostgreSQL initialization script completed."
