/**
 * Device Management Service - 비즈니스 로직
 * 계약 기반: device-service.yaml 100% 준수
 */

import { PrismaClient } from '@prisma/client';
import { DeviceRepository } from '@/repositories';
import { CacheService, MetricsService, EventBusService } from '@/services';
import { getLogger } from '@/utils';
import { 
  DeviceStatus, 
  DeviceMetrics, 
  HeartbeatRequest, 
  HeartbeatResponse,
  DevicesHealth,
  DeviceAlertsResponse 
} from '@/types';

export class DeviceManagementService {
  private deviceRepository: DeviceRepository;
  private cacheService: CacheService;
  private metricsService: MetricsService;
  private eventBusService: EventBusService;
  private logger = getLogger();

  constructor(
    prisma: PrismaClient,
    cacheService: CacheService,
    metricsService: MetricsService,
    eventBusService: EventBusService
  ) {
    this.deviceRepository = new DeviceRepository(prisma, cacheService);
    this.cacheService = cacheService;
    this.metricsService = metricsService;
    this.eventBusService = eventBusService;
  }

  // 장비 현재 상태 조회 (계약: GET /devices/{id}/status)
  async getDeviceStatus(
    deviceId: string,
    includeMetrics: boolean = true,
    includeErrors: boolean = true
  ): Promise<DeviceStatus | null> {
    try {
      // 1. DB에서 기본 장비 정보 조회
      const device = await this.deviceRepository.findDeviceById(deviceId);
      if (!device) {
        this.logger.debug('Device not found', { deviceId });
        return null;
      }

      // 2. Redis에서 실시간 상태 조회
      const cachedStatus = await this.cacheService.getDeviceStatus(deviceId);
      
      // 3. 상태 객체 구성
      const status: DeviceStatus = {
        deviceId: device.id,
        status: this.mapDbStatusToApiStatus(cachedStatus?.status || device.status),
        lastHeartbeat: cachedStatus?.last_heartbeat || device.updatedAt?.toISOString() || '',
        uptime: cachedStatus?.uptime ? parseInt(cachedStatus.uptime) : undefined,
        version: cachedStatus?.version || undefined
      };

      // 4. 메트릭 포함 (요청시)
      if (includeMetrics && cachedStatus) {
        status.metrics = {
          cpu: cachedStatus.cpu_usage ? parseFloat(cachedStatus.cpu_usage) : undefined,
          memory: cachedStatus.memory_usage ? parseFloat(cachedStatus.memory_usage) : undefined,
          disk: cachedStatus.disk_usage ? parseFloat(cachedStatus.disk_usage) : undefined,
          network: cachedStatus.network_in && cachedStatus.network_out ? {
            rxBytes: parseInt(cachedStatus.network_in),
            txBytes: parseInt(cachedStatus.network_out)
          } : undefined,
          temperature: cachedStatus.temperature ? parseFloat(cachedStatus.temperature) : undefined,
          power: cachedStatus.power ? parseFloat(cachedStatus.power) : undefined
        };
      }

      // 5. 에러 정보 포함 (요청시)
      if (includeErrors) {
        const errorCount = cachedStatus?.error_count ? parseInt(cachedStatus.error_count) : 0;
        status.errors = errorCount > 0 ? [`${errorCount} recent errors`] : [];
        status.lastError = cachedStatus?.last_error || null;
      }

      this.logger.logDeviceOperation('status_retrieved', deviceId, { 
        status: status.status,
        includeMetrics,
        includeErrors 
      });

      return status;
    } catch (error) {
      this.logger.logError('getDeviceStatus', error as Error, { deviceId });
      throw error;
    }
  }

