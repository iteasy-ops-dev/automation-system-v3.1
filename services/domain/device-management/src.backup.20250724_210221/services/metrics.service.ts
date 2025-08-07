/**
 * Device Management Service InfluxDB Metrics
 * 시계열 메트릭 수집 및 저장
 */

import { InfluxDB, Point, WriteApi, QueryApi, flux } from '@influxdata/influxdb-client';
import { InfluxMetricPoint } from '@/types';
import { getLogger } from '@/utils';

export class MetricsService {
  private influxDB: InfluxDB;
  private writeApi: WriteApi;
  private queryApi: QueryApi;
  private logger = getLogger();
  private org: string;
  private bucket: string;

  constructor(config: {
    url: string;
    token: string;
    org: string;
    bucket: string;
  }) {
    this.org = config.org;
    this.bucket = config.bucket;

    this.influxDB = new InfluxDB({
      url: config.url,
      token: config.token,
      timeout: 30000
    });

    this.writeApi = this.influxDB.getWriteApi(this.org, this.bucket, 'ns');
    this.queryApi = this.influxDB.getQueryApi(this.org);

    this.setupWriteApi();
    this.logger.info('InfluxDB metrics service initialized');
  }

  private setupWriteApi(): void {
    this.writeApi.useDefaultTags({
      service: 'device-management',
      version: process.env.SERVICE_VERSION || '1.0.0'
    });
  }

  // Device 메트릭 기록 (스키마 기반)
  async writeDeviceMetric(
    deviceId: string,
    deviceType: string,
    metrics: {
      cpuUsage?: number;
      memoryUsage?: number;
      diskUsage?: number;
      networkIn?: number;
      networkOut?: number;
      loadAverage?: number;
      temperature?: number;
      powerConsumption?: number;
    },
    tags: Record<string, string> = {},
    timestamp?: Date
  ): Promise<boolean> {
    try {
      const point = new Point('device_metrics')
        .tag('device_id', deviceId)
        .tag('device_type', deviceType)
        .tag('environment', process.env.NODE_ENV || 'development');

      // 추가 태그 설정
      Object.entries(tags).forEach(([key, value]) => {
        point.tag(key, value);
      });

      // 메트릭 필드 설정
      if (metrics.cpuUsage !== undefined) {
        point.floatField('cpu_usage', metrics.cpuUsage);
      }
      if (metrics.memoryUsage !== undefined) {
        point.floatField('memory_usage', metrics.memoryUsage);
      }
      if (metrics.diskUsage !== undefined) {
        point.floatField('disk_usage', metrics.diskUsage);
      }
      if (metrics.networkIn !== undefined) {
        point.intField('network_in', metrics.networkIn);
      }
      if (metrics.networkOut !== undefined) {
        point.intField('network_out', metrics.networkOut);
      }
      if (metrics.loadAverage !== undefined) {
        point.floatField('load_average', metrics.loadAverage);
      }
      if (metrics.temperature !== undefined) {
        point.floatField('temperature', metrics.temperature);
      }
      if (metrics.powerConsumption !== undefined) {
        point.floatField('power_consumption', metrics.powerConsumption);
      }

      if (timestamp) {
        point.timestamp(timestamp);
      }

      this.writeApi.writePoint(point);
      await this.writeApi.flush();

      this.logger.logMetricCollection(deviceId, 'device_metrics', Object.keys(metrics).length);
      return true;
    } catch (error) {
      this.logger.error('Write device metric failed', error, { deviceId, deviceType });
      return false;
    }
  }

