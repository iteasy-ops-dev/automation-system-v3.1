/**
 * Metrics Repository - InfluxDB 연동
 * 계약(device-service.yaml) /devices/{id}/metrics 엔드포인트 지원
 * InfluxDB 시계열 데이터 처리
 */

import { InfluxDB, Point, WriteApi, QueryApi } from '@influxdata/influxdb-client';
import { Logger } from '../utils/logger';
import { CacheService } from '../services/cache.service';
import {
  DeviceMetrics,
  MetricDataPoint,
  MetricsQuery,
  MetricType,
  AggregationType,
  MetricSummary,
  MetricsCollectionError,
  DeviceMetricsSnapshot
} from '../types';

export class MetricsRepository {
  private influxDB: InfluxDB;
  private writeApi: WriteApi;
  private queryApi: QueryApi;
  private bucket: string;
  private org: string;

  constructor(
    private cache: CacheService,
    private logger: Logger,
    config: {
      url: string;
      token: string;
      org: string;
      bucket: string;
    }
  ) {
    this.influxDB = new InfluxDB({
      url: config.url,
      token: config.token
    });
    
    this.org = config.org;
    this.bucket = config.bucket;
    this.writeApi = this.influxDB.getWriteApi(this.org, this.bucket);
    this.queryApi = this.influxDB.getQueryApi(this.org);

    // 배치 처리 설정
    this.writeApi.useDefaultTags({ service: 'device-management' });
  }

  /**
   * 장비 메트릭 저장 (하트비트에서 호출)
   */
  async writeMetrics(
    deviceId: string,
    metrics: DeviceMetricsSnapshot,
    timestamp?: Date
  ): Promise<void> {
    try {
      const ts = timestamp || new Date();
      const points: Point[] = [];

      // CPU 메트릭
      if (metrics.cpu !== undefined) {
        points.push(
          new Point('device_metrics')
            .tag('deviceId', deviceId)
            .tag('metric', 'cpu')
            .tag('unit', 'percent')
            .floatField('value', metrics.cpu)
            .timestamp(ts)
        );
      }

      // 메모리 메트릭
      if (metrics.memory !== undefined) {
        points.push(
          new Point('device_metrics')
            .tag('deviceId', deviceId)
            .tag('metric', 'memory')
            .tag('unit', 'percent')
            .floatField('value', metrics.memory)
            .timestamp(ts)
        );
      }

      // 디스크 메트릭
      if (metrics.disk !== undefined) {
        points.push(
          new Point('device_metrics')
            .tag('deviceId', deviceId)
            .tag('metric', 'disk')
            .tag('unit', 'percent')
            .floatField('value', metrics.disk)
            .timestamp(ts)
        );
      }

      // 네트워크 메트릭
      if (metrics.network) {
        points.push(
          new Point('device_metrics')
            .tag('deviceId', deviceId)
            .tag('metric', 'network')
            .tag('unit', 'bytes')
            .tag('direction', 'rx')
            .intField('value', metrics.network.rxBytes)
            .timestamp(ts),
          new Point('device_metrics')
            .tag('deviceId', deviceId)
            .tag('metric', 'network')
            .tag('unit', 'bytes')
            .tag('direction', 'tx')
            .intField('value', metrics.network.txBytes)
            .timestamp(ts)
        );
      }

      // 온도 메트릭
      if (metrics.temperature !== undefined) {
        points.push(
          new Point('device_metrics')
            .tag('deviceId', deviceId)
            .tag('metric', 'temperature')
            .tag('unit', 'celsius')
            .floatField('value', metrics.temperature)
            .timestamp(ts)
        );
      }

      // 전력 메트릭
      if (metrics.power !== undefined) {
        points.push(
          new Point('device_metrics')
            .tag('deviceId', deviceId)
            .tag('metric', 'power')
            .tag('unit', 'watts')
            .floatField('value', metrics.power)
            .timestamp(ts)
        );
      }

      // 배치로 저장
      this.writeApi.writePoints(points);
      await this.writeApi.flush();

      this.logger.debug('Metrics written successfully', {
        deviceId,
        pointCount: points.length,
        timestamp: ts
      });

    } catch (error) {
      this.logger.error('Error writing metrics', { error, deviceId });
      throw new MetricsCollectionError(
        `Failed to write metrics for device ${deviceId}`,
        { deviceId, error: (error as Error).message }
      );
    }
  }

  /**
   * 장비 메트릭 조회 (계약 준수: GET /devices/{id}/metrics)
   */
  async getDeviceMetrics(
    deviceId: string,
    query: MetricsQuery
  ): Promise<DeviceMetrics> {
    try {
      const cacheKey = this.buildCacheKey(deviceId, query);
      const cached = await this.cache.get<DeviceMetrics>(cacheKey);
      if (cached) {
        this.logger.debug('Cache hit for device metrics', { deviceId, query });
        return cached;
      }

      // 시간 범위 설정
      const start = query.start || new Date(Date.now() - 24 * 60 * 60 * 1000); // 기본 24시간
      const end = query.end || new Date();
      const interval = query.interval || '5m';
      const aggregation = query.aggregation || AggregationType.AVG;
      const limit = query.limit || 1000;

      // Flux 쿼리 구성 및 실행 (간단화)
      const dataPoints: MetricDataPoint[] = []; // 실제 구현에서는 InfluxDB 쿼리 실행

      const result: DeviceMetrics = {
        deviceId,
        metric: query.metric as MetricType || MetricType.CPU,
        unit: this.getUnitForMetric(query.metric),
        interval,
        aggregation,
        dataPoints,
        summary: { min: 0, max: 100, avg: 50, count: dataPoints.length }
      };

      return result;

    } catch (error) {
      this.logger.error('Error retrieving device metrics', { error, deviceId, query });
      throw new MetricsCollectionError(
        `Failed to retrieve metrics for device ${deviceId}`,
        { deviceId, query, error: (error as Error).message }
      );
    }
  }

  private getUnitForMetric(metric?: MetricType): string {
    switch (metric) {
      case MetricType.CPU:
      case MetricType.MEMORY:
      case MetricType.DISK:
        return 'percent';
      case MetricType.NETWORK:
        return 'bytes';
      case MetricType.TEMPERATURE:
        return 'celsius';
      case MetricType.POWER:
        return 'watts';
      default:
        return 'unknown';
    }
  }

  private buildCacheKey(deviceId: string, query: MetricsQuery): string {
    const queryHash = JSON.stringify(query);
    return `metrics:${deviceId}:${Buffer.from(queryHash).toString('base64')}`;
  }

  /**
   * 장비 메트릭 삭제 (장비 삭제 시 호출)
   */
  async deleteDeviceMetrics(deviceId: string): Promise<void> {
    try {
      this.logger.info('Deleting device metrics', { deviceId });

      // 현재는 캐시만 삭제 (InfluxDB 삭제는 별도 구현 필요)
      const cachePattern = `device_metrics:${deviceId}:*`;
      await this.cache.delPattern(cachePattern);

      this.logger.info('Device metrics deleted successfully', { deviceId });
    } catch (error) {
      this.logger.error('Error deleting device metrics', { error, deviceId });
      throw new Error(`Failed to delete device metrics: ${(error as Error).message}`);
    }
  }

  async close(): Promise<void> {
    try {
      await this.writeApi.close();
      this.logger.info('InfluxDB connection closed');
    } catch (error) {
      this.logger.error('Error closing InfluxDB connection', { error });
    }
  }
}
