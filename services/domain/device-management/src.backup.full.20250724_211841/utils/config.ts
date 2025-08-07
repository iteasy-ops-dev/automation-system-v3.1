/**
 * Device Management Service - 설정 관리
 * 환경 변수 기반 설정
 */

interface DatabaseConfig {
  url: string;
  maxConnections: number;
  timeout: number;
}

interface RedisConfig {
  host: string;
  port: number;
  db: number;
  password?: string;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
}

interface InfluxDBConfig {
  url: string;
  token: string;
  org: string;
  bucket: string;
  timeout: number;
}

interface KafkaConfig {
  brokers: string[];
  clientId: string;
  groupId: string;
  retry: {
    initialRetryTime: number;
    retries: number;
  };
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface LoggingConfig {
  level: string;
  format: string;
  file: boolean;
  console: boolean;
}

interface ServiceConfig {
  port: number;
  database: DatabaseConfig;
  redis: RedisConfig;
  influxdb: InfluxDBConfig;
  kafka: KafkaConfig;
  rateLimit: RateLimitConfig;
  logging: LoggingConfig;
  environment: string;
  allowedOrigins: string[];
}

const defaultConfig: ServiceConfig = {
  port: parseInt(process.env.PORT || '8101'),
  
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/automation',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
    timeout: parseInt(process.env.DB_TIMEOUT || '30000')
  },
  
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    db: parseInt(process.env.REDIS_DB || '0'),
    password: process.env.REDIS_PASSWORD,
    retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
    maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3')
  },
  
  influxdb: {
    url: process.env.INFLUXDB_URL || 'http://localhost:8086',
    token: process.env.INFLUXDB_TOKEN || 'automation-token',
    org: process.env.INFLUXDB_ORG || 'automation',
    bucket: process.env.INFLUXDB_BUCKET || 'automation',
    timeout: parseInt(process.env.INFLUXDB_TIMEOUT || '10000')
  },
  
  kafka: {
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    clientId: process.env.KAFKA_CLIENT_ID || 'device-management-service',
    groupId: process.env.KAFKA_GROUP_ID || 'device-management-group',
    retry: {
      initialRetryTime: parseInt(process.env.KAFKA_RETRY_TIME || '100'),
      retries: parseInt(process.env.KAFKA_RETRIES || '3')
    }
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '900000'), // 15분
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '1000')
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
    file: process.env.LOG_FILE === 'true',
    console: process.env.LOG_CONSOLE !== 'false'
  },
  
  environment: process.env.NODE_ENV || 'development',
  allowedOrigins: (process.env.ALLOWED_ORIGINS || '*').split(',')
};

let currentConfig: ServiceConfig = defaultConfig;

export const config = {
  getConfig(): ServiceConfig {
    return currentConfig;
  },
  
  updateConfig(newConfig: Partial<ServiceConfig>): void {
    currentConfig = { ...currentConfig, ...newConfig };
  },
  
  isDevelopment(): boolean {
    return currentConfig.environment === 'development';
  },
  
  isProduction(): boolean {
    return currentConfig.environment === 'production';
  },
  
  isTest(): boolean {
    return currentConfig.environment === 'test';
  }
};

export default config;
