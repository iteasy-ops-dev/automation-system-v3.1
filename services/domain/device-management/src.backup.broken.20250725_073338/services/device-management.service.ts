/**
 * Device Management Service - 완전 구현
 * @file src/services/device-management.service.ts
 * @description 장비 관리 서비스 - device-service.yaml 100% 준수
 */

import { PrismaClient } from '@prisma/client';
import { DeviceRepository } from '../repositories/device.repository';
import { CacheService } from './cache.service';
import { MetricsService, DeviceMetricsInput } from './metrics.service';
import { EventBusService } from './eventbus.service';
import { Logger } from '../utils/logger';

// device-service.yaml 기반 타입 정의
export interface DeviceStatus {
  deviceId: string;
  status: 'online' | 'offline' | 'error' | 'maintenance';
  lastHeartbeat: string;
  uptime?: number;
  version?: string;
  metrics?: { 
    cpu?: number; 
    memory?: number; 
    disk?: number;
    network?: { rxBytes: number; txBytes: number; };
    temperature?: number;
    power?: number;
  };
  errors?: string[];
  lastError?: string | null;
}

export interface DeviceMetrics {
  timestamp: string;
  value: number;
  metric: string;
}

export interface HeartbeatRequest {
  status: 'online' | 'offline' | 'error' | 'maintenance';
  uptime?: number;
  version?: string;
  metrics?: { 
    cpu?: number; 
    memory?: number; 
    disk?: number;
    network?: { rxBytes: number; txBytes: number; };
    temperature?: number;
    power?: number;
  };
  requestCommands?: boolean;
}

export interface HeartbeatResponse {
  acknowledged: boolean;
  timestamp: string;
  nextHeartbeat: string;
  commands?: any[];
}

export interface DevicesHealth {
  total: number;
  online: number;
  offline: number;
  error: number;
  maintenance: number;
  healthPercentage: number;
  lastUpdate: string;
  unhealthyDevices: string[];
  criticalAlerts: string[];
}

export interface DeviceAlert {
  id: string;
  deviceId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  acknowledged: boolean;
  metadata?: Record<string, any>;
}

export interface DeviceAlertsResponse {
  alerts: DeviceAlert[];
  total: number;
  unacknowledged: number;
  critical: number;
  limit: number;
  offset: number;
}

export class DeviceManagementService {
  private deviceRepository: DeviceRepository;
  private cacheService: CacheService;
  private metricsService: MetricsService;
  private eventBusService: EventBusService;
  private logger = new Logger();

  constructor(
    prisma: PrismaClient, 
    cache: CacheService, 
    metrics: MetricsService, 
    events: EventBusService
  ) {
    this.deviceRepository = new DeviceRepository(prisma, cache);
    this.cacheService = cache;
    this.metricsService = metrics;
    this.eventBusService = events;
    this.logger.info('Device management service initialized');
  }

