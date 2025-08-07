/**
 * Logger utility - MCP Integration Service
 * Winston 기반 로깅 유틸리티 - TypeScript 5.x 완전 호환
 */

import * as winston from 'winston';
import * as fs from 'fs';
import * as path from 'path';

export class Logger {
  private static instance: Logger;
  private logger: winston.Logger;

  constructor(service: string = 'mcp-integration') {
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
          filename: path.join(logsDir, 'mcp-integration-service.log') 
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

  /**
   * 싱글톤 인스턴스 반환
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
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

  /**
   * MCP 작업 전용 로깅
   */
  logMCPOperation(operation: string, serverId: string, meta?: any): void {
    this.logger.info(`🔧 MCP ${operation}`, {
      serverId,
      ...meta
    });
  }

  /**
   * JSON-RPC 요청/응답 로깅
   */
  logJsonRpc(direction: 'request' | 'response', data: any, serverId?: string): void {
    this.logger.debug(`🔄 JSON-RPC ${direction}`, {
      direction,
      serverId,
      data: JSON.stringify(data)
    });
  }
}