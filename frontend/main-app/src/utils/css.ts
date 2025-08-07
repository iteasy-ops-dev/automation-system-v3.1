/**
 * CSS 유틸리티 함수
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind CSS 클래스 병합
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 조건부 클래스 적용
 */
export function conditionalClass(
  condition: boolean,
  trueClass: string,
  falseClass?: string
): string {
  return condition ? trueClass : (falseClass || '');
}

/**
 * 상태별 색상 클래스 반환
 */
export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    // 일반 상태
    active: 'text-green-600 bg-green-50 border-green-200',
    inactive: 'text-gray-600 bg-gray-50 border-gray-200',
    pending: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    error: 'text-red-600 bg-red-50 border-red-200',
    
    // 장비 상태
    online: 'text-green-600 bg-green-50 border-green-200',
    offline: 'text-gray-600 bg-gray-50 border-gray-200',
    maintenance: 'text-blue-600 bg-blue-50 border-blue-200',
    
    // 실행 상태
    running: 'text-blue-600 bg-blue-50 border-blue-200',
    completed: 'text-green-600 bg-green-50 border-green-200',
    failed: 'text-red-600 bg-red-50 border-red-200',
  };
  
  return statusColors[status.toLowerCase()] || 'text-gray-600 bg-gray-50 border-gray-200';
}

/**
 * 알림 타입별 색상 클래스 반환
 */
export function getNotificationColor(type: string): string {
  const notificationColors: Record<string, string> = {
    info: 'text-blue-600 bg-blue-50 border-blue-200',
    success: 'text-green-600 bg-green-50 border-green-200',
    warning: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    error: 'text-red-600 bg-red-50 border-red-200',
  };
  
  return notificationColors[type] || notificationColors.info;
}