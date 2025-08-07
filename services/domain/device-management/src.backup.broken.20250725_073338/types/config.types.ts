/**
 * 설정 및 내부 타입 정의
 */

export interface DeviceServiceConfig {
  port: number;
  serviceName: string;
  serviceVersion: string;
  database: {
    url: string;
  };
  redis: {
    host: string;
    port: number;
    password?: string;
    db: number;
    keyPrefix: string;
  };
  influxdb: {
    url: string;
    token: string;
    org: string;
    bucket: string;
  };
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  websocket: {
    port: number;
    heartbeatInterval: number;
  };
  monitoring: {
    healthCheckInterval: number;
    metricCollectionInterval: number;
    heartbeatTimeout: number;
  };
  logging: {
    level: string;
    file: string;
    maxSize: string;
    maxFiles: number;
  };
  storageService: {
    url: string;
  };
}

// Redis 캐시 키 타입
export interface DeviceCacheKeys {
  status: (deviceId: string) => string;
  list: (queryHash: string) => string;
  detail: (deviceId: string) => string;
  metrics: (deviceId: string, hour: number) => string;
}

// InfluxDB 포인트 타입
export interface InfluxMetricPoint {
  measurement: string;
  tags: Record<string, string>;
  fields: Record<string, number>;
  timestamp?: Date;
}
