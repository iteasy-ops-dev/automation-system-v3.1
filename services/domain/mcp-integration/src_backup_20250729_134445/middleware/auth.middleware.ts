/**
 * 인증 미들웨어 - Gateway 신뢰 모드
 * TASK-17-B: Gateway에서 전달한 X-User-Info 헤더 기반 인증
 * 
 * v3.1 아키텍처 원칙:
 * - Gateway에서 이미 JWT 검증 완료
 * - 내부 서비스는 Gateway를 신뢰
 * - X-User-Info 헤더에서 사용자 정보 추출
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { Logger } from '../utils/logger';

const logger = new Logger('auth-middleware');

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string;
    roles?: string[];
  };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    // Gateway 신뢰 모드: X-User-Info 헤더 확인
    const userInfoHeader = req.headers['x-user-info'] as string;
    
    if (userInfoHeader) {
      // Gateway에서 전달한 사용자 정보 파싱
      try {
        const userInfo = JSON.parse(userInfoHeader);
        
        req.user = {
          id: userInfo.id,
          username: userInfo.username,
          email: userInfo.email,
          role: userInfo.role,
          roles: [userInfo.role] // 하위 호환성
        };

        logger.debug('✅ User authenticated via Gateway', {
          userId: req.user.id,
          username: req.user.username,
          role: req.user.role,
          path: req.path,
          method: req.method
        });

        next();
        return;
        
      } catch (parseError) {
        logger.error('❌ Failed to parse X-User-Info header', {
          error: parseError,
          header: userInfoHeader
        });
        
        res.status(400).json({
          error: 'INVALID_USER_INFO',
          message: 'Invalid user information from gateway',
          timestamp: new Date().toISOString()
        });
        return;
      }
    }

    // Fallback: 개발 환경에서만 직접 JWT 검증 허용
    if (process.env.NODE_ENV === 'development') {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // 개발 토큰 허용
        if (token === 'dev-token') {
          req.user = {
            id: 'dev-user-id',
            username: 'developer',
            email: 'dev@automation-system.com',
            role: 'admin',
            roles: ['admin']
          };
          
          logger.info('✅ Development token accepted', {
            path: req.path,
            method: req.method
          });
          
          next();
          return;
        }
        
        // JWT 검증 시도 (개발 환경)
        const secret = process.env.JWT_SECRET;
        if (secret) {
          try {
            const decoded = jwt.verify(token, secret) as any;
            
            req.user = {
              id: decoded.sub || decoded.userId,
              username: decoded.username,
              email: decoded.email,
              role: decoded.role || 'user',
              roles: decoded.roles || [decoded.role || 'user']
            };

            logger.debug('✅ JWT verified in development mode', {
              userId: req.user.id,
              username: req.user.username,
              path: req.path
            });

            next();
            return;
            
          } catch (jwtError) {
            logger.warn('🚫 Invalid JWT token in development mode', {
              error: jwtError instanceof Error ? jwtError.message : 'Unknown error',
              path: req.path
            });
          }
        }
      }
    }

    // 인증 실패
    logger.warn('🚫 Authentication failed - No valid user info', {
      path: req.path,
      method: req.method,
      ip: req.ip,
      hasUserInfo: !!userInfoHeader,
      hasAuth: !!req.headers.authorization,
      environment: process.env.NODE_ENV
    });
    
    res.status(401).json({
      error: 'UNAUTHORIZED',
      message: process.env.NODE_ENV === 'development' 
        ? 'Access through Gateway required, or use development token'
        : 'Access through Gateway required',
      timestamp: new Date().toISOString(),
      details: {
        expectedHeader: 'X-User-Info',
        source: 'Gateway authentication required'
      }
    });

  } catch (error) {
    logger.error('❌ Authentication middleware error:', error);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: 'Authentication failed',
      timestamp: new Date().toISOString()
    });
  }
}
