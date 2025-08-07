  // 장비 상태 변경 이벤트
  async publishDeviceStatusChanged(
    deviceId: string,
    previousStatus: string,
    currentStatus: string,
    reason?: string,
    duration?: number,
    correlationId?: string
  ): Promise<boolean> {
    return await this.publishDeviceEvent(
      'DeviceStatusChanged',
      deviceId,
      {
        previousStatus,
        currentStatus,
        reason,
        duration
      },
      {
        correlationId,
        source: 'device-service',
        tags: ['status-change', currentStatus]
      }
    );
  }

  // 메트릭 임계값 초과 이벤트
  async publishMetricThresholdExceeded(
    deviceId: string,
    metric: string,
    threshold: number,
    currentValue: number,
    severity: 'low' | 'medium' | 'high' | 'critical',
    duration?: number,
    correlationId?: string
  ): Promise<boolean> {
    return await this.publishDeviceEvent(
      'MetricThresholdExceeded',
      deviceId,
      {
        metric,
        threshold,
        currentValue,
        unit: metric === 'temperature' ? 'celsius' : 'percent',
        severity,
        duration
      },
      {
        correlationId,
        source: 'device-service',
        tags: ['threshold-exceeded', metric, severity]
      }
    );
  }

  // 장비 헬스체크 이벤트
  async publishDeviceHealthCheck(
    deviceId: string,
    checkType: 'scheduled' | 'manual' | 'triggered',
    result: 'healthy' | 'warning' | 'critical' | 'unknown',
    metrics?: {
      responseTime?: number;
      uptime?: number;
      resourceUsage?: {
        cpu?: number;
        memory?: number;
        disk?: number;
      };
    },
    issues?: string[],
    correlationId?: string
  ): Promise<boolean> {
    return await this.publishDeviceEvent(
      'DeviceHealthCheck',
      deviceId,
      {
        checkType,
        result,
        metrics,
        issues
      },
      {
        correlationId,
        source: 'device-service',
        tags: ['health-check', result]
      }
    );
  }

  // 장비 알림 트리거 이벤트
  async publishDeviceAlertTriggered(
    deviceId: string,
    alertId: string,
    alertType: 'metric_threshold' | 'heartbeat_timeout' | 'error_detected' | 'maintenance_required',
    severity: 'low' | 'medium' | 'high' | 'critical',
    message: string,
    details?: Record<string, any>,
    correlationId?: string
  ): Promise<boolean> {
    return await this.publishDeviceEvent(
      'DeviceAlertTriggered',
      deviceId,
      {
        alertId,
        alertType,
        severity,
        message,
        details
      },
      {
        correlationId,
        source: 'device-service',
        tags: ['alert', alertType, severity]
      }
    );
  }
