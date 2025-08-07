/**
 * Device Management Service - Logger
 * Winston 기반 구조화된 로깅
 */

import winston from 'winston';
import Config from './config';

export class Logger {
  private logger: winston.Logger;
  private context: string;

  constructor(context: string = 'DeviceService') {
    this.context = context;
    this.logger = winston.createLogger({
      level: Config.instance.LOG_LEVEL,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, context: ctx, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            context: ctx || this.context,
            message,
            ...meta
          });
        })
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, context: ctx, ...meta }) => {
              const contextStr = ctx || this.context;
              const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
              return `${timestamp} [${level}] [${contextStr}] ${message}${metaStr}`;
            })
          )
        }),
        new winston.transports.File({
          filename: 'logs/device-service.log',
          format: winston.format.json()
        }),
        new winston.transports.File({
          filename: 'logs/device-service-error.log',
          level: 'error',
          format: winston.format.json()
        })
      ]
    });
  }

  info(message: string, meta?: Record<string, any>): void {
    this.logger.info(message, { context: this.context, ...meta });
  }

  error(message: string, error?: Error | any, meta?: Record<string, any>): void {
    this.logger.error(message, {
      context: this.context,
      error: error?.message || error,
      stack: error?.stack,
      ...meta
    });
  }

  warn(message: string, meta?: Record<string, any>): void {
    this.logger.warn(message, { context: this.context, ...meta });
  }

  debug(message: string, meta?: Record<string, any>): void {
    this.logger.debug(message, { context: this.context, ...meta });
  }

  logSuccess(message: string, meta?: Record<string, any>): void {
    this.info(`✅ ${message}`, meta);
  }

  logError(message: string, error?: Error | any, meta?: Record<string, any>): void {
    this.error(`❌ ${message}`, error, meta);
  }

  logWarning(message: string, meta?: Record<string, any>): void {
    this.warn(`⚠️ ${message}`, meta);
  }
}

export const createLogger = (context: string): Logger => new Logger(context);
export default Logger;
