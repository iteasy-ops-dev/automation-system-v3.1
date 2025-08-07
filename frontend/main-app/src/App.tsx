/**
 * Main App Component
 * 
 * 애플리케이션 진입점
 */

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

// Components
import { MainLayout } from '@/components/layout';
import { ProtectedRoute } from '@/components/ProtectedRoute';

// Pages
import { LoginPage, DashboardPage, ChatPage, DevicesPage, MCPServersPage, LLMManagementPage, SettingsPage } from '@/pages';

// Stores
import { initializeDarkMode } from '@/stores';

// Create QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1, // 3에서 1로 줄임 (무한루프 방지)
      staleTime: 5 * 60 * 1000, // 5분
      refetchOnWindowFocus: false, // 포커스 시 재요청 방지
      onError: (error: any) => {
        // 401 에러는 API 인터셉터에서 처리하므로 여기서는 무시
        if (error?.status === 401) {
          return;
        }
        console.error('Query error:', error);
      },
    },
  },
});

// Placeholder components for missing pages
const WorkflowsPage: React.FC = () => (
  <div className="text-center py-12">
    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">워크플로우 관리</h2>
    <p className="text-gray-600 dark:text-gray-400">곧 구현될 예정입니다.</p>
  </div>
);

// Remove placeholder components as they are now implemented
// const DevicesPage: React.FC = () => ...
// const SettingsPage: React.FC = () => ...

export const App: React.FC = () => {
  useEffect(() => {
    // 다크모드 초기화만 (인증 초기화 제거로 무한루프 완전 방지)
    initializeDarkMode();
  }, []); // 빈 의존성 배열로 한 번만 실행

  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="App">
          <Routes>
            {/* 공개 라우트 */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* 보호된 라우트 */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="devices" element={<DevicesPage />} />
              <Route path="mcp" element={<MCPServersPage />} />
              <Route path="llm" element={<LLMManagementPage />} />
              <Route path="workflows" element={<WorkflowsPage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            
            {/* 404 처리 */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          
          {/* 토스트 알림 */}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              className: 'dark:bg-gray-800 dark:text-gray-100',
            }}
          />
        </div>
      </Router>
    </QueryClientProvider>
  );
};
