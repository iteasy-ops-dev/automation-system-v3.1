/**
 * Device Management Service Types Export
 * 모든 타입을 중앙에서 관리
 */

// 기본 디바이스 타입
export * from './device.types';

// 확장 타입
export * from './device.extended.types';

// 설정 타입
export * from './config.types';

// InfluxDB 메트릭 타입
export interface InfluxMetricPoint {
  timestamp: string;
  value: number;
  field: string;
  deviceId: string;
  tags: Record<string, string>;
}

// DeviceEvent 타입 (device-events.json 기반)
export interface DeviceEvent {
  eventId: string;
  eventType: 'DeviceCreated' | 'DeviceUpdated' | 'DeviceDeleted' | 'DeviceStatusChanged' | 'MetricThresholdExceeded';
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