  // Device 메트릭 조회 (시계열 데이터)
  async getDeviceMetrics(
    deviceId: string,
    metric?: string,
    start?: Date,
    end?: Date,
    aggregation?: 'mean' | 'max' | 'min' | 'sum',
    interval?: string
  ): Promise<InfluxMetricPoint[]> {
    try {
      const startTime = start || new Date(Date.now() - 24 * 60 * 60 * 1000); // 기본 24시간
      const endTime = end || new Date();
      const aggFunc = aggregation || 'mean';
      const aggInterval = interval || '5m';

      let fluxQuery = `
        from(bucket: "${this.bucket}")
          |> range(start: ${Math.floor(startTime.getTime() / 1000)}, stop: ${Math.floor(endTime.getTime() / 1000)})
          |> filter(fn: (r) => r._measurement == "device_metrics")
          |> filter(fn: (r) => r.device_id == "${deviceId}")
      `;

      if (metric) {
        fluxQuery += `|> filter(fn: (r) => r._field == "${metric}")\n`;
      }

      fluxQuery += `
          |> aggregateWindow(every: ${aggInterval}, fn: ${aggFunc}, createEmpty: false)
          |> yield(name: "result")
      `;

      const result: InfluxMetricPoint[] = [];
      
      await new Promise<void>((resolve, reject) => {
        this.queryApi.queryRows(fluxQuery, {
          next(row: string[], tableMeta: any) {
            const point: InfluxMetricPoint = {
              timestamp: tableMeta.get(row, '_time'),
              value: parseFloat(tableMeta.get(row, '_value')),
              field: tableMeta.get(row, '_field'),
              deviceId: tableMeta.get(row, 'device_id'),
              tags: {}
            };

            // 추가 태그들 수집
            for (const column of tableMeta.columns) {
              if (!column.label.startsWith('_') && 
                  column.label !== 'device_id' && 
                  column.label !== 'result') {
                const value = tableMeta.get(row, column.label);
                if (value) {
                  point.tags[column.label] = value;
                }
              }
            }

            result.push(point);
          },
          error(error: Error) {
            reject(error);
          },
          complete() {
            resolve();
          }
        });
      });

      this.logger.logMetricQuery(deviceId, metric, result.length, {
        start: startTime,
        end: endTime,
        aggregation: aggFunc,
        interval: aggInterval
      });

      return result;
    } catch (error) {
      this.logger.error('Get device metrics failed', error, { 
        deviceId, 
        metric, 
        start, 
        end 
      });
      throw error;
    }
  }

  // 배치 메트릭 처리
  async writeBatchMetrics(metrics: Array<{
    deviceId: string;
    deviceType: string;
    metrics: Record<string, number>;
    tags?: Record<string, string>;
    timestamp?: Date;
  }>): Promise<{ success: number; failed: number }> {
    const results = { success: 0, failed: 0 };

    try {
      for (const metric of metrics) {
        const success = await this.writeDeviceMetric(
          metric.deviceId,
          metric.deviceType,
          metric.metrics,
          metric.tags,
          metric.timestamp
        );
        
        if (success) {
          results.success++;
        } else {
          results.failed++;
        }
      }

      await this.writeApi.flush();
      this.logger.info('Batch metrics processed', results);
      
      return results;
    } catch (error) {
      this.logger.error('Batch metrics processing failed', error, { 
        total: metrics.length 
      });
      throw error;
    }
  }

  // 임계값 모니터링
  async checkThresholds(
    deviceId: string,
    thresholds: {
      cpuUsage?: number;
      memoryUsage?: number;
      diskUsage?: number;
      temperature?: number;
    }
  ): Promise<Array<{ metric: string; value: number; threshold: number; exceeded: boolean }>> {
    try {
      // 최근 5분간 평균값 조회
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - 5 * 60 * 1000);

      const metrics = await this.getDeviceMetrics(
        deviceId,
        undefined,
        startTime,
        endTime,
        'mean',
        '5m'
      );

      const results: Array<{ metric: string; value: number; threshold: number; exceeded: boolean }> = [];

      // 각 임계값 확인
      for (const [metricName, threshold] of Object.entries(thresholds)) {
        if (threshold === undefined) continue;

        const metricPoints = metrics.filter(m => m.field === metricName.replace('Usage', '_usage'));
        if (metricPoints.length === 0) continue;

        const latestValue = metricPoints[metricPoints.length - 1].value;
        const exceeded = latestValue > threshold;

        results.push({
          metric: metricName,
          value: latestValue,
          threshold,
          exceeded
        });

        if (exceeded) {
          this.logger.warn('Threshold exceeded', {
            deviceId,
            metric: metricName,
            value: latestValue,
            threshold
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Threshold check failed', error, { deviceId });
      throw error;
    }
  }

  // 서비스 종료 시 정리
  async close(): Promise<void> {
    try {
      await this.writeApi.close();
      this.logger.info('InfluxDB metrics service closed');
    } catch (error) {
      this.logger.error('Error closing metrics service', error);
    }
  }
}
