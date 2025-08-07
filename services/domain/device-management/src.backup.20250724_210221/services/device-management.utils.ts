  // 상태 매핑 헬퍼 메서드들
  private mapDbStatusToApiStatus(dbStatus: string): 'online' | 'offline' | 'error' | 'maintenance' {
    switch (dbStatus) {
      case 'active':
        return 'online';
      case 'inactive':
        return 'offline';
      case 'maintenance':
        return 'maintenance';
      default:
        return 'error';
    }
  }

  private mapApiStatusToDb(apiStatus: string): string {
    switch (apiStatus) {
      case 'online':
        return 'active';
      case 'offline':
        return 'inactive';
      case 'maintenance':
        return 'maintenance';
      case 'error':
        return 'error';
      default:
        return 'inactive';
    }
  }

  // 메트릭 단위 매핑
  private getMetricUnit(metric?: string): string {
    if (!metric) return 'mixed';
    
    switch (metric) {
      case 'cpu':
      case 'memory':
      case 'disk':
        return 'percent';
      case 'temperature':
        return 'celsius';
      case 'power':
        return 'watts';
      case 'network':
        return 'bytes';
      default:
        return 'unknown';
    }
  }

  // 장비 타입별 기본 메트릭 반환
  private getDefaultMetricsForDeviceType(deviceType: string): string[] {
    switch (deviceType) {
      case 'server':
        return ['cpu', 'memory', 'disk', 'network', 'temperature'];
      case 'network':
        return ['cpu', 'memory', 'network'];
      case 'storage':
        return ['disk', 'temperature', 'power'];
      case 'iot':
        return ['power', 'temperature'];
      default:
        return ['cpu', 'memory'];
    }
  }

  // 헬스체크 수행
  async performHealthCheck(deviceId: string): Promise<void> {
    try {
      const device = await this.deviceRepository.findDeviceById(deviceId);
      if (!device) return;

      const cachedStatus = await this.cacheService.getDeviceStatus(deviceId);
      
      let healthResult: 'healthy' | 'warning' | 'critical' | 'unknown' = 'unknown';
      const issues: string[] = [];

      if (cachedStatus) {
        // 하트비트 시간 체크
        const lastHeartbeat = new Date(cachedStatus.last_heartbeat);
        const now = new Date();
        const timeDiff = now.getTime() - lastHeartbeat.getTime();
        const minutesSinceHeartbeat = timeDiff / (1000 * 60);

        if (minutesSinceHeartbeat > 5) {
          healthResult = 'critical';
          issues.push(`No heartbeat for ${Math.round(minutesSinceHeartbeat)} minutes`);
        } else if (minutesSinceHeartbeat > 2) {
          healthResult = 'warning';
          issues.push(`Heartbeat delayed by ${Math.round(minutesSinceHeartbeat)} minutes`);
        } else {
          healthResult = 'healthy';
        }

        // 메트릭 체크
        const cpuUsage = cachedStatus.cpu_usage ? parseFloat(cachedStatus.cpu_usage) : 0;
        const memoryUsage = cachedStatus.memory_usage ? parseFloat(cachedStatus.memory_usage) : 0;
        const diskUsage = cachedStatus.disk_usage ? parseFloat(cachedStatus.disk_usage) : 0;

        if (cpuUsage > 90 || memoryUsage > 90 || diskUsage > 90) {
          healthResult = healthResult === 'healthy' ? 'warning' : healthResult;
          if (cpuUsage > 90) issues.push(`High CPU usage: ${cpuUsage}%`);
          if (memoryUsage > 90) issues.push(`High memory usage: ${memoryUsage}%`);
          if (diskUsage > 90) issues.push(`High disk usage: ${diskUsage}%`);
        }
      }

      // 헬스체크 이벤트 발행
      await this.eventBusService.publishDeviceHealthCheck(
        deviceId,
        'scheduled',
        healthResult,
        cachedStatus ? {
          responseTime: 100, // 예시값
          uptime: cachedStatus.uptime ? parseInt(cachedStatus.uptime) : 0,
          resourceUsage: {
            cpu: cachedStatus.cpu_usage ? parseFloat(cachedStatus.cpu_usage) : undefined,
            memory: cachedStatus.memory_usage ? parseFloat(cachedStatus.memory_usage) : undefined,
            disk: cachedStatus.disk_usage ? parseFloat(cachedStatus.disk_usage) : undefined
          }
        } : undefined,
        issues.length > 0 ? issues : undefined
      );

    } catch (error) {
      this.logger.logError('performHealthCheck', error as Error, { deviceId });
    }
  }

  // 정리 작업
  async cleanup(): Promise<void> {
    try {
      this.logger.info('Device management service cleanup started');
      // 연결 정리는 각 서비스에서 처리
      this.logger.info('Device management service cleanup completed');
    } catch (error) {
      this.logger.error('Cleanup failed', error);
    }
  }
}
