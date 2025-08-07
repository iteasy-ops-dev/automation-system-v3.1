/**
 * Storage Types - Prisma 완전 호환
 * shared/contracts/v1.0/rest/core/storage-api.yaml 계약 타입 정의
 * TASK-4-PRISMA: TypeScript 5.x 완전 호환 타입
 * BACKEND-FIX: ConnectionInfo 타입 추가
 */

import { Device, DeviceGroup } from '@prisma/client';

// ========== Connection 관련 타입 ==========

export interface ConnectionInfo {
  protocol: 'ssh' | 'telnet' | 'http' | 'https' | 'snmp';
  host: string;
  port: number;
  username?: string;
  password?: string;
  privateKey?: string;
  timeout?: number;
  retryAttempts?: number;
  enableSudo?: boolean;
  sudoPassword?: string;
}

// ========== Device 관련 타입 ==========

export interface DeviceFilter {
  groupId?: string;
  status?: string;
  type?: string;
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface DeviceListResponse {
  items: Device[];
  total: number;
  limit: number;
  offset: number;
}

export interface DeviceCreate {
  name: string;
  type: string;
  status?: string;
  groupId?: string;
  connectionInfo?: ConnectionInfo;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface DeviceUpdate {
  name?: string;
  type?: string;
  status?: string;
  groupId?: string;
  connectionInfo?: ConnectionInfo;
  metadata?: Record<string, any>;
  tags?: string[];
}

// ========== 그룹 관련 타입 ==========

export interface DeviceGroupFilter {
  parentId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface DeviceGroupCreate {
  name: string;
  description?: string;
  parentId?: string;
  metadata?: Record<string, any>;
}

export interface DeviceGroupUpdate {
  name?: string;
  description?: string;
  parentId?: string;
  metadata?: Record<string, any>;
}

// ========== 페이지네이션 ==========

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

// ========== API 응답 타입 ==========

export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: number;
    message: string;
    details?: any;
    timestamp: string;
  };
}

// ========== 통계 타입 ==========

export interface StorageStats {
  devices: {
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
  };
  cache: CacheStats;
  uptime: number;
  timestamp: string;
}

export interface CacheStats {
  hitRate: number;
  totalHits: number;
  totalMisses: number;
  totalRequests: number;
  connectedClients: number;
  usedMemory: number;
  maxMemory: number;
  keyCount: number;
  uptime: number;
}

// ========== 헬스 체크 ==========

export interface HealthCheckResult {
  healthy: boolean;
  checks: {
    database: boolean;
    cache: boolean;
    eventBus: boolean;
  };
  timestamp: string;
  uptime: number;
}

// ========== 이벤트 타입 ==========

export interface DeviceEvent {
  eventId: string;
  eventType: 'DeviceCreated' | 'DeviceUpdated' | 'DeviceDeleted' | 'DeviceStatusChanged' | 'MetricThresholdExceeded';
  timestamp: string;
  deviceId: string;
  payload: {
    device?: {
      name: string;
      type: string;
      groupId?: string;
    };
    previousStatus?: string;
    currentStatus?: string;
    reason?: string;
    metric?: string;
    threshold?: number;
    currentValue?: number;
  };
  metadata: {
    userId?: string;
    correlationId?: string;
    source: string;
  };
}

// ========== 캐시 키 타입 ==========

export interface CacheKey {
  prefix: string;
  type: string;
  id?: string;
  filters?: string;
}

// ========== 쿼리 옵션 ==========

export interface QueryOptions {
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  include?: string[];
}

// ========== 데이터베이스 구성 ==========

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  max?: number;
}

// ========== Redis 구성 ==========

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  retryDelayOnFailover?: number;
  maxRetriesPerRequest?: number;
  connectTimeout?: number;
  commandTimeout?: number;
}

// ========== 서비스 구성 ==========

export interface ServiceConfig {
  port: number;
  host: string;
  database: DatabaseConfig;
  redis: RedisConfig;
  kafka: {
    brokers: string[];
    clientId: string;
    groupId: string;
  };
  logging: {
    level: string;
    format: string;
  };
}

// ========== 입력 검증 타입 ==========

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

// ========== Device 확장 타입 (Prisma include용) ==========

export type DeviceWithGroup = Device & {
  group: DeviceGroup | null;
};

export type DeviceWithHistory = Device & {
  statusHistory: Array<{
    id: string;
    previousStatus: string | null;
    currentStatus: string;
    reason: string | null;
    changedAt: Date | null;
  }>;
};

export type DeviceWithRelations = Device & {
  group: DeviceGroup | null;
  statusHistory: Array<{
    id: string;
    previousStatus: string | null;
    currentStatus: string;
    reason: string | null;
    changedAt: Date | null;
  }>;
};
