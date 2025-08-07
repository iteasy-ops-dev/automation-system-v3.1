/**
 * Storage Service 마이그레이션 스크립트
 * MCP 스키마를 영구적으로 적용하는 완전한 해결책
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// 간단한 로거 (Logger 클래스 의존성 제거)
const logger = {
  info: (message: string, ...args: any[]) => console.log(`[INFO] ${message}`, ...args),
  warn: (message: string, ...args: any[]) => console.warn(`[WARN] ${message}`, ...args),
  error: (message: string, ...args: any[]) => console.error(`[ERROR] ${message}`, ...args)
};

export class MCPSchemaMigrator {
  
  /**
   * MCP 스키마 마이그레이션 실행
   * 컨테이너 재빌드시에도 항상 적용됨
   */
  static async applyMCPMigration(): Promise<void> {
    logger.info('🔄 MCP 스키마 마이그레이션 시작...');
    
    try {
      const migrationSQL = `
        -- MCP Protocol 표준 컬럼들 추가 (영구 해결책)
        DO $$
        BEGIN
          -- connection_status 컬럼 추가
          BEGIN
            ALTER TABLE mcp_servers ADD COLUMN connection_status VARCHAR(20) DEFAULT 'disconnected';
            RAISE NOTICE 'connection_status 컬럼 추가됨';
          EXCEPTION
            WHEN duplicate_column THEN
              RAISE NOTICE 'connection_status 컬럼 이미 존재함';
          END;

          -- transport 컬럼 추가
          BEGIN
            ALTER TABLE mcp_servers ADD COLUMN transport VARCHAR(20) DEFAULT 'stdio';
            RAISE NOTICE 'transport 컬럼 추가됨';
          EXCEPTION
            WHEN duplicate_column THEN
              RAISE NOTICE 'transport 컬럼 이미 존재함';
          END;

          -- command 컬럼 추가
          BEGIN
            ALTER TABLE mcp_servers ADD COLUMN command VARCHAR(500);
            RAISE NOTICE 'command 컬럼 추가됨';
          EXCEPTION
            WHEN duplicate_column THEN
              RAISE NOTICE 'command 컬럼 이미 존재함';
          END;

          -- args 컬럼 추가
          BEGIN
            ALTER TABLE mcp_servers ADD COLUMN args TEXT[] DEFAULT '{}';
            RAISE NOTICE 'args 컬럼 추가됨';
          EXCEPTION
            WHEN duplicate_column THEN
              RAISE NOTICE 'args 컬럼 이미 존재함';
          END;

          -- ssh_config 컬럼 추가
          BEGIN
            ALTER TABLE mcp_servers ADD COLUMN ssh_config JSONB;
            RAISE NOTICE 'ssh_config 컬럼 추가됨';
          EXCEPTION
            WHEN duplicate_column THEN
              RAISE NOTICE 'ssh_config 컬럼 이미 존재함';
          END;

          -- docker_config 컬럼 추가
          BEGIN
            ALTER TABLE mcp_servers ADD COLUMN docker_config JSONB;
            RAISE NOTICE 'docker_config 컬럼 추가됨';
          EXCEPTION
            WHEN duplicate_column THEN
              RAISE NOTICE 'docker_config 컬럼 이미 존재함';
          END;

          -- http_config 컬럼 추가
          BEGIN
            ALTER TABLE mcp_servers ADD COLUMN http_config JSONB;
            RAISE NOTICE 'http_config 컬럼 추가됨';
          EXCEPTION
            WHEN duplicate_column THEN
              RAISE NOTICE 'http_config 컬럼 이미 존재함';
          END;

          -- server_info 컬럼 추가
          BEGIN
            ALTER TABLE mcp_servers ADD COLUMN server_info JSONB;
            RAISE NOTICE 'server_info 컬럼 추가됨';
          EXCEPTION
            WHEN duplicate_column THEN
              RAISE NOTICE 'server_info 컬럼 이미 존재함';
          END;

          -- last_error 컬럼 추가
          BEGIN
            ALTER TABLE mcp_servers ADD COLUMN last_error TEXT;
            RAISE NOTICE 'last_error 컬럼 추가됨';
          EXCEPTION
            WHEN duplicate_column THEN
              RAISE NOTICE 'last_error 컬럼 이미 존재함';
          END;

          -- metadata 컬럼 추가
          BEGIN
            ALTER TABLE mcp_servers ADD COLUMN metadata JSONB DEFAULT '{}';
            RAISE NOTICE 'metadata 컬럼 추가됨';
          EXCEPTION
            WHEN duplicate_column THEN
              RAISE NOTICE 'metadata 컬럼 이미 존재함';
          END;

          -- NOT NULL 제약 조건 제거
          BEGIN
            ALTER TABLE mcp_servers ALTER COLUMN endpoint_url DROP NOT NULL;
            RAISE NOTICE 'endpoint_url NOT NULL 제약 조건 제거됨';
          EXCEPTION
            WHEN others THEN
              RAISE NOTICE 'endpoint_url NOT NULL 제약 조건 제거 스킵됨';
          END;

          BEGIN
            ALTER TABLE mcp_servers ALTER COLUMN server_type DROP NOT NULL;
            RAISE NOTICE 'server_type NOT NULL 제약 조건 제거됨';
          EXCEPTION
            WHEN others THEN
              RAISE NOTICE 'server_type NOT NULL 제약 조건 제거 스킵됨';
          END;

        END
        $$;

        -- 인덱스 추가
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_transport ON mcp_servers(transport);
        CREATE INDEX IF NOT EXISTS idx_mcp_servers_connection_status ON mcp_servers(connection_status);

        -- 제약 조건 추가 (안전하게)
        DO $$
        BEGIN
          BEGIN
            ALTER TABLE mcp_servers ADD CONSTRAINT mcp_servers_connection_status_check 
              CHECK (connection_status::text = ANY (ARRAY['connected'::character varying, 'disconnected'::character varying, 'connecting'::character varying, 'error'::character varying]::text[]));
            RAISE NOTICE 'connection_status 체크 제약 조건 추가됨';
          EXCEPTION
            WHEN duplicate_object THEN
              RAISE NOTICE 'connection_status 체크 제약 조건 이미 존재함';
          END;

          BEGIN
            ALTER TABLE mcp_servers ADD CONSTRAINT mcp_servers_transport_check 
              CHECK (transport::text = ANY (ARRAY['stdio'::character varying, 'ssh'::character varying, 'docker'::character varying, 'http'::character varying]::text[]));
            RAISE NOTICE 'transport 체크 제약 조건 추가됨';
          EXCEPTION
            WHEN duplicate_object THEN
              RAISE NOTICE 'transport 체크 제약 조건 이미 존재함';
          END;
        END
        $$;
      `;

      // 환경변수에서 데이터베이스 연결 정보 가져오기
      const host = process.env.POSTGRES_HOST || 'postgres';
      const port = process.env.POSTGRES_PORT || '5432';
      const user = process.env.POSTGRES_USER || 'postgres';
      const password = process.env.POSTGRES_PASSWORD || 'password';
      const database = process.env.POSTGRES_DB || 'automation';

      // PostgreSQL 연결 대기
      await MCPSchemaMigrator.waitForDatabase(host, port, user, password, database);

      // 마이그레이션 실행
      const command = `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${user} -d ${database} -c "${migrationSQL.replace(/"/g, '\\"')}"`;
      
      const { stdout, stderr } = await execAsync(command);
      
      if (stdout) {
        logger.info('✅ MCP 마이그레이션 성공:', stdout);
      }
      
      if (stderr && !stderr.includes('NOTICE')) {
        logger.warn('⚠️ MCP 마이그레이션 경고:', stderr);
      }

      logger.info('✅ MCP 스키마 마이그레이션 완료');
      
    } catch (error) {
      logger.error('❌ MCP 마이그레이션 실패:', error);
      // 마이그레이션 실패해도 서비스는 계속 시작
      // (개발 환경에서는 수동으로 스키마를 적용할 수 있음)
    }
  }

  /**
   * 데이터베이스 연결 대기
   */
  private static async waitForDatabase(
    host: string, 
    port: string, 
    user: string, 
    password: string, 
    database: string,
    maxRetries: number = 12
  ): Promise<void> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        const command = `PGPASSWORD="${password}" pg_isready -h ${host} -p ${port} -U ${user}`;
        await execAsync(command);
        
        // 데이터베이스 존재 확인
        const dbCheckCommand = `PGPASSWORD="${password}" psql -h ${host} -p ${port} -U ${user} -lqt | cut -d \\| -f 1 | grep -w ${database}`;
        await execAsync(dbCheckCommand);
        
        logger.info(`✅ 데이터베이스 연결 확인: ${host}:${port}/${database}`);
        return;
      } catch (error) {
        if (i === maxRetries - 1) {
          throw new Error(`데이터베이스 연결 실패: ${host}:${port}/${database}`);
        }
        logger.info(`⏳ 데이터베이스 연결 대기 중... (${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }
}
