/**
 * JWT 인증 서비스
 * 계약 준수: shared/contracts/v1.0/rest/core/gateway-auth.yaml
 * 
 * 주요 기능:
 * - JWT 토큰 발급 및 검증
 * - 리프레시 토큰 관리
 * - 토큰 블랙리스트 관리
 * - 세션 관리
 */

import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import winston from 'winston';

import { gatewayConfig } from '../config/gateway.config';
import {
  JWTPayload,
  RefreshTokenPayload,
  UserInfo,
  LoginResponse,
  TokenResponse,
  UserSession,
  AuthenticationError,
  AuthorizationError
} from '../types/gateway.types';

export class JWTAuthService {
  private redis: Redis;
  private logger: winston.Logger;

  constructor(redis: Redis, logger: winston.Logger) {
    this.redis = redis;
    this.logger = logger;
  }

  /**
   * 사용자 로그인 및 토큰 발급
   * 계약: POST /auth/login
   */
  async login(
    username: string,
    password: string,
    ipAddress: string,
    userAgent: string,
    rememberMe: boolean = false
  ): Promise<LoginResponse> {
    try {
      // 1. 사용자 인증 (Storage Service 연동 필요)
      const user = await this.authenticateUser(username, password);
      
      if (!user) {
        throw new AuthenticationError('Invalid username or password');
      }

      // 2. JWT 토큰 생성
      const { accessToken, refreshToken } = await this.generateTokens(user);

      // 3. 세션 정보 생성 및 저장
      const sessionId = uuidv4();
      const session: UserSession = {
        sessionId,
        userId: user.id,
        username: user.username,
        role: user.role,
        ipAddress,
        userAgent,
        loginAt: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        permissions: this.getUserPermissions(user.role)
      };

      await this.saveUserSession(user.id, session);

      // 4. 리프레시 토큰 저장
      await this.saveRefreshToken(refreshToken, user.id, rememberMe);

      // 5. 로그인 이력 업데이트 (Storage Service 연동)
      await this.updateLastLogin(user.id);

      this.logger.info('User login successful', {
        userId: user.id,
        username: user.username,
        ipAddress,
        userAgent
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: this.getTokenExpirySeconds(gatewayConfig.jwt.accessTokenExpiry),
        tokenType: 'Bearer',
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          email: user.email,
          createdAt: user.createdAt,
          lastLoginAt: new Date().toISOString()
        }
      };

    } catch (error) {
      this.logger.error('Login failed', {
        username,
        ipAddress,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
  /**
   * 토큰 갱신
   * 계약: POST /auth/refresh
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      // 1. 리프레시 토큰 검증
      const payload = this.verifyRefreshToken(refreshToken);
      
      // 2. 토큰 유효성 확인 (Redis 확인)
      const storedUserId = await this.redis.get(
        `${gatewayConfig.redis.keyPrefix}refresh_token:${payload.tokenId}`
      );

      if (!storedUserId || storedUserId !== payload.sub) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // 3. 사용자 정보 조회
      const user = await this.getUserById(payload.sub);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // 4. 새로운 액세스 토큰 생성
      const newAccessToken = this.generateAccessToken(user);

      this.logger.info('Token refresh successful', {
        userId: user.id,
        username: user.username
      });

      return {
        accessToken: newAccessToken,
        expiresIn: this.getTokenExpirySeconds(gatewayConfig.jwt.accessTokenExpiry),
        tokenType: 'Bearer'
      };

    } catch (error) {
      this.logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new AuthenticationError('Token refresh failed');
    }
  }

  /**
   * 로그아웃
   * 계약: POST /auth/logout
   */
  async logout(accessToken: string, userId: string): Promise<void> {
    try {
      // 1. 액세스 토큰을 블랙리스트에 추가
      const payload = this.verifyAccessToken(accessToken);
      const tokenExpiry = payload.exp - Math.floor(Date.now() / 1000);
      
      if (tokenExpiry > 0) {
        await this.redis.setex(
          `${gatewayConfig.redis.keyPrefix}blacklist:jwt:${payload.jti}`,
          tokenExpiry,
          'revoked'
        );
      }

      // 2. 사용자 세션 삭제
      await this.redis.del(`${gatewayConfig.redis.keyPrefix}session:user:${userId}`);

      // 3. 모든 리프레시 토큰 무효화
      const refreshTokenKeys = await this.redis.keys(
        `${gatewayConfig.redis.keyPrefix}refresh_token:*`
      );
      
      for (const key of refreshTokenKeys) {
        const storedUserId = await this.redis.get(key);
        if (storedUserId === userId) {
          await this.redis.del(key);
        }
      }

      this.logger.info('User logout successful', { userId });

    } catch (error) {
      this.logger.error('Logout failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 토큰 검증
   * 계약: GET /auth/verify
   */
  async verifyToken(accessToken: string): Promise<UserInfo> {
    try {
      // 1. JWT 토큰 검증
      const payload = this.verifyAccessToken(accessToken);

      // 2. 블랙리스트 확인
      const isBlacklisted = await this.redis.exists(
        `${gatewayConfig.redis.keyPrefix}blacklist:jwt:${payload.jti}`
      );

      if (isBlacklisted) {
        throw new AuthenticationError('Token has been revoked');
      }

      // 3. 사용자 정보 조회
      const user = await this.getUserById(payload.sub);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // 4. 세션 활성화 업데이트
      await this.updateLastActivity(user.id);

      return user;

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token expired');
      }
      throw error;
    }
  }
  // ========================================
  // 토큰 생성 관련 메서드
  // ========================================

  /**
   * JWT 토큰 쌍 생성 (액세스 + 리프레시)
   */
  private async generateTokens(user: UserInfo): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    return { accessToken, refreshToken };
  }

  /**
   * 액세스 토큰 생성
   */
  private generateAccessToken(user: UserInfo): string {
    const payload: JWTPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.getTokenExpirySeconds(gatewayConfig.jwt.accessTokenExpiry),
      iss: gatewayConfig.jwt.issuer,
      aud: gatewayConfig.jwt.audience,
      jti: uuidv4()
    };

    return jwt.sign(payload, gatewayConfig.jwt.accessSecret, {
      algorithm: 'HS256'
    });
  }

  /**
   * 리프레시 토큰 생성
   */
  private generateRefreshToken(user: UserInfo): string {
    const tokenId = uuidv4();
    
    const payload: RefreshTokenPayload = {
      sub: user.id,
      tokenId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.getTokenExpirySeconds(gatewayConfig.jwt.refreshTokenExpiry),
      iss: gatewayConfig.jwt.issuer,
      aud: gatewayConfig.jwt.audience
    };

    return jwt.sign(payload, gatewayConfig.jwt.refreshSecret, {
      algorithm: 'HS256'
    });
  }

  // ========================================
  // 토큰 검증 관련 메서드
  // ========================================

  /**
   * 액세스 토큰 검증
   */
  private verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, gatewayConfig.jwt.accessSecret, {
        issuer: gatewayConfig.jwt.issuer,
        audience: gatewayConfig.jwt.audience
      }) as JWTPayload;
    } catch (error) {
      throw new AuthenticationError('Invalid access token');
    }
  }

  /**
   * 리프레시 토큰 검증
   */
  private verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, gatewayConfig.jwt.refreshSecret, {
        issuer: gatewayConfig.jwt.issuer,
        audience: gatewayConfig.jwt.audience
      }) as RefreshTokenPayload;
    } catch (error) {
      throw new AuthenticationError('Invalid refresh token');
    }
  }
  // ========================================
  // 사용자 관련 메서드 (Storage Service 연동)
  // ========================================

  /**
   * 사용자 인증 (Storage Service 연동)
   */
  private async authenticateUser(username: string, password: string): Promise<UserInfo | null> {
    try {
      // TODO: Storage Service API 호출로 사용자 인증
      // 현재는 하드코딩된 관리자 계정으로 테스트
      if (username === 'admin' && password === 'secure_password123') {
        return {
          id: '550e8400-e29b-41d4-a716-446655440000',
          username: 'admin',
          role: 'administrator',
          email: 'admin@automation-system.com',
          createdAt: '2024-01-01T00:00:00Z'
        };
      }

      return null;
    } catch (error) {
      this.logger.error('User authentication failed', {
        username,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * 사용자 ID로 사용자 정보 조회
   */
  private async getUserById(userId: string): Promise<UserInfo | null> {
    try {
      // TODO: Storage Service API 호출
      // 현재는 하드코딩된 사용자 정보 반환
      if (userId === '550e8400-e29b-41d4-a716-446655440000') {
        return {
          id: userId,
          username: 'admin',
          role: 'administrator',
          email: 'admin@automation-system.com',
          createdAt: '2024-01-01T00:00:00Z'
        };
      }

      return null;
    } catch (error) {
      this.logger.error('User lookup failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * 마지막 로그인 시간 업데이트
   */
  private async updateLastLogin(userId: string): Promise<void> {
    try {
      // TODO: Storage Service API 호출
      this.logger.debug('Last login updated', { userId });
    } catch (error) {
      this.logger.error('Failed to update last login', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  // ========================================
  // Redis 세션 관리 메서드
  // ========================================

  /**
   * 사용자 세션 저장
   */
  private async saveUserSession(userId: string, session: UserSession): Promise<void> {
    const key = `${gatewayConfig.redis.keyPrefix}session:user:${userId}`;
    const sessionData = {
      session_id: session.sessionId,
      user_id: session.userId,
      username: session.username,
      role: session.role,
      ip_address: session.ipAddress,
      user_agent: session.userAgent,
      login_at: session.loginAt,
      last_activity: session.lastActivity,
      permissions: JSON.stringify(session.permissions || [])
    };

    await this.redis.hmset(key, sessionData);
    await this.redis.expire(key, 3600); // 1시간 TTL
  }

  /**
   * 리프레시 토큰 저장
   */
  private async saveRefreshToken(
    refreshToken: string, 
    userId: string, 
    rememberMe: boolean
  ): Promise<void> {
    const payload = this.verifyRefreshToken(refreshToken);
    const key = `${gatewayConfig.redis.keyPrefix}refresh_token:${payload.tokenId}`;
    const ttl = rememberMe ? 7 * 24 * 3600 : 24 * 3600; // 7일 vs 1일

    await this.redis.setex(key, ttl, userId);
  }

  /**
   * 마지막 활동 시간 업데이트
   */
  private async updateLastActivity(userId: string): Promise<void> {
    const key = `${gatewayConfig.redis.keyPrefix}session:user:${userId}`;
    const exists = await this.redis.exists(key);

    if (exists) {
      await this.redis.hset(key, 'last_activity', new Date().toISOString());
      await this.redis.expire(key, 3600); // TTL 갱신
    }
  }

  // ========================================
  // 유틸리티 메서드
  // ========================================

  /**
   * 토큰 만료 시간을 초 단위로 변환
   */
  private getTokenExpirySeconds(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1));

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return 3600; // 기본 1시간
    }
  }

  /**
   * 사용자 역할에 따른 권한 반환
   */
  private getUserPermissions(role: string): string[] {
    switch (role) {
      case 'administrator':
        return ['read', 'write', 'delete', 'admin'];
      case 'operator':
        return ['read', 'write'];
      case 'viewer':
        return ['read'];
      default:
        return ['read'];
    }
  }

  /**
   * 비밀번호 해시 검증
   */
  private async verifyPassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcryptjs.compare(plainPassword, hashedPassword);
    } catch (error) {
      this.logger.error('Password verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * 비밀번호 해시 생성
   */
  private async hashPassword(password: string): Promise<string> {
    try {
      return await bcryptjs.hash(password, gatewayConfig.security.bcryptRounds);
    } catch (error) {
      this.logger.error('Password hashing failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Password processing failed');
    }
  }
}
  /**
   * 토큰 갱신
   * 계약: POST /auth/refresh
   */
  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      // 1. 리프레시 토큰 검증
      const payload = this.verifyRefreshToken(refreshToken);
      
      // 2. 토큰 유효성 확인 (Redis 확인)
      const storedUserId = await this.redis.get(
        `${gatewayConfig.redis.keyPrefix}refresh_token:${payload.tokenId}`
      );

      if (!storedUserId || storedUserId !== payload.sub) {
        throw new AuthenticationError('Invalid refresh token');
      }

      // 3. 사용자 정보 조회
      const user = await this.getUserById(payload.sub);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // 4. 새로운 액세스 토큰 생성
      const newAccessToken = this.generateAccessToken(user);

      this.logger.info('Token refresh successful', {
        userId: user.id,
        username: user.username
      });

      return {
        accessToken: newAccessToken,
        expiresIn: this.getTokenExpirySeconds(gatewayConfig.jwt.accessTokenExpiry),
        tokenType: 'Bearer'
      };

    } catch (error) {
      this.logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new AuthenticationError('Token refresh failed');
    }
  }

  /**
   * 로그아웃
   * 계약: POST /auth/logout
   */
  async logout(accessToken: string, userId: string): Promise<void> {
    try {
      // 1. 액세스 토큰을 블랙리스트에 추가
      const payload = this.verifyAccessToken(accessToken);
      const tokenExpiry = payload.exp - Math.floor(Date.now() / 1000);
      
      if (tokenExpiry > 0) {
        await this.redis.setex(
          `${gatewayConfig.redis.keyPrefix}blacklist:jwt:${payload.jti}`,
          tokenExpiry,
          'revoked'
        );
      }

      // 2. 리프레시 토큰들 무효화 (사용자의 모든 리프레시 토큰)
      const refreshTokenKeys = await this.redis.keys(
        `${gatewayConfig.redis.keyPrefix}refresh_token:*`
      );
      
      for (const key of refreshTokenKeys) {
        const storedUserId = await this.redis.get(key);
        if (storedUserId === userId) {
          await this.redis.del(key);
        }
      }

      // 3. 사용자 세션 삭제
      await this.redis.del(`${gatewayConfig.redis.keyPrefix}session:user:${userId}`);

      // 4. WebSocket 연결 정리
      await this.redis.del(`${gatewayConfig.redis.keyPrefix}websocket:connections:${userId}`);

      this.logger.info('User logout successful', {
        userId,
        tokenId: payload.jti
      });

    } catch (error) {
      this.logger.error('Logout failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * 토큰 검증
   * 계약: GET /auth/verify
   */
  async verifyToken(accessToken: string): Promise<UserInfo> {
    try {
      // 1. JWT 토큰 검증
      const payload = this.verifyAccessToken(accessToken);

      // 2. 블랙리스트 확인
      const isBlacklisted = await this.redis.get(
        `${gatewayConfig.redis.keyPrefix}blacklist:jwt:${payload.jti}`
      );

      if (isBlacklisted) {
        throw new AuthenticationError('Token has been revoked');
      }

      // 3. 사용자 정보 조회
      const user = await this.getUserById(payload.sub);
      if (!user) {
        throw new AuthenticationError('User not found');
      }

      // 4. 세션 활동 시간 업데이트
      await this.updateSessionActivity(user.id);

      return user;

    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Token expired');
      }
      throw error;
    }
  }

  // ========================================
  // Private Helper Methods
  // ========================================

  /**
   * JWT 토큰 생성
   */
  private async generateTokens(user: UserInfo): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  /**
   * 액세스 토큰 생성
   */
  private generateAccessToken(user: UserInfo): string {
    const payload: JWTPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.getTokenExpirySeconds(gatewayConfig.jwt.accessTokenExpiry),
      iss: gatewayConfig.jwt.issuer,
      aud: gatewayConfig.jwt.audience,
      jti: uuidv4()
    };

    return jwt.sign(payload, gatewayConfig.jwt.accessSecret, {
      algorithm: 'HS256'
    });
  }

  /**
   * 리프레시 토큰 생성
   */
  private generateRefreshToken(userId: string): string {
    const tokenId = uuidv4();
    const payload: RefreshTokenPayload = {
      sub: userId,
      tokenId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.getTokenExpirySeconds(gatewayConfig.jwt.refreshTokenExpiry),
      iss: gatewayConfig.jwt.issuer,
      aud: gatewayConfig.jwt.audience
    };

    return jwt.sign(payload, gatewayConfig.jwt.refreshSecret, {
      algorithm: 'HS256'
    });
  }

  /**
   * 액세스 토큰 검증
   */
  private verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, gatewayConfig.jwt.accessSecret) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid access token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Access token expired');
      }
      throw error;
    }
  }

  /**
   * 리프레시 토큰 검증
   */
  private verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      return jwt.verify(token, gatewayConfig.jwt.refreshSecret) as RefreshTokenPayload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AuthenticationError('Invalid refresh token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AuthenticationError('Refresh token expired');
      }
      throw error;
    }
  }

  /**
   * 사용자 인증 (Storage Service 연동)
   */
  private async authenticateUser(username: string, password: string): Promise<UserInfo | null> {
    try {
      // TODO: Storage Service API 호출로 사용자 정보 조회
      // const user = await this.storageService.getUserByUsername(username);
      
      // 임시 구현: 하드코딩된 관리자 계정
      if (username === 'admin' && password === 'admin123') {
        return {
          id: '550e8400-e29b-41d4-a716-446655440000',
          username: 'admin',
          role: 'administrator',
          email: 'admin@automation-system.com',
          createdAt: '2024-01-01T00:00:00Z'
        };
      }

      return null;
    } catch (error) {
      this.logger.error('User authentication failed', {
        username,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * 사용자 정보 조회 (Storage Service 연동)
   */
  private async getUserById(userId: string): Promise<UserInfo | null> {
    try {
      // TODO: Storage Service API 호출로 사용자 정보 조회
      // return await this.storageService.getUserById(userId);
      
      // 임시 구현
      if (userId === '550e8400-e29b-41d4-a716-446655440000') {
        return {
          id: userId,
          username: 'admin',
          role: 'administrator',
          email: 'admin@automation-system.com',
          createdAt: '2024-01-01T00:00:00Z'
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Get user by ID failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return null;
    }
  }

  /**
   * 사용자 세션 저장
   */
  private async saveUserSession(userId: string, session: UserSession): Promise<void> {
    const sessionKey = `${gatewayConfig.redis.keyPrefix}session:user:${userId}`;
    const sessionData = {
      session_id: session.sessionId,
      user_id: session.userId,
      username: session.username,
      role: session.role,
      ip_address: session.ipAddress,
      user_agent: session.userAgent,
      login_at: session.loginAt,
      last_activity: session.lastActivity,
      permissions: JSON.stringify(session.permissions || [])
    };

    // TTL: 1시간 (JWT 액세스 토큰과 동일)
    await this.redis.hmset(sessionKey, sessionData);
    await this.redis.expire(sessionKey, 3600);
  }

  /**
   * 리프레시 토큰 저장
   */
  private async saveRefreshToken(refreshToken: string, userId: string, rememberMe: boolean): Promise<void> {
    const payload = this.verifyRefreshToken(refreshToken);
    const tokenKey = `${gatewayConfig.redis.keyPrefix}refresh_token:${payload.tokenId}`;
    
    // TTL: 7일 (기본) 또는 30일 (Remember Me)
    const ttl = rememberMe ? 30 * 24 * 3600 : 7 * 24 * 3600;
    await this.redis.setex(tokenKey, ttl, userId);
  }

  /**
   * 세션 활동 시간 업데이트
   */
  private async updateSessionActivity(userId: string): Promise<void> {
    const sessionKey = `${gatewayConfig.redis.keyPrefix}session:user:${userId}`;
    const exists = await this.redis.exists(sessionKey);
    
    if (exists) {
      await this.redis.hset(sessionKey, 'last_activity', new Date().toISOString());
      await this.redis.expire(sessionKey, 3600); // TTL 갱신
    }
  }

  /**
   * 마지막 로그인 시간 업데이트 (Storage Service 연동)
   */
  private async updateLastLogin(userId: string): Promise<void> {
    try {
      // TODO: Storage Service API 호출
      // await this.storageService.updateUserLastLogin(userId, new Date());
      
      this.logger.debug('Last login updated', { userId });
    } catch (error) {
      this.logger.error('Failed to update last login', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * 사용자 권한 조회
   */
  private getUserPermissions(role: string): string[] {
    const permissions: Record<string, string[]> = {
      administrator: [
        'system:read', 'system:write', 'system:delete',
        'users:read', 'users:write', 'users:delete',
        'devices:read', 'devices:write', 'devices:delete',
        'workflows:read', 'workflows:write', 'workflows:delete'
      ],
      operator: [
        'system:read',
        'devices:read', 'devices:write',
        'workflows:read', 'workflows:write'
      ],
      viewer: [
        'system:read',
        'devices:read',
        'workflows:read'
      ]
    };

    return permissions[role] || [];
  }

  /**
   * 토큰 만료 시간을 초 단위로 변환
   */
  private getTokenExpirySeconds(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1), 10);

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 24 * 3600;
      default: return 3600; // 기본 1시간
    }
  }
}