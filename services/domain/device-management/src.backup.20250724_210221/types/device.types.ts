/**
 * Device Types - 장비 관련 타입 정의
 * device-service.yaml 계약에서 추출한 타입들
 * 
 * @file src/types/device.types.ts
 * @description 장비 도메인 타입 정의
 * @author Backend Team - Domains
 */

/**
 * Device Types - 장비 관련 타입 정의
 * device-service.yaml 계약에서 추출한 타입들
 * 
 * @file src/types/device.types.ts
 * @description 장비 도메인 타입 정의
 * @author Backend Team - Domains
 */

// 임시 타입 정의 (Prisma 클라이언트 경로 설정 후 교체)
export interface Device {
  id: string;
  name: string;
  type: string;
  status: string;
  groupId?: string;
  metadata?: any;
  tags: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DeviceGroup {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  metadata?: any;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DeviceStatusHistory {
  id: string;
  deviceId: string;
  previousStatus?: string;
  currentStatus: string;
  reason?: string;
  changedBy?: string;
  changedAt?: Date;
}

export interface User {
  id: string;
  username: string;
  fullName?: string;
}

// =============================================================================
// API 요청/응답 타입 (계약 기반)
// =============================================================================

export interface DeviceCreateInput {
  name: string;
  type: string;
  status?: string;
  groupId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface DeviceUpdateInput {
  name?: string;
  type?: string;
  status?: string;
  groupId?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface DeviceStatusUpdateInput {
  status: string;
  reason?: string;
}

// =============================================================================
// 확장된 Device 타입들
// =============================================================================

export interface DeviceWithGroup extends Device {
  group?: {
    id: string;
    name: string;
    description?: string;
    parentId?: string;
  } | null;
}

export interface DeviceWithHistory extends Device {
  group?: DeviceGroup | null;
  statusHistory: Array<DeviceStatusHistory & {
    user?: {
      id: string;
      username: string;
      fullName?: string;
    } | null;
  }>;
}

// =============================================================================
// API 응답 타입
// =============================================================================

export interface DeviceListResponse {
  items: DeviceWithGroup[];
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
  hasPrev: boolean;
  totalPages: number;
  currentPage: number;
}

export interface DeviceStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  byGroup: Record<string, number>;
  lastUpdated: Date;
}

// =============================================================================
// 계약 기반 API 타입들 (device-service.yaml)
// =============================================================================

export interface DeviceStatus {
  deviceId: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  lastHeartbeat: string;
  uptime?: number;
  metrics?: {
    cpu?: number;
    memory?: number;
    disk?: number;
    network?: {
      rxBytes: number;
      txBytes: number;
    };
    temperature?: number;
    power?: number;
  };
  errors?: string[];
  lastError?: string;
  version?: string;
}

export interface DeviceMetrics {
  deviceId: string;
  metric: string;
  unit: string;
  interval?: string;
  aggregation?: string;
  dataPoints: MetricDataPoint[];
  summary?: {
    min: number;
    max: number;
    avg: number;
    count: number;
  };
}

export interface MetricDataPoint {
  timestamp: string;
  value: number;
  tags?: Record<string, string>;
}

export interface HeartbeatRequest {
  timestamp: string;
  status: 'online' | 'maintenance';
  metrics?: {
    cpu?: number;
    memory?: number;
    disk?: number;
  };
  version?: string;
  errors?: string[];
}

export interface HeartbeatResponse {
  received: string;
  nextHeartbeat: number;
  configuration?: Record<string, any>;
}

export interface DevicesHealth {
  summary: {
    total: number;
    online: number;
    offline: number;
    error: number;
    maintenance: number;
  };
  details: DeviceHealthDetail[];
  lastUpdated: string;
}

export interface DeviceHealthDetail {
  deviceId: string;
  name: string;
  status: 'offline' | 'error' | 'maintenance';
  issue: string;
  lastSeen?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DeviceAlert {
  id: string;
  deviceId: string;
  type: 'metric_threshold' | 'heartbeat_timeout' | 'error_detected' | 'maintenance_required';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  details?: Record<string, any>;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

export interface DeviceAlertsResponse {
  items: DeviceAlert[];
  total: number;
  limit: number;
  offset: number;
}

// =============================================================================
// 서비스 레이어 타입들
// =============================================================================

export interface DeviceQuery {
  id?: string;
  name?: string;
  type?: string | string[];
  status?: string | string[];
  groupId?: string;
  tags?: string[];
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  includeMetrics?: boolean;
  includeHistory?: boolean;
}

export interface StatusOptions {
  includeMetrics?: boolean;
  includeErrors?: boolean;
  cacheTimeout?: number;
}

export interface MetricsQuery {
  metric?: string;
  start?: Date;
  end?: Date;
  interval?: '1m' | '5m' | '15m' | '1h' | '6h' | '24h';
  aggregation?: 'avg' | 'min' | 'max' | 'sum' | 'last';
  limit?: number;
}

export interface MetricsData {
  timestamp: Date;
  cpu?: number;
  memory?: number;
  disk?: number;
  network?: {
    rxBytes: number;
    txBytes: number;
  };
  temperature?: number;
  power?: number;
  custom?: Record<string, number>;
}

export interface DevicesHealthSummary {
  total: number;
  online: number;
  offline: number;
  error: number;
  maintenance: number;
  critical: DeviceHealthDetail[];
  warnings: DeviceHealthDetail[];
  lastUpdated: Date;
}

// =============================================================================
// 캐시 타입들
// =============================================================================

export interface DeviceStatusCache {
  status: string;
  lastHeartbeat: Date;
  metrics?: Record<string, number>;
  errors?: string[];
  updatedAt: Date;
}

// =============================================================================
// 이벤트 타입들 (device-events.json 기반)
// =============================================================================

export interface DeviceEvent {
  eventId: string;
  eventType: 'DeviceCreated' | 'DeviceUpdated' | 'DeviceDeleted' | 'DeviceStatusChanged' | 
             'MetricThresholdExceeded' | 'DeviceHealthCheck' | 'DeviceAlertTriggered' | 
             'DeviceMaintenanceScheduled';
  timestamp: string;
  deviceId: string;
  payload: Record<string, any>;
  metadata?: {
    userId?: string;
    correlationId?: string;
    source?: string;
    version?: string;
    tags?: string[];
  };
}

export interface DeviceCreatedEvent extends DeviceEvent {
  eventType: 'DeviceCreated';
  payload: {
    device: {
      name: string;
      type: string;
      groupId?: string;
      metadata?: Record<string, any>;
    };
  };
}

export interface DeviceStatusChangedEvent extends DeviceEvent {
  eventType: 'DeviceStatusChanged';
  payload: {
    previousStatus: string;
    currentStatus: string;
    reason?: string;
    duration?: number;
  };
}

export interface MetricThresholdExceededEvent extends DeviceEvent {
  eventType: 'MetricThresholdExceeded';
  payload: {
    metric: string;
    threshold: number;
    currentValue: number;
    unit: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    duration?: number;
  };
}

// =============================================================================
// 에러 타입들
// =============================================================================

export class DeviceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'DeviceError';
  }
}

export class DeviceNotFoundError extends DeviceError {
  constructor(deviceId: string) {
    super(`Device with ID '${deviceId}' not found`, 'DEVICE_NOT_FOUND', 404, { deviceId });
  }
}

export class DeviceValidationError extends DeviceError {
  constructor(message: string, field?: string) {
    super(message, 'DEVICE_VALIDATION_ERROR', 400, { field });
  }
}

export class DeviceConflictError extends DeviceError {
  constructor(message: string, conflictField?: string) {
    super(message, 'DEVICE_CONFLICT', 409, { conflictField });
  }
}
