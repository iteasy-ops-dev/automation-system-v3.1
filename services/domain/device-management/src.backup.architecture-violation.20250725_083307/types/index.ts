// src/types/index.ts
// Device Management Service 전용 타입 정의 (계약 100% 준수)

// ==================================================
// 1. Device Base Types (계약 기반)
// ==================================================

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  groupId?: string;
  metadata: Record<string, any>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export enum DeviceType {
  SERVER = 'server',
  NETWORK = 'network', 
  STORAGE = 'storage',
  IOT = 'iot'
}

export enum DeviceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  MAINTENANCE = 'maintenance'
}

export enum DeviceRuntimeStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  ERROR = 'error',
  MAINTENANCE = 'maintenance'
}

// ==================================================
// 2. Device Group Types
// ==================================================

export interface DeviceGroup {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// ==================================================
// 3. Device Status Types (계약 API 스키마 준수)
// ==================================================

export interface DeviceStatusInfo {
  deviceId: string;
  status: DeviceRuntimeStatus;
  lastHeartbeat: Date;
  uptime?: number;
  metrics?: DeviceMetricsSnapshot;
  errors: string[];
  lastError?: string;
  version?: string;
}

export interface DeviceMetricsSnapshot {
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: {
    rxBytes: number;
    txBytes: number;
  };
  temperature?: number;
  power?: number;
}

// ==================================================
// 4. Configuration Types
// ==================================================

export interface DeviceServiceConfig {
  port: number;
  databaseUrl: string;
  redisConfig: {
    host: string;
    port: number;
    password?: string;
    db: number;
  };
  influxConfig: {
    url: string;
    token: string;
    org: string;
    bucket: string;
  };
  kafkaConfig: {
    brokers: string[];
    clientId: string;
    groupId: string;
  };
  monitoring: {
    healthCheckInterval: number;
    metricCollectionInterval: number;
    heartbeatTimeout: number;
  };
}

// Re-export from other modules
export * from './metrics.types';
export * from './device.types';
export * from './common.types';
