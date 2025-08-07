#!/bin/bash

# 통합 자동화 시스템 - 데이터베이스 스키마 동기화 스크립트

set -e

echo "🔧 데이터베이스 스키마 동기화 시작..."

# 1. connection_info 컬럼 추가 (devices 테이블)
echo "📝 devices.connection_info 컬럼 확인 및 추가..."
docker exec automation-postgres psql -U postgres -d automation -c "
DO \$\$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'devices' AND column_name = 'connection_info'
  ) THEN
    ALTER TABLE devices ADD COLUMN connection_info JSONB;
    RAISE NOTICE 'connection_info 컬럼이 추가되었습니다.';
  ELSE
    RAISE NOTICE 'connection_info 컬럼이 이미 존재합니다.';
  END IF;
END
\$\$;
"

# 2. MCP 관련 컬럼들 추가
echo "📝 MCP 서버 관련 컬럼들 확인 및 추가..."
docker exec automation-postgres psql -U postgres -d automation << 'EOF'
DO $$
BEGIN
  -- connection_status 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mcp_servers' AND column_name = 'connection_status'
  ) THEN
    ALTER TABLE mcp_servers ADD COLUMN connection_status VARCHAR(20) DEFAULT 'disconnected';
    RAISE NOTICE 'connection_status 컬럼이 추가되었습니다.';
  END IF;

  -- transport 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mcp_servers' AND column_name = 'transport'
  ) THEN
    ALTER TABLE mcp_servers ADD COLUMN transport VARCHAR(20) DEFAULT 'stdio';
    RAISE NOTICE 'transport 컬럼이 추가되었습니다.';
  END IF;

  -- command 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mcp_servers' AND column_name = 'command'
  ) THEN
    ALTER TABLE mcp_servers ADD COLUMN command VARCHAR(500);
    RAISE NOTICE 'command 컬럼이 추가되었습니다.';
  END IF;

  -- args 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mcp_servers' AND column_name = 'args'
  ) THEN
    ALTER TABLE mcp_servers ADD COLUMN args TEXT[] DEFAULT '{}';
    RAISE NOTICE 'args 컬럼이 추가되었습니다.';
  END IF;

  -- ssh_config 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mcp_servers' AND column_name = 'ssh_config'
  ) THEN
    ALTER TABLE mcp_servers ADD COLUMN ssh_config JSONB;
    RAISE NOTICE 'ssh_config 컬럼이 추가되었습니다.';
  END IF;

  -- docker_config 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mcp_servers' AND column_name = 'docker_config'
  ) THEN
    ALTER TABLE mcp_servers ADD COLUMN docker_config JSONB;
    RAISE NOTICE 'docker_config 컬럼이 추가되었습니다.';
  END IF;

  -- http_config 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mcp_servers' AND column_name = 'http_config'
  ) THEN
    ALTER TABLE mcp_servers ADD COLUMN http_config JSONB;
    RAISE NOTICE 'http_config 컬럼이 추가되었습니다.';
  END IF;

  -- server_info 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mcp_servers' AND column_name = 'server_info'
  ) THEN
    ALTER TABLE mcp_servers ADD COLUMN server_info JSONB;
    RAISE NOTICE 'server_info 컬럼이 추가되었습니다.';
  END IF;

  -- last_error 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mcp_servers' AND column_name = 'last_error'
  ) THEN
    ALTER TABLE mcp_servers ADD COLUMN last_error TEXT;
    RAISE NOTICE 'last_error 컬럼이 추가되었습니다.';
  END IF;

  -- metadata 컬럼 추가
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'mcp_servers' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE mcp_servers ADD COLUMN metadata JSONB DEFAULT '{}';
    RAISE NOTICE 'metadata 컬럼이 추가되었습니다.';
  END IF;
END
$$;
EOF

# 3. Prisma 마이그레이션 동기화
echo "📝 Prisma 마이그레이션 상태 확인..."
docker exec automation-storage npx prisma migrate status || true

# 4. Storage 서비스 재시작
echo "🔄 Storage 서비스 재시작..."
docker-compose restart storage

echo "✅ 데이터베이스 스키마 동기화 완료!"
echo "📋 다음 명령으로 상태를 확인하세요:"
echo "  docker logs -f automation-storage --tail 50"
