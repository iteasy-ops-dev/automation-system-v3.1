// src/types/device.types.ts
// Device 관련 핵심 타입 정의

// ==================================================
// 6. Device Health Types (계약 API 스키마 준수)
// ==================================================

export interface DevicesHealth {
  summary: DeviceHealthSummary;
  details: DeviceHealthDetail[];
  lastUpdated: Date;
}

export interface DeviceHealthSummary {
  total: number;
  online: number;
  offline: number;
  error: number;
  maintenance: number;
}

export interface DeviceHealthDetail {
  deviceId: string;
  name: string;
  status: DeviceRuntimeStatus;
  issue: string;
  lastSeen?: Date;
  severity: AlertSeverity;
}

// ==================================================
// 7. Device Alert Types (계약 API 스키마 준수)
// ==================================================

export interface DeviceAlert {
  id: string;
  deviceId: string;
  type: AlertType;
  severity: AlertSeverity;
  message: string;
  status: AlertStatus;
  details?: Record<string, any>;
  createdAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

export enum AlertType {
  METRIC_THRESHOLD = 'metric_threshold',
  HEARTBEAT_TIMEOUT = 'heartbeat_timeout',
  ERROR_DETECTED = 'error_detected',
  MAINTENANCE_REQUIRED = 'maintenance_required'
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved'
}

export interface DeviceAlertsResponse {
  items: DeviceAlert[];
  total: number;
  limit: number;
  offset: number;
}

// Import types needed
import { DeviceRuntimeStatus } from './index';
