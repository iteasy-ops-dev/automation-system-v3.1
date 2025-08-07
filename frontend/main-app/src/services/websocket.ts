/**
 * WebSocket Service - Socket.IO 기반 구현 (개선됨)
 * 
 * TASK-2 WebSocket 계약 100% 준수
 * shared/contracts/v1.0/events/websocket-messages.json 기반
 * 
 * 🔥 핵심 개선사항:
 * - React 훅 규칙 준수를 위한 토큰 주입 방식
 * - 연결 상태 개선된 관리
 * - 인증 에러 처리 강화
 */

import io, { Socket } from 'socket.io-client';
import type {
  WebSocketMessage,
  WebSocketMessageType,
  WebSocketState,
  WebSocketManager,
  TypedWebSocketMessage,
} from '@/types';

type MessageHandler<T extends WebSocketMessageType> = (message: TypedWebSocketMessage<T>) => void;

export class WebSocketService implements WebSocketManager {
  private socket: Socket | null = null;
  private state: WebSocketState = {
    isConnected: false,
    isConnecting: false,
    error: null,
    retryCount: 0,
    lastHeartbeat: null,
  };
  
  private readonly url: string;
  private readonly maxRetries = 3;
  private readonly heartbeatInterval = 30000; // 30초
  
  private handlers = new Map<WebSocketMessageType, Set<MessageHandler<any>>>();
  private heartbeatTimer: NodeJS.Timeout | null = null;
  
  // 🔥 토큰을 외부에서 주입받도록 수정
  private currentToken: string | null = null;

  constructor() {
    const host = import.meta.env.VITE_WS_HOST || 'localhost:8080';
    this.url = `http://${host}`;
  }

  /**
   * 🔥 토큰 설정 메서드 (React 컴포넌트에서 호출)
   */
  setAuthToken(token: string | null): void {
    console.log('[WebSocket] Token updated:', token ? `${token.substring(0, 20)}...` : 'N/A');
    this.currentToken = token;
    
    // 이미 연결된 상태에서 토큰이 변경된 경우 재연결
    if (this.socket?.connected && token) {
      console.log('[WebSocket] Token changed, reconnecting...');
      this.disconnect();
      setTimeout(() => this.connect(), 100);
    }
  }

  /**
   * Socket.IO 연결
   */
  connect(): void {
    // 🔥 핵심 수정: 연결 상태를 더 엄격하게 체크
    const currentState = this.getState();
    
    console.log('[WebSocket] Connect called - Current state:', {
      isConnected: currentState.isConnected,
      isConnecting: currentState.isConnecting,
      socketConnected: this.socket?.connected,
      socketExists: !!this.socket
    });

    if (this.socket?.connected) {
      console.log('[WebSocket] Already connected - socket.connected = true');
      return;
    }
    
    if (this.state.isConnecting) {
      console.log('[WebSocket] Already connecting - isConnecting = true');
      return;
    }

    const token = this.currentToken;
    
    console.log('[WebSocket] Auth token exists:', !!token);
    console.log('[WebSocket] Token preview:', token ? `${token.substring(0, 20)}...` : 'N/A');
    
    if (!token) {
      console.warn('[WebSocket] No auth token found, cannot connect');
      this.setState({ 
        error: 'Authentication required. Please login first.',
        isConnected: false,
        isConnecting: false
      });
      return;
    }

    this.setState({ isConnecting: true, error: null });

    try {
      console.log('[WebSocket] Connecting to:', this.url);
      console.log('[WebSocket] Connection options:', {
        path: '/ws',
        transports: ['websocket', 'polling'],
        hasToken: !!token,
        tokenLength: token.length,
        reconnection: true,
        forceNew: true
      });
      
      // Socket.IO 연결 설정 - 간소화된 인증 방식
      this.socket = io(this.url, {
        path: '/ws',
        transports: ['websocket', 'polling'],
        // 기본 auth 방식 (백엔드와 일치)
        auth: {
          token: token
        },
        // 연결 옵션
        reconnection: true,
        reconnectionAttempts: this.maxRetries,
        reconnectionDelay: 1000,
        forceNew: true,
        timeout: 10000
      });

      this.setupEventListeners();
      this.setupMessageHandlers();
    } catch (error) {
      console.error('[WebSocket] Connection initialization error:', error);
      this.handleError(error as Error);
    }
  }

  /**
   * 🔥 강제 재연결 메서드 추가
   */
  forceReconnect(): void {
    console.log('[WebSocket] Force reconnect triggered');
    this.disconnect();
    setTimeout(() => {
      this.connect();
    }, 1000);
  }

  /**
   * WebSocket 연결 해제
   */
  disconnect(): void {
    console.log('[WebSocket] Disconnecting...');
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }

