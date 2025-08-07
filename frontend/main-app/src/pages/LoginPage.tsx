/**
 * Login Page
 * 
 * 로그인 페이지
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '@/components/auth';
import { useAuthStore, isTokenExpired } from '@/stores';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, accessToken, expiresAt } = useAuthStore();

  // 실제로 유효한 토큰이 있는 경우에만 리다이렉트
  useEffect(() => {
    if (isAuthenticated && accessToken && !isTokenExpired(expiresAt)) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, accessToken, expiresAt, navigate]);

  const handleLoginSuccess = () => {
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <LoginForm onSuccess={handleLoginSuccess} />
      </div>
    </div>
  );
};