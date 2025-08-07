/**
 * MCP HTTP Transport 구현
 * HTTP/WebSocket 기반 MCP 통신
 */

import { BaseMCPTransport } from './base-transport';
import { JsonRpcRequest, JsonRpcResponse, MCPConnectionError } from '../types';
import axios, { AxiosInstance } from 'axios';

export class HTTPTransport extends BaseMCPTransport {
  private httpClient: AxiosInstance | null = null;

  async connect(): Promise<void> {
    try {
      if (!this.server.httpConfig) {
        throw new MCPConnectionError('HTTP transport requires httpConfig');
      }

      this.httpClient = axios.create({
        baseURL: this.server.httpConfig.url,
        headers: {
          'Content-Type': 'application/json',
          ...this.server.httpConfig.headers
        },
        timeout: 30000
      });

      // 연결 테스트
      await this.performHandshake();
      
      this.connected = true;
      this.logger.info(`HTTP transport connected: ${this.server.name}`, {
        serverId: this.server.id,
        url: this.server.httpConfig.url
      });

    } catch (error) {
      this.logError('connect', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.httpClient = null;
  }

  async send(request: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.httpClient || !this.connected) {
      throw new MCPConnectionError('HTTP transport not connected');
    }

    try {
      const response = await this.httpClient.post('/', request);
      return this.validateJsonRpcResponse(response.data);
    } catch (error) {
      this.logError('send', error);
      throw new MCPConnectionError(`HTTP request failed: ${error}`);
    }
  }
}