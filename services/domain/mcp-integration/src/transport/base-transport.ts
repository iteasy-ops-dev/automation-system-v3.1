/**
 * Base MCP Transport 추상 클래스
 * 모든 Transport 구현체의 기본 인터페이스
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcError,
  MCPInitializeRequest,
  MCPInitializeResponse,
  MCPServerInfo,
  MCPConnectionStatus,
  MCPTransportType
} from '../types';

export interface TransportConfig {
  timeout?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

export abstract class BaseMCPTransport extends EventEmitter {
  protected serverId: string;
  protected status: MCPConnectionStatus = 'disconnected';
  protected serverInfo?: MCPServerInfo;
  protected requestTimeout: number;
  protected pendingRequests: Map<string | number, {
    resolve: (response: JsonRpcResponse) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }> = new Map();

  constructor(serverId: string, config: TransportConfig = {}) {
    super();
    this.serverId = serverId;
    this.requestTimeout = config.timeout || 30000;
  }

  abstract get type(): MCPTransportType;
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  protected abstract sendRaw(data: string): Promise<void>;

  getStatus(): MCPConnectionStatus {
    return this.status;
  }

  getServerInfo(): MCPServerInfo | undefined {
    return this.serverInfo;
  }

  /**
   * MCP 표준 초기화 핸드셰이크
   */
  protected async performHandshake(): Promise<MCPServerInfo> {
    const initRequest: MCPInitializeRequest = {
      protocolVersion: '2024-11-05',
      capabilities: {
        experimental: {}
      },
      clientInfo: {
        name: 'mcp-integration-service',
        version: '1.0.0'
      }
    };

    const response = await this.send({
      jsonrpc: '2.0',
      method: 'initialize',
      params: initRequest,
      id: uuidv4()
    });

    if (response.error) {
      throw new Error(`Handshake failed: ${response.error.message}`);
    }

    const initResponse = response.result as MCPInitializeResponse;
    this.serverInfo = initResponse.serverInfo;
    return this.serverInfo;
  }

  /**
   * JSON-RPC 2.0 요청 전송
   */
  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (this.status !== 'connected') {
      throw new Error('Transport is not connected');
    }

    const requestId = request.id || uuidv4();
    const requestWithId = { ...request, id: requestId };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${request.method}`));
      }, this.requestTimeout);

      this.pendingRequests.set(requestId, { resolve, reject, timer });

      this.sendRaw(JSON.stringify(requestWithId)).catch(error => {
        this.pendingRequests.delete(requestId);
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  /**
   * JSON-RPC 응답 처리
   */
  protected handleResponse(data: string): void {
    try {
      const response = JSON.parse(data) as JsonRpcResponse;
      
      if (response.id !== null && response.id !== undefined) {
        const pending = this.pendingRequests.get(response.id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(response.id);
          pending.resolve(response);
        }
      }
      
      // Notification 처리 (id가 null인 경우)
      if (response.id === null) {
        this.emit('notification', response);
      }
    } catch (error) {
      console.error('Failed to parse response:', error);
    }
  }

  /**
   * 에러 응답 생성
   */
  protected createErrorResponse(
    id: string | number | null,
    code: number,
    message: string,
    data?: any
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      error: { code, message, data },
      id
    };
  }

  /**
   * 연결 상태 변경
   */
  protected setStatus(status: MCPConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.emit('statusChanged', status);
    }
  }

  /**
   * 정리 작업
   */
  protected cleanup(): void {
    // 대기 중인 요청들 정리
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Transport disconnected'));
    }
    this.pendingRequests.clear();
  }
}
