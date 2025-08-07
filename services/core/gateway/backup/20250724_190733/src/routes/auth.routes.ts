/**
 * 인증 라우터
 * 계약 준수: shared/contracts/v1.0/rest/core/gateway-auth.yaml
 * 
 * 라우트:
 * - POST /auth/login
 * - POST /auth/refresh  
 * - POST /auth/logout (인증 필요)
 * - GET /auth/verify (인증 필요)
 */

import { Router } from 'express';
import winston from 'winston';

import { AuthController } from '../controllers/auth.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { RateLimitMiddleware } from '../middleware/rate-limit.middleware';

export class AuthRoutes {
  private router: Router;
  private authController: AuthController;
  private authMiddleware: AuthMiddleware;
  private rateLimitMiddleware: RateLimitMiddleware;
  private logger: winston.Logger;

  constructor(
    authController: AuthController,
    authMiddleware: AuthMiddleware,
    rateLimitMiddleware: RateLimitMiddleware,
    logger: winston.Logger
  ) {
    this.router = Router();
    this.authController = authController;
    this.authMiddleware = authMiddleware;
    this.rateLimitMiddleware = rateLimitMiddleware;
    this.logger = logger;

    this.setupRoutes();
  }

  /**
   * 라우트 설정
   */
  private setupRoutes(): void {
    // POST /auth/login - 사용자 로그인
    // Rate Limiting: 브루트 포스 공격 방지
    this.router.post(
      '/login',
      this.rateLimitMiddleware.loginProtection(),
      this.authController.login
    );

    // POST /auth/refresh - 토큰 갱신
    // Rate Limiting: 기본 제한
    this.router.post(
      '/refresh',
      this.rateLimitMiddleware.basic({ maxRequests: 10, windowMs: 60000 }), // 1분에 10번
      this.authController.refresh
    );

    // POST /auth/logout - 로그아웃 (인증 필요)
    this.router.post(
      '/logout',
      this.authMiddleware.authenticate(),
      this.authController.logout
    );

    // GET /auth/verify - 토큰 검증 (인증 필요)
    this.router.get(
      '/verify',
      this.authMiddleware.authenticate(),
      this.authController.verify
    );

    this.logger.info('Auth routes configured', {
      routes: [
        'POST /auth/login',
        'POST /auth/refresh',
        'POST /auth/logout',
        'GET /auth/verify'
      ]
    });
  }

  /**
   * 라우터 인스턴스 반환
   */
  getRouter(): Router {
    return this.router;
  }
}