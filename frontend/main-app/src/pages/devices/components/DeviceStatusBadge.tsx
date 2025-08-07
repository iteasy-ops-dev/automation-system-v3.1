/**
 * Device Status Badge Component
 * 
 * 장비 상태를 시각적으로 표시하는 배지 컴포넌트
 */

import React from 'react';

interface DeviceStatusBadgeProps {
  status: string; // DeviceStatus 대신 string으로 변경
  className?: string;
}

const statusConfig: Record<string, { color: string; text: string; bgColor: string; description: string }> = {
  active: {
    color: 'text-green-800 dark:text-green-200',
    text: '활성',
    bgColor: 'bg-green-100 dark:bg-green-900',
    description: '장비가 등록되어 관리 대상임',
  },
  inactive: {
    color: 'text-gray-800 dark:text-gray-200',
    text: '비활성',
    bgColor: 'bg-gray-100 dark:bg-gray-900',
    description: '장비가 일시적으로 관리 제외됨',
  },
  online: {
    color: 'text-green-800 dark:text-green-200',
    text: '온라인',
    bgColor: 'bg-green-100 dark:bg-green-900',
    description: '장비와 연결이 정상적임',
  },
  offline: {
    color: 'text-red-800 dark:text-red-200',
    text: '오프라인',
    bgColor: 'bg-red-100 dark:bg-red-900',
    description: '장비와 연결할 수 없음',
  },
  error: {
    color: 'text-red-800 dark:text-red-200',
    text: '에러',
    bgColor: 'bg-red-100 dark:bg-red-900',
    description: '장비에 문제가 발생함',
  },
  maintenance: {
    color: 'text-yellow-800 dark:text-yellow-200',
    text: '점검중',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900',
    description: '장비가 점검 중임',
  },
};

export const DeviceStatusBadge: React.FC<DeviceStatusBadgeProps> = ({ status, className = '' }) => {
  const config = statusConfig[status] || statusConfig.inactive; // 기본값 설정

  if (!config) {
    // 추가 안전장치
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 ${className}`}>
        알 수 없음
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bgColor} ${config.color} ${className}`}
      title={config.description}
    >
      <span 
        className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
          status === 'active' || status === 'online' ? 'bg-green-500' : 
          status === 'error' || status === 'offline' ? 'bg-red-500' : 
          status === 'maintenance' ? 'bg-yellow-500' : 
          'bg-gray-500'
        }`}
      />
      {config.text}
    </span>
  );
};

export default DeviceStatusBadge;
