// src/types/common.types.ts
// 공통 타입 정의

// ==================================================
// 8. Event Types (device-events.json 스키마 준수)
// ==================================================

export interface DeviceEvent {
  eventId: string;
  eventType: DeviceEventType;
  timestamp: Date;
  deviceId: string;
  payload: any;
  metadata?: {
    userId?: string;
    correlationId?: string;
    source?: string;
    version?: string;
    tags?: string[];
  };
}

export enum DeviceEventType {
  DEVICE_CREATED = 'DeviceCreated',
  DEVICE_UPDATED = 'DeviceUpdated',
  DEVICE_DELETED = 'DeviceDeleted',
  DEVICE_STATUS_CHANGED = 'DeviceStatusChanged',
  METRIC_THRESHOLD_EXCEEDED = 'MetricThresholdExceeded',
  DEVICE_HEALTH_CHECK = 'DeviceHealthCheck',
  DEVICE_ALERT_TRIGGERED = 'DeviceAlertTriggered',
  DEVICE_MAINTENANCE_SCHEDULED = 'DeviceMaintenanceScheduled'
}

// ==================================================
// 9. API Request/Response Types
// ==================================================

export interface DeviceListQuery {
  groupId?: string;
  status?: DeviceStatus;
  type?: DeviceType;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface DeviceListResponse {
  items: Device[];
  total: number;
  limit: number;
  offset: number;
}

export interface DeviceCreateRequest {
  name: string;
  type: DeviceType;
  groupId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface DeviceUpdateRequest {
  name?: string;
  groupId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

// ==================================================
// 10. Error Types
// ==================================================

export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: Date;
  details?: Record<string, any>;
}

export class DeviceServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'DeviceServiceError';
  }
}

export class DeviceNotFoundError extends DeviceServiceError {
  constructor(deviceId: string) {
    super(
      `Device with ID '${deviceId}' not found`,
      'DEVICE_NOT_FOUND',
      404,
      { deviceId }
    );
  }
}

export class MetricsCollectionError extends DeviceServiceError {
  constructor(message: string, details?: any) {
    super(
      `Metrics collection failed: ${message}`,
      'METRICS_COLLECTION_ERROR',
      500,
      details
    );
  }
}

// Import 필요한 타입들
import { DeviceStatus, DeviceType, Device } from './index';
