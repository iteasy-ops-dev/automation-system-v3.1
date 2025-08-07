/**
 * Storage Service 인증 라우트
 * 계약: shared/contracts/v1.0/rest/core/storage-auth.yaml
 */

import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { PrismaClient } from '@prisma/client';

export function createAuthRoutes(prisma: PrismaClient): Router {
  const router = Router();
  const authController = new AuthController(prisma);

  /**
   * POST /api/v1/storage/auth/authenticate
   * 사용자 인증
   */
  router.post('/authenticate', (req, res) => 
    authController.authenticateUser(req, res)
  );

  /**
   * GET /api/v1/storage/auth/users/:userId
   * 사용자 정보 조회
   */
  router.get('/users/:userId', (req, res) => 
    authController.getUserById(req, res)
  );

  return router;
}
