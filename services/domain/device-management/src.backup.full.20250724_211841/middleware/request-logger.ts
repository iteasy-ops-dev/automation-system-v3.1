/**
 * Device Management Service - 요청 로깅 미들웨어
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';

const logger = createLogger();

export function requestLogger() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    
    // 요청 정보 로깅
    logger.info('API Request:', {
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      contentType: req.get('Content-Type'),
      timestamp: new Date().toISOString()
    });

    // 응답 완료 시 로깅
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      const logLevel = res.statusCode >= 400 ? 'error' : 'info';
      
      logger.log(logLevel, 'API Response:', {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        contentLength: res.get('Content-Length'),
        timestamp: new Date().toISOString()
      });
    });

    next();
  };
}
