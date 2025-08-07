/**
 * Header Component
 * 
 * 상단 헤더
 */

import React from 'react';
import { Moon, Sun, Menu } from 'lucide-react';
import { useAppStore } from '@/stores';
import { Button } from '@/components/ui';
import { cn } from '@/utils';

interface HeaderProps {
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ className }) => {
  const { isDarkMode, toggleDarkMode, currentPage } = useAppStore();

  const pageTitle = {
    dashboard: '대시보드',
    devices: '장비 관리',
    chat: '채팅',
    settings: '설정',
  }[currentPage] || '통합 자동화 시스템';

  return (
    <header
      className={cn(
        'bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {/* 모바일에서 사이드바 토글 */}
          <button
            onClick={() => {}} // 나중에 모바일 사이드바 토글 로직 추가
            className="lg:hidden p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <Menu size={20} className="text-gray-600 dark:text-gray-400" />
          </button>

          {/* 페이지 제목 */}
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {pageTitle}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              통합 자동화 시스템 관리
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* 웹소켓 연결 상태 */}
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              연결됨
            </span>
          </div>

          {/* 다크모드 토글 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleDarkMode}
            icon={isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          >
            {isDarkMode ? '라이트' : '다크'}
          </Button>
        </div>
      </div>
    </header>
  );
};