/**
 * WebSocket Store
 * 
 * WebSocket 연결 상태 및 메시지 관리
 */

import { create } from 'zustand';
import { webSocketService } from '@/services';
import type { WebSocketState, WebSocketMessage } from '@/types';

interface WebSocketStore extends WebSocketState {
  // 액션
  connect: () => void;
  disconnect: () => void;
  updateState: (newState: Partial<WebSocketState>) => void;
  
  // 메시지 처리
  lastMessage: WebSocketMessage | null;
  messageHistory: WebSocketMessage[];
  addMessage: (message: WebSocketMessage) => void;
  clearHistory: () => void;
}

export const useWebSocketStore = create<WebSocketStore>((set, get) => ({
  // 초기 상태
  isConnected: false,
  isConnecting: false,
  error: null,
  retryCount: 0,
  lastHeartbeat: null,
  lastMessage: null,
  messageHistory: [],

  // 액션
  connect: () => {
    webSocketService.connect();
    set({ isConnecting: true });
  },

  disconnect: () => {
    webSocketService.disconnect();
    set({
      isConnected: false,
      isConnecting: false,
      error: null,
      retryCount: 0,
    });
  },

  updateState: (newState: Partial<WebSocketState>) => {
    set(newState);
  },

  addMessage: (message: WebSocketMessage) => {
    const { messageHistory } = get();
    const maxHistorySize = 100; // 최대 100개 메시지 저장
    
    const newHistory = [message, ...messageHistory].slice(0, maxHistorySize);
    
    set({
      lastMessage: message,
      messageHistory: newHistory,
    });
  },

  clearHistory: () => {
    set({
      lastMessage: null,
      messageHistory: [],
    });
  },
}));

// WebSocket 상태 동기화 설정
export const syncWebSocketState = () => {
  const updateStore = useWebSocketStore.getState().updateState;
  
  // WebSocket 서비스 상태와 스토어 동기화
  const checkState = () => {
    const wsState = webSocketService.getState();
    updateStore(wsState);
  };
  
  // 주기적으로 상태 확인 (1초마다)
  setInterval(checkState, 1000);
};