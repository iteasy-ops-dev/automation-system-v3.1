/**
 * Logger Utils - 로깅 유틸리티
 * TASK-4-PRISMA 검증된 구현 재사용
 * 
 * @file src/utils/logger.ts
 * @description Device Management Service용 로거
 * @author Backend Team - Domains
 */

import * as winston from 'winston';

const isDevelopment = process.env.NODE_ENV === 'development';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// 커스텀 로그 포맷
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    const { timestamp, level, message, service = 'device-management', ...meta } = info;
    
    let logMessage = `${timestamp} [${service}] ${level.toUpperCase()}: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta)}`;
    }
    
    return logMessage;
  })
);

// 개발 환경용 컬러 포맷
const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf((info) => {
    const { timestamp, level, message, service = 'device-management', ...meta } = info;
    
    let logMessage = `${timestamp} [${service}] ${level}: ${message}`;
    
    if (Object.keys(meta).length > 0) {
      logMessage += ` ${JSON.stringify(meta, null, 2)}`;
    }
    
    return logMessage;
  })
);

// Winston logger 인스턴스 생성
const logger = winston.createLogger({
  level: logLevel,
  format: isDevelopment ? developmentFormat : customFormat,
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true
    })
  ],
  exitOnError: false
});

// 프로덕션 환경에서는 파일 로깅 추가
if (!isDevelopment) {
  logger.add(new winston.transports.File({
    filename: 'logs/device-management-error.log',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxsize: 5242880, // 5MB
    maxFiles: 10
  }));

  logger.add(new winston.transports.File({
    filename: 'logs/device-management-combined.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    maxsize: 5242880, // 5MB
    maxFiles: 5
  }));
}

/**
 * 로거 팩토리 함수
 */
export function createLogger(service?: string): winston.Logger {
  return logger.child({ service: service || 'device-management' });
}

/**
 * 기본 로거 익스포트
 */
export { logger };

/**
 * 로그 레벨 상수
 */
export const LOG_LEVELS = {
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  HTTP: 'http',
  VERBOSE: 'verbose',
  DEBUG: 'debug',
  SILLY: 'silly'
} as const;

/**
 * 로깅 헬퍼 클래스
 */
export class Logger {
  private logger: winston.Logger;

  constructor(service?: string) {
    this.logger = createLogger(service);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  http(message: string, meta?: any): void {
    this.logger.http(message, meta);
  }

  verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  silly(message: string, meta?: any): void {
    this.logger.silly(message, meta);
  }

  /**
   * Express 미들웨어용 로그 함수
   */
  logRequest(req: any, res: any, responseTime: number): void {
    const { method, url, ip } = req;
    const { statusCode } = res;
    
    const logLevel = statusCode >= 400 ? 'warn' : 'info';
    
    this.logger.log(logLevel, 'HTTP Request', {
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      ip,
      userAgent: req.get('User-Agent')
    });
  }

  /**
   * 성능 측정 시작
   */
  startTimer(label: string): () => void {
    const start = Date.now();
    
    return () => {
      const duration = Date.now() - start;
      this.debug(`${label} completed`, { duration: `${duration}ms` });
    };
  }

  /**
   * 에러 로깅 (스택 트레이스 포함)
   */
  logError(error: Error, context?: any): void {
    this.error(error.message, {
      stack: error.stack,
      name: error.name,
      ...context
    });
  }

  /**
   * 데이터베이스 쿼리 로깅
   */
  logQuery(query: string, params?: any, duration?: number): void {
    this.debug('Database Query', {
      query: query.length > 200 ? query.substring(0, 200) + '...' : query,
      params,
      duration: duration ? `${duration}ms` : undefined
    });
  }

  /**
   * 캐시 작업 로깅
   */
  logCache(operation: string, key: string, hit?: boolean, duration?: number): void {
    this.debug(`Cache ${operation}`, {
      key,
      hit,
      duration: duration ? `${duration}ms` : undefined
    });
  }

  /**
   * 이벤트 발행 로깅
   */
  logEvent(eventType: string, payload: any): void {
    this.info('Event Published', {
      eventType,
      payloadSize: JSON.stringify(payload).length
    });
  }

  /**
   * 메트릭 로깅
   */
  logMetric(name: string, value: number, unit?: string, tags?: Record<string, string>): void {
    this.debug('Metric', {
      name,
      value,
      unit,
      tags
    });
  }
}

/**
 * 싱글톤 로거 인스턴스
 */
export const defaultLogger = new Logger('device-management');

/**
 * Express 로깅 미들웨어
 */
export function createLoggingMiddleware() {
  const requestLogger = new Logger('http');
  
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      requestLogger.logRequest(req, res, duration);
    });
    
    next();
  };
}

/**
 * 에러 핸들링 미들웨어
 */
export function createErrorLoggingMiddleware() {
  const errorLogger = new Logger('error');
  
  return (err: any, req: any, res: any, next: any) => {
    errorLogger.logError(err, {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      body: req.body
    });
    
    next(err);
  };
}

/**
 * 종료 시 로거 정리
 */
export function closeLogger(): Promise<void> {
  return new Promise((resolve) => {
    logger.end(() => {
      resolve();
    });
  });
}
