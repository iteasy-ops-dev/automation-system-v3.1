/**
 * WebSocket Handler for API Gateway
 * Implements websocket-messages.json contract from shared/contracts/v1.0
 */

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import { createLogger } from '../utils/logger.util';
import { WebSocketMessage, MessageType, ConnectionMetadata } from './websocket.types';
import { JWTPayload } from '../types/gateway.types';

// Socket.IO 타입 확장
interface SocketData {
  user: JWTPayload;
}

interface ServerToClientEvents {
  message: (data: WebSocketMessage) => void;
  subscribed: (data: { channels: string[] }) => void;
  unsubscribed: (data: { channels: string[] }) => void;
}

interface ClientToServerEvents {
  message: (data: any) => void;
  subscribe: (channels: string[]) => void;
  unsubscribe: (channels: string[]) => void;
}

type Socket = import('socket.io').Socket<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;

export class WebSocketHandler {
  private io: SocketIOServer<ClientToServerEvents, ServerToClientEvents, {}, SocketData>;
  private logger = createLogger();
  private redis: Redis;
  private redisPub: Redis;
  private redisSub: Redis;
  private connections = new Map<string, ConnectionMetadata>();
  private heartbeatInterval?: NodeJS.Timeout;
  private jwtService: any; // JWT 서비스는 app.ts에서 주입받음

  constructor(
    server: HTTPServer,
    redisConfig: { host: string; port: number; password?: string },
    jwtService?: any
  ) {
    // Socket.IO 서버 초기화
    this.io = new SocketIOServer(server, {
      path: '/ws',
      cors: {
        origin: true,
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Redis 클라이언트 초기화
    const redisOptions: any = {
      host: redisConfig.host,
      port: redisConfig.port
    };
    
    if (redisConfig.password) {
      redisOptions.password = redisConfig.password;
    }

    this.redis = new Redis(redisOptions);
    this.redisPub = new Redis(redisOptions);
    this.redisSub = new Redis(redisOptions);

    // JWT 서비스 설정
    this.jwtService = jwtService;

    this.setupSocketServer();
    this.setupRedisSubscriptions();
    this.startHeartbeat();
  }

  /**
   * Socket.IO 서버 설정
   */
  private setupSocketServer(): void {
    // 인증 미들웨어
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication required'));
        }

        // JWT 서비스를 사용한 토큰 검증
        let user: JWTPayload;
        try {
          if (this.jwtService) {
            const result = await this.jwtService.verifyToken(token);
            if (!result.valid) {
              return next(new Error('Invalid token'));
            }
            user = {
              sub: result.user.id,
              username: result.user.username,
              email: result.user.email,
              role: result.user.role,
              iat: Date.now() / 1000,
              exp: Date.now() / 1000 + 3600,
              jti: 'ws-jwt-id'
            } as JWTPayload;
          } else {
            // JWT 서비스가 없으면 개발 모드로 간주
            user = {
              sub: 'dev-user',
              username: 'developer',
              email: 'dev@automation.com',
              role: 'administrator',
              iat: Date.now() / 1000,
              exp: Date.now() / 1000 + 3600,
              jti: 'dev-jwt-id'
            };
          }
        } catch (error) {
          return next(new Error('Token verification failed'));
        }
        
        socket.data.user = user;
        
        this.logger.info('[WebSocket] Client authenticated', { userId: user.sub });
        next();
      } catch (error) {
        this.logger.error('[WebSocket] Authentication failed:', error);
        next(new Error('Invalid token'));
      }
    });

