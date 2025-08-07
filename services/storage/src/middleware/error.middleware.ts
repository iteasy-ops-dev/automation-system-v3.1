/**
 * Error Middleware - Storage Service
 * shared/contracts/v1.0/rest/core/storage-api.yaml 에러 형식 100% 준수
 * 
 * 모든 에러를 계약에 정의된 ErrorResponse 형식으로 변환
 */

import { Request, Response, NextFunction } from 'express';
import { Logger } from '../utils/logger';
import { ErrorResponse } from '../types/storage.types';

const logger = new Logger('ErrorMiddleware');

/**
 * JSON 파싱 에러 핸들러
 * Express body-parser에서 발생하는 JSON 파싱 에러를 처리
 */
export function jsonErrorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  if (err instanceof SyntaxError && 'body' in err) {
    logger.warn('JSON parsing error', {
      error: err.message,
      url: req.url,
      method: req.method,
      contentType: req.get('Content-Type'),
      body: req.body
    });

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 400,
        message: 'Invalid JSON format',
        details: 'Request body contains malformed JSON',
        timestamp: new Date().toISOString()
      }
    };

    res.status(400).json(errorResponse);
    return;
  }

  next(err);
}

/**
 * 일반적인 에러 핸들러
 * 모든 처리되지 않은 에러를 계약 형식으로 변환
 */
export function globalErrorHandler(err: Error, req: Request, res: Response, next: NextFunction): void {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    headers: req.headers,
    body: req.body
  });

  // 이미 응답이 시작된 경우
  if (res.headersSent) {
    return next(err);
  }

  // 개발 환경에서는 스택 트레이스 포함
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: 500,
      message: 'Internal server error',
      details: isDevelopment ? err.stack : 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    }
  };

  res.status(500).json(errorResponse);
}

/**
 * 비동기 에러 래퍼
 * 비동기 라우트 핸들러의 에러를 자동으로 catch
 */
export function asyncErrorHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 핸들러
 * 존재하지 않는 엔드포인트에 대한 계약 준수 에러 응답
 */
export function notFoundHandler(req: Request, res: Response): void {
  logger.warn('Endpoint not found', {
    url: req.url,
    method: req.method,
    userAgent: req.get('User-Agent')
  });

  const errorResponse: ErrorResponse = {
    success: false,
    error: {
      code: 404,
      message: 'Endpoint not found',
      details: `${req.method} ${req.url} is not available`,
      timestamp: new Date().toISOString()
    }
  };

  res.status(404).json(errorResponse);
}

/**
 * 요청 검증 에러 핸들러
 * express-validator 에러를 계약 형식으로 변환
 */
export function validationErrorHandler(errors: any[]): ErrorResponse {
  const details = errors.map(error => ({
    field: error.param || error.path,
    message: error.msg,
    value: error.value
  }));

  return {
    success: false,
    error: {
      code: 400,
      message: 'Validation failed',
      details,
      timestamp: new Date().toISOString()
    }
  };
}