  // 장비 메트릭 조회 (계약: GET /devices/{id}/metrics)
  async getDeviceMetrics(
    deviceId: string,
    metric?: string,
    start?: Date,
    end?: Date,
    aggregation?: 'mean' | 'max' | 'min' | 'sum',
    interval?: string
  ): Promise<DeviceMetrics[]> {
    try {
      // 1. 장비 존재 확인
      const device = await this.deviceRepository.findDeviceById(deviceId);
      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }

      // 2. InfluxDB에서 메트릭 조회
      const influxMetrics = await this.metricsService.getDeviceMetrics(
        deviceId,
        metric,
        start,
        end,
        aggregation,
        interval
      );

      // 3. API 계약 형식으로 변환
      const metrics: DeviceMetrics[] = influxMetrics.map(point => ({
        timestamp: point.timestamp,
        value: point.value,
        metric: point.field
      }));

      this.logger.logDeviceOperation('metrics_retrieved', deviceId, {
        metric,
        count: metrics.length,
        start: start?.toISOString(),
        end: end?.toISOString()
      });

      return metrics;
    } catch (error) {
      this.logger.logError('getDeviceMetrics', error as Error, { deviceId, metric });
      throw error;
    }
  }

  // 하트비트 처리 (계약: POST /devices/{id}/heartbeat)
  async sendHeartbeat(
    deviceId: string,
    request: HeartbeatRequest
  ): Promise<HeartbeatResponse> {
    try {
      // 1. 장비 존재 확인
      const device = await this.deviceRepository.findDeviceById(deviceId);
      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }

      const timestamp = new Date();

      // 2. Redis에 실시간 상태 업데이트
      await this.cacheService.updateDeviceStatus(deviceId, {
        status: request.status,
        last_heartbeat: timestamp.toISOString(),
        uptime: request.uptime?.toString(),
        version: request.version,
        cpu_usage: request.metrics?.cpu?.toString(),
        memory_usage: request.metrics?.memory?.toString(),
        disk_usage: request.metrics?.disk?.toString(),
        network_in: request.metrics?.network?.rxBytes?.toString(),
        network_out: request.metrics?.network?.txBytes?.toString(),
        temperature: request.metrics?.temperature?.toString(),
        power: request.metrics?.power?.toString(),
        error_count: '0', // 하트비트 성공시 에러 카운트 리셋
        last_error: null
      });

      // 3. InfluxDB에 메트릭 저장 (메트릭이 있는 경우)
      if (request.metrics) {
        await this.metricsService.writeDeviceMetric(
          deviceId,
          device.type,
          {
            cpuUsage: request.metrics.cpu,
            memoryUsage: request.metrics.memory,
            diskUsage: request.metrics.disk,
            networkIn: request.metrics.network?.rxBytes,
            networkOut: request.metrics.network?.txBytes,
            temperature: request.metrics.temperature,
            powerConsumption: request.metrics.power
          },
          {
            device_name: device.name,
            device_group: device.groupId || 'default'
          },
          timestamp
        );
      }

      // 4. 상태 변경 이벤트 발행 (상태가 변경된 경우)
      const previousStatus = await this.cacheService.get(`device:${deviceId}:previous_status`);
      if (previousStatus !== request.status) {
        await this.eventBusService.publishDeviceEvent(
          'DeviceStatusChanged',
          deviceId,
          {
            previousStatus: previousStatus || 'unknown',
            currentStatus: request.status,
            reason: 'heartbeat_update',
            timestamp: timestamp.toISOString()
          },
          {
            source: 'heartbeat',
            correlationId: `heartbeat-${deviceId}-${timestamp.getTime()}`
          }
        );

        // 이전 상태 업데이트
        await this.cacheService.set(
          `device:${deviceId}:previous_status`,
          request.status,
          3600 // 1시간 TTL
        );
      }

      const response: HeartbeatResponse = {
        acknowledged: true,
        timestamp: timestamp.toISOString(),
        nextHeartbeat: new Date(timestamp.getTime() + 30000).toISOString(), // 30초 후
        commands: request.requestCommands ? [] : undefined // 추후 구현
      };

      this.logger.logDeviceOperation('heartbeat_processed', deviceId, {
        status: request.status,
        hasMetrics: !!request.metrics,
        statusChanged: previousStatus !== request.status
      });

      return response;
    } catch (error) {
      this.logger.logError('sendHeartbeat', error as Error, { deviceId });
      throw error;
    }
  }

  // 장비들 건강 상태 요약 (계약: GET /devices/health)
  async getDevicesHealth(
    groupId?: string,
    status?: string
  ): Promise<DevicesHealth> {
    try {
      // 1. 필터 조건 구성
      const filters: any = {};
      if (groupId) filters.groupId = groupId;
      if (status) filters.status = status;

      // 2. 장비 목록 조회
      const devices = await this.deviceRepository.findDevices(filters);

      // 3. 각 장비의 실시간 상태 조회 및 집계
      let online = 0;
      let offline = 0;
      let error = 0;
      let maintenance = 0;
      const unhealthyDevices: string[] = [];
      const criticalAlerts: string[] = [];

      for (const device of devices.items) {
        const cachedStatus = await this.cacheService.getDeviceStatus(device.id);
        
        // 하트비트 기반 상태 확인 (5분 이내 하트비트 없으면 offline)
        const lastHeartbeat = cachedStatus?.last_heartbeat ? 
          new Date(cachedStatus.last_heartbeat) : 
          device.updatedAt;
        
        const isOnline = lastHeartbeat && 
          (Date.now() - lastHeartbeat.getTime()) < 5 * 60 * 1000;

        if (!isOnline) {
          offline++;
          unhealthyDevices.push(device.id);
        } else {
          const currentStatus = cachedStatus?.status || device.status;
          switch (currentStatus) {
            case 'online':
            case 'active':
              online++;
              break;
            case 'error':
              error++;
              unhealthyDevices.push(device.id);
              criticalAlerts.push(`Device ${device.name} in error state`);
              break;
            case 'maintenance':
              maintenance++;
              break;
            default:
              offline++;
              unhealthyDevices.push(device.id);
          }
        }

        // CPU 사용률 임계값 확인 (90% 이상)
        if (cachedStatus?.cpu_usage) {
          const cpuUsage = parseFloat(cachedStatus.cpu_usage);
          if (cpuUsage >= 90) {
            criticalAlerts.push(`Device ${device.name} CPU usage: ${cpuUsage}%`);
          }
        }
      }

      const health: DevicesHealth = {
        total: devices.total,
        online,
        offline,
        error,
        maintenance,
        healthPercentage: devices.total > 0 ? 
          Math.round((online / devices.total) * 100) : 0,
        lastUpdate: new Date().toISOString(),
        unhealthyDevices,
        criticalAlerts: criticalAlerts.slice(0, 10) // 최대 10개
      };

      this.logger.logDeviceOperation('health_summary_generated', 'all', {
        total: health.total,
        online: health.online,
        offline: health.offline,
        healthPercentage: health.healthPercentage,
        groupId,
        status
      });

      return health;
    } catch (error) {
      this.logger.logError('getDevicesHealth', error as Error, { groupId, status });
      throw error;
    }
  }

  // 장비 알림 조회 (계약: GET /devices/{id}/alerts)
  async getDeviceAlerts(
    deviceId: string,
    severity?: 'low' | 'medium' | 'high' | 'critical',
    limit: number = 20,
    offset: number = 0
  ): Promise<DeviceAlertsResponse> {
    try {
      // 1. 장비 존재 확인
      const device = await this.deviceRepository.findDeviceById(deviceId);
      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }

      // 2. 임계값 확인
      const thresholds = {
        cpuUsage: 80,
        memoryUsage: 85,
        diskUsage: 90,
        temperature: 75
      };

      const thresholdResults = await this.metricsService.checkThresholds(
        deviceId,
        thresholds
      );

      // 3. 알림 생성
      const alerts = thresholdResults
        .filter(result => result.exceeded)
        .map(result => ({
          id: `${deviceId}-${result.metric}-${Date.now()}`,
          deviceId,
          type: 'metric_threshold',
          severity: this.getSeverityForMetric(result.metric, result.value, result.threshold),
          message: `${result.metric} is ${result.value}% (threshold: ${result.threshold}%)`,
          timestamp: new Date().toISOString(),
          acknowledged: false,
          metadata: {
            metric: result.metric,
            value: result.value,
            threshold: result.threshold
          }
        }))
        .filter(alert => !severity || alert.severity === severity)
        .slice(offset, offset + limit);

      const response: DeviceAlertsResponse = {
        alerts,
        total: alerts.length,
        unacknowledged: alerts.filter(a => !a.acknowledged).length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        limit,
        offset
      };

      this.logger.logDeviceOperation('alerts_retrieved', deviceId, {
        totalAlerts: response.total,
        unacknowledged: response.unacknowledged,
        critical: response.critical,
        severity
      });

      return response;
    } catch (error) {
      this.logger.logError('getDeviceAlerts', error as Error, { deviceId, severity });
      throw error;
    }
  }

  // 유틸리티 메서드들
  private mapDbStatusToApiStatus(dbStatus: string): 'online' | 'offline' | 'error' | 'maintenance' {
    switch (dbStatus) {
      case 'active':
        return 'online';
      case 'inactive':
        return 'offline';
      case 'error':
        return 'error';
      case 'maintenance':
        return 'maintenance';
      default:
        return 'offline';
    }
  }

  private getSeverityForMetric(
    metric: string, 
    value: number, 
    threshold: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const exceedPercentage = ((value - threshold) / threshold) * 100;
    
    if (exceedPercentage > 50) return 'critical';
    if (exceedPercentage > 25) return 'high';
    if (exceedPercentage > 10) return 'medium';
    return 'low';
  }
}
