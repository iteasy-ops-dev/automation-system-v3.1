/**
 * JWT 인증 미들웨어
 * 계약 준수: shared/contracts/v1.0/rest/core/gateway-auth.yaml
 * 
 * 주요 기능:
 * - Bearer 토큰 추출 및 검증
 * - 사용자 정보 req.user에 추가
 * - 역할 기반 접근 제어
 * - 에러 응답 표준화
 */

import { Request, Response, NextFunction } from 'express';
import winston from 'winston';

import { JWTAuthService } from '../services/jwt-auth.service';
import { AuthenticationError, AuthorizationError, ErrorResponse } from '../types/gateway.types';

export class JWTMiddleware {
  private jwtAuthService: JWTAuthService;
  private logger: winston.Logger;

  constructor(jwtAuthService: JWTAuthService, logger: winston.Logger) {
    this.jwtAuthService = jwtAuthService;
    this.logger = logger;
  }

  /**
   * JWT 토큰 인증 미들웨어
   * Authorization 헤더에서 Bearer 토큰을 추출하고 검증
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // 1. Authorization 헤더 확인
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        throw new AuthenticationError('Authorization header missing');
      }

      // 2. Bearer 토큰 추출
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw new AuthenticationError('Invalid authorization header format');
      }

      const token = parts[1];
      if (!token) {
        throw new AuthenticationError('Token missing');
      }

      // 3. 토큰 검증 및 사용자 정보 조회
      const user = await this.jwtAuthService.verifyToken(token);

      // 4. 요청 객체에 사용자 정보 추가
      req.user = user;

      // 5. 로깅
      this.logger.debug('Authentication successful', {
        userId: user.id,
        username: user.username,
        role: user.role,
        path: req.path,
        method: req.method
      });

      next();

    } catch (error) {
      this.handleAuthError(error, req, res);
    }
  };
  /**
   * 선택적 인증 미들웨어
   * 토큰이 있으면 검증하고, 없어도 요청을 계속 진행
   */
  optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader) {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0] === 'Bearer' && parts[1]) {
          const user = await this.jwtAuthService.verifyToken(parts[1]);
          req.user = user;
        }
      }

      next();

    } catch (error) {
      // 선택적 인증에서는 에러가 발생해도 계속 진행
      this.logger.warn('Optional authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path
      });
      next();
    }
  };

  /**
   * 역할 기반 인가 미들웨어
   * 특정 역할을 가진 사용자만 접근 허용
   */
  requireRole = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      try {
        if (!req.user) {
          throw new AuthenticationError('Authentication required');
        }

        if (!allowedRoles.includes(req.user.role)) {
          throw new AuthorizationError(
            `Access denied. Required roles: ${allowedRoles.join(', ')}`
          );
        }

        this.logger.debug('Authorization successful', {
          userId: req.user.id,
          userRole: req.user.role,
          allowedRoles,
          path: req.path
        });

        next();

      } catch (error) {
        this.handleAuthError(error, req, res);
      }
    };
  };

  /**
   * 관리자 전용 미들웨어
   */
  requireAdmin = this.requireRole(['administrator']);

  /**
   * 운영자 이상 미들웨어
   */
  requireOperator = this.requireRole(['administrator', 'operator']);