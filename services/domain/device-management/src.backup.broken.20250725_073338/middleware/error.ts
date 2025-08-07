/**
 * Device Management Service - 에러 처리 미들웨어
 */

import { Request, Response, NextFunction } from 'express';
import { createLogger } from '../utils/logger';
import { ValidationError } from '../utils/validation';

const logger = createLogger();

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('API Error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // 이미 응답이 시작된 경우
  if (res.headersSent) {
    return next(error);
  }

  // ValidationError
  if (error instanceof ValidationError) {
    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString()
    });
    return;
  }

  // Prisma 에러
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;
    
    switch (prismaError.code) {
      case 'P2002':
        res.status(409).json({
          error: 'DUPLICATE_ENTRY',
          message: '중복된 데이터입니다',
          field: prismaError.meta?.target,
          timestamp: new Date().toISOString()
        });
        return;
        
      case 'P2025':
        res.status(404).json({
          error: 'NOT_FOUND',
          message: '요청한 리소스를 찾을 수 없습니다',
          timestamp: new Date().toISOString()
        });
        return;
        
      case 'P2003':
        res.status(400).json({
          error: 'FOREIGN_KEY_CONSTRAINT',
          message: '참조 무결성 제약 조건 위반',
          timestamp: new Date().toISOString()
        });
        return;
    }
  }

  // JWT 에러
  if (error.name === 'JsonWebTokenError') {
    res.status(401).json({
      error: 'INVALID_TOKEN',
      message: '유효하지 않은 토큰입니다',
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (error.name === 'TokenExpiredError') {
    res.status(401).json({
      error: 'TOKEN_EXPIRED',
      message: '토큰이 만료되었습니다',
      timestamp: new Date().toISOString()
    });
    return;
  }

  // 기본 서버 에러
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: process.env.NODE_ENV === 'production' 
      ? '서버 내부 오류가 발생했습니다' 
      : error.message,
    timestamp: new Date().toISOString()
  });
}
