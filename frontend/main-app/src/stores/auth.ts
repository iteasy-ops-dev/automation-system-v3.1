/**
 * Authentication Store - 무한루프 문제 해결
 * 
 * Zustand 기반 인증 상태 관리
 * TASK-2 계약 100% 준수
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '@/services';
import { webSocketService } from '@/services';
import type { AuthState, AuthActions, LoginRequest, User } from '@/types';

interface AuthStore extends AuthState, AuthActions {}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // 초기 상태
      isAuthenticated: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      isLoading: false,
      error: null,

      // 액션
      login: async (credentials: LoginRequest) => {
        set({ isLoading: true, error: null });
        
        try {
          const response = await authService.login(credentials);
          
          set({
            isAuthenticated: true,
            user: response.user,
            accessToken: response.accessToken,
            refreshToken: response.refreshToken,
            expiresAt: Date.now() + (response.expiresIn * 1000),
            isLoading: false,
            error: null,
          });
          
          // WebSocket에 토큰 설정
          webSocketService.setAuthToken(response.accessToken);
          
          return response;
        } catch (error) {
          set({
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isLoading: false,
            error: error instanceof Error ? error.message : 'Login failed',
          });
          throw error;
        }
      },

      logout: async () => {
        // 중복 호출 방지를 위한 플래그
        const currentState = get();
        if (!currentState.isAuthenticated) {
          return;
        }
        
        try {
          // API 호출은 토큰이 있을 때만
          if (currentState.accessToken) {
            await authService.logout();
          }
        } catch (error) {
          console.warn('Logout service call failed:', error);
        }
        
        set({
          isAuthenticated: false,
          user: null,
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          isLoading: false,
          error: null,
        });
        
        // WebSocket 토큰 제거
        webSocketService.setAuthToken(null);
      },

      refreshAccessToken: async () => {
        const { refreshToken, isLoading } = get();
        
        // 이미 진행 중이면 중복 요청 방지
        if (isLoading) {
          return;
        }
        
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        set({ isLoading: true });

        try {
          const response = await authService.refreshToken(refreshToken);
          
          set({
            accessToken: response.accessToken,
            expiresAt: Date.now() + (response.expiresIn * 1000),
            isLoading: false,
            error: null,
          });
          
          return response;
        } catch (error) {
          // 토큰 갱신 실패 시 로그아웃 (조용히)
          console.warn('Token refresh failed, logging out:', error);
          
          set({
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isLoading: false,
            error: null,
          });
          
          throw error;
        }
      },

      verifyToken: async () => {
        const { accessToken, isLoading } = get();
        
        // 토큰이 없거나 이미 로딩 중이면 스킵
        if (!accessToken || isLoading) {
          set({ isLoading: false });
          return;
        }

        set({ isLoading: true });
        
        try {
          const response = await authService.verifyToken();
          
          // 사용자 정보 업데이트 (서버에서 최신 정보 가져옴)
          const updatedUser: User = {
            id: response.id,
            username: response.username,
            role: response.role,
          };
          
          set({
            user: updatedUser,
            isLoading: false,
            error: null,
          });
          
          return response;
        } catch (error) {
          console.warn('Token verification failed:', error);
          
          // 토큰 검증 실패 시 조용히 로그아웃
          set({
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isLoading: false,
            error: null,
          });
          
          throw error;
        }
      },

      clearError: () => {
        set({ error: null });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
      }),
      // 무한루프 방지: 초기화 시 상태 변경 방지
      onRehydrateStorage: () => (state) => {
        // 복원된 상태가 있고 토큰이 만료되었으면 조용히 클리어
        if (state && state.isAuthenticated && state.expiresAt && isTokenExpired(state.expiresAt)) {
          console.warn('Restored token expired, clearing auth state');
          return {
            ...state,
            isAuthenticated: false,
            user: null,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            isLoading: false,
            error: null,
          };
        }
        return state;
      },
    }
  )
);

// 토큰 만료 확인 헬퍼
export const isTokenExpired = (expiresAt: number | null): boolean => {
  if (!expiresAt) return true;
  
  // 5분 여유 둠
  const bufferTime = 5 * 60 * 1000;
  return Date.now() >= (expiresAt - bufferTime);
};

// 자동 토큰 갱신 설정 - 안전한 버전
let refreshTimeout: NodeJS.Timeout | null = null;

export const setupAutoTokenRefresh = () => {
  // 기존 타임아웃 클리어
  if (refreshTimeout) {
    clearTimeout(refreshTimeout);
    refreshTimeout = null;
  }

  const store = useAuthStore.getState();
  
  if (!store.isAuthenticated || !store.expiresAt || !store.accessToken) {
    return;
  }
  
  // 토큰이 이미 만료되었으면 즉시 로그아웃
  if (isTokenExpired(store.expiresAt)) {
    console.warn('Token already expired, logging out');
    store.logout();
    return;
  }
  
  const timeUntilRefresh = store.expiresAt - Date.now() - (10 * 60 * 1000); // 10분 전에 갱신
  
  if (timeUntilRefresh > 0) {
    refreshTimeout = setTimeout(async () => {
      try {
        const currentState = useAuthStore.getState();
        
        // 상태가 여전히 유효한지 확인
        if (currentState.isAuthenticated && currentState.refreshToken) {
          await currentState.refreshAccessToken();
          setupAutoTokenRefresh(); // 재귀적으로 다음 갱신 스케줄
        }
      } catch (error) {
        console.warn('Auto token refresh failed:', error);
        // 자동 갱신 실패 시에는 조용히 처리 (사용자가 다음 API 호출 시 처리됨)
      }
    }, timeUntilRefresh);
  }
};

// 초기화 시 토큰 상태 확인 - 무한루프 완전 방지
let isInitializing = false;
let isInitialized = false;

export const initializeAuth = async () => {
  // 이미 초기화 중이거나 완료되었으면 스킵
  if (isInitializing || isInitialized) {
    return;
  }

  isInitializing = true;
  
  try {
    const store = useAuthStore.getState();
    
    // 저장된 인증 정보가 있는지 확인
    if (store.isAuthenticated && store.accessToken && store.expiresAt) {
      // 토큰이 만료되었는지 확인
      if (isTokenExpired(store.expiresAt)) {
        console.warn('Stored token expired, attempting refresh');
        
        if (store.refreshToken) {
          try {
            await store.refreshAccessToken();
            setupAutoTokenRefresh();
          } catch (error) {
            console.warn('Failed to refresh expired token:', error);
            store.logout();
          }
        } else {
          store.logout();
        }
      } else {
        // 토큰이 유효하면 자동 갱신 스케줄 설정
        setupAutoTokenRefresh();
      }
    }
    
    isInitialized = true;
  } finally {
    isInitializing = false;
  }
};