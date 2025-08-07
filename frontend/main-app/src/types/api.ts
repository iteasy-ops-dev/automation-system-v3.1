/**
 * API Types
 * 
 * API 요청/응답 및 공통 타입 정의
 */

// HTTP 메서드
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

// API 응답 기본 구조
export interface ApiResponse<T = unknown> {
  data: T;
  success: boolean;
  message?: string;
  timestamp: string;
}

// 에러 응답
export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: Record<string, unknown>;
}

// 페이지네이션 파라미터
export interface PaginationParams {
  limit?: number;
  offset?: number;
  page?: number;
  size?: number;
}

// 페이지네이션 응답
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

// 정렬 파라미터
export interface SortParams {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// 필터 파라미터
export interface FilterParams {
  [key: string]: string | number | boolean | null | undefined;
}

// 요청 설정
export interface RequestConfig {
  timeout?: number;
  retries?: number;
  requireAuth?: boolean;
  headers?: Record<string, string>;
}

// API 엔드포인트 설정
export interface ApiEndpoint {
  method: HttpMethod;
  url: string;
  config?: RequestConfig;
}

// API 클라이언트 인터페이스
export interface ApiClient {
  get<T>(url: string, params?: Record<string, unknown>): Promise<T>;
  post<T>(url: string, data?: unknown): Promise<T>;
  put<T>(url: string, data?: unknown): Promise<T>;
  delete<T>(url: string): Promise<T>;
  patch<T>(url: string, data?: unknown): Promise<T>;
}