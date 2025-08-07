/**
 * MCP Connection Pool Service
 * Transport 연결 관리 및 재사용
 */

import { EventEmitter } from 'events';
import { 
  MCPConnection, 
  MCPConnectionStatus,
  MCPServer,
  MCPConnectionError
} from '../types';
import { BaseMCPTransport, MCPTransportFactory } from '../transport';
import { MCPServerRepository } from '../repositories';

interface ConnectionPoolOptions {
  maxIdleTime?: number;
  healthCheckInterval?: number;
  maxRetries?: number;
}

export class MCPConnectionPool extends EventEmitter {
  private connections: Map<string, {
    transport: BaseMCPTransport;
    lastActivity: Date;
    retryCount: number;
  }> = new Map();
  
  private healthCheckTimer?: NodeJS.Timeout;
  private options: Required<ConnectionPoolOptions>;
  private serverRepository: MCPServerRepository;

  constructor(
    serverRepository: MCPServerRepository,
    options: ConnectionPoolOptions = {}
  ) {
    super();
    this.serverRepository = serverRepository;
    this.options = {
      maxIdleTime: options.maxIdleTime || 300000, // 5분
      healthCheckInterval: options.healthCheckInterval || 60000, // 1분
      maxRetries: options.maxRetries || 3
    };
  }

  /**
   * 연결 풀 시작
   */
  start(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.options.healthCheckInterval);
  }

  /**
   * 연결 풀 종료
   */
  async stop(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = undefined;
    }

    // 모든 연결 종료
    const disconnectPromises = Array.from(this.connections.values()).map(
      conn => conn.transport.disconnect()
    );
    await Promise.all(disconnectPromises);
    
    this.connections.clear();
  }

  /**
   * 서버 연결 획득
   */
  async getConnection(serverId: string): Promise<BaseMCPTransport> {
    // 기존 연결 확인
    const existing = this.connections.get(serverId);
    if (existing && existing.transport.getStatus() === 'connected') {
      existing.lastActivity = new Date();
      return existing.transport;
    }

    // 서버 정보 조회
    const server = await this.serverRepository.findById(serverId);
    if (!server) {
      throw new MCPConnectionError(`Server ${serverId} not found`);
    }

    // 새 연결 생성
    return await this.createConnection(server);
  }

  /**
   * 새 연결 생성
   */
  private async createConnection(server: MCPServer): Promise<BaseMCPTransport> {
    const transport = MCPTransportFactory.createTransport(server);
    
    // 이벤트 핸들러 설정
    transport.on('statusChanged', (status: MCPConnectionStatus) => {
      this.handleStatusChange(server.id, status);
    });

    transport.on('disconnected', () => {
      this.handleDisconnect(server.id);
    });

    try {
      await transport.connect();
      
      // 연결 성공
      this.connections.set(server.id, {
        transport,
        lastActivity: new Date(),
        retryCount: 0
      });

      // DB 상태 업데이트
      await this.serverRepository.updateConnectionStatus(
        server.id,
        'connected',
        transport.getServerInfo()
      );

      this.emit('connected', server.id);
      return transport;
    } catch (error) {
      // 연결 실패
      await this.serverRepository.updateConnectionStatus(
        server.id,
        'error',
        undefined,
        error instanceof Error ? error.message : 'Connection failed'
      );

      throw new MCPConnectionError(
        `Failed to connect to server ${server.id}: ${error}`,
        { serverId: server.id, error }
      );
    }
  }

  /**
   * 상태 변경 처리
   */
  private async handleStatusChange(
    serverId: string,
    status: MCPConnectionStatus
  ): Promise<void> {
    await this.serverRepository.updateConnectionStatus(serverId, status);
    this.emit('statusChanged', serverId, status);
  }

  /**
   * 연결 해제 처리
   */
  private handleDisconnect(serverId: string): void {
    const connection = this.connections.get(serverId);
    if (connection) {
      connection.retryCount++;
      
      if (connection.retryCount >= this.options.maxRetries) {
        // 최대 재시도 횟수 초과
        this.connections.delete(serverId);
        this.emit('connectionLost', serverId);
      } else {
        // 재연결 시도
        setTimeout(() => {
          this.reconnect(serverId);
        }, Math.min(1000 * Math.pow(2, connection.retryCount), 30000));
      }
    }
  }

  /**
   * 재연결 시도
   */
  private async reconnect(serverId: string): Promise<void> {
    try {
      const server = await this.serverRepository.findById(serverId);
      if (server && server.status === 'active') {
        await this.createConnection(server);
      }
    } catch (error) {
      console.error(`Reconnection failed for ${serverId}:`, error);
    }
  }

  /**
   * 헬스 체크 수행
   */
  private async performHealthCheck(): Promise<void> {
    const now = new Date();
    const toRemove: string[] = [];

    for (const [serverId, connection] of this.connections) {
      // 유휴 연결 확인
      const idleTime = now.getTime() - connection.lastActivity.getTime();
      if (idleTime > this.options.maxIdleTime) {
        toRemove.push(serverId);
      }
    }

    // 유휴 연결 제거
    for (const serverId of toRemove) {
      const connection = this.connections.get(serverId);
      if (connection) {
        await connection.transport.disconnect();
        this.connections.delete(serverId);
        this.emit('connectionClosed', serverId, 'idle');
      }
    }
  }

  /**
   * 연결 상태 조회
   */
  getConnectionStatus(): MCPConnection[] {
    const status: MCPConnection[] = [];
    
    for (const [serverId, connection] of this.connections) {
      status.push({
        serverId,
        transport: connection.transport.type,
        status: connection.transport.getStatus(),
        lastActivity: connection.lastActivity,
        serverInfo: connection.transport.getServerInfo()
      });
    }

    return status;
  }
}
