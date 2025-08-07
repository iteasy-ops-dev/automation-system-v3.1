/**
 * MCP Transport Layer 표준 구현
 * Model Context Protocol 완전 준수
 * JSON-RPC 2.0 프로토콜 기반
 */

import { MCPServer, JsonRpcRequest, JsonRpcResponse, MCPConnectionError } from '../types';
import { Logger } from '../utils/logger';

export abstract class BaseMCPTransport {
  protected server: MCPServer;
  protected logger: Logger;
  protected connected: boolean = false;
  protected lastError: string | null = null;

  constructor(server: MCPServer) {
    this.server = server;
    this.logger = Logger.getInstance();
  }

  /**
   * MCP 서버 연결 수립
   */
  abstract connect(): Promise<void>;

  /**
   * MCP 서버 연결 종료
   */
  abstract disconnect(): Promise<void>;

  /**
   * JSON-RPC 2.0 요청 전송
   */
  abstract send(request: JsonRpcRequest): Promise<JsonRpcResponse>;

  /**
   * 연결 상태 확인
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 마지막 에러 반환
   */
  getLastError(): string | null {
    return this.lastError;
  }

  /**
   * MCP 초기화 핸드셰이크 수행
   */
  protected async performHandshake(): Promise<void> {
    try {
      const initRequest: JsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: true,
            resources: true,
            prompts: true,
            logging: true
          },
          clientInfo: {
            name: 'automation-system-mcp-integration',
            version: '1.0.0'
          }
        },
        id: 1
      };

      const response = await this.send(initRequest);
      
      if (response.error) {
        throw new MCPConnectionError(
          `Handshake failed: ${response.error.message}`,
          response.error
        );
      }

      this.logger.info(`MCP handshake completed for server ${this.server.name}`, {
        serverId: this.server.id,
        serverInfo: response.result
      });

    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Unknown handshake error';
      throw new MCPConnectionError(`Failed to complete MCP handshake: ${this.lastError}`);
    }
  }

  /**
   * JSON-RPC 응답 검증
   */
  protected validateJsonRpcResponse(response: any): JsonRpcResponse {
    if (!response || typeof response !== 'object') {
      throw new MCPConnectionError('Invalid response: not an object');
    }

    if (response.jsonrpc !== '2.0') {
      throw new MCPConnectionError('Invalid response: missing or invalid jsonrpc version');
    }

    if (!('result' in response) && !('error' in response)) {
      throw new MCPConnectionError('Invalid response: missing result or error');
    }

    return response as JsonRpcResponse;
  }

  /**
   * JSON-RPC 요청 ID 생성
   */
  protected generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 에러 로깅
   */
  protected logError(context: string, error: any): void {
    this.lastError = error instanceof Error ? error.message : String(error);
    this.logger.error(`MCP Transport Error [${context}]`, {
      serverId: this.server.id,
      serverName: this.server.name,
      transport: this.server.transport,
      error: this.lastError
    });
  }
}