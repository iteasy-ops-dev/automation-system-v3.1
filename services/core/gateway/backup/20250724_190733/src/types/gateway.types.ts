/**
 * Gateway Service 타입 정의
 * 계약 준수: shared/contracts/v1.0/rest/core/gateway-auth.yaml
 */

import { Request, Response } from 'express';
import { WebSocket } from 'ws';

// ========================================
// 인증 관련 타입 (계약 100% 준수)
// ========================================

export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: UserInfo;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface UserInfo {
  id: string;
  username: string;
  role: 'administrator' | 'operator' | 'viewer';
  email?: string;
  createdAt?: string;
  lastLoginAt?: string;
}
export interface ErrorResponse {
  error: string;
  message: string;
  timestamp: string;
  details?: Record<string, any>;
}

// ========================================
// JWT 토큰 관련 타입
// ========================================

export interface JWTPayload {
  sub: string; // user ID
  username: string;
  role: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  jti: string; // token ID
}

export interface RefreshTokenPayload {
  sub: string; // user ID
  tokenId: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

// ========================================
// Express 확장 타입
// ========================================

declare global {
  namespace Express {
    interface Request {
      user?: UserInfo;
      correlationId?: string;
      startTime?: number;
      rateLimitInfo?: {
        limit: number;
        remaining: number;
        resetTime: Date;
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: UserInfo;
}
// ========================================
// 미들웨어 관련 타입
// ========================================

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
  onLimitReached?: (req: Request, res: Response) => void;
}

export interface CORSOptions {
  origins: string[];
  credentials: boolean;
  methods?: string[];
  allowedHeaders?: string[];
}

// ========================================
// 세션 관리 타입
// ========================================

export interface UserSession {
  sessionId: string;
  userId: string;
  username: string;
  role: string;
  ipAddress: string;
  userAgent: string;
  loginAt: string;
  lastActivity: string;
  permissions?: string[];
}

export interface SessionData {
  user: UserInfo;
  loginTime: Date;
  lastActivity: Date;
  ipAddress: string;
  userAgent: string;
}
// ========================================
// WebSocket 관련 타입
// ========================================

export interface WebSocketMessage {
  type: string;
  timestamp: string;
  payload?: any;
  correlationId?: string;
}

export interface WebSocketConnection {
  id: string;
  userId: string;
  socket: any; // WebSocket
  subscriptions: Set<string>;
  lastHeartbeat: Date;
  authenticated: boolean;
}

// ========================================
// 에러 처리 관련 타입
// ========================================

export class GatewayError extends Error {
  public readonly statusCode: number;
  public readonly errorCode: string;
  public readonly details?: Record<string, any>;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR',
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'GatewayError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends GatewayError {
  constructor(message: string = 'Authentication failed', details?: Record<string, any>) {
    super(message, 401, 'AUTHENTICATION_FAILED', details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends GatewayError {
  constructor(message: string = 'Access denied', details?: Record<string, any>) {
    super(message, 403, 'ACCESS_DENIED', details);
    this.name = 'AuthorizationError';
  }
}

export class ValidationError extends GatewayError {
  constructor(message: string = 'Validation failed', details?: Record<string, any>) {
    super(message, 400, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export class RateLimitError extends GatewayError {
  constructor(message: string = 'Rate limit exceeded', details?: Record<string, any>) {
    super(message, 429, 'RATE_LIMIT_EXCEEDED', details);
    this.name = 'RateLimitError';
  }
}

// ========================================
// 유틸리티 타입
// ========================================

export type AsyncRequestHandler = (req: Request, res: Response) => Promise<void>;
export type AsyncMiddleware = (req: Request, res: Response, next: Function) => Promise<void>;