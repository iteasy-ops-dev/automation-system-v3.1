/**
 * Login Form Component
 * 
 * TASK-2 Gateway Auth 계약 100% 준수
 */

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { Button, Input, Card, CardContent } from '@/components/ui';
import { useAuthStore } from '@/stores';
import { AUTH_CONSTANTS, type LoginRequest } from '@/types';
import { cn } from '@/utils';

// 계약 기반 검증 스키마
const loginSchema = z.object({
  username: z
    .string()
    .min(AUTH_CONSTANTS.VALIDATION.USERNAME_MIN_LENGTH, `사용자명은 최소 ${AUTH_CONSTANTS.VALIDATION.USERNAME_MIN_LENGTH}자 이상이어야 합니다`)
    .max(AUTH_CONSTANTS.VALIDATION.USERNAME_MAX_LENGTH, `사용자명은 최대 ${AUTH_CONSTANTS.VALIDATION.USERNAME_MAX_LENGTH}자 이하여야 합니다`)
    .regex(AUTH_CONSTANTS.VALIDATION.USERNAME_PATTERN, '사용자명은 영문, 숫자, 하이픈, 언더스코어만 사용 가능합니다'),
  password: z
    .string()
    .min(AUTH_CONSTANTS.VALIDATION.PASSWORD_MIN_LENGTH, `비밀번호는 최소 ${AUTH_CONSTANTS.VALIDATION.PASSWORD_MIN_LENGTH}자 이상이어야 합니다`)
    .max(AUTH_CONSTANTS.VALIDATION.PASSWORD_MAX_LENGTH, `비밀번호는 최대 ${AUTH_CONSTANTS.VALIDATION.PASSWORD_MAX_LENGTH}자 이하여야 합니다`),
});

interface LoginFormProps {
  onSuccess?: () => void;
  className?: string;
}

export const LoginForm: React.FC<LoginFormProps> = ({ 
  onSuccess,
  className 
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading, error, clearError } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: LoginRequest) => {
    try {
      clearError();
      await login(data);
      onSuccess?.();
    } catch (err) {
      if (err instanceof Error) {
        setError('root', { 
          type: 'manual', 
          message: err.message 
        });
      }
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <Card className={cn('w-full max-w-md mx-auto', className)}>
      <CardContent className="pt-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            로그인
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            통합 자동화 시스템에 로그인하세요
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="사용자명"
            {...register('username')}
            error={errors.username?.message}
            placeholder="사용자명을 입력하세요"
            autoComplete="username"
            autoFocus
          />

          <Input
            label="비밀번호"
            type={showPassword ? 'text' : 'password'}
            {...register('password')}
            error={errors.password?.message}
            placeholder="비밀번호를 입력하세요"
            autoComplete="current-password"
            rightIcon={
              <button
                type="button"
                onClick={togglePasswordVisibility}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            }
          />

          {(error || errors.root) && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md dark:bg-red-900/20 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">
                {error || errors.root?.message}
              </p>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={isLoading || isSubmitting}
            icon={<LogIn size={16} />}
          >
            로그인
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            통합 자동화 시스템 v3.1
          </p>
        </div>
      </CardContent>
    </Card>
  );
};