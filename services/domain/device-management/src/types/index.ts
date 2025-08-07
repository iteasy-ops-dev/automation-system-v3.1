/**
 * Device Management Service - 타입 정의
 * shared/contracts/v1.0/rest/domain/device-service.yaml 계약 100% 준수
 * shared/contracts/v1.0/events/device-events.json 이벤트 100% 준수
 */

// ============ Device Connection Types ============

export interface DeviceConnectionInfo {
  protocol: 'ssh' | 'http' | 'https' | 'snmp';
  host: string;
  port: number;
  username?: string;
  password?: string;
  privateKey?: string;
  timeout?: number;
  retryAttempts?: number;
  enableSudo?: boolean;
}

// ============ Device Core Types ============

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  groupId?: string;
  connectionInfo?: DeviceConnectionInfo;  // 🔥 추가됨
  metadata: Record<string, any>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type DeviceType = 'server' | 'network' | 'storage' | 'iot';

export type DeviceStatus = 'active' | 'inactive' | 'maintenance' | 'error';

export interface DeviceGroup {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  metadata: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

// ============ Request/Response Types ============

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
  connectionInfo: DeviceConnectionInfo;  // 🔥 추가됨 (필수)
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface DeviceUpdateRequest {
  name?: string;
  type?: DeviceType;
  status?: DeviceStatus;
  groupId?: string;
  connectionInfo?: DeviceConnectionInfo;  // 🔥 추가됨
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface DeviceFilter {
  groupId?: string;
  status?: DeviceStatus;
  type?: DeviceType;
  tags?: string[];
  limit?: number;
  offset?: number;
}

// ============ Status & Heartbeat Types ============

export interface DeviceStatusResponse {
  deviceId: string;
  status: DeviceStatus;
  lastHeartbeat?: string;
  metrics?: DeviceMetrics;
  errors?: string[];
}

export interface HeartbeatRequest {
  status: DeviceStatus;
  metrics?: DeviceMetrics;
  metadata?: Record<string, any>;
}

export interface DeviceMetrics {
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: {
    bytesIn: number;
    bytesOut: number;
  };
  timestamp: string;
}

// ============ Group Management Types ============

export interface DeviceGroupCreateRequest {
  name: string;
  description?: string;
  parentId?: string;
  metadata?: Record<string, any>;
}

export interface DeviceGroupListResponse {
  items: DeviceGroup[];
  total: number;
}

// ============ Health Check Types ============

export interface DeviceHealthSummary {
  totalDevices: number;
  activeDevices: number;
  inactiveDevices: number;
  errorDevices: number;
  maintenanceDevices: number;
  lastUpdated: string;
}

// ============ Connection Test Types ============

export interface ConnectionTestResult {
  success: boolean;
  protocol: string;
  responseTime: number;
  details?: {
    serverInfo?: string;
    uptime?: string;
    statusCode?: number;
    statusText?: string;
    server?: string;
    contentType?: string;
    [key: string]: any;
  };
  error?: string;
  errorCode?: string;
}

// ============ Event Types (device-events.json 준수) ============

export type DeviceEventType = 
  | 'DeviceCreated'
  | 'DeviceUpdated'
  | 'DeviceDeleted'
  | 'DeviceStatusChanged'
  | 'MetricThresholdExceeded'
  | 'DeviceHealthCheck'
  | 'DeviceAlertTriggered'
  | 'DeviceMaintenanceScheduled';

export interface DeviceEvent {
  eventId: string;
  eventType: DeviceEventType;
  timestamp: string;
  deviceId: string;
  payload: Record<string, any>;
  metadata?: {
    userId?: string;
    correlationId?: string;
    source?: string;
  };
}

// ============ Error Types ============

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    timestamp: string;
    details?: Record<string, any>;
  };
}

// ============ Storage Service API Types ============
// Storage Service와 통신하기 위한 타입들

export interface StorageDeviceFilter {
  groupId?: string;
  status?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export interface StorageDeviceListResponse {
  items: Device[];
  total: number;
  limit: number;
  offset: number;
}

export interface StorageDeviceCreateRequest {
  name: string;
  type: string;
  groupId?: string;
  connectionInfo?: DeviceConnectionInfo;  // 🔥 추가됨
  metadata?: Record<string, any>;
  tags?: string[];
  status?: string;
}

// ============ Configuration Types ============

export interface DeviceServiceConfig {
  PORT: number;
  STORAGE_SERVICE_URL: string;
  INFLUXDB_URL: string;
  INFLUXDB_TOKEN: string;
  INFLUXDB_ORG: string;
  INFLUXDB_BUCKET: string;
  REDIS_URL: string;
  KAFKA_BROKERS: string[];
  KAFKA_CLIENT_ID: string;
  KAFKA_GROUP_ID: string;
  LOG_LEVEL: string;
}

// ============ Utility Types ============

export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface TimestampFields {
  createdAt: string;
  updatedAt: string;
}
