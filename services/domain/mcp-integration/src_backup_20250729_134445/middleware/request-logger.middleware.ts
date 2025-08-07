/**
 * 요청 로깅 미들웨어
 * 모든 API 요청을 로깅하고 성능 메트릭 수집
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

const logger = new Logger('request-logger');

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const requestId = generateRequestId();

  // 요청 정보 로깅
  logger.info('📥 Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    user: (req as any).user?.id
  });

  // 응답 완료 시 로깅
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    const emoji = res.statusCode >= 400 ? '⚠️' : '✅';

    logger[logLevel](`${emoji} Request completed`, {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      user: (req as any).user?.id
    });

    // 성능 메트릭 (느린 요청 감지)
    if (duration > 5000) {
      logger.warn('🐌 Slow request detected', {
        requestId,
        method: req.method,
        path: req.path,
        duration: `${duration}ms`
      });
    }
  });

  // 요청 ID를 응답 헤더에 추가
  res.set('X-Request-ID', requestId);

  next();
}

/**
 * 고유한 요청 ID 생성
 */
function generateRequestId(): string {
  return `mcp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
