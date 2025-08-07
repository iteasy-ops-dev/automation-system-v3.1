/**
 * Settings Page - 설정 페이지
 * 
 * 사용자 설정 및 시스템 설정 관리
 */

import React, { useState } from 'react';
import toast from 'react-hot-toast';

import { useAuthStore } from '@/stores';

interface SettingsPageProps {
  className?: string;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ className = '' }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'system'>('profile');

  // 사용자 정보 조회 (Zustand store에서)
  const { user } = useAuthStore();

  // 테마 설정
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  const handleThemeToggle = () => {
    const newDarkMode = !isDarkMode;
    setIsDarkMode(newDarkMode);

    if (newDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }

    toast.success(`${newDarkMode ? '다크' : '라이트'} 모드로 변경되었습니다.`);
  };

  // 알림 설정
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    deviceAlerts: true,
    workflowUpdates: true,
    systemMaintenance: true,
  });

  const handleNotificationChange = (key: keyof typeof notificationSettings) => {
    setNotificationSettings(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
    toast.success('알림 설정이 저장되었습니다.');
  };

  const tabs = [
    { id: 'profile', name: '프로필', icon: 'user' },
    { id: 'preferences', name: '환경설정', icon: 'cog' },
    { id: 'system', name: '시스템', icon: 'server' },
  ] as const;

  const getTabIcon = (iconName: string) => {
    switch (iconName) {
      case 'user':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'cog':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case 'server':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">설정</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          사용자 환경설정 및 시스템 설정을 관리할 수 있습니다.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* 사이드바 탭 */}
        <div className="lg:w-64">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md ${
                  activeTab === tab.id
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                {getTabIcon(tab.icon)}
                <span className="ml-3">{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* 메인 콘텐츠 */}
        <div className="flex-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            {/* 프로필 탭 */}
            {activeTab === 'profile' && (
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">사용자 프로필</h3>
                
                {user ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          사용자 ID
                        </label>
                        <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                          {user.id}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          사용자명
                        </label>
                        <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                          {user.username}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          역할
                        </label>
                        <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                          {user.role}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          가입일
                        </label>
                        <div className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                          {(user as any).createdAt ? new Date((user as any).createdAt).toLocaleDateString('ko-KR') : '-'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        사용자 정보는 읽기 전용입니다. 변경이 필요한 경우 관리자에게 문의하세요.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">사용자 정보를 불러오는 중...</p>
                  </div>
                )}
              </div>
            )}

            {/* 환경설정 탭 */}
            {activeTab === 'preferences' && (
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">환경설정</h3>
                
                <div className="space-y-6">
                  {/* 테마 설정 */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">테마</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">다크 모드</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">어두운 테마를 사용합니다</p>
                      </div>
                      <button
                        onClick={handleThemeToggle}
                        className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                          isDarkMode ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                            isDarkMode ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* 알림 설정 */}
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">알림 설정</h4>
                    <div className="space-y-4">
                      {Object.entries(notificationSettings).map(([key, value]) => {
                        const labels: Record<string, { title: string; description: string }> = {
                          emailNotifications: {
                            title: '이메일 알림',
                            description: '중요한 알림을 이메일로 받습니다'
                          },
                          pushNotifications: {
                            title: '푸시 알림',
                            description: '브라우저 푸시 알림을 받습니다'
                          },
                          deviceAlerts: {
                            title: '장비 알림',
                            description: '장비 상태 변경 시 알림을 받습니다'
                          },
                          workflowUpdates: {
                            title: '워크플로우 업데이트',
                            description: '워크플로우 실행 상태 알림을 받습니다'
                          },
                          systemMaintenance: {
                            title: '시스템 점검',
                            description: '시스템 점검 및 업데이트 알림을 받습니다'
                          },
                        };

                        const label = labels[key];
                        if (!label) return null;

                        return (
                          <div key={key} className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-gray-600 dark:text-gray-400">{label.title}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{label.description}</p>
                            </div>
                            <button
                              onClick={() => handleNotificationChange(key as keyof typeof notificationSettings)}
                              className={`relative inline-flex flex-shrink-0 h-6 w-11 border-2 border-transparent rounded-full cursor-pointer transition-colors ease-in-out duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                                value ? 'bg-blue-600' : 'bg-gray-200'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition ease-in-out duration-200 ${
                                  value ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 언어 설정 */}
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">언어</h4>
                    <select className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                      <option value="ko">한국어</option>
                      <option value="en" disabled>English (준비 중)</option>
                      <option value="ja" disabled>日本語 (준비 중)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* 시스템 탭 */}
            {activeTab === 'system' && (
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-6">시스템 정보</h3>
                
                <div className="space-y-6">
                  {/* 시스템 버전 */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">버전 정보</h4>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                      <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">시스템 버전</dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">v3.1.0</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">빌드 날짜</dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">2024-01-15</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">API 버전</dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">v1.0.0</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">환경</dt>
                          <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">Development</dd>
                        </div>
                      </dl>
                    </div>
                  </div>

                  {/* API 키 관리 (향후 확장용) */}
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">API 키 관리</h4>
                    <div className="bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
                      <div className="flex">
                        <div className="flex-shrink-0">
                          <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="ml-3">
                          <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            준비 중인 기능
                          </h3>
                          <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                            <p>API 키 관리 기능은 향후 버전에서 제공될 예정입니다.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 데이터 관리 */}
                  <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">데이터 관리</h4>
                    <div className="space-y-3">
                      <button
                        onClick={() => toast('데이터 내보내기 기능은 준비 중입니다.')}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        데이터 내보내기
                      </button>
                      
                      <button
                        onClick={() => toast('데이터 가져오기 기능은 준비 중입니다.')}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ml-3"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                        데이터 가져오기
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
