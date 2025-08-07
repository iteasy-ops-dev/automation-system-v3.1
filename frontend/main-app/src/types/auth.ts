/**
 * Authentication Types
 * 
 * TASK-2 Gateway Auth 계약 100% 준수
 * shared/contracts/v1.0/rest/core/gateway-auth.yaml 기반
 */

// 사용자 역할 (계약에서 정의됨)
export type UserRole = 'administrator' | 'operator' | 'viewer';

// 토큰 타입
export type TokenType = 'Bearer';

// 로그인 요청 (계약 정의 준수)
export interface LoginRequest {
  username: string; // minLength: 3, maxLength: 50, pattern: '^[a-zA-Z0-9_-]+$'
  password: string; // minLength: 8, maxLength: 128
}

// 사용자 정보 (계약 정의 준수)
export interface User {
  id: string; // UUID format
  username: string;
  role: UserRole;
}

// 로그인 응답 (계약 정의 준수)
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // minimum: 1
  tokenType: TokenType; // default: "Bearer"
  user: User;
}

// 토큰 갱신 요청 (계약 정의 준수)
export interface RefreshTokenRequest {
  refreshToken: string;
}

// 토큰 갱신 응답 (계약 정의 준수)
export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number; // minimum: 1
  tokenType: TokenType; // default: "Bearer"
}

// 토큰 검증 응답 (계약 정의 준수)
export interface VerifyTokenResponse {
  id: string; // UUID format
  username: string;
  role: UserRole;
}

// 인증 상태
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  isLoading: boolean;
  error: string | null;
}

// 인증 액션
export interface AuthActions {
  login: (credentials: LoginRequest) => Promise<LoginResponse>;
  logout: () => void;
  refreshAccessToken: () => Promise<RefreshTokenResponse | undefined>;
  verifyToken: () => Promise<VerifyTokenResponse | undefined>;
  clearError: () => void;
}

// 인증 컨텍스트
export interface AuthContext extends AuthState, AuthActions {}

// API 에러 응답 (일반적인 에러 형식)
export interface ApiErrorResponse {
  message: string;
  code?: string;
  details?: Record<string, unknown>;
}

// JWT 토큰 페이로드 (예상 구조)
export interface JWTPayload {
  sub: string; // subject (user id)
  username: string;
  role: UserRole;
  iat: number; // issued at
  exp: number; // expires at
}

// 인증 관련 상수
export const AUTH_CONSTANTS = {
  TOKEN_TYPE: 'Bearer' as const,
  STORAGE_KEYS: {
    ACCESS_TOKEN: 'auth_access_token',
    REFRESH_TOKEN: 'auth_refresh_token',
    USER: 'auth_user',
    EXPIRES_AT: 'auth_expires_at',
  },
  VALIDATION: {
    USERNAME_MIN_LENGTH: 3,
    USERNAME_MAX_LENGTH: 50,
    USERNAME_PATTERN: /^[a-zA-Z0-9_-]+$/,
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_MAX_LENGTH: 128,
  },
} as const;