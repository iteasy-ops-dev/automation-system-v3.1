/**
 * Device Management Service - Configuration
 * 환경 변수 기반 설정 관리
 */

import { DeviceServiceConfig } from '../types';

export class Config {
  private static _instance: DeviceServiceConfig;

  static get instance(): DeviceServiceConfig {
    if (!Config._instance) {
      Config._instance = Config.loadConfig();
    }
    return Config._instance;
  }

  private static loadConfig(): DeviceServiceConfig {
    return {
      PORT: parseInt(process.env.PORT || '8101'),
      STORAGE_SERVICE_URL: process.env.STORAGE_SERVICE_URL || 'http://localhost:8001',
      INFLUXDB_URL: process.env.INFLUXDB_URL || 'http://localhost:8086',
      INFLUXDB_TOKEN: process.env.INFLUXDB_TOKEN || 'device-service-token',
      INFLUXDB_ORG: process.env.INFLUXDB_ORG || 'automation-org',
      INFLUXDB_BUCKET: process.env.INFLUXDB_BUCKET || 'device-metrics',
      REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
      KAFKA_BROKERS: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
      KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || 'device-service',
      KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'device-service-group',
      LOG_LEVEL: process.env.LOG_LEVEL || 'info'
    };
  }

  // 설정 검증
  static validate(): void {
    const config = Config.instance;
    
    if (!config.STORAGE_SERVICE_URL) {
      throw new Error('STORAGE_SERVICE_URL is required');
    }

    if (!config.INFLUXDB_URL) {
      throw new Error('INFLUXDB_URL is required');
    }

    if (!config.REDIS_URL) {
      throw new Error('REDIS_URL is required');
    }

    if (config.KAFKA_BROKERS.length === 0) {
      throw new Error('KAFKA_BROKERS is required');
    }
  }
}

export default Config;
