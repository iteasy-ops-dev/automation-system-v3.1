  // 장비 메트릭 조회 (계약: GET /devices/{id}/metrics)
  async getDeviceMetrics(
    deviceId: string,
    metric?: string,
    start?: Date,
    end?: Date,
    interval: string = '5m',
    aggregation: string = 'avg',
    limit: number = 1000
  ): Promise<DeviceMetrics | null> {
    try {
      // 1. 장비 존재 확인
      const device = await this.deviceRepository.findDeviceById(deviceId);
      if (!device) {
        return null;
      }

      // 2. InfluxDB에서 메트릭 조회
      const dataPoints = await this.metricsService.queryDeviceMetrics(
        deviceId,
        metric,
        start,
        end,
        interval,
        aggregation
      );

      // 3. 제한된 수만 반환
      const limitedDataPoints = dataPoints.slice(0, limit);

      // 4. 요약 통계 계산
      let summary = undefined;
      if (limitedDataPoints.length > 0) {
        const values = limitedDataPoints.map(point => point.value);
        summary = {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((sum, val) => sum + val, 0) / values.length,
          count: values.length
        };
      }

      // 5. 응답 구성
      const metrics: DeviceMetrics = {
        deviceId: device.id,
        metric: metric || 'all',
        unit: this.getMetricUnit(metric),
        interval,
        aggregation,
        dataPoints: limitedDataPoints.map(point => ({
          timestamp: point.timestamp,
          value: point.value
        })),
        summary
      };

      this.logger.logDeviceOperation('metrics_retrieved', deviceId, {
        metric,
        interval,
        dataPointCount: limitedDataPoints.length
      });

      return metrics;
    } catch (error) {
      this.logger.logError('getDeviceMetrics', error as Error, { 
        deviceId, 
        metric, 
        interval 
      });
      throw error;
    }
  }

  // 하트비트 처리 (계약: POST /devices/{id}/heartbeat)
  async processHeartbeat(
    deviceId: string,
    heartbeat: HeartbeatRequest
  ): Promise<HeartbeatResponse> {
    try {
      // 1. 장비 존재 확인
      const device = await this.deviceRepository.findDeviceById(deviceId);
      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }

      // 2. 현재 상태 확인
      const currentCachedStatus = await this.cacheService.getDeviceStatus(deviceId);
      const previousStatus = currentCachedStatus?.status || device.status;

      // 3. Redis에 상태 업데이트
      await this.cacheService.setDeviceStatus(deviceId, {
        status: heartbeat.status,
        lastHeartbeat: heartbeat.timestamp,
        cpuUsage: heartbeat.metrics?.cpu,
        memoryUsage: heartbeat.metrics?.memory,
        diskUsage: heartbeat.metrics?.disk,
        errorCount: heartbeat.errors?.length || 0
      });

      // 4. InfluxDB에 메트릭 기록
      if (heartbeat.metrics) {
        await this.metricsService.writeDeviceMetric(
          deviceId,
          device.type,
          {
            cpuUsage: heartbeat.metrics.cpu,
            memoryUsage: heartbeat.metrics.memory,
            diskUsage: heartbeat.metrics.disk
          },
          {
            hostname: device.name,
            group_id: device.groupId || 'ungrouped'
          },
          new Date(heartbeat.timestamp)
        );
      }

      // 5. 상태 변경 감지 및 이벤트 발행
      const mappedCurrentStatus = this.mapApiStatusToDb(heartbeat.status);
      if (previousStatus !== mappedCurrentStatus) {
        // 상태 변경 기록
        await this.deviceRepository.recordStatusChange(
          deviceId,
          previousStatus,
          mappedCurrentStatus,
          'Heartbeat status change'
        );

        // 이벤트 발행
        await this.eventBusService.publishDeviceStatusChanged(
          deviceId,
          this.mapDbStatusToApiStatus(previousStatus),
          heartbeat.status,
          'Heartbeat status change'
        );
      }

      // 6. 응답 구성
      const response: HeartbeatResponse = {
        received: new Date().toISOString(),
        nextHeartbeat: 60, // 1분 후 다음 하트비트
        configuration: {
          interval: 60,
          metrics: ['cpu', 'memory', 'disk']
        }
      };

      this.logger.logDeviceOperation('heartbeat_processed', deviceId, {
        status: heartbeat.status,
        hasMetrics: !!heartbeat.metrics,
        statusChanged: previousStatus !== mappedCurrentStatus
      });

      return response;
    } catch (error) {
      this.logger.logError('processHeartbeat', error as Error, { deviceId });
      throw error;
    }
  }
