/**
 * 추가 타입 정의 - 계약 기반
 */

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
  severity?: 'low' | 'medium' | 'high' | 'critical';
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
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
}

export interface DeviceAlertsResponse {
  items: DeviceAlert[];
  total: number;
  limit: number;
  offset: number;
}

export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

// 이벤트 타입 (device-events.json 기반)
export interface DeviceEvent {
  eventId: string;
  eventType: 'DeviceCreated' | 'DeviceUpdated' | 'DeviceDeleted' | 
             'DeviceStatusChanged' | 'MetricThresholdExceeded' | 
             'DeviceHealthCheck' | 'DeviceAlertTriggered' | 'DeviceMaintenanceScheduled';
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
