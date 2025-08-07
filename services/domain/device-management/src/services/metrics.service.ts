/**
 * Metrics Service - Device Management Service
 * InfluxDB 직접 연동 (v3.1 아키텍처에서 허용됨)
 * 시계열 메트릭 데이터 관리
 */

import { InfluxDB, Point, WriteApi, QueryApi } from '@influxdata/influxdb-client';
import { Logger } from '../utils/logger';
import { DeviceMetrics } from '../types';

export interface InfluxConfig {
  url: string;
  token: string;
  org: string;
  bucket: string;
}

export class MetricsService {
  private influxClient: InfluxDB;
  private writeApi: WriteApi;
  private queryApi: QueryApi;
  private logger: Logger;
  private config: InfluxConfig;

  constructor(config: InfluxConfig) {
    this.config = config;
    this.logger = new Logger('MetricsService');
    
    this.influxClient = new InfluxDB({
      url: config.url,
      token: config.token
    });

    this.writeApi = this.influxClient.getWriteApi(config.org, config.bucket);
    this.queryApi = this.influxClient.getQueryApi(config.org);

    // Write API 설정
    this.writeApi.useDefaultTags({ source: 'device-management-service' });
  }

  /**
   * 서비스 초기화
   */
  async initialize(): Promise<void> {
    try {
      // InfluxDB 연결 테스트 (간단한 쿼리로 확인)
      const queryApi = this.influxClient.getQueryApi(this.config.org);
      await queryApi.collectRows('buckets() |> limit(1)');

      this.logger.logSuccess('InfluxDB connected successfully', {
        url: this.config.url,
        org: this.config.org,
        bucket: this.config.bucket
      });
    } catch (error: any) {
      this.logger.logWarning('InfluxDB connection test failed, but continuing...', error);
      // InfluxDB 연결 실패해도 서비스는 시작되도록 함
    }
  }

  /**
   * 서비스 종료
   */
  async shutdown(): Promise<void> {
    try {
      await this.writeApi.close();
      this.logger.info('Metrics service shut down successfully');
    } catch (error) {
      this.logger.error('Error shutting down metrics service', error);
    }
  }

  // ============ 메트릭 쓰기 작업 ============

  /**
   * 장비 메트릭 저장
   */
  async writeDeviceMetrics(deviceId: string, metrics: DeviceMetrics): Promise<void> {
    try {
      const point = new Point('device_metrics')
        .tag('deviceId', deviceId)
        .timestamp(new Date(metrics.timestamp));

      // CPU 메트릭
      if (metrics.cpu !== undefined) {
        point.floatField('cpu', metrics.cpu);
      }

      // 메모리 메트릭
      if (metrics.memory !== undefined) {
        point.floatField('memory', metrics.memory);
      }

      // 디스크 메트릭
      if (metrics.disk !== undefined) {
        point.floatField('disk', metrics.disk);
      }

      // 네트워크 메트릭
      if (metrics.network) {
        point
          .floatField('network_bytes_in', metrics.network.bytesIn)
          .floatField('network_bytes_out', metrics.network.bytesOut);
      }

      this.writeApi.writePoint(point);
      
      this.logger.debug('Device metrics written to InfluxDB', {
        deviceId,
        timestamp: metrics.timestamp
      });
    } catch (error) {
      this.logger.error('Failed to write device metrics', error, { deviceId, metrics });
      throw error;
    }
  }

  /**
   * 쓰기 작업 플러시 (즉시 전송)
   */
  async flush(): Promise<void> {
    try {
      await this.writeApi.flush();
      this.logger.debug('InfluxDB write buffer flushed');
    } catch (error) {
      this.logger.error('Failed to flush InfluxDB write buffer', error);
      throw error;
    }
  }

  // ============ 메트릭 조회 작업 ============

  /**
   * 장비 메트릭 조회
   */
  async getDeviceMetrics(
    deviceId: string,
    timeRange: string = '-1h'
  ): Promise<DeviceMetrics[]> {
    try {
      const query = `
        from(bucket: "${this.config.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "device_metrics")
        |> filter(fn: (r) => r.deviceId == "${deviceId}")
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      `;

      const result = await this.queryApi.collectRows(query);
      const metrics = this.parseMetricsResult(result);

      this.logger.debug('Device metrics retrieved from InfluxDB', {
        deviceId,
        timeRange,
        count: metrics.length
      });

      return metrics;
    } catch (error) {
      this.logger.error('Failed to get device metrics', error, { deviceId, timeRange });
      throw error;
    }
  }

  /**
   * 장비 최신 메트릭 조회
   */
  async getLatestDeviceMetrics(deviceId: string): Promise<DeviceMetrics | null> {
    try {
      const query = `
        from(bucket: "${this.config.bucket}")
        |> range(start: -1h)
        |> filter(fn: (r) => r._measurement == "device_metrics")
        |> filter(fn: (r) => r.deviceId == "${deviceId}")
        |> last()
        |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
      `;

      const result = await this.queryApi.collectRows(query);
      const metrics = this.parseMetricsResult(result);

      return metrics.length > 0 ? metrics[0] : null;
    } catch (error) {
      this.logger.error('Failed to get latest device metrics', error, { deviceId });
      return null;
    }
  }

  /**
   * 임계값 초과 장비 조회
   */
  async getDevicesExceedingThreshold(
    metric: 'cpu' | 'memory' | 'disk',
    threshold: number,
    timeRange: string = '-5m'
  ): Promise<Array<{deviceId: string, currentValue: number}>> {
    try {
      const query = `
        from(bucket: "${this.config.bucket}")
        |> range(start: ${timeRange})
        |> filter(fn: (r) => r._measurement == "device_metrics")
        |> filter(fn: (r) => r._field == "${metric}")
        |> filter(fn: (r) => r._value > ${threshold})
        |> group(columns: ["deviceId"])
        |> last()
      `;

      const result = await this.queryApi.collectRows(query);
      const exceedingDevices = result.map((row: any) => ({
        deviceId: row.deviceId,
        currentValue: row._value
      }));

      return exceedingDevices;
    } catch (error) {
      this.logger.error('Failed to get devices exceeding threshold', error);
      return [];
    }
  }

  // ============ 유틸리티 메서드 ============

  /**
   * 메트릭 결과 파싱
   */
  private parseMetricsResult(result: any[]): DeviceMetrics[] {
    return result.map((row: any) => ({
      cpu: row.cpu,
      memory: row.memory,
      disk: row.disk,
      network: row.network_bytes_in !== undefined ? {
        bytesIn: row.network_bytes_in,
        bytesOut: row.network_bytes_out
      } : undefined,
      timestamp: row._time
    }));
  }

  /**
   * 헬스 체크
   */
  async healthCheck(): Promise<boolean> {
    try {
      const queryApi = this.influxClient.getQueryApi(this.config.org);
      await queryApi.collectRows('buckets() |> limit(1)');
      return true;
    } catch (error) {
      this.logger.error('InfluxDB health check failed', error);
      return false;
    }
  }
}
