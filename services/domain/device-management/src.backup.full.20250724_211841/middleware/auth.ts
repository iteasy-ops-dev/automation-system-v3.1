/**
 * Device Management Service - 인증 미들웨어
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger';

const logger = createLogger();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  // 개발 환경에서는 인증 스킵 (테스트 목적)
  if (process.env.NODE_ENV === 'development' || process.env.SKIP_AUTH === 'true') {
    req.user = {
      id: 'dev-user-123',
      email: 'dev@automation-system.com',
      role: 'admin'
    };
    return next();
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    logger.warn('Missing or invalid authorization header:', {
      url: req.url,
      ip: req.ip
    });
    
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: '인증이 필요합니다',
      timestamp: new Date().toISOString()
    });
    return;
  }

  const token = authHeader.substring(7);
  const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

  try {
    const decoded = jwt.verify(token, jwtSecret) as any;
    
    req.user = {
      id: decoded.sub || decoded.userId,
      email: decoded.email,
      role: decoded.role || 'user'
    };

    logger.debug('User authenticated:', {
      userId: req.user.id,
      email: req.user.email,
      role: req.user.role
    });

    next();
  } catch (error) {
    logger.warn('JWT verification failed:', {
      error: error.message,
      url: req.url,
      ip: req.ip
    });

    next(error); // errorHandler에서 처리
  }
}

export function requireRole(roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: '인증이 필요합니다',
        timestamp: new Date().toISOString()
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Insufficient permissions:', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        url: req.url
      });

      res.status(403).json({
        error: 'FORBIDDEN',
        message: '권한이 부족합니다',
        timestamp: new Date().toISOString()
      });
      return;
    }

    next();
  };
}
