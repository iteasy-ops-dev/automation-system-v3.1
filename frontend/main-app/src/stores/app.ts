/**
 * App Store
 * 
 * 애플리케이션 전역 상태 관리
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // UI 상태
  isDarkMode: boolean;
  sidebarCollapsed: boolean;
  currentPage: string;
  
  // 알림 상태
  notifications: Notification[];
  unreadCount: number;
  
  // 설정
  settings: AppSettings;
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
}

interface AppSettings {
  language: 'ko' | 'en';
  timezone: string;
  dateFormat: string;
  autoRefresh: boolean;
  refreshInterval: number; // seconds
  soundEnabled: boolean;
  emailNotifications: boolean;
}

interface AppActions {
  // UI 액션
  toggleDarkMode: () => void;
  toggleSidebar: () => void;
  setCurrentPage: (page: string) => void;
  
  // 알림 액션
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  
  // 설정 액션
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetSettings: () => void;
}

interface AppStore extends AppState, AppActions {}

const defaultSettings: AppSettings = {
  language: 'ko',
  timezone: 'Asia/Seoul',
  dateFormat: 'YYYY-MM-DD HH:mm:ss',
  autoRefresh: true,
  refreshInterval: 30,
  soundEnabled: true,
  emailNotifications: true,
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // 초기 상태
      isDarkMode: false,
      sidebarCollapsed: false,
      currentPage: 'dashboard',
      notifications: [],
      unreadCount: 0,
      settings: defaultSettings,

      // UI 액션
      toggleDarkMode: () => {
        const { isDarkMode } = get();
        const newMode = !isDarkMode;
        
        // HTML 클래스 업데이트
        if (newMode) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        
        set({ isDarkMode: newMode });
      },
      toggleSidebar: () => {
        set(state => ({ sidebarCollapsed: !state.sidebarCollapsed }));
      },

      setCurrentPage: (page: string) => {
        set({ currentPage: page });
      },

      // 알림 액션
      addNotification: (notification) => {
        const { notifications } = get();
        const newNotification: Notification = {
          ...notification,
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          read: false,
        };

        const updatedNotifications = [newNotification, ...notifications];
        const unreadCount = updatedNotifications.filter(n => !n.read).length;

        set({
          notifications: updatedNotifications,
          unreadCount,
        });
      },

      markNotificationRead: (id: string) => {
        const { notifications } = get();
        const updatedNotifications = notifications.map(n =>
          n.id === id ? { ...n, read: true } : n
        );
        const unreadCount = updatedNotifications.filter(n => !n.read).length;

        set({
          notifications: updatedNotifications,
          unreadCount,
        });
      },

      markAllNotificationsRead: () => {
        const { notifications } = get();
        const updatedNotifications = notifications.map(n => ({ ...n, read: true }));

        set({
          notifications: updatedNotifications,
          unreadCount: 0,
        });
      },

      removeNotification: (id: string) => {
        const { notifications } = get();
        const updatedNotifications = notifications.filter(n => n.id !== id);
        const unreadCount = updatedNotifications.filter(n => !n.read).length;

        set({
          notifications: updatedNotifications,
          unreadCount,
        });
      },

      clearAllNotifications: () => {
        set({
          notifications: [],
          unreadCount: 0,
        });
      },
      // 설정 액션
      updateSettings: (newSettings: Partial<AppSettings>) => {
        const { settings } = get();
        set({
          settings: { ...settings, ...newSettings },
        });
      },

      resetSettings: () => {
        set({ settings: defaultSettings });
      },
    }),
    {
      name: 'app-storage',
      partialize: (state) => ({
        isDarkMode: state.isDarkMode,
        sidebarCollapsed: state.sidebarCollapsed,
        settings: state.settings,
        notifications: state.notifications,
        unreadCount: state.unreadCount,
      }),
    }
  )
);

// 다크모드 초기화
export const initializeDarkMode = () => {
  const { isDarkMode } = useAppStore.getState();
  
  if (isDarkMode) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

// 알림 헬퍼 함수들
export const notificationHelpers = {
  success: (title: string, message: string) => {
    useAppStore.getState().addNotification({
      type: 'success',
      title,
      message,
    });
  },
  
  error: (title: string, message: string) => {
    useAppStore.getState().addNotification({
      type: 'error',
      title,
      message,
    });
  },
  
  warning: (title: string, message: string) => {
    useAppStore.getState().addNotification({
      type: 'warning',
      title,
      message,
    });
  },
  
  info: (title: string, message: string) => {
    useAppStore.getState().addNotification({
      type: 'info',
      title,
      message,
    });
  },
};