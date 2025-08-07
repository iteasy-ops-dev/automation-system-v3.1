import { Router, Request, Response } from 'express';
import * as winston from 'winston';
import { AuthController } from '../controllers/auth.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { RateLimitMiddleware } from '../middleware/rate-limit.middleware';

/**
 * 인증 라우터
 * 계약 100% 준수: shared/contracts/v1.0/rest/core/gateway-auth.yaml
 */
export class AuthRoutes {
  private readonly router: Router;
  private readonly authController: AuthController;
  private readonly authMiddleware: AuthMiddleware;
  private readonly rateLimitMiddleware: RateLimitMiddleware;
  private readonly logger: winston.Logger;

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
    // POST /auth/login - 로그인 (Rate Limit + 검증)
    this.router.post(
      '/login',
      this.rateLimitMiddleware.loginProtection(),
      AuthController.getLoginValidationRules(),
      (req: Request, res: Response) => this.authController.login(req, res)
    );

    // POST /auth/refresh - 토큰 갱신 (Rate Limit + 검증)
    this.router.post(
      '/refresh',
      this.rateLimitMiddleware.basic(),
      AuthController.getRefreshValidationRules(),
      (req: Request, res: Response) => this.authController.refresh(req, res)
    );

    // POST /auth/logout - 로그아웃 (인증 필요)
    this.router.post(
      '/logout',
      this.authMiddleware.authenticate(),
      (req: Request, res: Response) => this.authController.logout(req, res)
    );

    // GET /auth/verify - 토큰 검증 (인증 필요)
    this.router.get(
      '/verify',
      this.authMiddleware.authenticate(),
      (req: Request, res: Response) => this.authController.verify(req, res)
    );

    this.logger.info('인증 라우트가 설정되었습니다.', {
      routes: [
        'POST /auth/login',
        'POST /auth/refresh', 
        'POST /auth/logout',
        'GET /auth/verify'
      ]
    });
  }

  /**
   * Router 인스턴스 반환
   */
  getRouter(): Router {
    return this.router;
  }
}