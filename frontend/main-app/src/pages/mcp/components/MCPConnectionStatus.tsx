/**
 * MCP Connection Status Component
 * 
 * MCP 서버 연결 상태를 표시하는 컴포넌트
 */

import React from 'react';
import type { MCPServerStatus, MCPConnectionStatus as MCPConnectionStatusType } from '@/types';

interface MCPConnectionStatusProps {
  status: MCPServerStatus;
  connectionStatus?: MCPConnectionStatusType;
  className?: string;
}

const statusConfig: Record<MCPServerStatus, { color: string; text: string; bgColor: string }> = {
  active: {
    color: 'text-green-800 dark:text-green-200',
    text: '활성',
    bgColor: 'bg-green-100 dark:bg-green-900',
  },
  inactive: {
    color: 'text-gray-800 dark:text-gray-200', 
    text: '비활성',
    bgColor: 'bg-gray-100 dark:bg-gray-900',
  },
  error: {
    color: 'text-red-800 dark:text-red-200',
    text: '에러',
    bgColor: 'bg-red-100 dark:bg-red-900',
  },
  connected: {
    color: 'text-green-800 dark:text-green-200',
    text: '연결됨',
    bgColor: 'bg-green-100 dark:bg-green-900',
  },
  disconnected: {
    color: 'text-gray-800 dark:text-gray-200',
    text: '연결 안됨',
    bgColor: 'bg-gray-100 dark:bg-gray-900',
  },
  connecting: {
    color: 'text-yellow-800 dark:text-yellow-200',
    text: '연결 중',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900',
  },
};

const connectionConfig: Record<MCPConnectionStatusType, { color: string; text: string; icon: string }> = {
  connected: {
    color: 'text-green-600 dark:text-green-400',
    text: '연결됨',
    icon: 'connected',
  },
  disconnected: {
    color: 'text-gray-600 dark:text-gray-400',
    text: '연결 안됨',
    icon: 'disconnected',
  },
  connecting: {
    color: 'text-yellow-600 dark:text-yellow-400',
    text: '연결 중',
    icon: 'connecting',
  },
  error: {
    color: 'text-red-600 dark:text-red-400',
    text: '연결 오류',
    icon: 'error',
  },
};

export const MCPConnectionStatus: React.FC<MCPConnectionStatusProps> = ({ 
  status, 
  connectionStatus,
  className = '' 
}) => {
  const statusCfg = statusConfig[status];
  const connectionCfg = connectionStatus ? connectionConfig[connectionStatus] : null;

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* 서버 상태 */}
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusCfg.bgColor} ${statusCfg.color}`}
      >
        <span 
          className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
            status === 'active' ? 'bg-green-500' : 
            status === 'error' ? 'bg-red-500' : 
            'bg-gray-500'
          }`}
        />
        {statusCfg.text}
      </span>

      {/* 연결 상태 */}
      {connectionCfg && (
        <div className={`flex items-center text-xs ${connectionCfg.color}`}>
          {connectionCfg.icon === 'connected' && (
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          {connectionCfg.icon === 'disconnected' && (
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {connectionCfg.icon === 'connecting' && (
            <svg className="w-3 h-3 mr-1 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          {connectionCfg.icon === 'error' && (
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          )}
          {connectionCfg.text}
        </div>
      )}
    </div>
  );
};

export default MCPConnectionStatus;
