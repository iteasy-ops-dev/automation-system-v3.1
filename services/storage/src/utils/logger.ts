/**
 * Logger utility - 완전한 클래스 구현
 * Winston 기반 로깅 유틸리티 - TypeScript 5.x 완전 호환
 */

import * as winston from 'winston';

export class Logger {
  private logger: winston.Logger;

  constructor(service: string = 'default') {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service },
      transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' })
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
}

// 기본 logger 인스턴스
export const logger = new Logger('storage-service');
export default Logger;
