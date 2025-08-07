/**
 * Gateway Service 환경 설정
 * 계약 준수: shared/contracts/v1.0/rest/core/gateway-auth.yaml
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';

// 환경 변수 로드
config();

export interface GatewayConfig {
  // 서버 설정
  server: {
    port: number;
    host: string;
    environment: 'development' | 'staging' | 'production';
    cors: {
      origins: string[];
      credentials: boolean;
    };
  };

  // JWT 설정
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    issuer: string;
    audience: string;
  };

  // Redis 설정
  redis: {
    host: string;
    port: number;
    password?: string;
    database: number;
    keyPrefix: string;
  };

  // Storage Service 연동 설정
  storageService: {
    baseUrl: string;
    timeout: number;
    retries: number;
  };

  // Rate Limiting 설정
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    skipSuccessfulRequests: boolean;
  };

  // WebSocket 설정
  websocket: {
    port: number;
    maxConnections: number;
    heartbeatInterval: number;
    connectionTimeout: number;
  };

  // 보안 설정
  security: {
    bcryptRounds: number;
    sessionSecret: string;
    cookieMaxAge: number;
    httpsOnly: boolean;
  };

  // 로깅 설정
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    format: 'json' | 'simple';
    file?: string;
  };

  // 서비스 디스커버리 설정
  services: {
    device: { baseUrl: string; timeout: number };
    mcp: { baseUrl: string; timeout: number };
    llm: { baseUrl: string; timeout: number };
    workflow: { baseUrl: string; timeout: number };
  };
}
/**
 * 환경 변수 검증 및 기본값 설정
 */
function validateConfig(): GatewayConfig {
  const requiredEnvVars = [
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'REDIS_HOST',
    'STORAGE_SERVICE_URL'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`필수 환경 변수가 설정되지 않았습니다: ${envVar}`);
    }
  }

  return {
    server: {
      port: parseInt(process.env.GATEWAY_PORT || '8080', 10),
      host: process.env.GATEWAY_HOST || '0.0.0.0',
      environment: (process.env.NODE_ENV as any) || 'development',
      cors: {
        origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
        credentials: true,
      },
    },

    jwt: {
      accessSecret: process.env.JWT_ACCESS_SECRET!,
      refreshSecret: process.env.JWT_REFRESH_SECRET!,
      accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '1h',
      refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
      issuer: process.env.JWT_ISSUER || 'automation-system-gateway',
      audience: process.env.JWT_AUDIENCE || 'automation-system',
    },

    redis: {
      host: process.env.REDIS_HOST!,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      database: parseInt(process.env.REDIS_DB || '0', 10),
      keyPrefix: process.env.REDIS_KEY_PREFIX || 'automation:',
    },

    storageService: {
      baseUrl: process.env.STORAGE_SERVICE_URL!,
      timeout: parseInt(process.env.STORAGE_SERVICE_TIMEOUT || '5000', 10),
      retries: parseInt(process.env.STORAGE_SERVICE_RETRIES || '3', 10),
    },

    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10), // 1분
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
    },

    websocket: {
      port: parseInt(process.env.WEBSOCKET_PORT || '8081', 10),
      maxConnections: parseInt(process.env.WEBSOCKET_MAX_CONNECTIONS || '10000', 10),
      heartbeatInterval: parseInt(process.env.WEBSOCKET_HEARTBEAT_INTERVAL || '30000', 10),
      connectionTimeout: parseInt(process.env.WEBSOCKET_CONNECTION_TIMEOUT || '60000', 10),
    },

    security: {
      bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
      sessionSecret: process.env.SESSION_SECRET || 'gateway-session-secret',
      cookieMaxAge: parseInt(process.env.COOKIE_MAX_AGE || '3600000', 10), // 1시간
      httpsOnly: process.env.HTTPS_ONLY === 'true',
    },

    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
      format: (process.env.LOG_FORMAT as any) || 'json',
      file: process.env.LOG_FILE,
    },

    services: {
      device: {
        baseUrl: process.env.DEVICE_SERVICE_URL || 'http://localhost:8101',
        timeout: parseInt(process.env.DEVICE_SERVICE_TIMEOUT || '5000', 10),
      },
      mcp: {
        baseUrl: process.env.MCP_SERVICE_URL || 'http://localhost:8201',
        timeout: parseInt(process.env.MCP_SERVICE_TIMEOUT || '5000', 10),
      },
      llm: {
        baseUrl: process.env.LLM_SERVICE_URL || 'http://localhost:8301',
        timeout: parseInt(process.env.LLM_SERVICE_TIMEOUT || '5000', 10),
      },
      workflow: {
        baseUrl: process.env.WORKFLOW_SERVICE_URL || 'http://localhost:8401',
        timeout: parseInt(process.env.WORKFLOW_SERVICE_TIMEOUT || '5000', 10),
      },
    },
  };
}

// 설정 인스턴스 생성 및 검증
export const gatewayConfig: GatewayConfig = validateConfig();

// 개발 모드에서 설정 정보 출력
if (gatewayConfig.server.environment === 'development') {
  console.log('🚀 Gateway Configuration Loaded:');
  console.log(`   Server: ${gatewayConfig.server.host}:${gatewayConfig.server.port}`);
  console.log(`   Environment: ${gatewayConfig.server.environment}`);
  console.log(`   Redis: ${gatewayConfig.redis.host}:${gatewayConfig.redis.port}`);
  console.log(`   WebSocket: ${gatewayConfig.websocket.port}`);
}

export default gatewayConfig;