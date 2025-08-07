/**
 * Metrics Service - 최소 완성형
 * @file src/services/metrics.service.ts
 * @description InfluxDB 기반 메트릭 수집 및 저장 서비스
 */

import { InfluxDB, Point, WriteApi, QueryApi } from '@influxdata/influxdb-client';
import { Logger } from '../utils/logger';

export interface InfluxConfig {
  url: string;
  token: string;
  org: string;
  bucket: string;
  timeout?: number;
}

export interface DeviceMetricsInput {
  cpuUsage?: number;
  memoryUsage?: number;
  diskUsage?: number;
  networkRx?: number;
  networkTx?: number;
  temperature?: number;
  power?: number;
}

export interface MetricThreshold {
  metric: string;
  warning: number;
  critical: number;
}

export interface DeviceMetricsQuery {
  deviceId: string;
  metric?: string;
  start?: Date;
  end?: Date;
  aggregation?: 'mean' | 'max' | 'min' | 'sum';
  interval?: string;
}

export interface MetricsQueryResult {
  timestamp: string;
  value: number;
  metric: string;
}

export class MetricsService {
  private influxDB: InfluxDB;
  private writeApi: WriteApi;
  private queryApi: QueryApi;
  private logger: Logger;
  private isConnected: boolean = false;
  private config: InfluxConfig;

  // 기본 임계값 설정
  private readonly defaultThresholds: MetricThreshold[] = [
    { metric: 'cpu', warning: 75, critical: 90 },
    { metric: 'memory', warning: 80, critical: 95 },
    { metric: 'disk', warning: 85, critical: 95 },
    { metric: 'temperature', warning: 70, critical: 85 }
  ];

  constructor(config: InfluxConfig) {
    this.logger = new Logger();
    this.config = config;
    
    try {
      this.influxDB = new InfluxDB({
        url: config.url,
        token: config.token,
        timeout: config.timeout || 10000
      });

      this.writeApi = this.influxDB.getWriteApi(config.org, config.bucket);
      this.queryApi = this.influxDB.getQueryApi(config.org);
      
      // Write API 설정
      this.writeApi.useDefaultTags({ source: 'device-management-service' });
      
      this.logger.info('Metrics service initialized', { 
        url: config.url, 
        org: config.org, 
        bucket: config.bucket 
      });
      
      this.isConnected = true;
    } catch (error) {
      this.logger.error('Failed to initialize InfluxDB:', error);
      this.isConnected = false;
      throw new Error(`InfluxDB initialization failed: ${error}`);
    }
  }

  /**
   * 장비 메트릭을 InfluxDB에 저장
   */
  async writeDeviceMetric(deviceId: string, metrics: DeviceMetricsInput): Promise<boolean> {
    try {
      if (!this.isConnected) {
        throw new Error('InfluxDB not connected');
      }

      const timestamp = new Date();
      const points: Point[] = [];

      // 각 메트릭을 개별 Point로 생성
      if (metrics.cpuUsage !== undefined) {
        points.push(
          new Point('device_metrics')
            .tag('device_id', deviceId)
            .tag('metric_type', 'cpu')
            .floatField('value', metrics.cpuUsage)
            .timestamp(timestamp)
        );
      }

      if (metrics.memoryUsage !== undefined) {
        points.push(
          new Point('device_metrics')
            .tag('device_id', deviceId)
            .tag('metric_type', 'memory')
            .floatField('value', metrics.memoryUsage)
            .timestamp(timestamp)
        );
      }

      if (metrics.diskUsage !== undefined) {
        points.push(
          new Point('device_metrics')
            .tag('device_id', deviceId)
            .tag('metric_type', 'disk')
            .floatField('value', metrics.diskUsage)
            .timestamp(timestamp)
        );
      }

      if (metrics.networkRx !== undefined) {
        points.push(
          new Point('device_metrics')
            .tag('device_id', deviceId)
            .tag('metric_type', 'network_rx')
            .floatField('value', metrics.networkRx)
            .timestamp(timestamp)
        );
      }

      if (metrics.networkTx !== undefined) {
        points.push(
          new Point('device_metrics')
            .tag('device_id', deviceId)
            .tag('metric_type', 'network_tx')
            .floatField('value', metrics.networkTx)
            .timestamp(timestamp)
        );
      }

      if (metrics.temperature !== undefined) {
        points.push(
          new Point('device_metrics')
            .tag('device_id', deviceId)
            .tag('metric_type', 'temperature')
            .floatField('value', metrics.temperature)
            .timestamp(timestamp)
        );
      }

      if (metrics.power !== undefined) {
        points.push(
          new Point('device_metrics')
            .tag('device_id', deviceId)
            .tag('metric_type', 'power')
            .floatField('value', metrics.power)
            .timestamp(timestamp)
        );
      }

      // 포인트들을 일괄 쓰기
      if (points.length > 0) {
        this.writeApi.writePoints(points);
        await this.writeApi.flush();
        
        this.logger.debug('Device metrics written', { 
          deviceId, 
          pointsCount: points.length,
          timestamp: timestamp.toISOString()
        });
      }

      return true;
    } catch (error) {
      this.logger.error('Failed to write device metrics:', { deviceId, error });
      throw error;
    }
  }