  /**
   * 장비 상태 조회 (GET /devices/{id}/status)
   * device-service.yaml operationId: getDeviceStatus 구현
   */
  async getDeviceStatus(
    deviceId: string, 
    includeMetrics = true, 
    includeErrors = true
  ): Promise<DeviceStatus | null> {
    try {
      this.logger.debug('Getting device status', { deviceId, includeMetrics, includeErrors });

      // 1. DB에서 기본 장비 정보 조회
      const device = await this.deviceRepository.findById(deviceId);
      if (!device) {
        this.logger.warn('Device not found', { deviceId });
        return null;
      }

      // 2. Redis에서 실시간 상태 조회
      const statusKey = `status:${deviceId}`;
      const heartbeatKey = `heartbeat:${deviceId}`;
      const errorKey = `errors:${deviceId}`;

      const [statusData, heartbeatData, errorData] = await Promise.all([
        this.cacheService.get(statusKey),
        this.cacheService.get(heartbeatKey),
        includeErrors ? this.cacheService.get(errorKey) : null
      ]);

      // 3. 기본 상태 정보 구성
      const lastHeartbeat = heartbeatData ? JSON.parse(heartbeatData) : null;
      const currentStatus = statusData || this.mapDbStatusToApiStatus(device.status);

      const deviceStatus: DeviceStatus = {
        deviceId,
        status: currentStatus as 'online' | 'offline' | 'error' | 'maintenance',
        lastHeartbeat: lastHeartbeat?.timestamp || device.updatedAt.toISOString(),
        uptime: lastHeartbeat?.uptime,
        version: lastHeartbeat?.version,
        lastError: null
      };

      // 4. 메트릭 정보 포함 (옵션)
      if (includeMetrics && lastHeartbeat?.metrics) {
        deviceStatus.metrics = {
          cpu: lastHeartbeat.metrics.cpu,
          memory: lastHeartbeat.metrics.memory,
          disk: lastHeartbeat.metrics.disk,
          network: lastHeartbeat.metrics.network,
          temperature: lastHeartbeat.metrics.temperature,
          power: lastHeartbeat.metrics.power
        };
      }

      // 5. 에러 정보 포함 (옵션)
      if (includeErrors && errorData) {
        const errors = JSON.parse(errorData);
        deviceStatus.errors = Array.isArray(errors) ? errors : [errors];
        deviceStatus.lastError = deviceStatus.errors[0] || null;
      }

      this.logger.debug('Device status retrieved', { deviceId, status: deviceStatus.status });
      return deviceStatus;

    } catch (error) {
      this.logger.error('Failed to get device status:', { deviceId, error });
      throw new Error(`Failed to get device status: ${error}`);
    }
  }

