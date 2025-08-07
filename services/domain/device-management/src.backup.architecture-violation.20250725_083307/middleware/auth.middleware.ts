/**
 * 인증 미들웨어
 * JWT 토큰 검증 및 사용자 정보 추출
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Logger } from '../utils/logger';

const logger = new Logger('auth-middleware');

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    roles: string[];
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('🚫 Missing or invalid authorization header', {
        path: req.path,
        method: req.method,
        ip: req.ip
      });
      
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Authorization header is required',
        timestamp: new Date().toISOString()
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      logger.error('❌ JWT_SECRET not configured');
      res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: 'Authentication service not properly configured',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // JWT 토큰 검증
    const decoded = jwt.verify(token, secret) as any;
    
    // 사용자 정보 설정
    req.user = {
      id: decoded.sub || decoded.userId,
      email: decoded.email,
      roles: decoded.roles || ['user']
    };

    logger.debug('✅ User authenticated', {
      userId: req.user.id,
      email: req.user.email,
      path: req.path
    });

    next();

  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      logger.warn('🚫 Invalid JWT token', {
        error: error.message,
        path: req.path,
        method: req.method
      });
      
      res.status(401).json({
        error: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
        timestamp: new Date().toISOString()
      });
      return;
    }

    logger.error('❌ Authentication error:', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Authentication failed',
      timestamp: new Date().toISOString()
    });
  }
}
