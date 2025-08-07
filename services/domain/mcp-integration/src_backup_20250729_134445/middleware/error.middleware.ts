/**
 * 에러 핸들러 미들웨어
 * 모든 에러를 통합 처리하고 계약에 맞는 ErrorResponse 형식으로 반환
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';

const logger = new Logger('error-handler');

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export function errorHandler(err: AppError, req: Request, res: Response, next: NextFunction): void {
  // 이미 응답이 시작된 경우 Express 기본 에러 핸들러로 넘김
  if (res.headersSent) {
    return next(err);
  }

  // 에러 로깅
  logger.error('❌ Error occurred:', {
    error: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    code: err.code,
    path: req.path,
    method: req.method,
    user: (req as any).user?.id,
    body: req.body,
    query: req.query
  });

  // 상태 코드 결정
  let statusCode = err.statusCode || 500;
  let errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected error occurred';

  // 특정 에러 타입별 처리
  if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'CastError' || err.message.includes('invalid UUID')) {
    statusCode = 400;
    errorCode = 'INVALID_PARAMETER';
  } else if (err.message.includes('not found')) {
    statusCode = 404;
    errorCode = 'RESOURCE_NOT_FOUND';
  } else if (err.message.includes('already exists') || err.message.includes('duplicate')) {
    statusCode = 409;
    errorCode = 'RESOURCE_CONFLICT';
  } else if (err.message.includes('connection') || err.message.includes('timeout')) {
    statusCode = 503;
    errorCode = 'SERVICE_UNAVAILABLE';
  }

  // 프로덕션 환경에서는 민감한 정보 숨김
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
  }

  // 계약에 맞는 ErrorResponse 형식으로 응답
  const errorResponse = {
    error: errorCode,
    message: message,
    timestamp: new Date().toISOString(),
    ...(err.details && { details: err.details })
  };

  res.status(statusCode).json(errorResponse);
}

/**
 * 비동기 라우터 핸들러를 위한 에러 캐치 래퍼
 */
export function asyncHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
