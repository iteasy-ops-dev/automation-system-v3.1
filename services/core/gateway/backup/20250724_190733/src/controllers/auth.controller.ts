/**
 * 인증 컨트롤러
 * 계약 준수: shared/contracts/v1.0/rest/core/gateway-auth.yaml
 * 
 * 엔드포인트:
 * - POST /auth/login
 * - POST /auth/refresh
 * - POST /auth/logout
 * - GET /auth/verify
 */

import { Request, Response } from 'express';
import Joi from 'joi';
import winston from 'winston';

import { JWTAuthService } from '../services/jwt-auth.service';
import {
  LoginRequest,
  RefreshRequest,
  AuthenticatedRequest,
  ValidationError,
  AsyncRequestHandler
} from '../types/gateway.types';

export class AuthController {
  private jwtAuthService: JWTAuthService;
  private logger: winston.Logger;

  constructor(jwtAuthService: JWTAuthService, logger: winston.Logger) {
    this.jwtAuthService = jwtAuthService;
    this.logger = logger;
  }

  /**
   * 사용자 로그인
   * POST /auth/login
   */
  login: AsyncRequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      // 1. 입력 검증 (계약 준수)
      const validationSchema = Joi.object({
        username: Joi.string()
          .min(3)
          .max(50)
          .pattern(/^[a-zA-Z0-9_-]+$/)
          .required()
          .messages({
            'string.pattern.base': 'Username can only contain letters, numbers, underscores, and hyphens'
          }),
        password: Joi.string()
          .min(8)
          .max(128)
          .required(),
        rememberMe: Joi.boolean()
          .default(false)
      });

      const { error, value } = validationSchema.validate(req.body);
      if (error) {
        throw new ValidationError(
          'Invalid input data',
          { validationErrors: error.details.map(d => d.message) }
        );
      }

      const { username, password, rememberMe } = value as LoginRequest;

      // 2. 클라이언트 정보 추출
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      // 3. 로그인 처리
      const loginResponse = await this.jwtAuthService.login(
        username,
        password,  
        ipAddress,
        userAgent,
        rememberMe
      );

      // 4. 응답 (계약 준수)
      res.status(200).json(loginResponse);

      this.logger.info('Login endpoint successful', {
        username,
        userId: loginResponse.user.id,
        ipAddress,
        userAgent
      });

    } catch (error) {
      this.handleError(error, req, res, 'login');
    }
  };
  /**
   * 토큰 갱신
   * POST /auth/refresh
   */
  refresh: AsyncRequestHandler = async (req: Request, res: Response): Promise<void> => {
    try {
      // 1. 입력 검증 (계약 준수)
      const validationSchema = Joi.object({
        refreshToken: Joi.string()
          .required()
          .messages({
            'any.required': 'Refresh token is required'
          })
      });

      const { error, value } = validationSchema.validate(req.body);
      if (error) {
        throw new ValidationError(
          'Invalid refresh token format',
          { validationErrors: error.details.map(d => d.message) }
        );
      }

      const { refreshToken } = value as RefreshRequest;

      // 2. 토큰 갱신 처리
      const tokenResponse = await this.jwtAuthService.refreshToken(refreshToken);

      // 3. 응답 (계약 준수)
      res.status(200).json(tokenResponse);

      this.logger.info('Token refresh endpoint successful', {
        ipAddress: req.ip
      });

    } catch (error) {
      this.handleError(error, req, res, 'refresh');
    }
  };

  /**
   * 로그아웃
   * POST /auth/logout
   * 인증 필요
   */
  logout: AsyncRequestHandler = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // 1. Authorization 헤더에서 토큰 추출
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new ValidationError('Authorization header required for logout');
      }

      const accessToken = authHeader.substring(7);

      // 2. 로그아웃 처리
      await this.jwtAuthService.logout(accessToken, req.user.id);

      // 3. 응답 (계약 준수)
      res.status(200).json({
        message: 'Successfully logged out'
      });

      this.logger.info('Logout endpoint successful', {
        userId: req.user.id,
        username: req.user.username,
        ipAddress: req.ip
      });

    } catch (error) {
      this.handleError(error, req, res, 'logout');
    }
  };

  /**
   * 토큰 검증
   * GET /auth/verify
   * 인증 필요
   */
  verify: AsyncRequestHandler = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // 인증 미들웨어에서 이미 토큰 검증이 완료됨
      // 사용자 정보만 반환 (계약 준수)
      res.status(200).json(req.user);

      this.logger.debug('Token verify endpoint successful', {
        userId: req.user.id,
        username: req.user.username,
        role: req.user.role
      });

    } catch (error) {
      this.handleError(error, req, res, 'verify');
    }
  };

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * 통합 에러 처리
   */
  private handleError(error: any, req: Request, res: Response, endpoint: string): void {
    this.logger.error(`Auth ${endpoint} endpoint failed`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    // 계약에 정의된 ErrorResponse 형식 준수
    if (error.statusCode && error.errorCode) {
      // 커스텀 에러 (ValidationError, AuthenticationError 등)
      res.status(error.statusCode).json({
        error: error.errorCode,
        message: error.message,
        timestamp: new Date().toISOString(),
        details: error.details
      });
    } else {
      // 예상치 못한 에러
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString()
      });
    }
  }
}