  /**
   * 하트비트 처리 (POST /devices/{id}/heartbeat)
   * device-service.yaml operationId: sendHeartbeat 구현
   */
  async sendHeartbeat(deviceId: string, request: HeartbeatRequest): Promise<HeartbeatResponse> {
    try {
      this.logger.debug('Processing heartbeat', { deviceId, status: request.status });

      // 1. 장비 존재 확인
      const device = await this.deviceRepository.findById(deviceId);
      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }

      const timestamp = new Date().toISOString();
      const nextHeartbeat = new Date(Date.now() + 30000).toISOString(); // 30초 후

      // 2. Redis 실시간 상태 업데이트
      const statusKey = `status:${deviceId}`;
      const heartbeatKey = `heartbeat:${deviceId}`;

      const heartbeatData = {
        timestamp,
        status: request.status,
        uptime: request.uptime,
        version: request.version,
        metrics: request.metrics
      };

      await Promise.all([
        this.cacheService.set(statusKey, request.status, 60), // 1분 TTL
        this.cacheService.set(heartbeatKey, JSON.stringify(heartbeatData), 120) // 2분 TTL
      ]);

      // 3. InfluxDB 메트릭 저장 (있는 경우)
      if (request.metrics) {
        const metricsInput: DeviceMetricsInput = {
          cpuUsage: request.metrics.cpu,
          memoryUsage: request.metrics.memory,
          diskUsage: request.metrics.disk,
          networkRx: request.metrics.network?.rxBytes,
          networkTx: request.metrics.network?.txBytes,
          temperature: request.metrics.temperature,
          power: request.metrics.power
        };

        await this.metricsService.writeDeviceMetric(deviceId, metricsInput);

        // 임계값 확인 및 알림 생성
        const thresholds = await this.metricsService.checkThresholds(deviceId, metricsInput);
        
        for (const critical of thresholds.criticals) {
          await this.eventBusService.publishMetricThresholdExceeded(
            deviceId,
            {
              metric: critical.metric,
              threshold: critical.threshold,
              currentValue: critical.value
            }
          );
        }
      }

      // 4. 상태 변경 이벤트 발행 (상태가 변경된 경우)
      const previousStatus = this.mapDbStatusToApiStatus(device.status);
      if (previousStatus !== request.status) {
        await this.eventBusService.publishDeviceStatusChanged(
          deviceId,
          {
            previousStatus,
            currentStatus: request.status,
            reason: 'Heartbeat status change'
          }
        );

        // DB 상태도 업데이트
        await this.deviceRepository.update(deviceId, {
          status: this.mapApiStatusToDbStatus(request.status),
          updatedAt: new Date()
        });
      }

      // 5. 커맨드 조회 (요청된 경우)
      const commands: any[] = [];
      if (request.requestCommands) {
        const commandKey = `commands:${deviceId}`;
        const commandData = await this.cacheService.get(commandKey);
        if (commandData) {
          commands.push(...JSON.parse(commandData));
          await this.cacheService.del(commandKey); // 커맨드 소비
        }
      }

      const response: HeartbeatResponse = {
        acknowledged: true,
        timestamp,
        nextHeartbeat,
        commands: commands.length > 0 ? commands : undefined
      };

      this.logger.debug('Heartbeat processed', { deviceId, nextHeartbeat });
      return response;

    } catch (error) {
      this.logger.error('Failed to process heartbeat:', { deviceId, error });
      throw new Error(`Failed to process heartbeat: ${error}`);
    }
  }  /**
   * 메트릭 조회 (GET /devices/{id}/metrics)
   * device-service.yaml operationId: getDeviceMetrics 구현
   */
  async getDeviceMetrics(
    deviceId: string, 
    metric?: string, 
    start?: Date, 
    end?: Date,
    aggregation?: 'mean' | 'max' | 'min' | 'sum',
    interval?: string
  ): Promise<DeviceMetrics[]> {
    try {
      this.logger.debug('Getting device metrics', { 
        deviceId, 
        metric, 
        start: start?.toISOString(), 
        end: end?.toISOString(),
        aggregation,
        interval
      });

      // 1. 장비 존재 확인
      const device = await this.deviceRepository.findById(deviceId);
      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }

      // 2. InfluxDB에서 메트릭 조회
      const results = await this.metricsService.queryDeviceMetrics({
        deviceId,
        metric,
        start,
        end,
        aggregation,
        interval
      });

      // 3. API 계약 형식으로 변환
      const deviceMetrics: DeviceMetrics[] = results.map(result => ({
        timestamp: result.timestamp,
        value: result.value,
        metric: result.metric
      }));

      this.logger.debug('Device metrics retrieved', { 
        deviceId, 
        resultsCount: deviceMetrics.length 
      });

      return deviceMetrics;

    } catch (error) {
      this.logger.error('Failed to get device metrics:', { deviceId, error });
      throw new Error(`Failed to get device metrics: ${error}`);
    }
  }

  /**
   * 전체 장비 건강 상태 (GET /devices/health)
   * device-service.yaml operationId: getDevicesHealth 구현
   */
  async getDevicesHealth(groupId?: string, status?: string): Promise<DevicesHealth> {
    try {
      this.logger.debug('Getting devices health', { groupId, status });

      // 1. 필터 조건에 따른 장비 목록 조회
      const filters: any = {};
      if (groupId) filters.groupId = groupId;
      if (status) filters.status = this.mapApiStatusToDbStatus(status);

      const devices = await this.deviceRepository.findMany({
        where: filters,
        select: { id: true, name: true, status: true }
      });

      // 2. 각 장비의 실시간 상태 확인
      const statusCounts = {
        online: 0,
        offline: 0,
        error: 0,
        maintenance: 0
      };

      const unhealthyDevices: string[] = [];
      const criticalAlerts: string[] = [];

      for (const device of devices) {
        try {
          const statusKey = `status:${device.id}`;
          const realtimeStatus = await this.cacheService.get(statusKey);
          const currentStatus = realtimeStatus || this.mapDbStatusToApiStatus(device.status);

          // 상태별 집계
          if (currentStatus in statusCounts) {
            statusCounts[currentStatus as keyof typeof statusCounts]++;
          }

          // 비정상 장비 수집
          if (currentStatus === 'offline' || currentStatus === 'error') {
            unhealthyDevices.push(device.id);
          }

          // 중요 알림 확인 (에러 상태인 장비)
          if (currentStatus === 'error') {
            const errorKey = `errors:${device.id}`;
            const errorData = await this.cacheService.get(errorKey);
            if (errorData) {
              criticalAlerts.push(`${device.name}: ${JSON.parse(errorData)[0] || 'Unknown error'}`);
            }
          }
        } catch (error) {
          this.logger.warn('Failed to get device status for health check:', { 
            deviceId: device.id, 
            error 
          });
          // 실시간 상태를 가져올 수 없는 경우 DB 상태 사용
          const dbStatus = this.mapDbStatusToApiStatus(device.status);
          if (dbStatus in statusCounts) {
            statusCounts[dbStatus as keyof typeof statusCounts]++;
          }
        }
      }

      // 3. 건강 상태 백분율 계산
      const total = devices.length;
      const healthy = statusCounts.online + statusCounts.maintenance;
      const healthPercentage = total > 0 ? Math.round((healthy / total) * 100) : 100;

      const devicesHealth: DevicesHealth = {
        total,
        online: statusCounts.online,
        offline: statusCounts.offline,
        error: statusCounts.error,
        maintenance: statusCounts.maintenance,
        healthPercentage,
        lastUpdate: new Date().toISOString(),
        unhealthyDevices: unhealthyDevices.slice(0, 10), // 최대 10개
        criticalAlerts: criticalAlerts.slice(0, 5) // 최대 5개
      };

      this.logger.debug('Devices health calculated', { 
        total, 
        healthPercentage, 
        unhealthyCount: unhealthyDevices.length 
      });

      return devicesHealth;

    } catch (error) {
      this.logger.error('Failed to get devices health:', { error });
      throw new Error(`Failed to get devices health: ${error}`);
    }
  }

  /**
   * 장비 알림 조회 (GET /devices/{id}/alerts)
   * device-service.yaml operationId: getDeviceAlerts 구현
   */
  async getDeviceAlerts(
    deviceId: string,
    severity?: 'low' | 'medium' | 'high' | 'critical',
    limit = 20,
    offset = 0
  ): Promise<DeviceAlertsResponse> {
    try {
      this.logger.debug('Getting device alerts', { deviceId, severity, limit, offset });

      // 1. 장비 존재 확인
      const device = await this.deviceRepository.findById(deviceId);
      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }

      // 2. 최근 메트릭 기반 임계값 확인
      const recentMetrics = await this.metricsService.queryDeviceMetrics({
        deviceId,
        start: new Date(Date.now() - 60 * 60 * 1000), // 최근 1시간
        end: new Date()
      });

      const alerts: DeviceAlert[] = [];

      // 3. 최신 메트릭별 임계값 확인
      const latestMetrics: Record<string, number> = {};
      recentMetrics.forEach(metric => {
        if (!latestMetrics[metric.metric] || new Date(metric.timestamp) > new Date(latestMetrics[metric.metric])) {
          latestMetrics[metric.metric] = metric.value;
        }
      });

      // 4. 임계값 초과 알림 생성
      for (const [metricType, value] of Object.entries(latestMetrics)) {
        const severity = this.getSeverityForMetric(metricType, value);
        
        if (severity && (!severity || severity === severity)) {
          alerts.push({
            id: `${deviceId}-${metricType}-${Date.now()}`,
            deviceId,
            type: `metric_threshold_${severity}`,
            severity,
            message: `${metricType.toUpperCase()} usage is ${value}% (${severity} threshold exceeded)`,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            metadata: {
              metric: metricType,
              value,
              threshold: this.getThresholdForMetric(metricType, severity)
            }
          });
        }
      }

      // 5. 에러 기반 알림 추가
      const errorKey = `errors:${deviceId}`;
      const errorData = await this.cacheService.get(errorKey);
      if (errorData) {
        const errors = JSON.parse(errorData);
        const errorArray = Array.isArray(errors) ? errors : [errors];
        
        errorArray.forEach((error, index) => {
          alerts.push({
            id: `${deviceId}-error-${Date.now()}-${index}`,
            deviceId,
            type: 'system_error',
            severity: 'critical',
            message: error,
            timestamp: new Date().toISOString(),
            acknowledged: false,
            metadata: {
              errorType: 'system',
              source: 'device-heartbeat'
            }
          });
        });
      }

      // 6. 심각도별 필터링
      let filteredAlerts = alerts;
      if (severity) {
        filteredAlerts = alerts.filter(alert => alert.severity === severity);
      }

      // 7. 페이징 적용
      const total = filteredAlerts.length;
      const paginatedAlerts = filteredAlerts
        .slice(offset, offset + limit)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // 8. 집계 정보 계산
      const unacknowledged = filteredAlerts.filter(alert => !alert.acknowledged).length;
      const critical = filteredAlerts.filter(alert => alert.severity === 'critical').length;

      const response: DeviceAlertsResponse = {
        alerts: paginatedAlerts,
        total,
        unacknowledged,
        critical,
        limit,
        offset
      };

      this.logger.debug('Device alerts retrieved', { 
        deviceId, 
        total, 
        unacknowledged, 
        critical 
      });

      return response;

    } catch (error) {
      this.logger.error('Failed to get device alerts:', { deviceId, error });
      throw new Error(`Failed to get device alerts: ${error}`);
    }
  }

  // 유틸리티 메서드들
  private mapDbStatusToApiStatus(dbStatus: string): 'online' | 'offline' | 'error' | 'maintenance' {
    switch (dbStatus?.toLowerCase()) {
      case 'active':
      case 'online':
        return 'online';
      case 'inactive':
      case 'offline':
        return 'offline';
      case 'error':
      case 'failed':
        return 'error';
      case 'maintenance':
        return 'maintenance';
      default:
        return 'offline';
    }
  }

  private mapApiStatusToDbStatus(apiStatus: string): string {
    switch (apiStatus) {
      case 'online':
        return 'ACTIVE';
      case 'offline':
        return 'INACTIVE';
      case 'error':
        return 'ERROR';
      case 'maintenance':
        return 'MAINTENANCE';
      default:
        return 'INACTIVE';
    }
  }

  private getSeverityForMetric(metric: string, value: number): 'low' | 'medium' | 'high' | 'critical' | null {
    const thresholds = {
      cpu: { warning: 75, critical: 90 },
      memory: { warning: 80, critical: 95 },
      disk: { warning: 85, critical: 95 },
      temperature: { warning: 70, critical: 85 }
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (!threshold) return null;

    if (value >= threshold.critical) return 'critical';
    if (value >= threshold.warning) return 'high';
    if (value >= threshold.warning * 0.8) return 'medium';
    if (value >= threshold.warning * 0.6) return 'low';
    
    return null;
  }

  private getThresholdForMetric(metric: string, severity: string): number | undefined {
    const thresholds = {
      cpu: { warning: 75, critical: 90 },
      memory: { warning: 80, critical: 95 },
      disk: { warning: 85, critical: 95 },
      temperature: { warning: 70, critical: 85 }
    };

    const threshold = thresholds[metric as keyof typeof thresholds];
    if (!threshold) return undefined;

    return severity === 'critical' ? threshold.critical : threshold.warning;
  }

  // 헬스체크
  async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy'; details: any }> {
    try {
      const [cacheHealth, metricsHealth, eventBusHealth] = await Promise.all([
        this.cacheService.healthCheck(),
        this.metricsService.healthCheck(),
        this.eventBusService.healthCheck()
      ]);

      const allHealthy = 
        cacheHealth.status === 'healthy' && 
        metricsHealth.status === 'healthy' && 
        eventBusHealth.status === 'healthy';

      return {
        status: allHealthy ? 'healthy' : 'unhealthy',
        details: {
          cache: cacheHealth,
          metrics: metricsHealth,
          eventBus: eventBusHealth,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // 서비스 종료
  async close(): Promise<void> {
    try {
      await Promise.all([
        this.cacheService.close(),
        this.metricsService.close(),
        this.eventBusService.close()
      ]);
      this.logger.info('Device management service closed');
    } catch (error) {
      this.logger.error('Error closing device management service:', error);
    }
  }
}
