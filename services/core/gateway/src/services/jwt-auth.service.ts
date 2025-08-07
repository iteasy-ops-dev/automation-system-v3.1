import Redis from 'ioredis';
import * as winston from 'winston';
import * as jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { config } from '../config/gateway.config';
import {
  UserInfo,
  LoginRequest,
  LoginResponse,
  TokenVerificationResult,
  JWTPayload,
  AuthenticationError,
  TokenExpiredError,
  TokenInvalidError,
} from '../types/gateway.types';

/**
 * JWT 기반 인증 서비스
 * v3.1 아키텍처: Gateway가 모든 인증을 자체 처리
 */
export class JWTAuthService {
  private readonly redis: Redis;
  private readonly logger: winston.Logger;
  private readonly jwtSecret: string;
  private readonly accessTokenExpiry: number = 3600; // 1시간
  private readonly refreshTokenExpiry: number = 604800; // 7일

  constructor(redis: Redis, logger: winston.Logger) {
    this.redis = redis;
    this.logger = logger;
    this.jwtSecret = config.jwt.accessSecret; // accessSecret 사용
  }

  /**
   * 사용자 로그인 처리 (계약: POST /api/v1/auth/login)
   */
  async login(request: LoginRequest, ipAddress: string): Promise<LoginResponse> {
    const { username, password } = request;
    
    this.logger.info('로그인 시도', { username, ipAddress });
    
    try {
      // 1. 사용자 인증 (자체 처리)
      const user = await this.authenticateUser(username, password);
      
      // 2. 세션 정보 Redis 저장
      const sessionKey = `session:user:${user.id}`;
      const sessionData = {
        userId: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        loginAt: new Date().toISOString(),
        ipAddress,
      };
      
      await this.redis.setex(
        sessionKey, 
        this.refreshTokenExpiry,
        JSON.stringify(sessionData)
      );
      
      // 3. JWT 토큰 쌍 생성
      const tokens = await this.generateTokenPair(user);
      
      // 4. Refresh 토큰 Redis 저장
      const refreshKey = `refresh:${tokens.refreshTokenId}`;
      await this.redis.setex(
        refreshKey,
        this.refreshTokenExpiry,
        JSON.stringify({
          userId: user.id,
          username: user.username,
          createdAt: new Date().toISOString(),
        })
      );
      
      this.logger.info('로그인 성공', { username, userId: user.id });
      
      // 5. 응답 반환 (계약 준수)
      return {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: this.accessTokenExpiry,
        tokenType: 'Bearer',
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email,
        },
      };
      
    } catch (error) {
      this.logger.error('로그인 실패', { 
        username, 
        error: error instanceof Error ? error.message : String(error),
        ipAddress 
      });
      
      if (error instanceof AuthenticationError) {
        throw error;
      }
      
      throw new AuthenticationError('로그인 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * 사용자 인증 (Storage Service 호출)
   */
  private async authenticateUser(username: string, password: string): Promise<UserInfo> {
    try {
      // Storage Service의 인증 API 호출
      const response = await axios.post(
        `${config.storage.serviceUrl}/api/v1/storage/auth/authenticate`,
        { username, password },
        { 
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200 && response.data) {
        // Storage Service의 응답을 UserInfo 형식으로 변환
        const userData = response.data;
        return {
          id: userData.id,
          username: userData.username,
          role: userData.role,
          email: userData.email,
          isActive: userData.isActive,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt
        };
      }

      throw new AuthenticationError('인증 서버 응답 오류');
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          const errorData = error.response.data;
          if (errorData?.error === 'USER_INACTIVE') {
            throw new AuthenticationError('비활성화된 계정입니다.');
          }
          throw new AuthenticationError('잘못된 사용자명 또는 비밀번호입니다.');
        }
        if (error.response?.status === 400) {
          throw new AuthenticationError('잘못된 요청입니다.');
        }
      }
      
      this.logger.error('Storage Service 인증 오류', { 
        username, 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      throw new AuthenticationError('인증 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * JWT 토큰 쌍 생성 (Access + Refresh)
   */
  private async generateTokenPair(user: UserInfo): Promise<{
    accessToken: string;
    refreshToken: string;
    refreshTokenId: string;
  }> {
    const now = Math.floor(Date.now() / 1000);
    const accessTokenId = uuidv4();
    const refreshTokenId = uuidv4();

    // Access Token 페이로드
    const accessPayload: JWTPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      iat: now,
      exp: now + this.accessTokenExpiry,
      jti: accessTokenId,
      type: 'access',
    };

    // Refresh Token 페이로드
    const refreshPayload: JWTPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      email: user.email,
      iat: now,
      exp: now + this.refreshTokenExpiry,
      jti: refreshTokenId,
      type: 'refresh',
    };

    // 토큰 서명
    const accessToken = jwt.sign(accessPayload, this.jwtSecret);
    const refreshToken = jwt.sign(refreshPayload, this.jwtSecret);

    return { accessToken, refreshToken, refreshTokenId };
  }

  /**
   * Access Token 갱신 (계약: POST /api/v1/auth/refresh)
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    try {
      // 1. Refresh Token 검증
      const decoded = jwt.verify(refreshToken, this.jwtSecret) as JWTPayload;
      
      if (decoded.type !== 'refresh') {
        throw new TokenInvalidError('유효하지 않은 Refresh Token입니다.');
      }

      // 2. Redis에서 Refresh Token 확인
      const refreshKey = `refresh:${decoded.jti}`;
      const refreshData = await this.redis.get(refreshKey);
      
      if (!refreshData) {
        throw new TokenExpiredError('만료된 Refresh Token입니다.');
      }

      // 3. 사용자 정보 조회
      const user = await this.getUserById(decoded.sub);
      if (!user) {
        throw new AuthenticationError('사용자를 찾을 수 없습니다.');
      }

      // 4. 새로운 Access Token 생성
      const now = Math.floor(Date.now() / 1000);
      const accessTokenId = uuidv4();
      
      const accessPayload: JWTPayload = {
        sub: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        iat: now,
        exp: now + this.accessTokenExpiry,
        jti: accessTokenId,
        type: 'access',
      };

      const accessToken = jwt.sign(accessPayload, this.jwtSecret);
      
      this.logger.info('Access Token 갱신 성공', { userId: user.id });

      return {
        accessToken,
        expiresIn: this.accessTokenExpiry,
      };
      
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError('만료된 Refresh Token입니다.');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new TokenInvalidError('유효하지 않은 Refresh Token입니다.');
      }
      
      this.logger.error('Token 갱신 실패', { error });
      throw error;
    }
  }

  /**
   * 토큰 검증
   */
  async verifyToken(token: string): Promise<TokenVerificationResult> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret) as JWTPayload;
      
      // Access Token만 허용
      if (decoded.type !== 'access') {
        return { valid: false, reason: 'Invalid token type' };
      }

      // 사용자 정보 조회
      const user = await this.getUserById(decoded.sub);
      if (!user || !user.isActive) {
        return { valid: false, reason: 'User not found or inactive' };
      }

      return {
        valid: true,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email,
          isActive: user.isActive,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      };
      
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return { valid: false, reason: 'Token expired' };
      }
      if (error instanceof jwt.JsonWebTokenError) {
        return { valid: false, reason: 'Invalid token' };
      }
      
      this.logger.error('토큰 검증 오류', { error });
      return { valid: false, reason: 'Verification failed' };
    }
  }

  /**
   * 로그아웃 처리
   */
  async logout(userId: string, refreshTokenId?: string): Promise<void> {
    try {
      // 세션 삭제
      const sessionKey = `session:user:${userId}`;
      await this.redis.del(sessionKey);
      
      // Refresh Token 삭제
      if (refreshTokenId) {
        const refreshKey = `refresh:${refreshTokenId}`;
        await this.redis.del(refreshKey);
      }
      
      this.logger.info('로그아웃 완료', { userId });
    } catch (error) {
      this.logger.error('로그아웃 처리 오류', { userId, error });
      throw new Error('로그아웃 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * 사용자 정보 조회 (Storage Service 호출)
   */
  async getUserById(userId: string): Promise<UserInfo | null> {
    try {
      const response = await axios.get(
        `${config.storage.serviceUrl}/api/v1/storage/auth/users/${userId}`,
        { 
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200 && response.data) {
        const userData = response.data;
        return {
          id: userData.id,
          username: userData.username,
          role: userData.role,
          email: userData.email,
          isActive: userData.isActive,
          createdAt: userData.createdAt,
          updatedAt: userData.updatedAt
        };
      }
      
      return null;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      
      this.logger.error('사용자 조회 오류', { userId, error });
      return null;
    }
  }
}
