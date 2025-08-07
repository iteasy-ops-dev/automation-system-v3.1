/**
 * Input Component
 * 
 * 재사용 가능한 입력 컴포넌트
 */

import React from 'react';
import { cn } from '@/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(({
  className,
  type = 'text',
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  id,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  
  const baseClasses = 'w-full px-3 py-2 border rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';
  const normalClasses = 'border-gray-300 focus:border-primary-500 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
  const errorClasses = 'border-red-500 focus:border-red-500 focus:ring-red-500';

  return (
    <div className="space-y-1">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          {label}
        </label>
      )}
      
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <div className="text-gray-400">
              {leftIcon}
            </div>
          </div>
        )}
        
        <input
          ref={ref}
          type={type}
          id={inputId}
          className={cn(
            baseClasses,
            error ? errorClasses : normalClasses,
            leftIcon && 'pl-10',
            rightIcon && 'pr-10',
            className
          )}
          {...props}
        />
        
        {rightIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <div className="text-gray-400">
              {rightIcon}
            </div>
          </div>
        )}
      </div>
      
      {(error || helperText) && (
        <p className={cn(
          'text-sm',
          error ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'
        )}>
          {error || helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export { Input };