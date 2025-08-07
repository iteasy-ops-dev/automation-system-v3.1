import { Request, Response, NextFunction } from 'express';
import * as winston from 'winston';
import { JWTAuthService } from '../services/jwt-auth.service';
import {
  AuthenticatedRequest,
  AuthenticationError,
  AuthorizationError,
  ErrorResponse,
  Role,
} from '../types/gateway.types';
import { hasAnyRole, hasPermission } from '../utils/role-mapper';

/**
 * JWT 인증 미들웨어
 * Authorization 헤더에서 Bearer 토큰을 추출하고 검증
 * 
 * 2025-07-31: 레거시 role 지원 추가
 */
export class AuthMiddleware {
  private readonly jwtAuthService: JWTAuthService;
  private readonly logger: winston.Logger;

  constructor(jwtAuthService: JWTAuthService, logger: winston.Logger) {
    this.jwtAuthService = jwtAuthService;
    this.logger = logger;
  }

  /**
   * 필수 인증 미들웨어
   * 유효한 JWT 토큰이 없으면 401 에러 반환
   */
  authenticate() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        // system/health 경로는 인증 제외
        if (req.path === '/system/health') {
          next();
          return;
        }

        const token = this.extractTokenFromHeader(req);
        
        if (!token) {
          this.sendErrorResponse(res, 401, 'MISSING_TOKEN', '인증 토큰이 필요합니다.');
          return;
        }

        const verificationResult = await this.jwtAuthService.verifyToken(token);
        
        if (!verificationResult.valid || !verificationResult.user) {
          this.sendErrorResponse(res, 401, 'INVALID_TOKEN', '유효하지 않은 토큰입니다.');
          return;
        }

        // 요청 객체에 사용자 정보 추가
        req.user = verificationResult.user;
        req.token = {
          payload: verificationResult.user as any, // JWT payload는 나중에 추가할 수 있음
          raw: token
        };

        next();
      } catch (error) {
        this.logger.error('인증 미들웨어 오류', { error });
        this.sendErrorResponse(res, 500, 'AUTHENTICATION_ERROR', '인증 처리 중 오류가 발생했습니다.');
      }
    };
  }

  /**
   * 선택적 인증 미들웨어
   * 토큰이 있으면 검증하지만, 없어도 계속 진행
   */
  optionalAuthenticate() {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
      try {
        const token = this.extractTokenFromHeader(req);
        
        if (!token) {
          // 토큰이 없어도 계속 진행
          next();
          return;
        }

        const verificationResult = await this.jwtAuthService.verifyToken(token);
        
        if (verificationResult.valid && verificationResult.user) {
          req.user = verificationResult.user;
          req.token = {
            payload: verificationResult.user as any,
            raw: token
          };
        }

        next();
      } catch (error) {
        this.logger.error('선택적 인증 미들웨어 오류', { error });
        // 에러가 있어도 계속 진행 (토큰이 유효하지 않을 뿐)
        next();
      }
    };
  }

  /**
   * 역할 기반 인가 미들웨어 (레거시 role 지원)
   * @param allowedRoles 허용된 role 배열 (계약 값 또는 레거시 값)
   */
  requireRole(allowedRoles: Role[]) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        this.sendErrorResponse(res, 401, 'AUTHENTICATION_REQUIRED', '인증이 필요합니다.');
        return;
      }

      // hasAnyRole 유틸리티로 레거시/계약 role 모두 지원
      if (!hasAnyRole(req.user.role, allowedRoles)) {
        this.logger.warn('권한 부족', { 
          userRole: req.user.role, 
          requiredRoles: allowedRoles,
          userId: req.user.id,
          username: req.user.username
        });
        this.sendErrorResponse(res, 403, 'INSUFFICIENT_PERMISSIONS', '권한이 부족합니다.');
        return;
      }

      next();
    };
  }

  /**
   * 최소 권한 레벨 요구 미들웨어
   * @param minRole 최소 요구 role (상위 role도 허용)
   */
  requireMinRole(minRole: Role) {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        this.sendErrorResponse(res, 401, 'AUTHENTICATION_REQUIRED', '인증이 필요합니다.');
        return;
      }

      // hasPermission 유틸리티로 권한 계층 확인
      if (!hasPermission(req.user.role, minRole)) {
        this.logger.warn('권한 레벨 부족', { 
          userRole: req.user.role, 
          requiredMinRole: minRole,
          userId: req.user.id,
          username: req.user.username
        });
        this.sendErrorResponse(res, 403, 'INSUFFICIENT_PERMISSIONS', '권한이 부족합니다.');
        return;
      }

      next();
    };
  }

  /**
   * Authorization 헤더에서 Bearer 토큰 추출
   */
  private extractTokenFromHeader(req: Request): string | null {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * 에러 응답 전송 (계약 준수)
   */
  private sendErrorResponse(
    res: Response,
    statusCode: number,
    errorCode: string,
    message: string,
    details?: Record<string, unknown>
  ): void {
    const errorResponse: ErrorResponse = {
      error: errorCode,
      message,
      timestamp: new Date().toISOString(),
      details,
    };

    res.status(statusCode).json(errorResponse);
  }
}