  /**
   * 장비 메트릭 조회
   */
  async queryDeviceMetrics(query: DeviceMetricsQuery): Promise<MetricsQueryResult[]> {
    try {
      if (!this.isConnected) {
        throw new Error('InfluxDB not connected');
      }

      const { deviceId, metric, start, end, aggregation = 'mean', interval = '1m' } = query;
      
      // 기본 시간 범위 설정 (최근 1시간)
      const startTime = start || new Date(Date.now() - 60 * 60 * 1000);
      const endTime = end || new Date();

      let fluxQuery = `
        from(bucket: "${this.config.bucket}")
          |> range(start: ${startTime.toISOString()}, stop: ${endTime.toISOString()})
          |> filter(fn: (r) => r._measurement == "device_metrics")
          |> filter(fn: (r) => r.device_id == "${deviceId}")
      `;

      // 특정 메트릭 필터링
      if (metric) {
        fluxQuery += `|> filter(fn: (r) => r.metric_type == "${metric}")`;
      }

      // 집계 함수 적용
      if (aggregation !== 'mean') {
        fluxQuery += `|> aggregateWindow(every: ${interval}, fn: ${aggregation}, createEmpty: false)`;
      } else {
        fluxQuery += `|> aggregateWindow(every: ${interval}, fn: mean, createEmpty: false)`;
      }

      fluxQuery += `|> yield(name: "${aggregation}")`;

      const results: MetricsQueryResult[] = [];
      
      for await (const { values, tableMeta } of this.queryApi.iterateRows(fluxQuery)) {
        const row = tableMeta.toObject(values);
        results.push({
          timestamp: row._time,
          value: row._value,
          metric: row.metric_type
        });
      }

      this.logger.debug('Metrics query executed', { 
        deviceId, 
        metric, 
        resultsCount: results.length,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });

      return results;
    } catch (error) {
      this.logger.error('Failed to query device metrics:', { query, error });
      throw error;
    }
  }

  /**
   * 임계값 확인 - 알림 생성을 위한 메서드
   */
  async checkThresholds(deviceId: string, metrics: DeviceMetricsInput): Promise<{
    warnings: Array<{ metric: string; value: number; threshold: number }>;
    criticals: Array<{ metric: string; value: number; threshold: number }>;
  }> {
    const warnings: Array<{ metric: string; value: number; threshold: number }> = [];
    const criticals: Array<{ metric: string; value: number; threshold: number }> = [];

    for (const threshold of this.defaultThresholds) {
      let value: number | undefined;
      
      switch (threshold.metric) {
        case 'cpu':
          value = metrics.cpuUsage;
          break;
        case 'memory':
          value = metrics.memoryUsage;
          break;
        case 'disk':
          value = metrics.diskUsage;
          break;
        case 'temperature':
          value = metrics.temperature;
          break;
      }

      if (value !== undefined) {
        if (value >= threshold.critical) {
          criticals.push({ metric: threshold.metric, value, threshold: threshold.critical });
        } else if (value >= threshold.warning) {
          warnings.push({ metric: threshold.metric, value, threshold: threshold.warning });
        }
      }
    }

    return { warnings, criticals };
  }

  /**
   * 헬스 체크
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const startTime = Date.now();
      
      // 간단한 쿼리로 연결 상태 확인
      const testQuery = `
        from(bucket: "${this.config.bucket}")
          |> range(start: -1m)
          |> limit(n: 1)
      `;
      
      let rowCount = 0;
      for await (const { values } of this.queryApi.iterateRows(testQuery)) {
        rowCount++;
        if (rowCount >= 1) break; // 첫 번째 행만 확인
      }
      
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        details: {
          connected: this.isConnected,
          responseTime: `${responseTime}ms`,
          influxdb: {
            url: this.config.url,
            org: this.config.org,
            bucket: this.config.bucket
          }
        }
      };
    } catch (error) {
      this.logger.error('Metrics health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          connected: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  /**
   * 서비스 종료
   */
  async close(): Promise<void> {
    try {
      if (this.writeApi) {
        await this.writeApi.close();
      }
      this.isConnected = false;
      this.logger.info('Metrics service closed');
    } catch (error) {
      this.logger.error('Error closing metrics service:', error);
    }
  }
}
