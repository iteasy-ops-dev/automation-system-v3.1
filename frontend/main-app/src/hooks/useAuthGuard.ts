/**
 * Auth Guard Hook
 * 
 * 인증 보호 로직
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores';

export const useAuthGuard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate]);

  return { isAuthenticated, isLoading };
};