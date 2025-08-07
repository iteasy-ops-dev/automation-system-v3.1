/**
 * Storage Service 인증 컨트롤러
 * 사용자 인증 관련 엔드포인트 구현
 * 계약: shared/contracts/v1.0/rest/core/storage-auth.yaml
 */

import { Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaClient, Prisma } from '@prisma/client';
import { Logger } from '../utils/logger';

interface AuthenticateRequest {
  username: string;
  password: string;
}

interface UserInfo {
  id: string;
  username: string;
  role: string;
  email: string;
  fullName: string | null;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AuthController {
  private readonly prisma: PrismaClient;
  private readonly logger: Logger;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.logger = new Logger('AuthController');
  }

  /**
   * 사용자 인증 처리
   * POST /api/v1/storage/auth/authenticate
   */
  async authenticateUser(req: Request, res: Response): Promise<void> {
    try {
      const { username, password }: AuthenticateRequest = req.body;

      // 입력 검증
      if (!username || !password) {
        res.status(400).json({
          error: 'INVALID_REQUEST',
          message: 'Username and password are required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 사용자 조회 (대소문자 구분 없이)
      const user = await this.prisma.user.findFirst({
        where: {
          username: {
            equals: username,
            mode: 'insensitive'
          }
        }
      });

      if (!user) {
        this.logger.warn(`Authentication failed: User not found - ${username}`);
        res.status(401).json({
          error: 'AUTHENTICATION_FAILED',
          message: 'Invalid username or password',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 계정 상태 확인
      if (user.status !== 'active') {
        this.logger.warn(`Authentication failed: User inactive - ${username}`);
        res.status(401).json({
          error: 'USER_INACTIVE',
          message: 'User account is inactive',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 비밀번호 검증
      const isValidPassword = await bcrypt.compare(password, user.passwordHash);
      if (!isValidPassword) {
        this.logger.warn(`Authentication failed: Invalid password - ${username}`);
        res.status(401).json({
          error: 'AUTHENTICATION_FAILED',
          message: 'Invalid username or password',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 마지막 로그인 시간 업데이트
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });

      // 성공 응답 (계약 준수)
      const userInfo: UserInfo = {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        fullName: user.fullName,
        isActive: user.status === 'active',
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt!,
        updatedAt: user.updatedAt!
      };

      this.logger.info(`User authenticated successfully: ${username}`);
      res.status(200).json(userInfo);

    } catch (error) {
      this.logger.error('Authentication error', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An error occurred during authentication',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * 사용자 정보 조회
   * GET /api/v1/storage/auth/users/:userId
   */
  async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      // UUID 형식 검증
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        res.status(400).json({
          error: 'INVALID_USER_ID',
          message: 'Invalid user ID format',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 사용자 조회
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        res.status(404).json({
          error: 'USER_NOT_FOUND',
          message: `User with ID '${userId}' not found`,
          timestamp: new Date().toISOString()
        });
        return;
      }

      // 성공 응답 (계약 준수)
      const userInfo: UserInfo = {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        fullName: user.fullName,
        isActive: user.status === 'active',
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt!,
        updatedAt: user.updatedAt!
      };

      res.status(200).json(userInfo);

    } catch (error) {
      this.logger.error('Get user error', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching user',
        timestamp: new Date().toISOString()
      });
    }
  }
}
