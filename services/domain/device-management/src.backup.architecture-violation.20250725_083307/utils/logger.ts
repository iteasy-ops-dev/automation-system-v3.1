/**
 * Logger utility - Device Management Service
 * Winston 기반 로깅 유틸리티 - TypeScript 5.x 완전 호환
 */

import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private logger: winston.Logger;

  constructor(service: string = 'device-management') {
    // logs 디렉토리 생성
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service },
      transports: [
        new winston.transports.File({ 
          filename: path.join(logsDir, 'error.log'), 
          level: 'error' 
        }),
        new winston.transports.File({ 
          filename: path.join(logsDir, 'device-service.log') 
        })
      ],
    });

    // 개발 환경에서는 콘솔에도 출력
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, meta?: any): void {
    this.logger.error(message, meta);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  verbose(message: string, meta?: any): void {
    this.logger.verbose(message, meta);
  }

  /**
   * 특정 작업의 성공을 로깅
   */
  logSuccess(operation: string, meta?: any): void {
    this.logger.info(`✅ ${operation} 성공`, meta);
  }

  /**
   * 특정 작업의 실패를 로깅
   */
  logFailure(operation: string, error: Error, meta?: any): void {
    this.logger.error(`❌ ${operation} 실패`, {
      error: error.message,
      stack: error.stack,
      ...meta
    });
  }
}

/**
 * Logger 인스턴스 생성 함수
 */
export function createLogger(service: string = 'device-management'): Logger {
  return new Logger(service);
}
