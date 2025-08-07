  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, error?: Error | any, meta?: any): void {
    this.logger.error(message, { error, ...meta });
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  // Device 관련 로깅 헬퍼
  logDeviceOperation(operation: string, deviceId: string, meta?: any): void {
    this.info(`Device ${operation}`, {
      deviceId,
      operation,
      ...meta
    });
  }

  logMetricCollection(deviceId: string, metricType: string, value: number, meta?: any): void {
    this.debug('Metric collected', {
      deviceId,
      metricType,
      value,
      ...meta
    });
  }

  logStatusChange(deviceId: string, fromStatus: string, toStatus: string, reason?: string): void {
    this.info('Device status changed', {
      deviceId,
      fromStatus,
      toStatus,
      reason
    });
  }

  logEventPublished(eventType: string, deviceId: string, correlationId?: string): void {
    this.info('Event published', {
      eventType,
      deviceId,
      correlationId
    });
  }

  logError(operation: string, error: Error, context?: any): void {
    this.error(`Operation failed: ${operation}`, error, context);
  }
}

// 싱글톤 인스턴스 생성
let loggerInstance: Logger | null = null;

export function createLogger(config: LoggerConfig): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger(config);
  }
  return loggerInstance;
}

export function getLogger(): Logger {
  if (!loggerInstance) {
    throw new Error('Logger not initialized. Call createLogger first.');
  }
  return loggerInstance;
}
