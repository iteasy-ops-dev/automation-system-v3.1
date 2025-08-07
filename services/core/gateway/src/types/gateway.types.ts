import { Request } from 'express';

/**
 * 계약 기반 요청 타입 정의
 * 파일: shared/contracts/v1.0/rest/core/gateway-auth.yaml 기준
 * 
 * 2025-07-31: Role 타입 확장 - 레거시 role 값 지원 추가
 * - 기존 DB의 'admin', 'user' 값을 허용하면서 점진적 마이그레이션 지원
 */

// Role 타입 정의 (레거시 + 계약 통합)
export type LegacyRole = 'admin' | 'user';
export type ContractRole = 'administrator' | 'operator' | 'viewer';
export type Role = LegacyRole | ContractRole;

// 로그인 요청 타입 (계약 100% 준수)
export interface LoginRequest {
  username: string; // 3-50자, ^[a-zA-Z0-9_-]+$
  password: string; // 8-128자
  rememberMe?: boolean; // 기본값: false
}

// 리프레시 토큰 요청 타입
export interface RefreshTokenRequest {
  refreshToken: string;
}

// 사용자 정보 타입 (계약 준수 + 레거시 호환)
export interface UserInfo {
  id: string; // UUID 형식
  username: string;
  role: Role; // 확장된 role 타입 (레거시 + 계약 값 모두 허용)
  email?: string;
  isActive?: boolean; // 계정 활성화 상태
  createdAt?: string | Date; // ISO 8601 date-time
  updatedAt?: string | Date; // 마지막 수정 시간
  lastLoginAt?: string; // ISO 8601 date-time
}

// 로그인 응답 타입 (계약 100% 준수)
export interface LoginResponse {
  accessToken: string; // JWT
  refreshToken: string;
  expiresIn: number; // 초 단위
  tokenType: string; // "Bearer"
  user: UserInfo;
}

// 에러 응답 타입 (계약 100% 준수)
export interface ErrorResponse {
  error: string; // 에러 코드
  message: string; // 에러 메시지
  timestamp: string; // ISO 8601 date-time
  details?: Record<string, unknown>; // 추가 세부사항
}

// JWT 페이로드 타입 (레거시 호환)
export interface JWTPayload {
  sub: string; // 사용자 ID (UUID)
  username: string;
  role: Role; // 확장된 role 타입
  email?: string; // 이메일 추가
  iat: number; // 발급 시간
  exp: number; // 만료 시간
  jti: string; // JWT ID (UUID)
  type?: 'access' | 'refresh'; // 토큰 타입
}

// 리프레시 토큰 페이로드 타입
export interface RefreshTokenPayload {
  sub: string; // 사용자 ID (UUID)
  type: 'refresh';
  iat: number; // 발급 시간
  exp: number; // 만료 시간
  jti: string; // JWT ID (UUID)
}

// Express Request 확장 (인증된 사용자 정보 추가)
export interface AuthenticatedRequest extends Request {
  user?: UserInfo;
  token?: {
    payload: JWTPayload;
    raw: string;
  };
}

// 세션 정보 타입 (Redis 저장용)
export interface SessionInfo {
  userId: string;
  username: string;
  role: Role; // 확장된 role 타입
  refreshTokenId: string;
  createdAt: string;
  lastAccessAt: string;
  ipAddress?: string;
  userAgent?: string;
}

// Redis 키 패턴 정의 (TASK-3 스키마 준수)
export enum RedisKeyPattern {
  SESSION = 'automation:session:user:',
  BLACKLIST = 'automation:blacklist:jwt:',
  RATE_LIMIT = 'automation:ratelimit:',
  WEBSOCKET = 'automation:websocket:connections:'
}

// 커스텀 에러 클래스들
export class AuthenticationError extends Error {
  public readonly statusCode = 401;
  public readonly errorCode = 'AUTHENTICATION_ERROR';

  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  public readonly statusCode = 400;
  public readonly errorCode = 'VALIDATION_ERROR';

  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthorizationError extends Error {
  public readonly statusCode = 403;
  public readonly errorCode = 'AUTHORIZATION_ERROR';

  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class TokenExpiredError extends Error {
  public readonly statusCode = 401;
  public readonly errorCode = 'TOKEN_EXPIRED';

  constructor(message: string = '토큰이 만료되었습니다.') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export class RateLimitError extends Error {
  public readonly statusCode = 429;
  public readonly errorCode = 'RATE_LIMIT_EXCEEDED';

  constructor(message: string = '요청 한도를 초과했습니다.') {
    super(message);
    this.name = 'RateLimitError';
  }
}

// 토큰 유효성 에러
export class TokenInvalidError extends Error {
  public readonly statusCode = 401;
  public readonly errorCode = 'TOKEN_INVALID';

  constructor(message: string = '유효하지 않은 토큰입니다.') {
    super(message);
    this.name = 'TokenInvalidError';
  }
}

// 토큰 검증 결과
export interface TokenVerificationResult {
  valid: boolean;
  user?: UserInfo;
  reason?: string;
}