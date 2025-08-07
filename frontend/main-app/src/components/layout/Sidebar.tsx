/**
 * Sidebar Component
 * 
 * 네비게이션 사이드바
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Server, 
  MessageSquare, 
  Settings, 
  ChevronLeft,
  LogOut,
  Bell,
  Network,
  Bot
} from 'lucide-react';
import { useAuthStore, useAppStore } from '@/stores';
import { cn } from '@/utils';

interface SidebarProps {
  className?: string;
}

interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
  badge?: number;
}

const navItems: NavItem[] = [
  {
    path: '/dashboard',
    label: '대시보드',
    icon: LayoutDashboard,
  },
  {
    path: '/devices',
    label: '장비 관리',
    icon: Server,
  },
  {
    path: '/mcp',
    label: 'MCP 서버',
    icon: Network,
  },
  {
    path: '/llm',
    label: 'LLM 관리',
    icon: Bot,
  },
  {
    path: '/chat',
    label: '채팅',
    icon: MessageSquare,
  },
  {
    path: '/settings',
    label: '설정',
    icon: Settings,
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ className }) => {
  const { user, logout } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar, unreadCount } = useAppStore();

  const handleLogout = () => {
    logout();
  };

  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      <div className="flex flex-col h-full">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          {!sidebarCollapsed && (
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">AS</span>
              </div>
              <div>
                <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  자동화 시스템
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">v3.1</p>
              </div>
            </div>
          )}
          
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft
              size={16}
              className={cn(
                'text-gray-600 dark:text-gray-400 transition-transform',
                sidebarCollapsed && 'rotate-180'
              )}
            />
          </button>
        </div>

        {/* 네비게이션 */}
        <nav className="flex-1 px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400'
                    : 'text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700',
                  sidebarCollapsed && 'justify-center'
                )
              }
            >
              <item.icon size={16} className="flex-shrink-0" />
              {!sidebarCollapsed && (
                <>
                  <span className="ml-3">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* 하단 사용자 정보 */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          {/* 알림 버튼 */}
          <div className="mb-3">
            <button
              className={cn(
                'flex items-center w-full px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors',
                sidebarCollapsed && 'justify-center'
              )}
            >
              <div className="relative">
                <Bell size={16} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
              {!sidebarCollapsed && <span className="ml-3">알림</span>}
            </button>
          </div>

          {/* 사용자 정보 */}
          {!sidebarCollapsed && user && (
            <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {user.username}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {user.role}
              </p>
            </div>
          )}

          {/* 로그아웃 버튼 */}
          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center w-full px-3 py-2 rounded-md text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors',
              sidebarCollapsed && 'justify-center'
            )}
          >
            <LogOut size={16} />
            {!sidebarCollapsed && <span className="ml-3">로그아웃</span>}
          </button>
        </div>
      </div>
    </div>
  );
};