    this.setState({ 
      isConnected: false, 
      isConnecting: false, 
      error: null 
    });
  }

  /**
   * 메시지 전송 (WebSocketManager 인터페이스)
   */
  send<T extends WebSocketMessageType>(message: TypedWebSocketMessage<T>): void {
    if (!this.socket?.connected) {
      console.error('[WebSocket] Cannot send message - not connected');
      throw new Error('WebSocket not connected');
    }

    console.log('[WebSocket] Sending message:', message.type, message);
    this.socket.emit('message', message);
  }

  /**
   * 메시지 전송 (backward compatibility)
   */
  sendMessage<T extends WebSocketMessageType>(message: TypedWebSocketMessage<T>): void {
    this.send(message);
  }

  /**
   * 이벤트 구독 (WebSocketManager 인터페이스)
   */
  subscribe<T extends WebSocketMessageType>(
    type: T, 
    handler: (message: TypedWebSocketMessage<T>) => void
  ): () => void {
    this.on(type, handler);
    
    // unsubscribe 함수 반환
    return () => {
      this.off(type, handler);
    };
  }

  /**
   * 이벤트 핸들러 등록
   */
  on<T extends WebSocketMessageType>(type: T, handler: MessageHandler<T>): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  /**
   * 이벤트 핸들러 제거
   */
  off<T extends WebSocketMessageType>(type: T, handler: MessageHandler<T>): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * 현재 상태 반환
   */
  getState(): WebSocketState {
    return { ...this.state };
  }

  /**
   * Socket.IO 이벤트 리스너 설정
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // 연결 성공
    this.socket.on('connect', () => {
      console.log('[WebSocket] Connected successfully!');
      this.setState({ 
        isConnected: true, 
        isConnecting: false, 
        error: null, 
        retryCount: 0 
      });
      this.startHeartbeat();
    });

    // 연결 실패
    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      this.handleConnectionError(error);
    });

    // 연결 해제
    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      this.setState({ 
        isConnected: false, 
        isConnecting: false,
        error: `Connection lost: ${reason}`
      });
      this.stopHeartbeat();
    });

    // 인증 오류
    this.socket.on('auth_error', (error) => {
      console.error('[WebSocket] Authentication error:', error);
      this.setState({ 
        isConnected: false,
        isConnecting: false,
        error: 'Authentication failed. Please login again.'
      });
    });

    // 재연결 시도
    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[WebSocket] Reconnected after', attemptNumber, 'attempts');
      this.setState({ 
        isConnected: true, 
        isConnecting: false, 
        error: null 
      });
    });

    // 재연결 실패
    this.socket.on('reconnect_failed', () => {
      console.error('[WebSocket] Reconnection failed');
      this.setState({ 
        isConnected: false, 
        isConnecting: false,
        error: 'Failed to reconnect to server'
      });
    });

    // Pong 응답
    this.socket.on('pong', () => {
      this.setState({ lastHeartbeat: new Date().toISOString() });
    });
  }

  /**
   * 메시지 핸들러 설정
   */
  private setupMessageHandlers(): void {
    if (!this.socket) return;

    this.socket.on('message', (data: WebSocketMessage) => {
      console.log('[WebSocket] Message received:', data.type, data);
      
      const handlers = this.handlers.get(data.type as WebSocketMessageType);
      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(data as TypedWebSocketMessage<any>);
          } catch (error) {
            console.error('[WebSocket] Handler error:', error);
          }
        });
      } else {
        console.warn('[WebSocket] No handlers for message type:', data.type);
      }
    });
  }

  /**
   * 상태 업데이트
   */
  private setState(updates: Partial<WebSocketState>): void {
    this.state = { ...this.state, ...updates };
  }

  /**
   * 에러 처리
   */
  private handleError(error: Error): void {
    console.error('[WebSocket] Error:', error);
    this.setState({ 
      isConnected: false, 
      isConnecting: false, 
      error: error.message 
    });
  }

  /**
   * 연결 에러 처리
   */
  private handleConnectionError(error: any): void {
    const errorMessage = error?.message || error?.description || 'Connection failed';
    console.error('[WebSocket] Connection error details:', {
      message: errorMessage,
      type: error?.type,
      description: error?.description,
      context: error?.context,
      transport: error?.transport
    });

    const currentRetryCount = this.state.retryCount + 1;
    
    if (currentRetryCount >= this.maxRetries) {
      console.error('[WebSocket] Max retry attempts reached');
      this.setState({ 
        isConnected: false,
        isConnecting: false,
        error: `Connection failed after ${this.maxRetries} attempts: ${errorMessage}`,
        retryCount: currentRetryCount
      });
    } else {
      this.setState({ 
        isConnected: false,
        isConnecting: false,
        error: `Retry ${currentRetryCount}/${this.maxRetries}: ${errorMessage}`,
        retryCount: currentRetryCount
      });
    }
  }

  /**
   * 하트비트 시작
   */
  private startHeartbeat(): void {
    this.stopHeartbeat(); // 기존 타이머 제거
    
    this.heartbeatTimer = setInterval(() => {
      if (this.socket?.connected) {
        console.log('[WebSocket] Sending heartbeat...');
        this.socket.emit('ping');
      }
    }, this.heartbeatInterval);
  }

  /**
   * 하트비트 중지
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

// 싱글톤 인스턴스
export const webSocketService = new WebSocketService();

// 기본 내보내기
export default webSocketService;
