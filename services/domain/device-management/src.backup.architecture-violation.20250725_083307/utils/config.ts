// src/utils/config.ts
// Device Service 설정 관리

import dotenv from 'dotenv';

dotenv.config();

export const Config = {
  // 서비스 설정
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '8101'),
  SERVICE_NAME: process.env.SERVICE_NAME || 'device-management-service',
  SERVICE_VERSION: process.env.SERVICE_VERSION || '1.0.0',

  // 데이터베이스
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/automation',

  // Redis
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379'),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || '',
  REDIS_DB: parseInt(process.env.REDIS_DB || '0'),
  REDIS_KEY_PREFIX: process.env.REDIS_KEY_PREFIX || 'automation',

  // InfluxDB
  INFLUXDB_URL: process.env.INFLUXDB_URL || 'http://localhost:8086',
  INFLUXDB_TOKEN: process.env.INFLUXDB_TOKEN || 'automation-token',
  INFLUXDB_ORG: process.env.INFLUXDB_ORG || 'automation-org',
  INFLUXDB_BUCKET: process.env.INFLUXDB_BUCKET || 'automation',

  // Kafka
  KAFKA_BROKERS: process.env.KAFKA_BROKERS?.split(',') || ['localhost:9092'],
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'device-management-service',
  KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'device-service-group',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '1h',
};
