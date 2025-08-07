// src/types/metrics.types.ts
// Device Metrics 관련 타입 정의

import { DeviceRuntimeStatus, DeviceMetricsSnapshot } from './index';

// ==================================================
// 4. Heartbeat Types (계약 API 스키마 준수)
// ==================================================

export interface HeartbeatRequest {
  timestamp: Date;
  status: DeviceRuntimeStatus;
  metrics?: DeviceMetricsSnapshot;
  version?: string;
  errors?: string[];
}

export interface HeartbeatResponse {
  received: Date;
  nextHeartbeat: number;
  configuration?: Record<string, any>;
}

// ==================================================
// 5. Device Metrics Types (InfluxDB 연동)
// ==================================================

export interface DeviceMetrics {
  deviceId: string;
  metric: MetricType;
  unit: string;
  interval: string;
  aggregation: AggregationType;
  dataPoints: MetricDataPoint[];
  summary?: MetricSummary;
}

export enum MetricType {
  CPU = 'cpu',
  MEMORY = 'memory',
  DISK = 'disk',
  NETWORK = 'network',
  TEMPERATURE = 'temperature',
  POWER = 'power'
}

export enum AggregationType {
  AVG = 'avg',
  MIN = 'min',
  MAX = 'max',
  SUM = 'sum',
  LAST = 'last'
}

export interface MetricDataPoint {
  timestamp: Date;
  value: number;
  tags?: Record<string, string>;
}

export interface MetricSummary {
  min: number;
  max: number;
  avg: number;
  count: number;
}

export interface MetricsQuery {
  metric?: MetricType;
  start?: Date;
  end?: Date;
  interval?: string;
  aggregation?: AggregationType;
  limit?: number;
}
