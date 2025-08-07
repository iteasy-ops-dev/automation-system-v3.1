/**
 * Card Component
 * 
 * 재사용 가능한 카드 컴포넌트
 */

import React from 'react';
import { cn } from '@/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({
  className,
  children,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn(
      'bg-white rounded-lg shadow-sm border border-gray-200 dark:bg-gray-800 dark:border-gray-700',
      className
    )}
    {...props}
  >
    {children}
  </div>
));

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(({
  className,
  children,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn(
      'px-6 py-4 border-b border-gray-200 dark:border-gray-700',
      className
    )}
    {...props}
  >
    {children}
  </div>
));

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(({
  className,
  children,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn('px-6 py-4', className)}
    {...props}
  >
    {children}
  </div>
));

const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(({
  className,
  children,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn(
      'px-6 py-4 border-t border-gray-200 dark:border-gray-700',
      className
    )}
    {...props}
  >
    {children}
  </div>
));

Card.displayName = 'Card';
CardHeader.displayName = 'CardHeader';
CardContent.displayName = 'CardContent';
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardContent, CardFooter };