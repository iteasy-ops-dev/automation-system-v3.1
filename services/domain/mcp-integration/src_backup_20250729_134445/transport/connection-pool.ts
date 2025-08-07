/**
 * MCP Connection Pool 구현
 * Transport 연결 관리 및 재사용
 */

import { MCPServer, MCPConnectionError } from '../types';
import { BaseMCPTransport } from './base-transport';
import { MCPTransportFactory } from './factory';
import { Logger } from '../utils/logger';

export class MCPConnectionPool {
  private connections: Map<string, {
    transport: BaseMCPTransport;
    lastUsed: Date;
    inUse: boolean;
  }> = new Map();
  
  private maxConnections: number;
  private cleanupInterval: NodeJS.Timeout;
  private logger = Logger.getInstance();

  constructor(maxConnections: number = 50) {
    this.maxConnections = maxConnections;
    
    // 5분마다 사용하지 않는 연결 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanupIdleConnections();
    }, 5 * 60 * 1000);
  }

  /**
   * 서버 연결 획득
   */
  async getConnection(server: MCPServer): Promise<BaseMCPTransport> {
    const serverId = server.id;
    
    // 기존 연결 재사용
    if (this.connections.has(serverId)) {
      const connection = this.connections.get(serverId)!;
      
      if (connection.transport.isConnected() && !connection.inUse) {
        connection.inUse = true;
        connection.lastUsed = new Date();
        return connection.transport;
      } else {
        // 연결이 끊어졌거나 사용 중인 경우 제거
        await this.releaseConnection(serverId);
      }
    }

    // 연결 수 제한 확인
    if (this.connections.size >= this.maxConnections) {
      await this.cleanupIdleConnections();
      
      if (this.connections.size >= this.maxConnections) {
        throw new MCPConnectionError('Connection pool exhausted');
      }
    }

    // 새 연결 생성
    const transport = MCPTransportFactory.createTransport(server);
    await transport.connect();

    this.connections.set(serverId, {
      transport,
      lastUsed: new Date(),
      inUse: true
    });

    this.logger.info(`MCP connection established`, {
      serverId,
      serverName: server.name,
      transport: server.transport,
      poolSize: this.connections.size
    });

    return transport;
  }  /**
   * 연결 반환 (풀로 되돌림)
   */
  async releaseConnection(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    
    if (connection) {
      connection.inUse = false;
      connection.lastUsed = new Date();
      
      // 연결이 끊어진 경우 완전 제거
      if (!connection.transport.isConnected()) {
        await connection.transport.disconnect();
        this.connections.delete(serverId);
        
        this.logger.info(`MCP connection removed from pool`, {
          serverId,
          reason: 'disconnected'
        });
      }
    }
  }

  /**
   * 특정 서버 연결 제거
   */
  async removeConnection(serverId: string): Promise<void> {
    const connection = this.connections.get(serverId);
    
    if (connection) {
      await connection.transport.disconnect();
      this.connections.delete(serverId);
      
      this.logger.info(`MCP connection removed from pool`, {
        serverId,
        reason: 'manual'
      });
    }
  }

  /**
   * 유휴 연결 정리
   */
  private async cleanupIdleConnections(): Promise<void> {
    const now = new Date();
    const idleTimeout = 30 * 60 * 1000; // 30분
    
    const toRemove: string[] = [];
    
    for (const [serverId, connection] of this.connections) {
      const idleTime = now.getTime() - connection.lastUsed.getTime();
      
      if (!connection.inUse && idleTime > idleTimeout) {
        toRemove.push(serverId);
      }
    }

    for (const serverId of toRemove) {
      await this.removeConnection(serverId);
    }

    if (toRemove.length > 0) {
      this.logger.info(`Cleaned up ${toRemove.length} idle MCP connections`);
    }
  }

  /**
   * 모든 연결 종료
   */
  async shutdown(): Promise<void> {
    clearInterval(this.cleanupInterval);
    
    const promises: Promise<void>[] = [];
    
    for (const [serverId, connection] of this.connections) {
      promises.push(connection.transport.disconnect());
    }
    
    await Promise.allSettled(promises);
    this.connections.clear();
    
    this.logger.info('MCP connection pool shutdown completed');
  }
}