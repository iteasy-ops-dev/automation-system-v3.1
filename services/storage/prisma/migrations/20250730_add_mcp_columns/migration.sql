-- MCP Protocol 표준 컬럼들 추가
-- 이 마이그레이션은 MCP 서비스가 Model Context Protocol 표준에 맞게 작동하도록 필요한 컬럼들을 추가합니다.

-- MCP Protocol 핵심 컬럼들
ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "connection_status" VARCHAR(20) DEFAULT 'disconnected';
ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "transport" VARCHAR(20) DEFAULT 'stdio';
ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "command" VARCHAR(500);
ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "args" TEXT[] DEFAULT '{}';

-- Transport별 설정 컬럼들
ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "ssh_config" JSONB;
ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "docker_config" JSONB;
ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "http_config" JSONB;

-- MCP 서버 정보 및 메타데이터
ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "server_info" JSONB;
ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "last_error" TEXT;
ALTER TABLE "mcp_servers" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}';

-- 기존 NOT NULL 제약 조건 완화 (MCP Protocol에서는 선택적)
ALTER TABLE "mcp_servers" ALTER COLUMN "endpoint_url" DROP NOT NULL;
ALTER TABLE "mcp_servers" ALTER COLUMN "server_type" DROP NOT NULL;

-- 성능을 위한 인덱스 추가
CREATE INDEX IF NOT EXISTS "idx_mcp_servers_transport" ON "mcp_servers"("transport");
CREATE INDEX IF NOT EXISTS "idx_mcp_servers_connection_status" ON "mcp_servers"("connection_status");

-- 트리거 및 제약 조건 업데이트
-- status 체크 제약 조건 업데이트 (기존과 호환)
ALTER TABLE "mcp_servers" DROP CONSTRAINT IF EXISTS "mcp_servers_status_check";
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_status_check" 
  CHECK ("status"::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying, 'error'::character varying, 'maintenance'::character varying]::text[]));

-- connection_status 체크 제약 조건 추가
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_connection_status_check" 
  CHECK ("connection_status"::text = ANY (ARRAY['connected'::character varying, 'disconnected'::character varying, 'connecting'::character varying, 'error'::character varying]::text[]));

-- transport 체크 제약 조건 추가
ALTER TABLE "mcp_servers" ADD CONSTRAINT "mcp_servers_transport_check" 
  CHECK ("transport"::text = ANY (ARRAY['stdio'::character varying, 'ssh'::character varying, 'docker'::character varying, 'http'::character varying]::text[]));
