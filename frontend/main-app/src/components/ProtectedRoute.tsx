/**
 * Protected Route Component - 무한루프 완전 해결
 * 
 * 최소한의 로직으로 무한루프 방지
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore, isTokenExpired } from '@/stores';
import { Loading } from '@/components/ui';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { 
    isAuthenticated, 
    isLoading, 
    accessToken, 
    expiresAt
  } = useAuthStore();

  // 로딩 중일 때
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading size="lg" text="인증 확인 중..." />
      </div>
    );
  }

  // 간단한 검증: 인증되지 않았거나, 토큰이 없거나, 토큰이 만료된 경우
  if (!isAuthenticated || !accessToken || isTokenExpired(expiresAt)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
