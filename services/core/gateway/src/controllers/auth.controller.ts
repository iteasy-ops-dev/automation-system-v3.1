import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import * as winston from 'winston';
import { JWTAuthService } from '../services/jwt-auth.service';
import {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  AuthenticatedRequest,
  ErrorResponse,
  AuthenticationError,
  ValidationError,
} from '../types/gateway.types';

/**
 * 인증 컨트롤러
 * 계약 100% 준수: shared/contracts/v1.0/rest/core/gateway-auth.yaml
 */
export class AuthController {
  private readonly jwtAuthService: JWTAuthService;
  private readonly logger: winston.Logger;

  constructor(jwtAuthService: JWTAuthService, logger: winston.Logger) {
    this.jwtAuthService = jwtAuthService;
    this.logger = logger;
  }

  /**
   * 로그인 (POST /auth/login)
   * 계약 준수: LoginRequest -> LoginResponse
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      // 입력 검증
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        this.sendErrorResponse(res, 400, 'VALIDATION_ERROR', '입력 데이터가 유효하지 않습니다.', {
          validationErrors: errors.array()
        });
        return;
      }

      const loginRequest: LoginRequest = req.body;
      const clientIp = this.getClientIP(req);
      const userAgent = req.headers['user-agent'];

      // JWT 인증 서비스를 통한 로그인
      const loginResponse = await this.jwtAuthService.login(loginRequest, clientIp);

      this.logger.info('로그인 성공', { 
        username: loginRequest.username, 
        userId: loginResponse.user.id,
        clientIp 
      });

      res.status(200).json(loginResponse);
    } catch (error) {
      this.handleControllerError(res, error, '로그인');
    }
  }
  /**
   * 토큰 갱신 (POST /auth/refresh)
   * 계약 준수: RefreshTokenRequest -> LoginResponse
   */
  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        this.sendErrorResponse(res, 400, 'VALIDATION_ERROR', '입력 데이터가 유효하지 않습니다.', {
          validationErrors: errors.array()
        });
        return;
      }

      const { refreshToken }: RefreshTokenRequest = req.body;

      const response = await this.jwtAuthService.refreshAccessToken(refreshToken);

      this.logger.info('토큰 갱신 성공');

      res.status(200).json(response);
    } catch (error) {
      this.handleControllerError(res, error, '토큰 갱신');
    }
  }

  /**
   * 로그아웃 (POST /auth/logout)
   * 계약 준수: 인증 필요, 성공 메시지 응답
   */
  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user || !req.token) {
        this.sendErrorResponse(res, 401, 'AUTHENTICATION_REQUIRED', '인증이 필요합니다.');
        return;
      }

      // JWT 페이로드에서 jti 추출 (실제로는 토큰 파싱 필요)
      const tokenId = req.token.payload.jti || 'unknown';
      
      await this.jwtAuthService.logout(req.user.id, tokenId);

      this.logger.info('로그아웃 성공', { userId: req.user.id });

      res.status(200).json({
        message: 'Successfully logged out'
      });
    } catch (error) {
      this.handleControllerError(res, error, '로그아웃');
    }
  }
  /**
   * 토큰 검증 (GET /auth/verify)
   * 계약 준수: 토큰 유효성과 사용자 정보 응답
   */
  async verify(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        this.sendErrorResponse(res, 401, 'INVALID_TOKEN', '유효하지 않은 토큰입니다.');
        return;
      }

      res.status(200).json({
        valid: true,
        user: req.user
      });
    } catch (error) {
      this.handleControllerError(res, error, '토큰 검증');
    }
  }

  /**
   * 클라이언트 IP 추출
   */
  private getClientIP(req: Request): string {
    return (
      req.ip ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
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
  /**
   * 컨트롤러 에러 처리
   */
  private handleControllerError(res: Response, error: unknown, operation: string): void {
    this.logger.error(`${operation} 오류`, { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });

    if (error instanceof AuthenticationError) {
      this.sendErrorResponse(res, error.statusCode, error.errorCode, error.message, error.details);
      return;
    }

    if (error instanceof ValidationError) {
      this.sendErrorResponse(res, error.statusCode, error.errorCode, error.message, error.details);
      return;
    }

    this.sendErrorResponse(res, 500, 'INTERNAL_SERVER_ERROR', '서버 내부 오류가 발생했습니다.');
  }

  /**
   * 로그인 입력 검증 규칙 (계약 100% 준수)
   */
  static getLoginValidationRules() {
    return [
      body('username')
        .isLength({ min: 3, max: 50 })
        .matches(/^[a-zA-Z0-9_-]+$/)
        .withMessage('사용자명은 3-50자의 영숫자, _, - 만 허용됩니다.'),
      body('password')
        .isLength({ min: 8, max: 128 })
        .withMessage('비밀번호는 8-128자여야 합니다.'),
      body('rememberMe')
        .optional()
        .isBoolean()
        .withMessage('rememberMe는 boolean 값이어야 합니다.')
    ];
  }

  /**
   * 토큰 갱신 입력 검증 규칙
   */
  static getRefreshValidationRules() {
    return [
      body('refreshToken')
        .notEmpty()
        .withMessage('리프레시 토큰이 필요합니다.')
    ];
  }
}