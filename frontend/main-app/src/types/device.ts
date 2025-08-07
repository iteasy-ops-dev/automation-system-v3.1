/**
 * Device 관련 타입 정의
 * 
 * 계약 기반: shared/contracts/v1.0/rest/domain/device-service.yaml
 * 백엔드 API와 100% 일치하는 타입 정의
 */

// Device 기본 타입
export type DeviceStatus = 'online' | 'offline' | 'error' | 'maintenance';
export type DeviceType = 'server' | 'network' | 'storage' | 'iot';

// Device 상태 정보
export interface DeviceStatusInfo {
  deviceId: string;
  status: DeviceStatus;
  lastHeartbeat: string;
  uptime: number;
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
  } | null;
  errors: string[];
  lastError?: string | null;
  version?: string;
}

// Device 메트릭 정보
export interface MetricDataPoint {
  timestamp: string;
  value: number;
  tags?: Record<string, string>;
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

// Device 건강 상태
export interface DevicesHealthSummary {
  total: number;
  online: number;
  offline: number;
  error: number;
  maintenance: number;
}

export interface DeviceHealthDetail {
  deviceId: string;
  name: string;
  status: Exclude<DeviceStatus, 'online'>;
  issue: string;
  lastSeen?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DevicesHealth {
  summary: DevicesHealthSummary;
  details: DeviceHealthDetail[];
  lastUpdated: string;
}

// Device 알림
export interface DeviceAlert {
  id: string;
  deviceId: string;
  type: 'metric_threshold' | 'heartbeat_timeout' | 'error_detected' | 'maintenance_required';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  details?: Record<string, unknown>;
  createdAt: string;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
}

export interface DeviceAlertsResponse {
  items: DeviceAlert[];
  total: number;
  limit: number;
  offset: number;
}

// Storage Service의 Device 타입 (기본 장비 정보)
export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  status: 'active' | 'inactive' | 'maintenance';
  groupId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  connectionInfo?: DeviceConnectionInfo; // 연결 정보 포함
  createdAt: string;
  updatedAt: string;
}

export interface DeviceGroup {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceListResponse {
  items: Device[];
  total: number;
  limit: number;
  offset: number;
}

// 연결 프로토콜 타입
export type ConnectionProtocol = 'ssh' | 'telnet' | 'http' | 'https' | 'snmp';

// Device 연결 정보 (실제 장비 접속용)
export interface DeviceConnectionInfo {
  protocol: ConnectionProtocol;
  host: string;          // IP 주소 또는 호스트명
  port: number;          // 접속 포트
  username?: string;     // 접속 계정
  password?: string;     // 접속 비밀번호 (암호화 저장)
  privateKey?: string;   // SSH 키 (SSH 프로토콜용)
  timeout?: number;      // 연결 타임아웃 (초)
  retryAttempts?: number; // 재시도 횟수
  enableSudo?: boolean;  // sudo 권한 필요 여부
  sudoPassword?: string; // sudo 비밀번호
}

// Device 생성/수정을 위한 타입
export interface DeviceCreateRequest {
  name: string;
  type: DeviceType;
  groupId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  connectionInfo: DeviceConnectionInfo; // 필수 연결 정보
}

export interface DeviceUpdateRequest {
  name?: string;
  groupId?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  status?: 'active' | 'inactive' | 'maintenance';
  connectionInfo?: Partial<DeviceConnectionInfo>; // 연결 정보 수정
}

// Device 검색 및 필터링
export interface DeviceFilters {
  groupId?: string;
  status?: 'active' | 'inactive' | 'maintenance';
  type?: DeviceType;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface DeviceStatusFilters {
  groupId?: string;
  status?: DeviceStatus[];
  critical?: boolean;
}

export interface DeviceMetricsFilters {
  metric?: 'cpu' | 'memory' | 'disk' | 'network' | 'temperature' | 'power';
  start?: string;
  end?: string;
  interval?: '1m' | '5m' | '15m' | '1h' | '6h' | '24h';
  aggregation?: 'avg' | 'min' | 'max' | 'sum' | 'last';
  limit?: number;
}

export interface DeviceAlertsFilters {
  severity?: 'low' | 'medium' | 'high' | 'critical';
  status?: 'active' | 'acknowledged' | 'resolved';
  limit?: number;
  offset?: number;
}

// Device 폼 데이터 (UI용)
export interface DeviceFormData {
  name: string;
  type: DeviceType;
  groupId: string;
  tags: string[];
  metadata: Record<string, string>;
  connectionInfo: {
    protocol: ConnectionProtocol;
    host: string;
    port: number;
    username: string;
    password: string;
    privateKey?: string;
    timeout?: number;
    retryAttempts?: number;
    enableSudo?: boolean;
    sudoPassword?: string;
  };
}

// Device 테이블 정렬
export interface DeviceSort {
  field: 'name' | 'type' | 'status' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}
