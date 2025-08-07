/**
 * WebSocket Manager
 * 
 * WebSocket 서버 관리 및 메시지 처리
 * 계약: shared/contracts/v1.0/events/websocket-messages.json
 */

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import * as winston from 'winston';
import { JWTAuthService } from '../services/jwt-auth.service';
import { KafkaManager } from '../services/kafka-manager';
import {
  WebSocketMessage,
  WebSocketMessageType,
  AuthenticatedSocket,
  WebSocketEvent,
  SubscriptionOptions,
  MessageMetadata,
  MessagePriority
} from '../types/websocket.types';

export class WebSocketManager {
  private io?: SocketIOServer;
  private logger: winston.Logger;
  private connectedClients: Map<string, AuthenticatedSocket> = new Map();
  private subscriptions: Map<string, Set<string>> = new Map(); // userId -> topics
  private heartbeatInterval?: NodeJS.Timeout;
  private kafkaManager?: KafkaManager;

  constructor(
    private authService: JWTAuthService,
    logger: winston.Logger
  ) {
    this.logger = logger.child({ component: 'WebSocketManager' });
  }

  /**
   * HTTP 서버에 WebSocket 연결
   */
  public attachToServer(httpServer: HttpServer): void {
    // Socket.IO 서버 초기화
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGINS?.split(',') || [
          'http://localhost:3000',
          'http://localhost:3001', 
          'http://localhost:3002'
        ],
        methods: ['GET', 'POST'],
        credentials: true
      },
      path: '/ws',
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupEventHandlers();
    this.startHeartbeat();
  }

  /**
   * Kafka Manager 설정 (옵션)
   */
  public setKafkaManager(kafkaManager: KafkaManager): void {
    this.kafkaManager = kafkaManager;
    this.subscribeToKafkaEvents();
  }

  /**
   * 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    if (!this.io) return;
    
    // 인증 미들웨어
    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth.token || 
                     socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          this.logger.warn('WebSocket 연결 시도 - 토큰 없음', {
            address: socket.handshake.address
          });
          return next(new Error('Authentication required'));
        }

        // JWT 검증
        try {
          const payload = await this.authService.verifyToken(token);
          
          if (!payload.valid) {
            throw new Error(payload.reason || 'Invalid token');
          }
          
          const authSocket = socket as AuthenticatedSocket;
          authSocket.userId = payload.user?.id;
          authSocket.userRole = payload.user?.role;
          authSocket.sessionId = uuidv4();
          
          this.logger.info('WebSocket 인증 성공', {
            userId: authSocket.userId,
            sessionId: authSocket.sessionId
          });
          
          next();
        } catch (error) {
          this.logger.error('WebSocket 인증 실패', { error });
          next(new Error('Invalid token'));
        }
      } catch (error) {
        this.logger.error('WebSocket 인증 처리 오류', { error });
        next(new Error('Authentication error'));
      }
    });

    // 연결 이벤트
    this.io.on(WebSocketEvent.CONNECTION, (socket: AuthenticatedSocket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * 클라이언트 연결 처리
   */
  private handleConnection(socket: AuthenticatedSocket): void {
    const { userId, sessionId } = socket;
    
    if (!userId || !sessionId) {
      socket.disconnect();
      return;
    }

    // 클라이언트 등록
    this.connectedClients.set(socket.id, socket);
    
    // 사용자별 방 참가
    socket.join(`user:${userId}`);
    
    this.logger.info('WebSocket 클라이언트 연결', {
      socketId: socket.id,
      userId,
      sessionId,
      totalClients: this.connectedClients.size
    });

    // 연결 상태 메시지 전송
    this.sendMessage(socket, {
      type: WebSocketMessageType.CONNECTION_STATUS,
      timestamp: new Date().toISOString(),
      payload: {
        connected: true,
        sessionId,
        serverTime: new Date().toISOString()
      },
      metadata: {
        messageId: uuidv4(),
        sessionId,
        version: '1.0.0'
      }
    });

    // 이벤트 핸들러 등록
    socket.on(WebSocketEvent.DISCONNECT, () => this.handleDisconnect(socket));
    socket.on(WebSocketEvent.SUBSCRIBE, (options: SubscriptionOptions) => 
      this.handleSubscribe(socket, options)
    );
    socket.on(WebSocketEvent.UNSUBSCRIBE, (topics: string[]) => 
      this.handleUnsubscribe(socket, topics)
    );
    socket.on(WebSocketEvent.ERROR, (error) => this.handleError(socket, error));
  }

  /**
   * 클라이언트 연결 해제 처리
   */
  private handleDisconnect(socket: AuthenticatedSocket): void {
    const { userId, sessionId } = socket;
    
    // 클라이언트 제거
    this.connectedClients.delete(socket.id);
    
    // 구독 정리
    this.subscriptions.delete(userId || '');
    
    this.logger.info('WebSocket 클라이언트 연결 해제', {
      socketId: socket.id,
      userId,
      sessionId,
      remainingClients: this.connectedClients.size
    });
  }

  /**
   * 토픽 구독 처리
   */
  private handleSubscribe(socket: AuthenticatedSocket, options: SubscriptionOptions): void {
    const { userId } = socket;
    if (!userId) return;

    const { topics = [], filters = {} } = options;
    
    // 사용자 구독 목록 관리
    if (!this.subscriptions.has(userId)) {
      this.subscriptions.set(userId, new Set());
    }
    
    const userTopics = this.subscriptions.get(userId)!;
    topics.forEach(topic => userTopics.add(topic));
    
    // 필터별 방 참가
    if (filters.deviceIds) {
      filters.deviceIds.forEach(deviceId => 
        socket.join(`device:${deviceId}`)
      );
    }
    
    if (filters.workflowIds) {
      filters.workflowIds.forEach(workflowId => 
        socket.join(`workflow:${workflowId}`)
      );
    }
    
    this.logger.debug('WebSocket 구독 추가', {
      userId,
      topics,
      filters
    });
  }

  /**
   * 토픽 구독 해제 처리
   */
  private handleUnsubscribe(socket: AuthenticatedSocket, topics: string[]): void {
    const { userId } = socket;
    if (!userId) return;

    const userTopics = this.subscriptions.get(userId);
    if (!userTopics) return;
    
    topics.forEach(topic => userTopics.delete(topic));
    
    this.logger.debug('WebSocket 구독 해제', {
      userId,
      topics
    });
  }

  /**
   * 에러 처리
   */
  private handleError(socket: AuthenticatedSocket, error: any): void {
    this.logger.error('WebSocket 에러', {
      socketId: socket.id,
      userId: socket.userId,
      error
    });
  }

  /**
   * 메시지 전송
   */
  private sendMessage(socket: Socket, message: WebSocketMessage): void {
    socket.emit(WebSocketEvent.MESSAGE, message);
  }

  /**
   * 브로드캐스트 메시지
   */
  public broadcast(message: WebSocketMessage, room?: string): void {
    if (!this.io) return;
    const emitter = room ? this.io.to(room) : this.io;
    emitter.emit(WebSocketEvent.MESSAGE, message);
  }

  /**
   * 특정 사용자에게 메시지 전송
   */
  public sendToUser(userId: string, message: WebSocketMessage): void {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(WebSocketEvent.MESSAGE, message);
  }

  /**
   * 특정 장비 구독자에게 메시지 전송
   */
  public sendToDeviceSubscribers(deviceId: string, message: WebSocketMessage): void {
    if (!this.io) return;
    this.io.to(`device:${deviceId}`).emit(WebSocketEvent.MESSAGE, message);
  }

  /**
   * 특정 워크플로우 구독자에게 메시지 전송
   */
  public sendToWorkflowSubscribers(workflowId: string, message: WebSocketMessage): void {
    if (!this.io) return;
    this.io.to(`workflow:${workflowId}`).emit(WebSocketEvent.MESSAGE, message);
  }

  /**
   * 하트비트 시작
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const heartbeatMessage: WebSocketMessage = {
        type: WebSocketMessageType.HEARTBEAT,
        timestamp: new Date().toISOString(),
        payload: {
          serverTime: new Date().toISOString(),
          activeConnections: this.connectedClients.size,
          systemStatus: 'healthy' // TODO: 실제 시스템 상태 확인
        },
        metadata: {
          messageId: uuidv4(),
          priority: MessagePriority.LOW,
          version: '1.0.0'
        }
      };
      
      this.broadcast(heartbeatMessage);
    }, 30000); // 30초마다
  }

  /**
   * Kafka 이벤트 구독
   */
  private subscribeToKafkaEvents(): void {
    if (!this.kafkaManager) return;

    // device-events 구독
    this.kafkaManager.subscribe('device-events', (event) => {
      const message: WebSocketMessage = {
        type: WebSocketMessageType.DEVICE_STATUS,
        timestamp: event.timestamp,
        payload: event.payload,
        metadata: {
          messageId: event.eventId,
          correlationId: event.metadata?.correlationId,
          version: '1.0.0'
        }
      };
      
      if (event.deviceId) {
        this.sendToDeviceSubscribers(event.deviceId, message);
      }
    });

    // workflow-events 구독
    this.kafkaManager.subscribe('workflow-events', (event) => {
      const message: WebSocketMessage = {
        type: WebSocketMessageType.WORKFLOW_PROGRESS,
        timestamp: event.timestamp,
        payload: event.payload,
        metadata: {
          messageId: event.eventId,
          correlationId: event.metadata?.correlationId,
          version: '1.0.0'
        }
      };
      
      if (event.executionId) {
        this.sendToWorkflowSubscribers(event.workflowId, message);
      }
    });
  }

  /**
   * 정리
   */
  public async cleanup(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    if (!this.io) return;
    
    // 모든 클라이언트 연결 해제
    this.io.disconnectSockets();
    
    // 서버 닫기
    await new Promise<void>((resolve) => {
      this.io!.close(() => {
        this.logger.info('WebSocket 서버 종료');
        resolve();
      });
    });
  }
}
