/**
 * Main Layout Component
 * 
 * 애플리케이션 주 레이아웃
 */

import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useWebSocketStore } from '@/stores';
import { useAuthStore } from '@/stores/auth';
import { webSocketService } from '@/services';
import { cn } from '@/utils';

export const MainLayout: React.FC = () => {
  const { connect, isConnected } = useWebSocketStore();
  const { accessToken } = useAuthStore();

  // WebSocket 연결 초기화 (토큰이 있을 때만)
  useEffect(() => {
    if (accessToken && !isConnected) {
      // 토큰을 WebSocket 서비스에 설정
      webSocketService.setAuthToken(accessToken);
      connect();
    }
  }, [accessToken, connect, isConnected]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* 사이드바 */}
      <Sidebar />
      
      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* 헤더 */}
        <Header />
        
        {/* 콘텐츠 영역 */}
        <main 
          className={cn(
            'flex-1 overflow-auto p-6',
            'transition-all duration-300'
          )}
        >
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};