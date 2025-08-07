import * as dotenv from 'dotenv';

// 환경 변수 로드
dotenv.config();

/**
 * Gateway Service 설정 관리
 * 환경 변수 검증 및 타입 안전성 보장
 */

// 설정 인터페이스 정의
export interface GatewayConfig {
  server: {
    port: number;
    host: string;
    corsOrigins: string[];
    trustProxy: boolean;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
    issuer: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
    connectTimeout: number;
    lazyConnect: boolean;
  };
  storage: {
    serviceUrl: string;
    timeout: number;
  };
  security: {
    bcryptRounds: number;
    rateLimitWindowMs: number;
    rateLimitMaxRequests: number;
  };
}

// 환경 변수 검증 헬퍼 함수들
function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`필수 환경 변수가 설정되지 않았습니다: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getNumberEnv(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(`환경 변수 ${key}는 숫자여야 합니다: ${value}`);
  }
  return parsed;
}

function getBooleanEnv(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

function getArrayEnv(key: string, defaultValue: string[]): string[] {
  const value = process.env[key];
  if (!value) return defaultValue;
  
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

// 설정 객체 생성
export const config: GatewayConfig = {
  server: {
    port: getNumberEnv('GATEWAY_PORT', 8080),
    host: getOptionalEnv('GATEWAY_HOST', '0.0.0.0'),
    corsOrigins: getArrayEnv('CORS_ORIGINS', ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002']),
    trustProxy: getBooleanEnv('TRUST_PROXY', true),
  },
  jwt: {
    accessSecret: getRequiredEnv('JWT_ACCESS_SECRET'),
    refreshSecret: getRequiredEnv('JWT_REFRESH_SECRET'),
    accessExpiresIn: getOptionalEnv('JWT_ACCESS_EXPIRES_IN', '1h'),
    refreshExpiresIn: getOptionalEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
    issuer: getOptionalEnv('JWT_ISSUER', 'automation-system-v3.1'),
  },
  redis: {
    host: getOptionalEnv('REDIS_HOST', 'localhost'),
    port: getNumberEnv('REDIS_PORT', 6379),
    password: process.env.REDIS_PASSWORD,
    db: getNumberEnv('REDIS_DB', 0),
    keyPrefix: getOptionalEnv('REDIS_KEY_PREFIX', 'automation:'),
    connectTimeout: getNumberEnv('REDIS_CONNECT_TIMEOUT', 10000),
    lazyConnect: getBooleanEnv('REDIS_LAZY_CONNECT', true),
  },
  storage: {
    serviceUrl: getOptionalEnv('STORAGE_SERVICE_URL', 'http://localhost:8001'),
    timeout: getNumberEnv('STORAGE_SERVICE_TIMEOUT', 5000),
  },
  security: {
    bcryptRounds: getNumberEnv('BCRYPT_ROUNDS', 12),
    rateLimitWindowMs: getNumberEnv('RATE_LIMIT_WINDOW_MS', 60000),
    rateLimitMaxRequests: getNumberEnv('RATE_LIMIT_MAX_REQUESTS', 100),
  },
};

// 설정 검증 함수
export function validateConfig(): void {
  if (config.jwt.accessSecret === config.jwt.refreshSecret) {
    throw new Error('JWT Access Secret과 Refresh Secret은 서로 달라야 합니다.');
  }
  
  if (config.jwt.accessSecret.length < 32) {
    throw new Error('JWT Access Secret은 최소 32자 이상이어야 합니다.');
  }
  
  if (config.jwt.refreshSecret.length < 32) {
    throw new Error('JWT Refresh Secret은 최소 32자 이상이어야 합니다.');
  }
}

// 설정 export
export const gatewayConfig = config;