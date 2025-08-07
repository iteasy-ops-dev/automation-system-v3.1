/**
 * JWT 인증 미들웨어
 * 계약 준수: shared/contracts/v1.0/rest/core/gateway-auth.yaml
 * 
 * 주요 기능:
 * - Bearer 토큰 추출 및 검증
 * - 사용자 권한 확인
 * - 요청 컨텍스트에 사용자 정보 주입
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

import { JWTAuthService } from '../services/jwt-auth.service';
import {
  AuthenticationError,
  AuthorizationError,
  UserInfo,
  AsyncMiddleware
} from '../types/gateway.types';

export class AuthMiddleware {
  private jwtAuthService: JWTAuthService;
  private logger: winston.Logger;

  constructor(jwtAuthService: JWTAuthService, logger: winston.Logger) {
    this.jwtAuthService = jwtAuthService;
    this.logger = logger;
  }

  /**
   * JWT 토큰 인증 미들웨어
   * Authorization: Bearer <token> 헤더에서 토큰 추출 및 검증
   */
  authenticate(): AsyncMiddleware {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        // 1. Authorization 헤더에서 토큰 추출
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          throw new AuthenticationError('Authorization header missing or invalid');
        }

        const token = authHeader.substring(7); // "Bearer " 제거
        if (!token) {
          throw new AuthenticationError('Access token missing');
        }

        // 2. 토큰 검증 및 사용자 정보 조회
        const user = await this.jwtAuthService.verifyToken(token);

        // 3. 요청 객체에 사용자 정보 주입
        req.user = user;

        // 4. 로그 기록
        this.logger.debug('Authentication successful', {
          userId: user.id,
          username: user.username,
          role: user.role,
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        next();

      } catch (error) {
        this.logger.warn('Authentication failed', {
          path: req.path,
          method: req.method,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        if (error instanceof AuthenticationError) {
          res.status(401).json({
            error: 'AUTHENTICATION_FAILED',
            message: error.message,
            timestamp: new Date().toISOString()
          });
        } else {
          res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Authentication service error',
            timestamp: new Date().toISOString()
          });
        }
      }
    };
  }
  /**
   * 역할 기반 인가 미들웨어
   * 특정 역할만 접근 가능한 엔드포인트에 사용
   */
  requireRole(allowedRoles: string[]): AsyncMiddleware {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        if (!req.user) {
          throw new AuthenticationError('Authentication required');
        }

        if (!allowedRoles.includes(req.user.role)) {
          throw new AuthorizationError(
            `Access denied. Required roles: ${allowedRoles.join(', ')}`,
            { userRole: req.user.role, requiredRoles: allowedRoles }
          );
        }

        this.logger.debug('Authorization successful', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: allowedRoles,
          path: req.path,
          method: req.method
        });

        next();

      } catch (error) {
        this.logger.warn('Authorization failed', {
          userId: req.user?.id,
          userRole: req.user?.role,
          requiredRoles: allowedRoles,
          path: req.path,
          method: req.method,
          error: error instanceof Error ? error.message : 'Unknown error'
        });

        if (error instanceof AuthenticationError) {
          res.status(401).json({
            error: 'AUTHENTICATION_REQUIRED',
            message: error.message,
            timestamp: new Date().toISOString()
          });
        } else if (error instanceof AuthorizationError) {
          res.status(403).json({
            error: 'ACCESS_DENIED',
            message: error.message,
            timestamp: new Date().toISOString(),
            details: error.details
          });
        } else {
          res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Authorization service error',
            timestamp: new Date().toISOString()
          });
        }
      }
    };
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * 사용자 권한 조회
   */
  private async getUserPermissions(userId: string): Promise<string[]> {
    // TODO: Redis 세션에서 권한 정보 조회 또는 Storage Service 호출
    // 현재는 역할 기반 기본 권한 반환
    return [];
  }
}