  // 전체 장비 건강 상태 조회 (계약: GET /devices/health)
  async getDevicesHealth(filters?: {
    groupId?: string;
    status?: string[];
    critical?: boolean;
  }): Promise<DevicesHealth> {
    try {
      // Repository에서 헬스 데이터 조회
      const healthData = await this.deviceRepository.getDevicesHealth(filters);

      const result: DevicesHealth = {
        summary: healthData.summary,
        details: healthData.details,
        lastUpdated: new Date().toISOString()
      };

      this.logger.logDeviceOperation('health_retrieved', 'all', {
        totalDevices: healthData.summary.total,
        criticalIssues: healthData.details.filter(d => d.severity === 'critical').length
      });

      return result;
    } catch (error) {
      this.logger.logError('getDevicesHealth', error as Error, { filters });
      throw error;
    }
  }

  // 장비 알림 조회 (계약: GET /devices/{id}/alerts)
  async getDeviceAlerts(
    deviceId: string,
    severity?: string,
    status?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<DeviceAlertsResponse> {
    try {
      // 장비 존재 확인
      const device = await this.deviceRepository.findDeviceById(deviceId);
      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }

      // 실제 구현에서는 별도 Alert 테이블이나 외부 시스템에서 조회
      // 현재는 기본 응답 반환
      const result: DeviceAlertsResponse = {
        items: [],
        total: 0,
        limit,
        offset
      };

      this.logger.logDeviceOperation('alerts_retrieved', deviceId, {
        severity,
        status,
        count: result.items.length
      });

      return result;
    } catch (error) {
      this.logger.logError('getDeviceAlerts', error as Error, { 
        deviceId, 
        severity, 
        status 
      });
      throw error;
    }
  }

  // 임계값 모니터링 (백그라운드 작업)
  async checkMetricThresholds(deviceId: string): Promise<void> {
    try {
      const device = await this.deviceRepository.findDeviceById(deviceId);
      if (!device) return;

      const cachedStatus = await this.cacheService.getDeviceStatus(deviceId);
      if (!cachedStatus) return;

      // CPU 임계값 체크 (90%)
      const cpuUsage = cachedStatus.cpu_usage ? parseFloat(cachedStatus.cpu_usage) : 0;
      if (cpuUsage > 90) {
        await this.eventBusService.publishMetricThresholdExceeded(
          deviceId,
          'cpu',
          90,
          cpuUsage,
          cpuUsage > 95 ? 'critical' : 'high'
        );
      }

      // 메모리 임계값 체크 (85%)
      const memoryUsage = cachedStatus.memory_usage ? parseFloat(cachedStatus.memory_usage) : 0;
      if (memoryUsage > 85) {
        await this.eventBusService.publishMetricThresholdExceeded(
          deviceId,
          'memory',
          85,
          memoryUsage,
          memoryUsage > 95 ? 'critical' : 'high'
        );
      }

      // 디스크 임계값 체크 (90%)
      const diskUsage = cachedStatus.disk_usage ? parseFloat(cachedStatus.disk_usage) : 0;
      if (diskUsage > 90) {
        await this.eventBusService.publishMetricThresholdExceeded(
          deviceId,
          'disk',
          90,
          diskUsage,
          diskUsage > 95 ? 'critical' : 'high'
        );
      }

    } catch (error) {
      this.logger.logError('checkMetricThresholds', error as Error, { deviceId });
    }
  }