    // 연결 이벤트 처리
    this.io.on('connection', (socket: Socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * 클라이언트 연결 처리
   */
  private handleConnection(socket: Socket): void {
    const userId = socket.data.user.sub;
    const sessionId = socket.id;

    // 연결 메타데이터 저장
    const metadata: ConnectionMetadata = {
      userId,
      sessionId,
      connectedAt: new Date(),
      lastActivity: new Date()
    };
    this.connections.set(sessionId, metadata);

    // 사용자별 룸 참가
    socket.join(`user:${userId}`);
    
    this.logger.info('[WebSocket] Client connected', {
      sessionId,
      userId,
      totalConnections: this.connections.size
    });

    // 연결 성공 메시지 전송
    const connectionMessage: WebSocketMessage = {
      type: 'connection_status',
      timestamp: new Date().toISOString(),
      payload: {
        status: 'connected',
        sessionId,
        serverTime: new Date().toISOString()
      },
      metadata: {
        messageId: this.generateMessageId(),
        sessionId,
        userId,
        version: '1.0.0'
      }
    };
    socket.emit('message', connectionMessage);

    // 클라이언트 메시지 처리
    socket.on('message', (data: any) => {
      this.handleClientMessage(socket, data);
    });

    // 구독 요청 처리
    socket.on('subscribe', (channels: string[]) => {
      this.handleSubscribe(socket, channels);
    });

    // 구독 취소 처리
    socket.on('unsubscribe', (channels: string[]) => {
      this.handleUnsubscribe(socket, channels);
    });

    // 연결 종료 처리
    socket.on('disconnect', (reason) => {
      this.handleDisconnect(socket, reason);
    });

    // 에러 처리
    socket.on('error', (error) => {
      this.logger.error('[WebSocket] Socket error:', error);
    });
  }

  /**
   * 클라이언트 메시지 처리
   */
  private handleClientMessage(socket: Socket, data: any): void {
    try {
      const metadata = this.connections.get(socket.id);
      if (metadata) {
        metadata.lastActivity = new Date();
      }

      this.logger.debug('[WebSocket] Client message received', {
        sessionId: socket.id,
        type: data.type
      });

      // 메시지 타입별 처리
      switch (data.type) {
        case 'ping':
          socket.emit('message', {
            type: 'pong',
            timestamp: new Date().toISOString(),
            payload: { timestamp: new Date().toISOString() }
          });
          break;
        
        case 'workflow_action':
          // 워크플로우 액션 처리 (다른 서비스로 전달)
          this.publishToRedis('workflow:actions', {
            ...data,
            userId: socket.data.user.sub,
            sessionId: socket.id
          });
          break;

        case 'device_command':
          // 장비 명령 처리
          this.publishToRedis('device:commands', {
            ...data,
            userId: socket.data.user.sub,
            sessionId: socket.id
          });
          break;

        default:
          this.logger.warn('[WebSocket] Unknown message type', { type: data.type });
      }
    } catch (error) {
      this.logger.error('[WebSocket] Message handling error:', error);
      this.sendError(socket, 'Message processing failed', { originalMessage: data });
    }
  }

  /**
   * 채널 구독 처리
   */
  private handleSubscribe(socket: Socket, channels: string[]): void {
    const userId = socket.data.user.sub;

    channels.forEach(channel => {
      // 권한 검증 (필요시 추가)
      socket.join(channel);
      this.logger.info('[WebSocket] Client subscribed to channel', {
        userId,
        channel
      });
    });

    socket.emit('subscribed', { channels });
  }

  /**
   * 채널 구독 취소 처리
   */
  private handleUnsubscribe(socket: Socket, channels: string[]): void {
    channels.forEach(channel => {
      socket.leave(channel);
    });

    socket.emit('unsubscribed', { channels });
  }

  /**
   * 연결 종료 처리
   */
  private handleDisconnect(socket: Socket, reason: string): void {
    const metadata = this.connections.get(socket.id);
    this.connections.delete(socket.id);

    this.logger.info('[WebSocket] Client disconnected', {
      sessionId: socket.id,
      userId: metadata?.userId,
      reason,
      totalConnections: this.connections.size
    });
  }

  /**
   * Redis 구독 설정
   */
  private setupRedisSubscriptions(): void {
    // 시스템 전체 이벤트 구독
    this.redisSub.subscribe(
      'system:alerts',
      'workflow:updates',
      'device:status',
      'metrics:updates',
      'chat:responses'
    );

    // Redis 메시지 처리
    this.redisSub.on('message', (channel: string, message: string) => {
      try {
        const data = JSON.parse(message);
        this.handleRedisMessage(channel, data);
      } catch (error) {
        this.logger.error('[WebSocket] Redis message parsing error:', error);
      }
    });
  }

  /**
   * Redis 메시지 처리 및 브로드캐스트
   */
  private handleRedisMessage(channel: string, data: any): void {
    const messageType = this.getMessageTypeFromChannel(channel);
    
    const message: WebSocketMessage = {
      type: messageType,
      timestamp: new Date().toISOString(),
      payload: data.payload || data,
      metadata: {
        messageId: this.generateMessageId(),
        correlationId: data.correlationId,
        version: '1.0.0'
      }
    };

    // 타겟별 메시지 전송
    if (data.userId) {
      // 특정 사용자에게만 전송
      this.io.to(`user:${data.userId}`).emit('message', message);
    } else if (data.sessionId) {
      // 특정 세션에만 전송
      this.io.to(data.sessionId).emit('message', message);
    } else if (data.channel) {
      // 특정 채널 구독자에게 전송
      this.io.to(data.channel).emit('message', message);
    } else {
      // 전체 브로드캐스트
      this.io.emit('message', message);
    }

    this.logger.debug('[WebSocket] Message broadcasted', {
      type: messageType,
      targets: data.userId || data.sessionId || data.channel || 'all'
    });
  }

  /**
   * 채널명에서 메시지 타입 추출
   */
  private getMessageTypeFromChannel(channel: string): MessageType {
    const typeMap: Record<string, MessageType> = {
      'system:alerts': 'alert',
      'workflow:updates': 'execution_update',
      'device:status': 'device_status',
      'metrics:updates': 'metric_update',
      'chat:responses': 'chat_response'
    };

    return typeMap[channel] || 'error';
  }

  /**
   * Redis에 메시지 발행
   */
  private publishToRedis(channel: string, data: any): void {
    this.redisPub.publish(channel, JSON.stringify(data));
  }

  /**
   * 에러 메시지 전송
   */
  private sendError(socket: Socket, message: string, details?: any): void {
    const errorMessage: WebSocketMessage = {
      type: 'error',
      timestamp: new Date().toISOString(),
      payload: {
        errorId: this.generateMessageId(),
        message,
        details,
        recoverable: true,
        retryable: false
      },
      metadata: {
        messageId: this.generateMessageId(),
        sessionId: socket.id,
        userId: socket.data.user?.sub,
        version: '1.0.0'
      }
    };

    socket.emit('message', errorMessage);
  }

  /**
   * 주기적인 하트비트 전송
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const heartbeatMessage: WebSocketMessage = {
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
        payload: {
          serverTime: new Date().toISOString(),
          activeConnections: this.connections.size,
          systemStatus: 'healthy'
        },
        metadata: {
          messageId: this.generateMessageId(),
          version: '1.0.0'
        }
      };

      this.io.emit('message', heartbeatMessage);
    }, 30000); // 30초마다
  }

  /**
   * 특정 사용자에게 메시지 전송
   */
  public sendToUser(userId: string, message: WebSocketMessage): void {
    this.io.to(`user:${userId}`).emit('message', message);
  }

  /**
   * 특정 세션에 메시지 전송
   */
  public sendToSession(sessionId: string, message: WebSocketMessage): void {
    this.io.to(sessionId).emit('message', message);
  }

  /**
   * 채널에 메시지 브로드캐스트
   */
  public broadcast(channel: string, message: WebSocketMessage): void {
    this.io.to(channel).emit('message', message);
  }

  /**
   * 메시지 ID 생성
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 정리 작업
   */
  public async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // 모든 연결 종료
    this.io.disconnectSockets(true);

    // Redis 연결 종료
    await Promise.all([
      this.redis.quit(),
      this.redisPub.quit(),
      this.redisSub.quit()
    ]);

    this.logger.info('[WebSocket] Handler shutdown complete');
  }
}
