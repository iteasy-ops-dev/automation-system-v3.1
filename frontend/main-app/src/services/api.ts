/**
 * API Client
 * 
 * Gateway 계약 기반 HTTP 클라이언트
 * 모든 백엔드 통신은 API Gateway를 통해서만 수행
 */

import axios from 'axios';
import type { ApiClient, ApiError } from '@/types';
import { useAuthStore } from '@/stores';

// API 기본 설정
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''; // 🔥 상대 경로 사용
const API_TIMEOUT = 10000; // 10초

// Axios 인스턴스 생성
const axiosInstance: any = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 요청 인터셉터 (인증 토큰 자동 추가)
axiosInstance.interceptors.request.use(
  (config: any) => {
    // Zustand store에서 직접 토큰 가져오기
    const authState = useAuthStore.getState();
    const token = authState.accessToken;
    
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // 요청 로깅 (개발환경에서만)
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        data: config.data,
        params: config.params,
      });
    }
    
    return config;
  },
  (error: any) => Promise.reject(error)
);

// 응답 인터센터 (에러 처리 및 토큰 갱신)
axiosInstance.interceptors.response.use(
  (response: any) => {
    // 응답 로깅 (개발환경에서만)
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.status}`, response.data);
    }
    
    return response;
  },
  async (error: any) => {
    const originalRequest = error.config;
    
    // 401 에러 시 토큰 갱신 시도
    if (error.response?.status === 401 && originalRequest && !(originalRequest as any)._retry) {
      (originalRequest as any)._retry = true;
      
      try {
        await refreshAccessToken();
        // 갱신된 토큰으로 재시도
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        // 토큰 갱신 실패 시 로그아웃
        handleAuthError();
        return Promise.reject(refreshError);
      }
    }
    
    // API 에러 형식으로 변환
    const apiError: ApiError = {
      message: (error.response?.data as any)?.message || error.message || '알 수 없는 오류가 발생했습니다.',
      code: (error.response?.data as any)?.code || error.code,
      status: error.response?.status,
      details: (error.response?.data as any)?.details,
    };
    
    return Promise.reject(apiError);
  }
);
// 토큰 갱신 함수
async function refreshAccessToken(): Promise<void> {
  const authState = useAuthStore.getState();
  
  if (!authState.refreshToken) {
    throw new Error('Refresh token not found');
  }
  
  // Zustand store의 refreshAccessToken 사용
  try {
    await authState.refreshAccessToken();
  } catch (error) {
    throw error;
  }
}

// 인증 에러 처리
function handleAuthError(): void {
  // Zustand store의 상태 초기화 (API 호출 없이)
  const authState = useAuthStore.getState();
  
  // 이미 로그아웃 상태면 아무것도 하지 않음
  if (!authState.isAuthenticated) {
    return;
  }
  
  // 상태만 초기화 (logout API 호출하지 않음)
  useAuthStore.setState({
    isAuthenticated: false,
    user: null,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    isLoading: false,
    error: null,
  });
  
  // 로그인 페이지가 아닌 경우에만 리다이렉트
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// API 클라이언트 구현
export const apiClient: ApiClient = {
  async get(url: string, params?: Record<string, unknown>): Promise<any> {
    const response = await axiosInstance.get(url, { params });
    return response.data;
  },

  async post(url: string, data?: unknown): Promise<any> {
    const response = await axiosInstance.post(url, data);
    return response.data;
  },

  async put(url: string, data?: unknown): Promise<any> {
    const response = await axiosInstance.put(url, data);
    return response.data;
  },

  async delete(url: string): Promise<any> {
    const response = await axiosInstance.delete(url);
    return response.data;
  },

  async patch(url: string, data?: unknown): Promise<any> {
    const response = await axiosInstance.patch(url, data);
    return response.data;
  },
};

export default apiClient;