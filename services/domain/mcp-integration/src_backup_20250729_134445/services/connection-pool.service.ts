/**
 * MCP Connection Pool - MCP Integration Service
 * MCP 서버 연결 풀 관리 및 부하 분산
 */

import { Logger } from '../utils/logger';
import { JsonRpcClient } from './json-rpc-client.service';
import { MCPConnection, MCPConnectionPool, MCPServer } from '../types';
import { EventBusService } from './event-bus.service';

export interface ConnectionPoolOptions {
  maxConnections?: number;
  connectionTimeout?: number;
  healthCheckInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class MCPConnectionPoolService implements MCPConnectionPool {
  public maxConnections: number;
  public activeConnections: Map<string, MCPConnection>;
  
  private logger: Logger;
  private eventBus: EventBusService;
  private clients: Map<string, JsonRpcClient>;
  private options: Required<ConnectionPoolOptions>;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(eventBus: EventBusService, options: ConnectionPoolOptions = {}) {
    this.logger = new Logger('mcp-connection-pool');
    this.eventBus = eventBus;
    
    this.options = {
      maxConnections: options.maxConnections || 50,
      connectionTimeout: options.connectionTimeout || 30000,
      healthCheckInterval: options.healthCheckInterval || 60000, // 1분
      maxRetries: options.maxRetries || 3,
      retryDelay: options.retryDelay || 1000
    };

    this.maxConnections = this.options.maxConnections;
    this.activeConnections = new Map();
    this.clients = new Map();

    this.startHealthCheck();
  }

  /**
   * MCP 서버에 연결
   */
  async connect(serverId: string, server?: MCPServer): Promise<MCPConnection> {
    if (this.activeConnections.has(serverId)) {
      const existing = this.activeConnections.get(serverId)!;
      existing.lastUsed = new Date();
      return existing;
    }

    if (this.activeConnections.size >= this.maxConnections) {
      await this.evictOldestConnection();
    }

    try {
      const connection = await this.createConnection(serverId, server);
      this.activeConnections.set(serverId, connection);
      
      this.logger.logMCPOperation('연결 설정', serverId);
      await this.eventBus.publishServerConnectionEstablished(serverId);
      
      return connection;
    } catch (error) {
      this.logger.error(`Failed to connect to MCP server ${serverId}:`, error);
      await this.eventBus.publishServerConnectionLost(serverId, error.message);
      throw error;
    }
  }

  /**
   * MCP 서버 연결 해제
   */
  async disconnect(serverId: string): Promise<void> {
    const connection = this.activeConnections.get(serverId);
    
    if (connection) {
      this.activeConnections.delete(serverId);
      this.clients.delete(serverId);
      
      this.logger.logMCPOperation('연결 해제', serverId);
      await this.eventBus.publishServerConnectionLost(serverId, 'Manual disconnect');
    }
  }

  /**
   * 연결 상태 조회
   */
  getConnection(serverId: string): MCPConnection | null {
    return this.activeConnections.get(serverId) || null;
  }

  /**
   * JSON-RPC 클라이언트 조회
   */
  getClient(serverId: string): JsonRpcClient | null {
    return this.clients.get(serverId) || null;
  }

  /**
   * 서버에 도구 실행 요청
   */
  async executeOnServer(
    serverId: string, 
    toolName: string, 
    params: Record<string, any>
  ): Promise<any> {
    const client = this.getClient(serverId);
    const connection = this.getConnection(serverId);
    
    if (!client || !connection) {
      throw new Error(`No active connection to server: ${serverId}`);
    }

    if (connection.status !== 'connected') {
      throw new Error(`Server ${serverId} is not connected (status: ${connection.status})`);
    }

    try {
      connection.lastUsed = new Date();
      const result = await client.executeTool(connection.endpoint, toolName, params);
      
      // 성공 시 에러 카운트 리셋
      connection.errorCount = 0;
      
      return result;
    } catch (error) {
      connection.errorCount++;
      
      // 연속 에러가 많으면 연결 상태를 error로 변경
      if (connection.errorCount >= 3) {
        connection.status = 'error';
        this.logger.warn(`Server ${serverId} marked as error due to repeated failures`);
      }
      
      throw error;
    }
  }

  /**
   * 서버 도구 목록 조회
   */
  async listToolsOnServer(serverId: string): Promise<any[]> {
    const client = this.getClient(serverId);
    const connection = this.getConnection(serverId);
    
    if (!client || !connection) {
      throw new Error(`No active connection to server: ${serverId}`);
    }

    try {
      connection.lastUsed = new Date();
      const tools = await client.listTools(connection.endpoint);
      connection.errorCount = 0;
      return tools;
    } catch (error) {
      connection.errorCount++;
      this.logger.error(`Failed to list tools on server ${serverId}:`, error);
      throw error;
    }
  }

  /**
   * 서버 정보 조회
   */
  async getServerInfo(serverId: string): Promise<any> {
    const client = this.getClient(serverId);
    const connection = this.getConnection(serverId);
    
    if (!client || !connection) {
      throw new Error(`No active connection to server: ${serverId}`);
    }

    try {
      connection.lastUsed = new Date();
      const info = await client.getServerInfo(connection.endpoint);
      connection.errorCount = 0;
      return info;
    } catch (error) {
      connection.errorCount++;
      throw error;
    }
  }

  /**
   * 헬스체크 실행
   */
  async healthCheck(): Promise<void> {
    const checkPromises = Array.from(this.activeConnections.entries()).map(
      async ([serverId, connection]) => {
        try {
          const client = this.clients.get(serverId);
          if (!client) return;

          const isAlive = await client.ping(connection.endpoint);
          
          if (isAlive) {
            if (connection.status !== 'connected') {
              connection.status = 'connected';
              connection.errorCount = 0;
              this.logger.info(`Server ${serverId} health check: OK`);
            }
          } else {
            connection.status = 'error';
            connection.errorCount++;
            this.logger.warn(`Server ${serverId} health check: FAILED`);
          }
        } catch (error) {
          connection.status = 'error';
          connection.errorCount++;
          this.logger.error(`Health check failed for server ${serverId}:`, error);
        }
      }
    );

    await Promise.allSettled(checkPromises);
  }

  /**
   * 연결 통계 조회
   */
  getStats(): {
    totalConnections: number;
    activeConnections: number;
    errorConnections: number;
    connectionsByStatus: Record<string, number>;
  } {
    const connections = Array.from(this.activeConnections.values());
    
    const stats = {
      totalConnections: connections.length,
      activeConnections: connections.filter(c => c.status === 'connected').length,
      errorConnections: connections.filter(c => c.status === 'error').length,
      connectionsByStatus: connections.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    return stats;
  }

  /**
   * 풀 정리
   */
  async cleanup(): Promise<void> {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    // 모든 연결 해제
    const disconnectPromises = Array.from(this.activeConnections.keys()).map(
      serverId => this.disconnect(serverId)
    );

    await Promise.allSettled(disconnectPromises);
    
    this.activeConnections.clear();
    this.clients.clear();
    
    this.logger.info('Connection pool cleaned up');
  }

  // Private methods
  private async createConnection(serverId: string, server?: MCPServer): Promise<MCPConnection> {
    if (!server) {
      throw new Error(`Server configuration not provided for ${serverId}`);
    }

    const client = new JsonRpcClient({
      timeout: this.options.connectionTimeout,
      retries: this.options.maxRetries,
      retryDelay: this.options.retryDelay
    });

    // 연결 테스트
    const isAlive = await client.ping(server.endpointUrl);
    
    if (!isAlive) {
      throw new Error(`Server ${serverId} is not responding`);
    }

    const connection: MCPConnection = {
      serverId,
      endpoint: server.endpointUrl,
      status: 'connected',
      lastUsed: new Date(),
      errorCount: 0
    };

    this.clients.set(serverId, client);
    
    return connection;
  }

  private async evictOldestConnection(): Promise<void> {
    if (this.activeConnections.size === 0) return;

    // 가장 오래된 연결 찾기
    let oldestServerId: string | null = null;
    let oldestTime = Date.now();

    for (const [serverId, connection] of this.activeConnections) {
      if (connection.lastUsed.getTime() < oldestTime) {
        oldestTime = connection.lastUsed.getTime();
        oldestServerId = serverId;
      }
    }

    if (oldestServerId) {
      this.logger.info(`Evicting oldest connection: ${oldestServerId}`);
      await this.disconnect(oldestServerId);
    }
  }

  private startHealthCheck(): void {
    this.healthCheckTimer = setInterval(() => {
      this.healthCheck().catch(error => {
        this.logger.error('Health check failed:', error);
      });
    }, this.options.healthCheckInterval);

    this.logger.info(`Health check started with interval: ${this.options.healthCheckInterval}ms`);
  }
}