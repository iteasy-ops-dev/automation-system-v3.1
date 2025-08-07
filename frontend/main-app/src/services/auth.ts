/**
 * Authentication Service - Zustand Store 완전 통합
 * 
 * TASK-2 Gateway Auth 계약 100% 준수
 * shared/contracts/v1.0/rest/core/gateway-auth.yaml 기반
 * 무한루프 해결: localStorage 직접 사용 제거
 */

import { apiClient } from './api';
import type {
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  VerifyTokenResponse,
} from '@/types';
import { AUTH_CONSTANTS } from '@/types';

export class AuthService {
  /**
   * 사용자 로그인
   * POST /auth/login 계약 준수
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    // 계약 검증: username validation
    this.validateUsername(credentials.username);
    this.validatePassword(credentials.password);
    
    const response = await apiClient.post<LoginResponse>('/api/v1/auth/login', credentials);
    
    // 계약 검증: 필수 필드 확인
    this.validateLoginResponse(response);
    
    return response;
  }

  /**
   * 토큰 갱신
   * POST /auth/refresh 계약 준수
   * 주의: refreshToken은 Zustand store에서 가져옴
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    if (!refreshToken) {
      throw new Error('Refresh token not found');
    }
    
    const request: RefreshTokenRequest = { refreshToken };
    const response = await apiClient.post<RefreshTokenResponse>('/api/v1/auth/refresh', request);
    
    // 계약 검증: 필수 필드 확인
    this.validateRefreshResponse(response);
    
    return response;
  }

  /**
   * 토큰 검증
   * GET /auth/verify 계약 준수
   */
  async verifyToken(): Promise<VerifyTokenResponse> {
    const response = await apiClient.get<VerifyTokenResponse>('/api/v1/auth/verify');
    
    // 계약 검증: 필수 필드 확인
    this.validateVerifyResponse(response);
    
    return response;
  }

  /**
   * 로그아웃 (서버 호출만)
   * 실제 상태 제거는 Zustand store에서 처리
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/api/v1/auth/logout');
    } catch (error) {
      // 로그아웃 API 실패는 조용히 처리 (토큰이 이미 만료되었을 수 있음)
      console.warn('Logout API call failed:', error);
    }
  }

  // Private validation methods (계약 준수)

  /**
   * 사용자명 검증 (계약 기준)
   */
  private validateUsername(username: string): void {
    if (username.length < AUTH_CONSTANTS.VALIDATION.USERNAME_MIN_LENGTH) {
      throw new Error(`Username must be at least ${AUTH_CONSTANTS.VALIDATION.USERNAME_MIN_LENGTH} characters`);
    }
    
    if (username.length > AUTH_CONSTANTS.VALIDATION.USERNAME_MAX_LENGTH) {
      throw new Error(`Username must be no more than ${AUTH_CONSTANTS.VALIDATION.USERNAME_MAX_LENGTH} characters`);
    }
    
    if (!AUTH_CONSTANTS.VALIDATION.USERNAME_PATTERN.test(username)) {
      throw new Error('Username can only contain letters, numbers, hyphens, and underscores');
    }
  }

  /**
   * 비밀번호 검증 (계약 기준)
   */
  private validatePassword(password: string): void {
    if (password.length < AUTH_CONSTANTS.VALIDATION.PASSWORD_MIN_LENGTH) {
      throw new Error(`Password must be at least ${AUTH_CONSTANTS.VALIDATION.PASSWORD_MIN_LENGTH} characters`);
    }
    
    if (password.length > AUTH_CONSTANTS.VALIDATION.PASSWORD_MAX_LENGTH) {
      throw new Error(`Password must be no more than ${AUTH_CONSTANTS.VALIDATION.PASSWORD_MAX_LENGTH} characters`);
    }
  }

  /**
   * 로그인 응답 검증 (계약 기준)
   */
  private validateLoginResponse(response: LoginResponse): void {
    const required = ['accessToken', 'refreshToken', 'expiresIn', 'tokenType', 'user'];
    for (const field of required) {
      if (!(field in response)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    const userRequired = ['id', 'username', 'role'];
    for (const field of userRequired) {
      if (!(field in response.user)) {
        throw new Error(`Missing required user field: ${field}`);
      }
    }
  }

  /**
   * 토큰 갱신 응답 검증 (계약 기준)
   */
  private validateRefreshResponse(response: RefreshTokenResponse): void {
    const required = ['accessToken', 'expiresIn', 'tokenType'];
    for (const field of required) {
      if (!(field in response)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  /**
   * 토큰 검증 응답 검증 (계약 기준)
   */
  private validateVerifyResponse(response: VerifyTokenResponse): void {
    const required = ['id', 'username', 'role'];
    for (const field of required) {
      if (!(field in response)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }
}

// 싱글톤 인스턴스 내보내기
export const authService = new AuthService();